"""
Prepara o ciclo oficial 2026-06 para edicao da Secretaria.

Uso:
  python scripts/preparar_junho_2026_regras_limpas.py
  python scripts/preparar_junho_2026_regras_limpas.py --apply

O script e idempotente. Em dry-run apenas gera relatorio. Em --apply:
- garante os lideres ativos no ciclo via reset mensal;
- zera valores financeiros do ciclo;
- publica Regra 01 de repasses com realizado do Dashboard Comercial;
- publica Regra 02 com IPs baseados no historico de maio ou placeholder.
"""

from __future__ import annotations

import argparse
import asyncio
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
import json
from pathlib import Path
import re
import sys
import unicodedata
from typing import Any

BASE_API = Path(__file__).resolve().parents[1]
PORTAL_ROOT = BASE_API.parents[1]
if str(BASE_API) not in sys.path:
    sys.path.insert(0, str(BASE_API))

from banco import encerrar_pool_de_conexoes, iniciar_pool_de_conexoes  # noqa: E402
from configuracoes import ESQUEMA_COMERCIAL, ESQUEMA_COMISSIONAMENTO  # noqa: E402
from repositorios.comissionamento import salvar_configuracao_ciclo, salvar_publicacao_regra  # noqa: E402
from scripts.resetar_ciclo_comissionamento_mensal import resetar  # noqa: E402
from scripts.restaurar_ciclo_maio_2026 import LeitorXlsx, PLANILHA_PADRAO, _detalhe_excel  # noqa: E402
from servicos.comissionamento_preview import FAIXAS_REGRA_01  # noqa: E402


CICLO_ID = "2026-06"
AGENTE = "preparar_junho_2026_regras_limpas.py"
REGISTRO_SAIDA = PORTAL_ROOT / "03_registros" / "comissionamento" / "execucoes"
METRICAS_SOMAVEIS = (
    "leads",
    "visitas",
    "vendas",
    "repasses",
    "propostas_aprovadas",
    "propostas_condicionadas",
    "propostas_reprovadas",
    "propostas_total",
    "cancelamentos",
    "distratos",
)


def _normalizar(valor: Any) -> str:
    texto = str(valor or "").strip()
    texto = "".join(
        caractere
        for caractere in unicodedata.normalize("NFD", texto)
        if unicodedata.category(caractere) != "Mn"
    )
    texto = re.sub(r"[^a-zA-Z0-9@.]+", " ", texto)
    return " ".join(texto.lower().split())


def _normalizar_corretor(valor: Any) -> str:
    tokens = [token for token in _normalizar(valor).split() if token not in {"clt"}]
    return " ".join(tokens)


def _nome_compativel(a: str, b: str) -> bool:
    if not a or not b:
        return False
    if a == b:
        return True
    tokens_a = set(a.split())
    tokens_b = set(b.split())
    inter = tokens_a & tokens_b
    return len(inter) >= 3 or (len(tokens_a) <= 3 and len(inter) >= max(2, len(tokens_a) - 1))


def _numero(valor: Any, casas: str = "0.01") -> float:
    return float(Decimal(str(valor or 0)).quantize(Decimal(casas)))


def _atingiu(operador: str, realizado: Decimal, alvo: Decimal) -> bool:
    if operador == ">":
        return realizado > alvo
    if operador == "<":
        return realizado < alvo
    if operador == "<=":
        return realizado <= alvo
    if operador in {"=", "=="}:
        return realizado == alvo
    return realizado >= alvo


def _faixa_aplicada(percentual: Decimal) -> str:
    for faixa in FAIXAS_REGRA_01:
        maximo = faixa["maximo"]
        if percentual >= Decimal(str(faixa["minimo"])) and (maximo is None or percentual <= Decimal(str(maximo))):
            return str(faixa["rotulo"])
    return str(FAIXAS_REGRA_01[0]["rotulo"])


def _faixas_zeradas(objetivo: Decimal, realizado: Decimal, faixa_aplicada: str) -> list[dict[str, Any]]:
    faixas = []
    for posicao, faixa in enumerate(FAIXAS_REGRA_01, start=1):
        minimo = Decimal(str(faixa["minimo"]))
        maximo = Decimal(str(faixa["maximo"])) if faixa["maximo"] is not None else None
        necessario_minimo = objetivo * minimo / Decimal("100") if objetivo > 0 else Decimal("0")
        necessario_maximo = objetivo * maximo / Decimal("100") if objetivo > 0 and maximo is not None else None
        rotulo = str(faixa["rotulo"])
        faixas.append({
            "id": f"faixa_{posicao}",
            "rotulo": rotulo,
            "percentual_minimo": float(minimo),
            "percentual_maximo": float(maximo) if maximo is not None else 999,
            "realizado_atual": _numero(realizado),
            "objetivo_base": _numero(objetivo),
            "necessario_minimo": _numero(necessario_minimo),
            "necessario_maximo": None if necessario_maximo is None else _numero(necessario_maximo),
            "faltam_para_minimo": _numero(max(necessario_minimo - realizado, Decimal("0"))),
            "valor_bonus": 0,
            "valor_faixa": 0,
            "ativa": rotulo == faixa_aplicada,
        })
    return faixas


@dataclass
class Metricas:
    valores: dict[str, Decimal]
    fonte: str
    linhas: int
    corretores: int

    def valor(self, indicador: str) -> Decimal:
        return self.valores.get(indicador, Decimal("0"))


def _metricas_vazias(fonte: str = "sem_fonte") -> Metricas:
    return Metricas({chave: Decimal("0") for chave in METRICAS_SOMAVEIS} | {"ipc": Decimal("0"), "sobrepreco_medio": Decimal("0")}, fonte, 0, 0)


def _somar_linhas(linhas: list[dict[str, Any]], fonte: str) -> Metricas:
    valores = {chave: Decimal("0") for chave in METRICAS_SOMAVEIS}
    corretores = { _normalizar(linha.get("corretor")) for linha in linhas if _normalizar(linha.get("corretor")) }
    for linha in linhas:
        for chave in METRICAS_SOMAVEIS:
            valores[chave] += Decimal(str(linha.get(chave) or 0))
    valores["ipc"] = (valores["repasses"] / Decimal(len(corretores))).quantize(Decimal("0.01")) if corretores else Decimal("0")
    valores["sobrepreco_medio"] = Decimal("0")
    return Metricas(valores, fonte, len(linhas), len(corretores))


async def _carregar_kpis(conexao, inicio: date, fim: date) -> list[dict[str, Any]]:
    return [dict(linha) for linha in await conexao.fetch(
        f"""
        select *
        from {ESQUEMA_COMERCIAL}.dashboard_gc_produtividade_kpi_daily
        where data >= $1 and data <= $2
        """,
        inicio,
        fim,
    )]


async def _carregar_repasses_importados(conexao, inicio: date) -> dict[str, int]:
    linhas = await conexao.fetch(
        f"""
        select corretor, count(*)::int as repasses
        from {ESQUEMA_COMERCIAL}.dashboard_gc_produtividade_repasses_importados
        where mes_referencia = $1
        group by corretor
        """,
        inicio,
    )
    return {_normalizar_corretor(linha["corretor"]): int(linha["repasses"] or 0) for linha in linhas}


async def _snapshot_por_comissionado(conexao) -> dict[str, list[dict[str, Any]]]:
    linhas = await conexao.fetch(
        f"""
        select comissionado_id, comissionado_nome, corretor_nome
        from {ESQUEMA_COMISSIONAMENTO}.hierarquia_snapshot
        where ciclo_id = $1
        """,
        CICLO_ID,
    )
    agrupado: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for linha in linhas:
        item = dict(linha)
        agrupado[str(linha["comissionado_id"])].append(item)
        nome_chave = _normalizar(item.get("comissionado_nome"))
        if nome_chave:
            agrupado[nome_chave].append(item)
    return agrupado


def _metricas_para_resultado(
    resultado: dict[str, Any],
    snapshot: dict[str, list[dict[str, Any]]],
    kpis: list[dict[str, Any]],
    repasses_importados: dict[str, int],
) -> Metricas:
    nomes_vinculados = {
        _normalizar_corretor(item.get("corretor_nome"))
        for item in [
            *snapshot.get(str(resultado["resultado_id"]), []),
            *snapshot.get(_normalizar(resultado.get("nome")), []),
        ]
        if _normalizar_corretor(item.get("corretor_nome"))
    }
    linhas = [
        linha for linha in kpis
        if any(_nome_compativel(_normalizar_corretor(linha.get("corretor")), nome) for nome in nomes_vinculados)
    ]
    if linhas:
        metricas = _somar_linhas(linhas, "dashboard_gc_produtividade_kpi_daily.corretor")
    else:
        nome = _normalizar(resultado.get("nome"))
        linhas_lider = [
            linha for linha in kpis
            if nome and nome in {_normalizar(linha.get("gerencia")), _normalizar(linha.get("coordenacao"))}
        ]
        metricas = _somar_linhas(linhas_lider, "dashboard_gc_produtividade_kpi_daily.lideranca") if linhas_lider else _metricas_vazias()

    repasses_aux = sum(repasses_importados.get(nome, 0) for nome in nomes_vinculados)
    if repasses_aux > 0 and metricas.valor("repasses") <= 0:
        valores = dict(metricas.valores)
        valores["repasses"] = Decimal(repasses_aux)
        valores["ipc"] = (Decimal(repasses_aux) / Decimal(max(metricas.corretores, len(nomes_vinculados), 1))).quantize(Decimal("0.01"))
        return Metricas(valores, "dashboard_gc_produtividade_repasses_importados", metricas.linhas, metricas.corretores)
    return metricas


def _resultado_para_seed_maio(resultado: dict[str, Any], mapa_maio: list[dict[str, Any]]) -> str | None:
    nome = _normalizar(resultado.get("nome"))
    for item in mapa_maio:
        if nome and nome == _normalizar(item.get("nome")):
            return str(item.get("seed_nome") or "").strip()
    for item in mapa_maio:
        tokens_a = set(nome.split())
        tokens_b = set(_normalizar(item.get("nome")).split())
        if len(tokens_a & tokens_b) >= 2:
            return str(item.get("seed_nome") or "").strip()
    return None


def _carregar_mapa_maio() -> list[dict[str, Any]]:
    caminho = REGISTRO_SAIDA / "comissionamento_restauracao_maio_2026.json"
    if not caminho.exists():
        return []
    payload = json.loads(caminho.read_text(encoding="utf-8"))
    return [dict(item) for item in payload.get("resultados") or []]


def _ips_base_maio(resultado: dict[str, Any], metricas: Metricas, leitor: LeitorXlsx, mapa_maio: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str]:
    seed = _resultado_para_seed_maio(resultado, mapa_maio)
    ips_origem = []
    fonte = "placeholder_sem_historico_maio"
    if seed:
        detalhe = _detalhe_excel(leitor, seed, Decimal("0"), Decimal("0"))
        ips_origem = detalhe.get("ips") or []
        fonte = f"excel_maio_2026:{seed}" if ips_origem else "placeholder_sem_ip_maio"

    ips = []
    for posicao, ip in enumerate(ips_origem, start=1):
        indicador = str(ip.get("indicador") or "ip_maio_2026")
        realizado = metricas.valor(indicador) if indicador in metricas.valores else Decimal(str(ip.get("realizado") or 0))
        alvo = Decimal(str(ip.get("alvo") or 0))
        operador = str(ip.get("operador") or ">=")
        ips.append({
            "ip_id": f"{resultado['resultado_id']}-ip-base-maio-{posicao}",
            "acao": "manter",
            "nome": ip.get("nome") or f"IP base Maio {posicao}",
            "indicador": indicador,
            "tipo_comissao": ip.get("tipo_comissao") or "numero",
            "operador": operador,
            "alvo": _numero(alvo),
            "realizado": _numero(realizado),
            "atingiu": _atingiu(operador, realizado, alvo),
            "valor_bonus": 0,
            "data_inicial": "2026-06-01",
            "data_fim": "2026-06-30",
            "periodo_corte": "2026-06",
            "fonte_realizado": fonte if indicador not in metricas.valores else metricas.fonte,
            "fonte_template": fonte,
        })

    if ips:
        return ips, fonte

    realizado_repasse = metricas.valor("repasses")
    ips.append({
        "ip_id": f"{resultado['resultado_id']}-ip-base-editar",
        "acao": "criar",
        "nome": "IP base - editar",
        "indicador": "repasses",
        "tipo_comissao": "numero",
        "operador": ">=",
        "alvo": 0,
        "realizado": _numero(realizado_repasse),
        "atingiu": realizado_repasse >= 0,
        "valor_bonus": 0,
        "data_inicial": "2026-06-01",
        "data_fim": "2026-06-30",
        "periodo_corte": "2026-06",
        "fonte_realizado": metricas.fonte,
        "fonte_template": fonte,
    })
    return ips, fonte


def _regra_01(resultado: dict[str, Any], metricas: Metricas, objetivo: Decimal) -> dict[str, Any]:
    realizado = metricas.valor("repasses")
    percentual = ((realizado / objetivo) * Decimal("100")).quantize(Decimal("0.01")) if objetivo > 0 else Decimal("0")
    faixa = _faixa_aplicada(percentual)
    return {
        "meta_id": f"{resultado['resultado_id']}-r01-junho-2026-repasses",
        "nome": "Regra 01 - Repasses Junho/2026",
        "indicador": "repasses",
        "substituir_faixas": True,
        "objetivo": _numero(objetivo),
        "realizado": _numero(realizado),
        "peso": 1,
        "percentual_atingimento": _numero(percentual),
        "faixa_aplicada": faixa,
        "valor_faixa": 0,
        "valor_calculado": 0,
        "faixas": _faixas_zeradas(objetivo, realizado, faixa),
        "fonte_realizado": metricas.fonte,
        "linhas_fonte": metricas.linhas,
        "corretores_fonte": metricas.corretores,
    }


async def preparar(aplicar: bool) -> dict[str, Any]:
    inicio = date(2026, 6, 1)
    fim = date(2026, 6, 30)
    if aplicar:
        await resetar(CICLO_ID, True, notificar_secretaria=False)

    pool = await iniciar_pool_de_conexoes()
    try:
        async with pool.acquire() as conexao:
            await conexao.execute((PORTAL_ROOT / "Servidor/migracao_20260616_comissionamento_configuracoes_ciclo.sql").read_text(encoding="utf-8"))
            configuracao = await conexao.fetchrow(
                f"""
                select objetivo_repasse_geral
                from {ESQUEMA_COMISSIONAMENTO}.configuracoes_ciclo
                where ciclo_id = $1
                """,
                CICLO_ID,
            )
            objetivo = Decimal(str(configuracao["objetivo_repasse_geral"] if configuracao else 0))
            resultados = [dict(linha) for linha in await conexao.fetch(
                f"""
                select *
                from {ESQUEMA_COMISSIONAMENTO}.resultados
                where ciclo_id = $1
                order by nome
                """,
                CICLO_ID,
            )]
            snapshot = await _snapshot_por_comissionado(conexao)
            kpis = await _carregar_kpis(conexao, inicio, fim)
            repasses_importados = await _carregar_repasses_importados(conexao, inicio)
            leitor = LeitorXlsx(PLANILHA_PADRAO)
            mapa_maio = _carregar_mapa_maio()
            preparados = []

            for resultado in resultados:
                metricas = _metricas_para_resultado(resultado, snapshot, kpis, repasses_importados)
                regra_01 = _regra_01(resultado, metricas, objetivo)
                ips, fonte_ip = _ips_base_maio(resultado, metricas, leitor, mapa_maio)
                regra_02 = {
                    "id": f"{resultado['resultado_id']}-r02-junho-2026-base",
                    "nome": "Regra 02 - IPs Junho/2026",
                    "indicador": "ips_base_maio",
                    "substituir_ips": True,
                    "valor_calculado": 0,
                    "valor_total_ips": 0,
                    "fonte_realizado": metricas.fonte,
                    "fonte_template": fonte_ip,
                }
                preparados.append({
                    "resultado_id": resultado["resultado_id"],
                    "nome": resultado["nome"],
                    "cargo": resultado.get("cargo") or resultado.get("funcao"),
                    "realizado_repasses": float(metricas.valor("repasses")),
                    "fonte_realizado": metricas.fonte,
                    "objetivo_repasse_geral": float(objetivo),
                    "ips": len(ips),
                    "fonte_ip": fonte_ip,
                    "regra_01": regra_01,
                    "regra_02": regra_02,
                    "regra_02_ips": ips,
                })

            resumo = {
                "ciclo_id": CICLO_ID,
                "modo": "apply" if aplicar else "dry-run",
                "objetivo_repasse_geral": float(objetivo),
                "resultados": len(resultados),
                "total_repasses_realizado": sum(item["realizado_repasses"] for item in preparados),
                "com_ips_historico_maio": sum(1 for item in preparados if str(item["fonte_ip"]).startswith("excel_maio_2026")),
                "com_placeholder_ip": sum(1 for item in preparados if str(item["fonte_ip"]).startswith("placeholder")),
                "sem_fonte_realizado": [item["nome"] for item in preparados if item["fonte_realizado"] == "sem_fonte"],
                "preparados": preparados,
            }

            if aplicar:
                async with conexao.transaction():
                    await salvar_configuracao_ciclo(
                        conexao,
                        ESQUEMA_COMISSIONAMENTO,
                        ciclo_id=CICLO_ID,
                        objetivo_repasse_geral=objetivo,
                        payload={"indicador_regra_01": "repasses", "origem": AGENTE},
                        usuario_id=None,
                    )
                    await conexao.execute(
                        f"""
                        update {ESQUEMA_COMISSIONAMENTO}.resultados
                        set valor_bruto = 0,
                            desconto_distrato = 0,
                            status = 'calculado',
                            status_nf = case when exige_nf then 'pendente_nf' else 'nao_aplicavel' end,
                            status_financeiro = 'nao_enviado',
                            status_pagamento = 'nao_enviado',
                            atualizado_em = now()
                        where ciclo_id = $1
                        """,
                        CICLO_ID,
                    )
                    await conexao.execute(
                        f"""
                        update {ESQUEMA_COMISSIONAMENTO}.regras_publicadas
                        set ativo = false
                        where ciclo_id = $1 and ativo = true
                        """,
                        CICLO_ID,
                    )
                    for item in preparados:
                        await salvar_publicacao_regra(
                            conexao,
                            ESQUEMA_COMISSIONAMENTO,
                            ciclo_id=CICLO_ID,
                            comissionado_id=item["resultado_id"],
                            comissionado_nome=item["nome"],
                            regra_tipo="regra_01",
                            regra_01=item["regra_01"],
                            regra_02={},
                            regra_02_ips=[],
                            regra_02_ips_removidos=[],
                            payload={"origem": AGENTE, "modo": "regra_01_repasses_zerada"},
                            motivo="Preparacao Junho/2026 limpo com realizado de repasses.",
                            comentario="Regra 01 criada zerada para edicao da Secretaria.",
                            usuario_id=None,
                        )
                        await salvar_publicacao_regra(
                            conexao,
                            ESQUEMA_COMISSIONAMENTO,
                            ciclo_id=CICLO_ID,
                            comissionado_id=item["resultado_id"],
                            comissionado_nome=item["nome"],
                            regra_tipo="regra_02",
                            regra_01={},
                            regra_02=item["regra_02"],
                            regra_02_ips=item["regra_02_ips"],
                            regra_02_ips_removidos=[],
                            payload={"origem": AGENTE, "modo": "ips_base_maio_zerados"},
                            motivo="Preparacao Junho/2026 com IP base de maio.",
                            comentario="IPs criados com bonus zerado para edicao da Secretaria.",
                            usuario_id=None,
                        )
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
                        values ($1, 'ciclo_junho_2026_regras_limpas_preparado', $2, $3::jsonb, $4, '127.0.0.1', $5)
                        """,
                        CICLO_ID,
                        "Junho/2026 preparado limpo: realizado de repasses, financeiro zerado e IPs base Maio.",
                        json.dumps({k: v for k, v in resumo.items() if k != "preparados"}, ensure_ascii=False, default=str),
                        f"{AGENTE}:{CICLO_ID}",
                        AGENTE,
                    )

            REGISTRO_SAIDA.mkdir(parents=True, exist_ok=True)
            saida = REGISTRO_SAIDA / f"comissionamento_junho_2026_regras_limpas_{'apply' if aplicar else 'dry_run'}.json"
            saida.write_text(json.dumps(resumo, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
            resumo["arquivo"] = str(saida)
            return resumo
    finally:
        await encerrar_pool_de_conexoes()


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepara Junho/2026 limpo com realizado e IPs base Maio.")
    parser.add_argument("--apply", action="store_true", help="Aplica no banco. Sem a flag, gera dry-run.")
    args = parser.parse_args()
    resumo = asyncio.run(preparar(args.apply))
    print(json.dumps({
        "ciclo_id": resumo["ciclo_id"],
        "modo": resumo["modo"],
        "resultados": resumo["resultados"],
        "total_repasses_realizado": resumo["total_repasses_realizado"],
        "com_ips_historico_maio": resumo["com_ips_historico_maio"],
        "com_placeholder_ip": resumo["com_placeholder_ip"],
        "sem_fonte_realizado": len(resumo["sem_fonte_realizado"]),
        "arquivo": resumo["arquivo"],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
