"""
Restaura o ciclo oficial Maio/2026 do Comissionamento.

Fontes:
- backup JSON gerado na remocao dos ciclos nao-2026-06;
- planilha historica de coordenadores/gerentes para detalhar Regra 01/IPs;
- Maquina de Vendas no Postgres para identidade e hierarquia.

O script e idempotente e recria apenas o ciclo 2026-05.
"""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata
import uuid
import zipfile
from xml.etree import ElementTree as ET
from typing import Any

BASE_API = Path(__file__).resolve().parents[1]
PORTAL_ROOT = BASE_API.parents[1]
if str(BASE_API) not in sys.path:
    sys.path.insert(0, str(BASE_API))

from banco import encerrar_pool_de_conexoes, iniciar_pool_de_conexoes  # noqa: E402
from configuracoes import ESQUEMA_COMISSIONAMENTO  # noqa: E402


CICLO_ID = "2026-05"
AGENTE_IMPORTADOR = "restaurar_ciclo_maio_2026.py"
BACKUP_PADRAO = (
    PORTAL_ROOT
    / "03_registros"
    / "comissionamento"
    / "backups"
    / "backup_comissionamento_remocao_ciclos_nao_2026_06_20260615_174304.json"
)
PLANILHA_PADRAO = Path("/root/data-engineering/apps/commercial-dashboard/Comissionamento - COORDENADORES - GERENTES.xlsx")
REGISTRO_SAIDA = PORTAL_ROOT / "03_registros" / "comissionamento" / "execucoes"

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

MESES_CHAVE = ("maio", "abril", "marco", "março", "fevereiro", "janeiro")

APELIDOS_IDENTIDADE = {
    "ROBSON": "Robson Ferreira Paulo",
    "FRANCISCO": "Francisco Lucielio De Queiroz",
    "JOSUE": "Josué Gomes De Souza",
    "JOSUÉ": "Josué Gomes De Souza",
    "ANA CLEIA": "Ana Cleia Nonato",
    "THOMAZ": "Thomaz Moreira Aquino",
    "JORDAN": "Jordan Vasconcelos",
    "RAFAEL": "Rafael De Lucena Martins",
    "ALANA": "Alana Rabelo Da Costa",
    "DAIANA": "Daiana Soares Da Rocha",
    "TAVEIRA": "Marco Taveira",
    "GEISI": "Geisiane Gomes Dos Santos",
    "BRUNO": "Bruno Macario",
    "LUIZ": "Luiz Aquino",
}

APELIDOS_ABAS = {
    "BRUNO": "MACÁRIO",
    "LUIZ": "Luiz - Gerente 1",
}

FAIXAS_PADRAO = (
    ("0% a 39,99%", Decimal("0"), Decimal("39.99")),
    ("40% a 59,99%", Decimal("40"), Decimal("59.99")),
    ("60% a 79,99%", Decimal("60"), Decimal("79.99")),
    ("80% a 94,99%", Decimal("80"), Decimal("94.99")),
    ("95% a 104,99%", Decimal("95"), Decimal("104.99")),
    ("105% a 109,99%", Decimal("105"), Decimal("109.99")),
    ("110% a 114,99%", Decimal("110"), Decimal("114.99")),
    ("115% a 119,99%", Decimal("115"), Decimal("119.99")),
    ("120% a 129,99%", Decimal("120"), Decimal("129.99")),
    ("130% a 139,99%", Decimal("130"), Decimal("139.99")),
    ("+ que 140%", Decimal("140"), None),
)


def _normalizar_texto(valor: Any) -> str:
    texto = str(valor or "").strip()
    texto = "".join(
        caractere
        for caractere in unicodedata.normalize("NFD", texto)
        if unicodedata.category(caractere) != "Mn"
    )
    return " ".join(texto.lower().split())


def _documento(valor: Any) -> str:
    return "".join(ch for ch in str(valor or "") if ch.isdigit())


def _email(valor: Any) -> str:
    return str(valor or "").strip().lower()


def _decimal(valor: Any) -> Decimal:
    if valor in (None, ""):
        return Decimal("0")
    texto = str(valor).strip().replace("R$", "").replace(" ", "")
    if "," in texto and "." in texto:
        texto = texto.replace(".", "").replace(",", ".")
    elif "," in texto:
        texto = texto.replace(",", ".")
    try:
        return Decimal(texto)
    except Exception:
        return Decimal("0")


def _moeda(valor: Any) -> Decimal:
    return _decimal(valor).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _json_default(valor: Any) -> Any:
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, (date,)):
        return valor.isoformat()
    if isinstance(valor, uuid.UUID):
        return str(valor)
    return str(valor)


def _md5_curto(valor: str) -> str:
    return hashlib.md5(valor.encode("utf-8")).hexdigest()[:12]


def _papel_por_funcao(funcao: str) -> str:
    texto = _normalizar_texto(funcao)
    return "coordenador" if "coord" in texto else "gestor"


def _faixa_por_percentual(percentual: Decimal) -> str:
    percentual_100 = percentual * Decimal("100") if percentual <= Decimal("10") else percentual
    for rotulo, minimo, maximo in FAIXAS_PADRAO:
        if percentual_100 >= minimo and (maximo is None or percentual_100 <= maximo):
            return rotulo
    return "Consolidado Maio/2026"


@dataclass
class AbaExcel:
    nome: str
    linhas: dict[int, dict[str, Any]]


class LeitorXlsx:
    def __init__(self, caminho: Path) -> None:
        self.caminho = caminho
        self._abas: dict[str, AbaExcel] = {}
        self._carregar()

    def _carregar_shared_strings(self, arquivo: zipfile.ZipFile) -> list[str]:
        raiz = ET.fromstring(arquivo.read("xl/sharedStrings.xml"))
        valores: list[str] = []
        for item in raiz.findall("m:si", NS):
            valores.append("".join(t.text or "" for t in item.findall(".//m:t", NS)))
        return valores

    def _carregar(self) -> None:
        with zipfile.ZipFile(self.caminho) as arquivo:
            shared = self._carregar_shared_strings(arquivo)
            workbook = ET.fromstring(arquivo.read("xl/workbook.xml"))
            rels = ET.fromstring(arquivo.read("xl/_rels/workbook.xml.rels"))
            relmap = {rel.attrib["Id"]: "xl/" + rel.attrib["Target"] for rel in rels}
            for sheet in workbook.find("m:sheets", NS):
                nome = sheet.attrib["name"]
                rel_id = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
                alvo = relmap[rel_id]
                self._abas[nome] = AbaExcel(nome=nome, linhas=self._linhas_aba(arquivo, alvo, shared))

    def _linhas_aba(self, arquivo: zipfile.ZipFile, alvo: str, shared: list[str]) -> dict[int, dict[str, Any]]:
        raiz = ET.fromstring(arquivo.read(alvo))
        linhas: dict[int, dict[str, Any]] = {}
        for row in raiz.findall(".//m:row", NS):
            numero = int(row.attrib.get("r", "0"))
            valores: dict[str, Any] = {}
            for cell in row.findall("m:c", NS):
                ref = cell.attrib.get("r", "")
                coluna = "".join(ch for ch in ref if ch.isalpha())
                tipo = cell.attrib.get("t")
                valor_xml = cell.find("m:v", NS)
                if not coluna or valor_xml is None:
                    continue
                bruto = valor_xml.text or ""
                valor = shared[int(bruto)] if tipo == "s" and bruto.isdigit() else bruto
                valores[coluna] = valor
            if valores:
                linhas[numero] = valores
        return linhas

    def aba_por_nome(self, nome: str) -> AbaExcel | None:
        chave = _normalizar_texto(nome)
        for aba_nome, aba in self._abas.items():
            if _normalizar_texto(aba_nome) == chave:
                return aba
        for aba_nome, aba in self._abas.items():
            if chave and chave in _normalizar_texto(aba_nome):
                return aba
        return None


def _carregar_backup(caminho: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    dados = json.loads(caminho.read_text(encoding="utf-8"))
    tabelas = dados.get("tabelas") or {}
    ciclo = next(item for item in tabelas.get("ciclos", []) if item.get("ciclo_id") == CICLO_ID)
    resultados = [item for item in tabelas.get("resultados", []) if item.get("ciclo_id") == CICLO_ID]
    return ciclo, sorted(resultados, key=lambda item: item.get("resultado_id") or item.get("nome") or "")


def _celula(linhas: dict[int, dict[str, Any]], numero: int, coluna: str) -> Any:
    return (linhas.get(numero) or {}).get(coluna)


def _encontrar_bloco_maio(aba: AbaExcel | None) -> tuple[int, int] | None:
    if not aba:
        return None
    inicios: list[tuple[int, str]] = []
    for numero, linha in sorted(aba.linhas.items()):
        texto = _normalizar_texto(linha.get("A"))
        if any(mes in texto for mes in MESES_CHAVE):
            inicios.append((numero, texto))
    for indice, (inicio, texto) in enumerate(inicios):
        if "maio" in texto:
            fim = inicios[indice + 1][0] if indice + 1 < len(inicios) else max(aba.linhas) + 1
            return inicio, fim
    return None


def _faixas_do_bloco(aba: AbaExcel, inicio: int, fim: int) -> list[dict[str, Any]]:
    faixas: list[dict[str, Any]] = []
    for numero in range(inicio, fim):
        rotulo = str(_celula(aba.linhas, numero, "B") or "").strip()
        if not rotulo:
            continue
        rotulo_norm = _normalizar_texto(rotulo)
        if "%" not in rotulo and "+ que" not in rotulo_norm:
            continue
        valor = _moeda(_celula(aba.linhas, numero, "C"))
        minimo = None
        maximo = None
        for padrao, min_padrao, max_padrao in FAIXAS_PADRAO:
            if _normalizar_texto(padrao) == rotulo_norm:
                minimo = min_padrao
                maximo = max_padrao
                break
        faixas.append(
            {
                "id": f"faixa_{len(faixas) + 1}",
                "rotulo": rotulo,
                "percentual_minimo": float(minimo) if minimo is not None else None,
                "percentual_maximo": float(maximo) if maximo is not None else None,
                "valor_bonus": float(valor),
                "valor_faixa": float(valor),
                "ativa": False,
            }
        )
    return faixas


def _metas_do_bloco(aba: AbaExcel, inicio: int, fim: int) -> list[dict[str, Any]]:
    metas: list[dict[str, Any]] = []
    for numero in range(inicio, fim):
        marcador = str(_celula(aba.linhas, numero, "B") or "").strip()
        if not _normalizar_texto(marcador).startswith("meta"):
            continue
        detalhe = numero + 1
        objetivo = _decimal(_celula(aba.linhas, detalhe, "B"))
        realizado = _decimal(_celula(aba.linhas, detalhe, "C"))
        percentual = _decimal(_celula(aba.linhas, detalhe, "D"))
        valor = _moeda(_celula(aba.linhas, detalhe, "E"))
        if objetivo <= 0 and realizado <= 0 and valor <= 0:
            continue
        metas.append(
            {
                "id": f"meta_{len(metas) + 1}",
                "nome": marcador,
                "indicador": "vendas" if len(metas) == 0 else "vendas_complementar",
                "objetivo": float(objetivo),
                "realizado": float(realizado),
                "percentual_atingimento": float((percentual * Decimal("100")) if percentual <= Decimal("10") else percentual),
                "valor_calculado": float(valor),
                "faixa_aplicada": _faixa_por_percentual(percentual),
            }
        )
    return metas


def _ips_do_bloco(aba: AbaExcel, inicio: int, fim: int) -> list[dict[str, Any]]:
    ips: list[dict[str, Any]] = []
    for numero in range(inicio, fim):
        marcador = str(_celula(aba.linhas, numero, "B") or "").strip()
        if not _normalizar_texto(marcador).startswith("ip"):
            continue
        detalhe = numero + 1
        atingiu_texto = _normalizar_texto(_celula(aba.linhas, detalhe, "C"))
        valor = _moeda(_celula(aba.linhas, detalhe, "D"))
        nome = str(_celula(aba.linhas, numero, "A") or marcador).strip()
        atingiu = atingiu_texto in {"sim", "s", "yes", "true"}
        ips.append(
            {
                "ip_id": f"maio-2026-ip-{len(ips) + 1}",
                "nome": nome,
                "indicador": "ip_maio_2026",
                "tipo_comissao": "numero",
                "operador": ">=",
                "alvo": 1,
                "realizado": 1 if atingiu else 0,
                "atingiu": atingiu,
                "valor_bonus": float(valor),
                "data_inicial": "2026-05-01",
                "data_fim": "2026-05-31",
                "periodo_corte": "2026-05",
                "fonte_realizado": "excel_maio_2026",
            }
        )
    return ips


def _detalhe_excel(leitor: LeitorXlsx, nome_seed: str, valor_final: Decimal, distrato: Decimal) -> dict[str, Any]:
    aba_nome = APELIDOS_ABAS.get(nome_seed.upper(), nome_seed)
    aba = leitor.aba_por_nome(aba_nome)
    bloco = _encontrar_bloco_maio(aba)
    if not aba or not bloco:
        regra_valor = valor_final + distrato
        return {
            "origem": "base_consolidada_sem_aba_maio",
            "aba": aba.nome if aba else None,
            "regra_total": regra_valor,
            "bonus_ips": Decimal("0"),
            "faixas": [],
            "metas": [],
            "ips": [],
            "observacoes": ["Aba individual sem bloco Maio/2026; valor importado da base consolidada."],
        }

    inicio, fim = bloco
    faixas = _faixas_do_bloco(aba, inicio, fim)
    metas = _metas_do_bloco(aba, inicio, fim)
    ips = _ips_do_bloco(aba, inicio, fim)
    bonus_ips = sum(_moeda(ip.get("valor_bonus")) for ip in ips)
    regra_total = sum(_moeda(meta.get("valor_calculado")) for meta in metas)
    esperado_regra = valor_final + distrato - bonus_ips
    observacoes: list[str] = []
    if not metas:
        regra_total = esperado_regra
        observacoes.append("Bloco Maio/2026 sem metas detectadas; Regra 01 calculada pelo valor final menos IPs.")
    elif abs(regra_total - esperado_regra) > Decimal("0.01"):
        observacoes.append(
            f"Regra 01 ajustada para preservar valor final: excel={regra_total} esperado={esperado_regra}."
        )
        regra_total = esperado_regra

    return {
        "origem": "excel_aba_individual_maio",
        "aba": aba.nome,
        "linha_inicio": inicio,
        "linha_fim": fim - 1,
        "regra_total": regra_total,
        "bonus_ips": bonus_ips,
        "faixas": faixas,
        "metas": metas,
        "ips": ips,
        "observacoes": observacoes,
    }


async def _identidades(conexao) -> dict[str, dict[str, dict[str, Any]]]:
    resultados_2026_06 = [
        dict(linha)
        for linha in await conexao.fetch(
            f"""
            select
                nome,
                identificador_usuario::text as identificador_usuario,
                identificador_funcionario::text as identificador_funcionario,
                documento,
                email,
                cargo,
                perfil_acesso,
                papel_comissionamento,
                origem_identidade
            from {ESQUEMA_COMISSIONAMENTO}.resultados
            where ciclo_id = '2026-06'
            """
        )
    ]
    snapshot_2026_06 = [
        dict(linha)
        for linha in await conexao.fetch(
            f"""
            select distinct
                comissionado_nome as nome,
                comissionado_usuario_id::text as identificador_usuario,
                comissionado_funcionario_id::text as identificador_funcionario,
                comissionado_documento as documento,
                comissionado_email as email,
                comissionado_cargo as cargo,
                comissionado_perfil as perfil_acesso,
                papel as papel_comissionamento,
                comissionado_origem_identidade as origem_identidade
            from {ESQUEMA_COMISSIONAMENTO}.hierarquia_snapshot
            where ciclo_id = '2026-06'
            """
        )
    ]
    funcionarios = [
        dict(linha)
        for linha in await conexao.fetch(
            """
            select
                nome,
                identificador_usuario::text as identificador_usuario,
                identificador_funcionario::text as identificador_funcionario,
                documento,
                email::text as email,
                cargo,
                perfil_acesso_padrao as perfil_acesso,
                null::text as papel_comissionamento,
                'funcionario_acesso' as origem_identidade
            from sevenlm_connect.funcionario_acesso
            where coalesce(ativo, true) = true
            """
        )
    ]
    usuarios = [
        dict(linha)
        for linha in await conexao.fetch(
            """
            select
                u.nome_completo as nome,
                u.identificador_usuario::text as identificador_usuario,
                null::text as identificador_funcionario,
                null::text as documento,
                u.correio_eletronico::text as email,
                coalesce(string_agg(distinct p.nome_perfil, ', ' order by p.nome_perfil), '') as cargo,
                coalesce(string_agg(distinct p.nome_perfil, ', ' order by p.nome_perfil), '') as perfil_acesso,
                null::text as papel_comissionamento,
                'usuario' as origem_identidade
            from sevenlm_connect.usuario u
            left join sevenlm_connect.usuario_perfil up on up.identificador_usuario = u.identificador_usuario
            left join sevenlm_connect.perfil p on p.identificador_perfil = up.identificador_perfil
            where coalesce(u.indicador_ativo, true) = true
            group by u.identificador_usuario, u.nome_completo, u.correio_eletronico
            order by
                case
                    when lower(coalesce(u.correio_eletronico::text, '')) like '%@7lm.com.br' then 0
                    when lower(coalesce(u.correio_eletronico::text, '')) like '%teste%' then 2
                    else 1
                end,
                u.nome_completo
            """
        )
    ]
    fontes = {
        "resultado_2026_06": resultados_2026_06,
        "snapshot_2026_06": snapshot_2026_06,
        "funcionario_acesso": funcionarios,
        "usuario": usuarios,
    }
    indices: dict[str, dict[str, dict[str, Any]]] = {chave: {} for chave in fontes}
    for fonte, itens in fontes.items():
        for item in itens:
            chave = _normalizar_texto(item.get("nome"))
            if chave and chave not in indices[fonte]:
                indices[fonte][chave] = item
    return indices


def _resolver_identidade(
    indices: dict[str, dict[str, dict[str, Any]]],
    nome_seed: str,
    funcao_seed: str,
) -> dict[str, Any]:
    nome_preferido = APELIDOS_IDENTIDADE.get(nome_seed.upper(), nome_seed)
    chave = _normalizar_texto(nome_preferido)
    for fonte in ("resultado_2026_06", "snapshot_2026_06", "funcionario_acesso", "usuario"):
        item = indices.get(fonte, {}).get(chave)
        if item:
            origem = item.get("origem_identidade") or fonte
            validacao = {
                "validado": fonte in {"resultado_2026_06", "snapshot_2026_06", "funcionario_acesso"},
                "fonte": fonte,
                "nome_seed": nome_seed,
                "nome_preferido": nome_preferido,
                "motivos": [f"match_por_apelido={nome_seed}->{nome_preferido}", f"fonte={fonte}"],
            }
            return {
                "nome": item.get("nome") or nome_preferido,
                "identificador_usuario": item.get("identificador_usuario"),
                "identificador_funcionario": item.get("identificador_funcionario"),
                "documento": item.get("documento"),
                "email": item.get("email"),
                "cargo": item.get("cargo") or funcao_seed,
                "perfil_acesso": item.get("perfil_acesso"),
                "papel_comissionamento": item.get("papel_comissionamento") or _papel_por_funcao(funcao_seed),
                "origem_identidade": f"maio_2026_{origem}",
                "validacao_lideranca": validacao,
            }
    return {
        "nome": nome_preferido,
        "identificador_usuario": None,
        "identificador_funcionario": None,
        "documento": None,
        "email": None,
        "cargo": funcao_seed,
        "perfil_acesso": None,
        "papel_comissionamento": _papel_por_funcao(funcao_seed),
        "origem_identidade": "maio_2026_sem_match",
        "validacao_lideranca": {
            "validado": False,
            "fonte": "sem_match",
            "nome_seed": nome_seed,
            "nome_preferido": nome_preferido,
            "motivos": ["Sem correspondencia segura na Maquina de Vendas."],
        },
    }


def _regra_01_payload(resultado_id: str, identidade: dict[str, Any], detalhe: dict[str, Any]) -> dict[str, Any]:
    metas = detalhe.get("metas") or []
    faixas = [dict(item) for item in detalhe.get("faixas") or []]
    regra_total = _moeda(detalhe.get("regra_total"))
    if len(metas) == 1:
        faixa_aplicada = metas[0].get("faixa_aplicada") or "Consolidado Maio/2026"
        for faixa in faixas:
            if _normalizar_texto(faixa.get("rotulo")) == _normalizar_texto(faixa_aplicada):
                faixa["ativa"] = True
                faixa["valor_bonus"] = float(regra_total)
                faixa["valor_faixa"] = float(regra_total)
    else:
        faixa_aplicada = "Consolidado Maio/2026"

    objetivo = sum(_decimal(meta.get("objetivo")) for meta in metas)
    realizado = sum(_decimal(meta.get("realizado")) for meta in metas)
    percentual = (realizado / objetivo * Decimal("100")) if objetivo > 0 else Decimal("0")

    return {
        "meta_id": f"{resultado_id}-r01-maio-2026",
        "nome": "Regra 01 - Maio/2026",
        "indicador": "vendas",
        "substituir_faixas": True,
        "objetivo": float(objetivo),
        "realizado": float(realizado),
        "peso": 1,
        "percentual_atingimento": float(percentual.quantize(Decimal("0.01"))),
        "faixa_aplicada": faixa_aplicada,
        "valor_faixa": float(regra_total),
        "valor_calculado": float(regra_total),
        "faixas": faixas,
        "metas": metas,
        "fonte_realizado": detalhe.get("origem") or "excel_maio_2026",
        "fonte_identidade": identidade.get("origem_identidade"),
    }


def _regra_02_payload(resultado_id: str, detalhe: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": f"{resultado_id}-r02-maio-2026",
        "nome": "Regra 02 - IPs Maio/2026",
        "indicador": "ip_maio_2026",
        "substituir_ips": True,
        "valor_calculado": float(_moeda(detalhe.get("bonus_ips"))),
        "fonte_realizado": detalhe.get("origem") or "excel_maio_2026",
    }


async def _limpar_ciclo(conexao) -> None:
    await conexao.execute(
        f"""
        delete from {ESQUEMA_COMISSIONAMENTO}.idempotency_keys
        where chave like $1
        """,
        f"{AGENTE_IMPORTADOR}:{CICLO_ID}:%",
    )
    await conexao.execute(
        f"""
        delete from {ESQUEMA_COMISSIONAMENTO}.notificacao_logs
        where fila_envio_id in (
            select f.fila_envio_id
            from {ESQUEMA_COMISSIONAMENTO}.notificacao_fila_envio f
            join {ESQUEMA_COMISSIONAMENTO}.notificacao_eventos e on e.evento_id = f.evento_id
            where e.ciclo_id = $1
        )
        """,
        CICLO_ID,
    )
    await conexao.execute(
        f"""
        delete from {ESQUEMA_COMISSIONAMENTO}.notificacao_fila_envio f
        using {ESQUEMA_COMISSIONAMENTO}.notificacao_eventos e
        where f.evento_id = e.evento_id
          and e.ciclo_id = $1
        """,
        CICLO_ID,
    )
    await conexao.execute(
        f"""
        delete from {ESQUEMA_COMISSIONAMENTO}.notificacao_destinatarios d
        using {ESQUEMA_COMISSIONAMENTO}.notificacoes n
        where d.notificacao_id = n.notificacao_id
          and n.ciclo_id = $1
        """,
        CICLO_ID,
    )
    for tabela in (
        "notificacoes",
        "notificacao_eventos",
        "regras_publicadas",
        "eventos",
        "documentos",
        "hierarquia_snapshot",
        "resultados",
        "ciclos",
    ):
        await conexao.execute(f"delete from {ESQUEMA_COMISSIONAMENTO}.{tabela} where ciclo_id = $1", CICLO_ID)


async def _inserir_ciclo(conexao, ciclo: dict[str, Any]) -> None:
    prazo_financeiro = ciclo.get("prazo_envio_financeiro") or "2026-06-15"
    if isinstance(prazo_financeiro, str):
        prazo_financeiro = date.fromisoformat(prazo_financeiro[:10])
    await conexao.execute(
        f"""
        insert into {ESQUEMA_COMISSIONAMENTO}.ciclos (
            ciclo_id,
            mes,
            ano,
            rotulo,
            origem,
            status,
            prazo_envio_financeiro,
            prazo_nf_dias
        )
        values ($1, $2, $3, $4, $5, $6, $7::date, $8)
        """,
        CICLO_ID,
        5,
        2026,
        ciclo.get("rotulo") or "Maio/2026",
        "excel_maio_2026_maquina_vendas",
        "calculado",
        prazo_financeiro,
        int(ciclo.get("prazo_nf_dias") or 2),
    )


async def _inserir_resultados_e_regras(conexao, resultados: list[dict[str, Any]], leitor: LeitorXlsx) -> list[dict[str, Any]]:
    indices = await _identidades(conexao)
    importados: list[dict[str, Any]] = []
    for item in resultados:
        seed_nome = str(item.get("nome") or "").strip().upper()
        resultado_id = str(item.get("resultado_id") or f"maio-2026-{_md5_curto(seed_nome)}")
        valor_final = _moeda(item.get("valor_liquido") or item.get("valor_bruto"))
        distrato = _moeda(item.get("desconto_distrato"))
        detalhe = _detalhe_excel(leitor, seed_nome, valor_final, distrato)
        identidade = _resolver_identidade(indices, seed_nome, item.get("funcao") or "")
        regra_01 = _regra_01_payload(resultado_id, identidade, detalhe)
        regra_02 = _regra_02_payload(resultado_id, detalhe)
        ips = [dict(ip, ip_id=f"{resultado_id}-{ip['ip_id']}") for ip in detalhe.get("ips") or []]

        validacao = {
            **(identidade.get("validacao_lideranca") or {}),
            "maio_2026": {
                "nome_seed": seed_nome,
                "nome_importado": identidade.get("nome"),
                "fonte_valores": detalhe.get("origem"),
                "aba_excel": detalhe.get("aba"),
                "observacoes": detalhe.get("observacoes") or [],
                "valor_final_preservado": float(valor_final),
                "regra_01": float(_moeda(detalhe.get("regra_total"))),
                "bonus_ips": float(_moeda(detalhe.get("bonus_ips"))),
            },
        }

        await conexao.execute(
            f"""
            insert into {ESQUEMA_COMISSIONAMENTO}.resultados (
                resultado_id,
                ciclo_id,
                funcao,
                cidade,
                nome,
                tipo_comissionado,
                valor_bruto,
                desconto_distrato,
                status,
                status_nf,
                status_financeiro,
                status_pagamento,
                exige_nf,
                origem,
                identificador_usuario,
                identificador_funcionario,
                documento,
                email,
                cargo,
                perfil_acesso,
                papel_comissionamento,
                origem_identidade,
                validacao_lideranca
            )
            values (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                'excel_maio_2026_maquina_vendas', $14::uuid, $15::uuid, $16, $17, $18, $19, $20, $21, $22::jsonb
            )
            """,
            resultado_id,
            CICLO_ID,
            item.get("funcao") or identidade.get("cargo") or "-",
            item.get("cidade") or "-",
            identidade.get("nome") or seed_nome,
            item.get("tipo_comissionado") or "PJ_AUTONOMO",
            valor_final,
            distrato,
            item.get("status") or "calculado",
            item.get("status_nf") or "pendente_nf",
            item.get("status_financeiro") or "nao_enviado",
            item.get("status_pagamento") or "nao_enviado",
            bool(item.get("exige_nf", True)),
            identidade.get("identificador_usuario"),
            identidade.get("identificador_funcionario"),
            identidade.get("documento"),
            identidade.get("email"),
            identidade.get("cargo") or item.get("funcao"),
            identidade.get("perfil_acesso"),
            identidade.get("papel_comissionamento") or _papel_por_funcao(item.get("funcao") or ""),
            identidade.get("origem_identidade"),
            json.dumps(validacao, ensure_ascii=False, default=_json_default),
        )
        for regra_tipo, regra_payload, regra_02_ips in (
            ("regra_01", regra_01, []),
            ("regra_02", regra_02, ips),
        ):
            await conexao.execute(
                f"""
                insert into {ESQUEMA_COMISSIONAMENTO}.regras_publicadas (
                    ciclo_id,
                    comissionado_id,
                    comissionado_nome,
                    regra_tipo,
                    versao,
                    regra_01,
                    regra_02,
                    regra_02_ips,
                    regra_02_ips_removidos,
                    payload,
                    motivo,
                    comentario,
                    ativo
                )
                values ($1, $2, $3, $4, 1, $5::jsonb, $6::jsonb, $7::jsonb, '[]'::jsonb, $8::jsonb, $9, $10, true)
                """,
                CICLO_ID,
                resultado_id,
                identidade.get("nome") or seed_nome,
                regra_tipo,
                json.dumps(regra_payload if regra_tipo == "regra_01" else {}, ensure_ascii=False, default=_json_default),
                json.dumps(regra_payload if regra_tipo == "regra_02" else {}, ensure_ascii=False, default=_json_default),
                json.dumps(regra_02_ips, ensure_ascii=False, default=_json_default),
                json.dumps({"fonte": "restauracao_maio_2026", "detalhe": detalhe}, ensure_ascii=False, default=_json_default),
                "Restauracao controlada do ciclo Maio/2026.",
                "Valores de maio preservados; identidade/hierarquia enriquecida pela Maquina de Vendas.",
            )

        importados.append(
            {
                "resultado_id": resultado_id,
                "seed_nome": seed_nome,
                "nome": identidade.get("nome"),
                "email": identidade.get("email"),
                "origem_identidade": identidade.get("origem_identidade"),
                "fonte_valores": detalhe.get("origem"),
                "aba_excel": detalhe.get("aba"),
                "valor_final": float(valor_final),
                "regra_01": float(_moeda(detalhe.get("regra_total"))),
                "bonus_ips": float(_moeda(detalhe.get("bonus_ips"))),
                "ips": len(ips),
                "observacoes": detalhe.get("observacoes") or [],
            }
        )
    return importados


async def _inserir_snapshot(conexao, importados: list[dict[str, Any]]) -> dict[str, Any]:
    por_nome = {_normalizar_texto(item["nome"]): item for item in importados if item.get("nome")}
    linhas = []
    snapshot_2026_06 = await conexao.fetch(
        f"""
        select *
        from {ESQUEMA_COMISSIONAMENTO}.hierarquia_snapshot
        where ciclo_id = '2026-06'
        """
    )
    for linha in snapshot_2026_06:
        item = dict(linha)
        destino = por_nome.get(_normalizar_texto(item.get("comissionado_nome")))
        if not destino:
            continue
        linhas.append(
            (
                CICLO_ID,
                "2026-05",
                item.get("papel"),
                destino["resultado_id"],
                destino["nome"],
                item.get("comissionado_documento"),
                item.get("comissionado_email"),
                item.get("gestor_nome"),
                item.get("gestor_documento"),
                item.get("gestor_email"),
                item.get("coordenador_nome"),
                item.get("coordenador_documento"),
                item.get("coordenador_email"),
                item.get("corretor_nome"),
                item.get("corretor_tipo"),
                item.get("corretor_hierarquia_key"),
                item.get("corretor_ativo_mes_key"),
                item.get("regiao_corretor"),
                item.get("imobiliaria_corretor"),
                item.get("ativo"),
                item.get("ativo_negocio"),
                json.dumps({"origem": "copiado_snapshot_2026_06", "snapshot_id_origem": str(item.get("snapshot_id"))}),
                item.get("comissionado_usuario_id"),
                item.get("comissionado_funcionario_id"),
                item.get("comissionado_cargo"),
                item.get("comissionado_perfil"),
                item.get("comissionado_origem_identidade"),
                item.get("corretor_usuario_id"),
                item.get("corretor_funcionario_id"),
                item.get("corretor_documento"),
                item.get("corretor_email"),
                item.get("corretor_cargo"),
                item.get("corretor_status"),
                item.get("corretor_origem_identidade"),
                "snapshot_2026_06_referencial",
            )
        )
    if linhas:
        await conexao.executemany(
            f"""
            insert into {ESQUEMA_COMISSIONAMENTO}.hierarquia_snapshot (
                ciclo_id,
                mes_referencia,
                papel,
                comissionado_id,
                comissionado_nome,
                comissionado_documento,
                comissionado_email,
                gestor_nome,
                gestor_documento,
                gestor_email,
                coordenador_nome,
                coordenador_documento,
                coordenador_email,
                corretor_nome,
                corretor_tipo,
                corretor_hierarquia_key,
                corretor_ativo_mes_key,
                regiao_corretor,
                imobiliaria_corretor,
                ativo,
                ativo_negocio,
                origem_json,
                comissionado_usuario_id,
                comissionado_funcionario_id,
                comissionado_cargo,
                comissionado_perfil,
                comissionado_origem_identidade,
                corretor_usuario_id,
                corretor_funcionario_id,
                corretor_documento,
                corretor_email,
                corretor_cargo,
                corretor_status,
                corretor_origem_identidade,
                vinculo_origem
            )
            values (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17, $18, $19,
                $20, $21, $22::jsonb,
                $23::uuid, $24::uuid, $25, $26, $27,
                $28::uuid, $29::uuid, $30, $31, $32, $33, $34, $35
            )
            on conflict do nothing
            """,
            linhas,
        )
    return {
        "linhas_snapshot": len(linhas),
        "comissionados_com_snapshot": len({linha[3] for linha in linhas}),
    }


async def _registrar_evento_importacao(conexao, resumo: dict[str, Any]) -> None:
    await conexao.execute(
        f"""
        insert into {ESQUEMA_COMISSIONAMENTO}.eventos (
            ciclo_id,
            tipo_evento,
            comentario,
            payload_depois,
            idempotency_key,
            endereco_ip,
            agente_do_usuario
        )
        values ($1, 'ciclo_maio_2026_restaurado', $2, $3::jsonb, $4, '127.0.0.1', $5)
        """,
        CICLO_ID,
        "Ciclo Maio/2026 restaurado com valores historicos e identidade da Maquina de Vendas.",
        json.dumps(resumo, ensure_ascii=False, default=_json_default),
        f"{AGENTE_IMPORTADOR}:{CICLO_ID}:importacao",
        AGENTE_IMPORTADOR,
    )


async def restaurar(backup: Path, planilha: Path, gravar_relatorio: bool = True) -> dict[str, Any]:
    ciclo, resultados = _carregar_backup(backup)
    leitor = LeitorXlsx(planilha)
    pool = await iniciar_pool_de_conexoes()
    async with pool.acquire() as conexao:
        async with conexao.transaction():
            await _limpar_ciclo(conexao)
            await _inserir_ciclo(conexao, ciclo)
            importados = await _inserir_resultados_e_regras(conexao, resultados, leitor)
            snapshot = await _inserir_snapshot(conexao, importados)
            totais = await conexao.fetchrow(
                f"""
                select count(*) as quantidade,
                       sum(valor_bruto) as valor_bruto_raw,
                       sum(desconto_distrato) as distrato_raw,
                       sum(valor_liquido) as valor_liquido_raw
                from {ESQUEMA_COMISSIONAMENTO}.resultados
                where ciclo_id = $1
                """,
                CICLO_ID,
            )
            resumo = {
                "ciclo_id": CICLO_ID,
                "rotulo": "Maio/2026",
                "fonte_backup": str(backup),
                "fonte_planilha": str(planilha),
                "resultados": importados,
                "snapshot": snapshot,
                "totais_raw_banco": {chave: _json_default(valor) for chave, valor in dict(totais).items()},
            }
            await _registrar_evento_importacao(conexao, resumo)

    if gravar_relatorio:
        REGISTRO_SAIDA.mkdir(parents=True, exist_ok=True)
        caminho = REGISTRO_SAIDA / "comissionamento_restauracao_maio_2026.json"
        caminho.write_text(json.dumps(resumo, ensure_ascii=False, indent=2, default=_json_default), encoding="utf-8")
        resumo["relatorio"] = str(caminho)
    return resumo


async def _main() -> None:
    parser = argparse.ArgumentParser(description="Restaura o ciclo oficial 2026-05 do Comissionamento.")
    parser.add_argument("--backup", type=Path, default=BACKUP_PADRAO)
    parser.add_argument("--planilha", type=Path, default=PLANILHA_PADRAO)
    parser.add_argument("--sem-relatorio", action="store_true")
    args = parser.parse_args()
    try:
        resumo = await restaurar(args.backup, args.planilha, gravar_relatorio=not args.sem_relatorio)
        print(json.dumps(resumo, ensure_ascii=False, indent=2, default=_json_default))
    finally:
        await encerrar_pool_de_conexoes()


if __name__ == "__main__":
    asyncio.run(_main())
