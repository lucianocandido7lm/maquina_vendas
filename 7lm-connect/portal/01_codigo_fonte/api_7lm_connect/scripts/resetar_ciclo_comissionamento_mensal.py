"""
Reseta/prepara um ciclo mensal de comissionamento a partir da Maquina de Vendas.

Uso:
  python resetar_ciclo_comissionamento_mensal.py --ciclo 2026-06 --apply
  python resetar_ciclo_comissionamento_mensal.py --apply --somente-primeiro-dia-util

O script e idempotente. Por padrao roda em dry-run; use --apply para gravar.
Sem --ciclo, usa o mes atual.
Ele:
- cria/atualiza o ciclo;
- traz liderancas ativas do mes para comissionamento.resultados;
- preserva valores ja existentes para a mesma pessoa/ciclo;
- coloca todos na etapa Calculada/Revisao;
- remove resultados automaticos de liderancas que nao estao mais ativos;
- recria hierarquia_snapshot com corretores ativos do mes para gestores/coordenadores.
- avisa a Secretaria de Vendas no primeiro dia util do ciclo quando aplicado.
"""

from __future__ import annotations

import argparse
import asyncio
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
import hashlib
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
from configuracoes import ESQUEMA_COMISSIONAMENTO  # noqa: E402
from repositorios.notificacoes_comissionamento import salvar_template  # noqa: E402
from servicos.comissionamento_indicadores import materializar_resultados_metas_lideranca  # noqa: E402
from servicos.notificacoes_comissionamento import criar_notificacao_manual, processar_fila  # noqa: E402


AGENTE = "resetar_ciclo_comissionamento_mensal.py"
REGISTRO_SAIDA = PORTAL_ROOT / "03_registros" / "comissionamento" / "execucoes"
ORIGEM_AUTOMATICA = "maquina_vendas_reset_mensal"
TEMPLATE_CICLO_REINICIADO = "secretaria_ciclo_reiniciado_novo_mes"

MESES = {
    1: "Janeiro",
    2: "Fevereiro",
    3: "Marco",
    4: "Abril",
    5: "Maio",
    6: "Junho",
    7: "Julho",
    8: "Agosto",
    9: "Setembro",
    10: "Outubro",
    11: "Novembro",
    12: "Dezembro",
}


def _normalizar(valor: Any) -> str:
    texto = str(valor or "").strip()
    texto = "".join(
        caractere
        for caractere in unicodedata.normalize("NFD", texto)
        if unicodedata.category(caractere) != "Mn"
    )
    texto = re.sub(r"[^a-zA-Z0-9@.]+", " ", texto)
    return " ".join(texto.lower().split())


def _documento(valor: Any) -> str:
    return "".join(ch for ch in str(valor or "") if ch.isdigit())


def _email(valor: Any) -> str:
    return str(valor or "").strip().lower()


def _md5_curto(valor: str) -> str:
    return hashlib.md5(valor.encode("utf-8")).hexdigest()[:16]


def _uuid(valor: Any) -> str | None:
    texto = str(valor or "").strip()
    return texto or None


def _mes_periodo(ciclo_id: str) -> tuple[int, int, date, date]:
    ano_texto, mes_texto = ciclo_id[:7].split("-")
    ano = int(ano_texto)
    mes = int(mes_texto)
    inicio = date(ano, mes, 1)
    fim = date(ano + (1 if mes == 12 else 0), 1 if mes == 12 else mes + 1, 1)
    fim = date.fromordinal(fim.toordinal() - 1)
    return ano, mes, inicio, fim


def _papel_por_cargo(cargo: Any, origem: str = "") -> str:
    texto = _normalizar(f"{cargo} {origem}")
    if "coord" in texto:
        return "coordenador"
    return "gestor"


def _tipo_vinculo_para_tipo_comissionado(tipo_vinculo: Any, cargo: Any) -> tuple[str, bool, str]:
    texto = _normalizar(f"{tipo_vinculo} {cargo}")
    if "clt" in texto:
        return "CLT", False, "nao_aplicavel"
    return "PJ_AUTONOMO", True, "pendente_nf"


def _cargo_eh_lider(cargo: Any) -> bool:
    texto = _normalizar(cargo)
    if "diretor" in texto:
        return False
    return any(termo in texto for termo in ("gerente", "coord", "head"))


def _primeiro_dia_util(ano: int, mes: int) -> date:
    dia = date(ano, mes, 1)
    while dia.weekday() >= 5:
        dia += timedelta(days=1)
    return dia


def _nome_valido(nome: Any) -> bool:
    texto = _normalizar(nome)
    return bool(texto) and "vago" not in texto and texto not in {"-", "nao informado", "n a"}


def _nome_equivalente(a: Any, b: Any) -> bool:
    na = _normalizar(a)
    nb = _normalizar(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    tokens_a = set(na.split())
    tokens_b = set(nb.split())
    if len(tokens_a) >= 2 and len(tokens_b) >= 2:
        inter = tokens_a & tokens_b
        return len(inter) >= min(len(tokens_a), len(tokens_b)) - 1 and len(inter) >= 2
    return False


@dataclass
class Lider:
    nome: str
    cargo: str
    papel: str
    origem: str
    tipo_funcionario: str = "FUNCIONARIO"
    documento: str | None = None
    email: str | None = None
    identificador_usuario: str | None = None
    identificador_funcionario: str | None = None
    perfil_acesso: str | None = None
    tipo_vinculo: str | None = None
    regional: str | None = None
    regiao: str | None = None
    imobiliaria: str | None = None
    fontes: list[str] = field(default_factory=list)

    @property
    def chave_nome(self) -> str:
        return _normalizar(self.nome)

    @property
    def resultado_id(self) -> str:
        chave = self.documento or self.email or self.chave_nome
        return f"prod-auto-{self.papel}-{_md5_curto(chave)}"


def _preferir(atual: Any, novo: Any) -> Any:
    return atual if atual not in (None, "") else novo


def _fundir_lider(atual: Lider, novo: Lider) -> Lider:
    atual.documento = _preferir(atual.documento, novo.documento)
    atual.email = _preferir(atual.email, novo.email)
    atual.identificador_usuario = _preferir(atual.identificador_usuario, novo.identificador_usuario)
    atual.identificador_funcionario = _preferir(atual.identificador_funcionario, novo.identificador_funcionario)
    atual.perfil_acesso = _preferir(atual.perfil_acesso, novo.perfil_acesso)
    atual.tipo_vinculo = _preferir(atual.tipo_vinculo, novo.tipo_vinculo)
    atual.regional = _preferir(atual.regional, novo.regional)
    atual.regiao = _preferir(atual.regiao, novo.regiao)
    atual.imobiliaria = _preferir(atual.imobiliaria, novo.imobiliaria)
    if atual.origem != "funcionario_acesso" and novo.origem == "funcionario_acesso":
        atual.nome = novo.nome
        atual.cargo = novo.cargo
        atual.papel = novo.papel
        atual.origem = novo.origem
        atual.tipo_funcionario = novo.tipo_funcionario
    atual.fontes = sorted(set([*atual.fontes, novo.origem, *novo.fontes]))
    return atual


async def _carregar_lideres(conexao, inicio: date, fim: date) -> dict[str, Lider]:
    funcionarios = [dict(linha) for linha in await conexao.fetch(
        """
        select
            identificador_funcionario::text,
            identificador_usuario::text,
            tipo_funcionario,
            documento,
            email::text,
            nome,
            cargo,
            perfil_acesso_padrao,
            tipo_vinculo,
            imobiliaria,
            regional,
            regiao,
            coordenador,
            coordenador_documento,
            coordenador_email::text,
            gestor,
            gestor_documento,
            gestor_email::text,
            gerente,
            gerente_documento,
            gerente_email::text,
            diretor,
            diretor_documento,
            diretor_email::text
        from sevenlm_connect.funcionario_acesso
        where ativo is true
          and coalesce(ativo_negocio, true) is true
          and coalesce(data_inicio_vigencia, date '1900-01-01') <= $2
          and coalesce(data_fim_vigencia, date '2999-12-31') >= $1
        """,
        inicio,
        fim,
    )]
    equipes = [dict(linha) for linha in await conexao.fetch(
        """
        select *
        from sevenlm_connect.funcionario_equipe_vigencia
        where ativo is true
          and status_equipe = 'ATIVO'
          and coalesce(data_inicio_vigencia, date '1900-01-01') <= $2
          and coalesce(data_fim_vigencia, date '2999-12-31') >= $1
        """,
        inicio,
        fim,
    )]

    lideres: dict[str, Lider] = {}

    def adicionar(lider: Lider) -> None:
        if not _nome_valido(lider.nome):
            return
        lider.documento = _documento(lider.documento) or None
        lider.email = _email(lider.email) or None
        lider.fontes = sorted(set([*lider.fontes, lider.origem]))
        chave = lider.documento or lider.email or lider.chave_nome
        chave_existente = None
        for existente_chave, existente in lideres.items():
            if chave and chave in {existente.documento, existente.email, existente.chave_nome}:
                chave_existente = existente_chave
                break
            if _nome_equivalente(existente.nome, lider.nome):
                chave_existente = existente_chave
                break
        if chave_existente:
            lideres[chave_existente] = _fundir_lider(lideres[chave_existente], lider)
        else:
            lideres[chave] = lider

    for funcionario in funcionarios:
        if _cargo_eh_lider(funcionario.get("cargo")):
            cargo = funcionario.get("cargo") or "Lideranca Comercial"
            adicionar(Lider(
                nome=funcionario.get("nome") or "",
                cargo=cargo,
                papel=_papel_por_cargo(cargo),
                origem="funcionario_acesso",
                tipo_funcionario=funcionario.get("tipo_funcionario") or "FUNCIONARIO",
                documento=funcionario.get("documento"),
                email=funcionario.get("email"),
                identificador_usuario=funcionario.get("identificador_usuario"),
                identificador_funcionario=funcionario.get("identificador_funcionario"),
                perfil_acesso=funcionario.get("perfil_acesso_padrao"),
                tipo_vinculo=funcionario.get("tipo_vinculo"),
                regional=funcionario.get("regional"),
                regiao=funcionario.get("regiao"),
                imobiliaria=funcionario.get("imobiliaria"),
            ))
        adicionar(Lider(
            nome=funcionario.get("coordenador") or "",
            cargo="Coordenador de Vendas",
            papel="coordenador",
            origem="funcionario_acesso.coordenador",
            documento=funcionario.get("coordenador_documento"),
            email=funcionario.get("coordenador_email"),
        ))

    for equipe in equipes:
        for campo, cargo in (
            ("gerente_vendas", "Gerente de Vendas"),
            ("gerente_comercial", "Gerente Comercial"),
            ("gerente_regional", "Gerente Regional"),
            ("head_comercial", "Head Comercial"),
        ):
            adicionar(Lider(
                nome=equipe.get(campo) or "",
                cargo=cargo,
                papel="gestor",
                origem=f"funcionario_equipe_vigencia.{campo}",
                regiao=equipe.get("regiao"),
            ))

    return lideres


async def _valores_existentes(conexao, ciclo_id: str) -> dict[str, dict[str, Any]]:
    linhas = await conexao.fetch(
        f"""
        select *
        from {ESQUEMA_COMISSIONAMENTO}.resultados
        where ciclo_id = $1
        """,
        ciclo_id,
    )
    existentes: dict[str, dict[str, Any]] = {}
    for linha in linhas:
        item = dict(linha)
        chaves = {
            _normalizar(item.get("nome")),
            _documento(item.get("documento")),
            _email(item.get("email")),
            str(item.get("identificador_funcionario") or ""),
            str(item.get("identificador_usuario") or ""),
        }
        for chave in chaves:
            if chave:
                existentes.setdefault(chave, item)
    return existentes


def _match_existente(lider: Lider, existentes: dict[str, dict[str, Any]]) -> dict[str, Any] | None:
    for chave in (
        lider.documento,
        lider.email,
        lider.identificador_funcionario,
        lider.identificador_usuario,
        lider.chave_nome,
    ):
        if chave and str(chave) in existentes:
            return existentes[str(chave)]
    for item in set(id(valor) for valor in existentes.values()):
        _ = item
    vistos: set[str] = set()
    for existente in existentes.values():
        resultado_id = str(existente.get("resultado_id") or "")
        if resultado_id in vistos:
            continue
        vistos.add(resultado_id)
        if _nome_equivalente(lider.nome, existente.get("nome")):
            return existente
    return None


def _payload_validacao(lider: Lider, ciclo_id: str, existente: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "validado": bool(lider.origem == "funcionario_acesso" or lider.documento or lider.email),
        "fonte": ORIGEM_AUTOMATICA,
        "ciclo_id": ciclo_id,
        "origens": lider.fontes,
        "papel": lider.papel,
        "cargo": lider.cargo,
        "preservou_valor_existente": bool(existente),
        "resultado_id_anterior": existente.get("resultado_id") if existente else None,
        "observacoes": [
            "Ativo no mes pela vigencia da Maquina de Vendas.",
            "Valores preservados quando ja existiam no ciclo; novos lideres entram zerados para a Secretaria ajustar regras.",
            "Diretoria Comercial nao entra em resultados de ciclo; fica restrita a aprovacao comercial.",
            "Snapshot detalhado aceita apenas gestor/coordenador por restricao atual da tabela.",
        ],
    }


def _template_ciclo_reiniciado() -> dict[str, Any]:
    corpo_html = """
<p>O ciclo <strong>{{ ciclo }}</strong> foi reiniciado para <strong>{{ mes_referencia }}</strong>.</p>
<p>Todos os comissionados ativos do mes foram colocados na etapa <strong>Calculada/Revisao</strong>, prontos para conferencia e ajuste de regras pela Secretaria de Vendas.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:8px;border:1px solid #d9e2ef;">Primeiro dia util de referencia</td><td style="padding:8px;border:1px solid #d9e2ef;"><strong>{{ primeiro_dia_util }}</strong></td></tr>
  <tr><td style="padding:8px;border:1px solid #d9e2ef;">Executado em</td><td style="padding:8px;border:1px solid #d9e2ef;"><strong>{{ data_execucao }}</strong></td></tr>
  <tr><td style="padding:8px;border:1px solid #d9e2ef;">Resultados no ciclo</td><td style="padding:8px;border:1px solid #d9e2ef;"><strong>{{ total_resultados }}</strong></td></tr>
  <tr><td style="padding:8px;border:1px solid #d9e2ef;">Gestores</td><td style="padding:8px;border:1px solid #d9e2ef;"><strong>{{ total_gestores }}</strong></td></tr>
  <tr><td style="padding:8px;border:1px solid #d9e2ef;">Coordenadores</td><td style="padding:8px;border:1px solid #d9e2ef;"><strong>{{ total_coordenadores }}</strong></td></tr>
</table>
<p>Diretoria Comercial permanece apenas na visao de Aprovacao Comercial e nao e criada como comissionado do ciclo.</p>
"""
    corpo_texto = """Ciclo reiniciado: {{ ciclo }}
Mes: {{ mes_referencia }}
Primeiro dia util: {{ primeiro_dia_util }}
Executado em: {{ data_execucao }}
Resultados no ciclo: {{ total_resultados }}
Gestores: {{ total_gestores }}
Coordenadores: {{ total_coordenadores }}

Todos foram colocados em Calculada/Revisao para conferencia da Secretaria de Vendas.
Diretoria Comercial permanece apenas na visao de Aprovacao Comercial."""
    return {
        "codigo": TEMPLATE_CICLO_REINICIADO,
        "versao": 1,
        "canal": "email",
        "assunto": "Comissionamento {{ ciclo }} reiniciado para {{ mes_referencia }}",
        "titulo": "Ciclo {{ ciclo }} reiniciado",
        "corpo_html": corpo_html,
        "corpo_texto": corpo_texto,
        "cta_label": "Abrir Comissionamento",
        "cta_url_template": "{{ link_comissionamento }}",
        "variaveis_obrigatorias": [
            "ciclo",
            "mes_referencia",
            "primeiro_dia_util",
            "data_execucao",
            "total_resultados",
            "total_gestores",
            "total_coordenadores",
        ],
        "politica_mascaramento": {},
        "ativo": True,
    }


async def _destinatarios_secretaria(conexao) -> list[dict[str, Any]]:
    linhas = await conexao.fetch(
        """
        select distinct
            u.identificador_usuario::text as usuario_id,
            coalesce(fa.nome, u.nome_completo) as nome,
            coalesce(fa.email::text, u.correio_eletronico::text) as email,
            coalesce(fa.perfil_acesso_padrao, fa.cargo, 'Secretaria de Vendas') as perfil
        from sevenlm_connect.usuario u
        left join sevenlm_connect.funcionario_acesso fa
          on fa.identificador_usuario = u.identificador_usuario
          or lower(fa.email::text) = lower(u.correio_eletronico::text)
        where u.indicador_ativo is true
          and coalesce(fa.ativo, true) is true
          and coalesce(fa.ativo_negocio, true) is true
          and (
            lower(coalesce(fa.cargo, '')) like '%secretaria de vendas%'
            or lower(coalesce(fa.perfil_acesso_padrao, '')) like '%secretaria de vendas%'
            or lower(coalesce(u.correio_eletronico::text, '')) in ('hudson.porto@7lm.com.br', 'fernanda.oliveira@7lm.com.br')
          )
          and coalesce(coalesce(fa.email::text, u.correio_eletronico::text), '') <> ''
        order by nome
        """
    )
    return [
        {
            "usuario_id": linha["usuario_id"],
            "nome": linha["nome"],
            "email": linha["email"],
            "perfil": linha["perfil"],
        }
        for linha in linhas
    ]


async def _notificar_secretaria_ciclo_reiniciado(
    conexao,
    *,
    ciclo_id: str,
    ano: int,
    mes: int,
    resumo: dict[str, Any],
) -> dict[str, Any]:
    await salvar_template(conexao, ESQUEMA_COMISSIONAMENTO, _template_ciclo_reiniciado(), usuario_id=None)
    destinatarios = await _destinatarios_secretaria(conexao)
    payload = {
        "ciclo": ciclo_id,
        "ciclo_id": ciclo_id,
        "mes_referencia": f"{MESES[mes]}/{ano}",
        "primeiro_dia_util": _primeiro_dia_util(ano, mes).isoformat(),
        "data_execucao": date.today().isoformat(),
        "total_resultados": resumo.get("lideres_detectados") or 0,
        "total_gestores": (resumo.get("por_papel") or {}).get("gestor") or 0,
        "total_coordenadores": (resumo.get("por_papel") or {}).get("coordenador") or 0,
        "link_comissionamento": "/comercial/comissionamento",
        "acao_executada_por_nome": "Reset mensal automatico",
        "acao_executada_por_email": "sistema@7lm.com.br",
    }
    notificacao = await criar_notificacao_manual(
        conexao,
        ESQUEMA_COMISSIONAMENTO,
        template_codigo=TEMPLATE_CICLO_REINICIADO,
        payload=payload,
        destinatarios=destinatarios,
        usuario_id=None,
        idempotency_key=f"{AGENTE}:{ciclo_id}:secretaria_ciclo_reiniciado",
    )
    processamento = await processar_fila(conexao, ESQUEMA_COMISSIONAMENTO, limite=50)
    return {
        "template": TEMPLATE_CICLO_REINICIADO,
        "destinatarios": destinatarios,
        "notificacao": notificacao,
        "processamento": processamento,
    }


async def _upsert_ciclo(conexao, ciclo_id: str, ano: int, mes: int) -> None:
    rotulo = f"{MESES[mes]}/{ano}"
    await conexao.execute(
        f"""
        insert into {ESQUEMA_COMISSIONAMENTO}.ciclos (
            ciclo_id, mes, ano, rotulo, origem, status, prazo_envio_financeiro, prazo_nf_dias
        )
        values ($1, $2, $3, $4, $5, 'calculado', make_date($3, $2, 15), 2)
        on conflict (ciclo_id) do update
        set mes = excluded.mes,
            ano = excluded.ano,
            rotulo = excluded.rotulo,
            origem = excluded.origem,
            status = 'calculado',
            atualizado_em = now()
        """,
        ciclo_id,
        mes,
        ano,
        rotulo,
        ORIGEM_AUTOMATICA,
    )


async def _aplicar_resultados(conexao, ciclo_id: str, lideres: list[Lider]) -> list[dict[str, Any]]:
    existentes = await _valores_existentes(conexao, ciclo_id)
    ids_validos: list[str] = []
    importados: list[dict[str, Any]] = []

    for lider in lideres:
        existente = _match_existente(lider, existentes)
        resultado_id = str((existente or {}).get("resultado_id") or lider.resultado_id)
        tipo_comissionado, exige_nf, status_nf = _tipo_vinculo_para_tipo_comissionado(lider.tipo_vinculo, lider.cargo)
        valor_bruto = Decimal(str((existente or {}).get("valor_bruto") or "0")).quantize(Decimal("0.01"))
        desconto = Decimal(str((existente or {}).get("desconto_distrato") or "0")).quantize(Decimal("0.01"))
        validacao = _payload_validacao(lider, ciclo_id, existente)
        ids_validos.append(resultado_id)
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
                $1, $2, $3, $4, $5, $6, $7, $8,
                'calculado', $9, 'nao_enviado', 'nao_enviado', $10,
                $11, $12::uuid, $13::uuid, $14, $15, $16, $17, $18, $19, $20::jsonb
            )
            on conflict (resultado_id) do update
            set funcao = excluded.funcao,
                cidade = excluded.cidade,
                nome = excluded.nome,
                tipo_comissionado = excluded.tipo_comissionado,
                valor_bruto = excluded.valor_bruto,
                desconto_distrato = excluded.desconto_distrato,
                status = 'calculado',
                status_nf = excluded.status_nf,
                status_financeiro = 'nao_enviado',
                status_pagamento = 'nao_enviado',
                exige_nf = excluded.exige_nf,
                origem = excluded.origem,
                identificador_usuario = excluded.identificador_usuario,
                identificador_funcionario = excluded.identificador_funcionario,
                documento = excluded.documento,
                email = excluded.email,
                cargo = excluded.cargo,
                perfil_acesso = excluded.perfil_acesso,
                papel_comissionamento = excluded.papel_comissionamento,
                origem_identidade = excluded.origem_identidade,
                validacao_lideranca = excluded.validacao_lideranca,
                atualizado_em = now()
            """,
            resultado_id,
            ciclo_id,
            lider.cargo,
            lider.regiao or lider.regional or "-",
            lider.nome,
            tipo_comissionado,
            valor_bruto,
            desconto,
            status_nf,
            exige_nf,
            ORIGEM_AUTOMATICA,
            _uuid(lider.identificador_usuario),
            _uuid(lider.identificador_funcionario),
            lider.documento,
            lider.email,
            lider.cargo,
            lider.perfil_acesso,
            lider.papel,
            lider.origem,
            json.dumps(validacao, ensure_ascii=False, default=str),
        )
        importados.append({
            "resultado_id": resultado_id,
            "nome": lider.nome,
            "cargo": lider.cargo,
            "papel": lider.papel,
            "email": lider.email,
            "documento": lider.documento,
            "valor_bruto_preservado": float(valor_bruto),
            "origens": lider.fontes,
            "existia_no_ciclo": bool(existente),
        })

    removidos = await conexao.fetch(
        f"""
        delete from {ESQUEMA_COMISSIONAMENTO}.resultados
        where ciclo_id = $1
          and origem in ($2, 'banco_producao_identidade')
          and not (resultado_id = any($3::text[]))
        returning resultado_id, nome, cargo, valor_bruto
        """,
        ciclo_id,
        ORIGEM_AUTOMATICA,
        ids_validos,
    )
    importados.append({
        "controle": "removidos_fora_da_base_ativa",
        "quantidade": len(removidos),
        "itens": [dict(item) for item in removidos],
    })
    return importados


async def _recriar_snapshot(conexao, ciclo_id: str, inicio: date, fim: date, lideres: dict[str, Lider]) -> dict[str, Any]:
    await conexao.execute(f"delete from {ESQUEMA_COMISSIONAMENTO}.hierarquia_snapshot where ciclo_id = $1", ciclo_id)
    funcionarios = [dict(linha) for linha in await conexao.fetch(
        """
        select
            identificador_funcionario::text,
            identificador_usuario::text,
            tipo_funcionario,
            documento,
            email::text,
            nome,
            cargo,
            imobiliaria,
            regional,
            regiao,
            coordenador,
            coordenador_documento,
            coordenador_email::text,
            gestor,
            gestor_documento,
            gestor_email::text,
            gerente,
            gerente_documento,
            gerente_email::text
        from sevenlm_connect.funcionario_acesso
        where ativo is true
          and coalesce(ativo_negocio, true) is true
          and coalesce(data_inicio_vigencia, date '1900-01-01') <= $2
          and coalesce(data_fim_vigencia, date '2999-12-31') >= $1
        """,
        inicio,
        fim,
    )]

    def resolver_lider(nome: Any, documento: Any, email: Any, papel: str) -> Lider | None:
        if not _nome_valido(nome):
            return None
        doc = _documento(documento)
        mail = _email(email)
        for lider in lideres.values():
            if doc and doc == lider.documento:
                return lider
            if mail and mail == lider.email:
                return lider
            if _nome_equivalente(nome, lider.nome):
                return lider
        return Lider(nome=str(nome), cargo="Coordenador de Vendas" if papel == "coordenador" else "Gerente de Vendas", papel=papel, origem="snapshot_inferido", documento=doc or None, email=mail or None)

    linhas: list[tuple[Any, ...]] = []
    for funcionario in funcionarios:
        for papel, nome_lider, doc_lider, email_lider in (
            ("gestor", funcionario.get("gestor"), funcionario.get("gestor_documento"), funcionario.get("gestor_email")),
            ("gestor", funcionario.get("gerente"), funcionario.get("gerente_documento"), funcionario.get("gerente_email")),
            ("coordenador", funcionario.get("coordenador"), funcionario.get("coordenador_documento"), funcionario.get("coordenador_email")),
        ):
            lider = resolver_lider(nome_lider, doc_lider, email_lider, papel)
            if not lider or _normalizar(lider.nome) == _normalizar(funcionario.get("nome")):
                continue
            linhas.append((
                ciclo_id,
                ciclo_id,
                papel,
                lider.resultado_id,
                lider.nome,
                lider.documento or _documento(doc_lider) or None,
                lider.email or _email(email_lider) or None,
                funcionario.get("gestor") or funcionario.get("gerente"),
                funcionario.get("gestor_documento") or funcionario.get("gerente_documento"),
                funcionario.get("gestor_email") or funcionario.get("gerente_email"),
                funcionario.get("coordenador"),
                funcionario.get("coordenador_documento"),
                funcionario.get("coordenador_email"),
                funcionario.get("nome"),
                funcionario.get("tipo_funcionario"),
                funcionario.get("documento") or funcionario.get("email") or funcionario.get("nome"),
                funcionario.get("documento") or funcionario.get("email") or funcionario.get("nome"),
                funcionario.get("regiao") or funcionario.get("regional"),
                funcionario.get("imobiliaria"),
                True,
                True,
                json.dumps({"origem": "reset_mensal_funcionario_acesso", "funcionario": funcionario}, ensure_ascii=False, default=str),
                _uuid(lider.identificador_usuario),
                _uuid(lider.identificador_funcionario),
                lider.cargo,
                lider.perfil_acesso,
                lider.origem,
                _uuid(funcionario.get("identificador_usuario")),
                _uuid(funcionario.get("identificador_funcionario")),
                _documento(funcionario.get("documento")) or None,
                _email(funcionario.get("email")) or None,
                funcionario.get("cargo"),
                "ativo",
                "funcionario_acesso",
                "funcionario_acesso",
            ))

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
        "linhas": len(linhas),
        "gestores": len({linha[3] for linha in linhas if linha[2] == "gestor"}),
        "coordenadores": len({linha[3] for linha in linhas if linha[2] == "coordenador"}),
        "vinculados_distintos": len({linha[15] for linha in linhas}),
    }


async def resetar(
    ciclo_id: str,
    aplicar: bool,
    *,
    notificar_secretaria: bool = False,
    forcar_notificacao: bool = False,
) -> dict[str, Any]:
    ano, mes, inicio, fim = _mes_periodo(ciclo_id)
    pool = await iniciar_pool_de_conexoes()
    try:
        async with pool.acquire() as conexao:
            lideres_dict = await _carregar_lideres(conexao, inicio, fim)
            lideres = sorted(lideres_dict.values(), key=lambda item: (_normalizar(item.nome), item.papel))
            existentes = await _valores_existentes(conexao, ciclo_id)
            preview = []
            for lider in lideres:
                existente = _match_existente(lider, existentes)
                preview.append({
                    "resultado_id": (existente or {}).get("resultado_id") or lider.resultado_id,
                    "nome": lider.nome,
                    "cargo": lider.cargo,
                    "papel": lider.papel,
                    "email": lider.email,
                    "documento": lider.documento,
                    "origens": lider.fontes,
                    "valor_preservado": float(Decimal(str((existente or {}).get("valor_bruto") or "0"))),
                    "existia_no_ciclo": bool(existente),
                })
            resumo: dict[str, Any] = {
                "ciclo_id": ciclo_id,
                "periodo": {"inicio": inicio.isoformat(), "fim": fim.isoformat()},
                "modo": "apply" if aplicar else "dry-run",
                "lideres_detectados": len(lideres),
                "por_papel": {
                    "gestor": sum(1 for item in lideres if item.papel == "gestor"),
                    "coordenador": sum(1 for item in lideres if item.papel == "coordenador"),
                },
                "preview": preview,
            }
            if aplicar:
                async with conexao.transaction():
                    await _upsert_ciclo(conexao, ciclo_id, ano, mes)
                    importados = await _aplicar_resultados(conexao, ciclo_id, lideres)
                    snapshot = await _recriar_snapshot(conexao, ciclo_id, inicio, fim, lideres_dict)
                    realizado = await materializar_resultados_metas_lideranca(conexao, ciclo_id, aplicar=True)
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
                        values ($1, 'ciclo_reset_mensal_maquina_vendas', $2, $3::jsonb, $4, '127.0.0.1', $5)
                        """,
                        ciclo_id,
                        "Ciclo resetado pela Maquina de Vendas com liderancas ativas, etapa Calculada/Revisao e realizado oficial inicial.",
                        json.dumps({"importados": importados, "snapshot": snapshot, "realizado": realizado}, ensure_ascii=False, default=str),
                        f"{AGENTE}:{ciclo_id}:reset_mensal",
                        AGENTE,
                    )
                    resumo["aplicado"] = {"importados": importados, "snapshot": snapshot, "realizado": realizado}
                deve_notificar = notificar_secretaria and (forcar_notificacao or date.today() == _primeiro_dia_util(ano, mes))
                resumo["notificacao_secretaria"] = {
                    "habilitada": bool(notificar_secretaria),
                    "executada": bool(deve_notificar),
                    "primeiro_dia_util": _primeiro_dia_util(ano, mes).isoformat(),
                }
                if deve_notificar:
                    resumo["notificacao_secretaria"].update(await _notificar_secretaria_ciclo_reiniciado(
                        conexao,
                        ciclo_id=ciclo_id,
                        ano=ano,
                        mes=mes,
                        resumo=resumo,
                    ))
            REGISTRO_SAIDA.mkdir(parents=True, exist_ok=True)
            saida = REGISTRO_SAIDA / f"comissionamento_reset_mensal_{ciclo_id}_{'apply' if aplicar else 'dry_run'}.json"
            saida.write_text(json.dumps(resumo, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
            resumo["arquivo"] = str(saida)
            return resumo
    finally:
        await encerrar_pool_de_conexoes()


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset mensal do ciclo de comissionamento pela Maquina de Vendas.")
    parser.add_argument("--ciclo", help="Ciclo no formato YYYY-MM, ex.: 2026-06. Sem informar, usa o mes atual.")
    parser.add_argument("--apply", action="store_true", help="Grava as alteracoes. Sem esta flag, apenas gera dry-run.")
    parser.add_argument(
        "--somente-primeiro-dia-util",
        action="store_true",
        help="Nao executa se hoje nao for o primeiro dia util do ciclo.",
    )
    parser.add_argument(
        "--notificar-secretaria",
        action="store_true",
        help="Compatibilidade: o aviso ja e automatico em --apply; esta flag mantem o comportamento explicito.",
    )
    parser.add_argument(
        "--sem-notificacao",
        action="store_true",
        help="Nao envia o aviso automatico para a Secretaria de Vendas.",
    )
    parser.add_argument(
        "--forcar-notificacao",
        action="store_true",
        help="Envia o aviso mesmo fora do primeiro dia util, util para teste controlado.",
    )
    args = parser.parse_args()
    ciclo_id = args.ciclo or date.today().strftime("%Y-%m")
    ano, mes, _, _ = _mes_periodo(ciclo_id)
    primeiro_dia_util = _primeiro_dia_util(ano, mes)
    if args.somente_primeiro_dia_util and date.today() != primeiro_dia_util:
        print(json.dumps({
            "ciclo_id": ciclo_id,
            "modo": "skip",
            "motivo": "hoje_nao_e_primeiro_dia_util",
            "hoje": date.today().isoformat(),
            "primeiro_dia_util": primeiro_dia_util.isoformat(),
        }, ensure_ascii=False, indent=2))
        return
    resumo = asyncio.run(resetar(
        ciclo_id,
        args.apply,
        notificar_secretaria=args.apply and not args.sem_notificacao or args.notificar_secretaria,
        forcar_notificacao=args.forcar_notificacao,
    ))
    print(json.dumps({
        "ciclo_id": resumo["ciclo_id"],
        "modo": resumo["modo"],
        "lideres_detectados": resumo["lideres_detectados"],
        "por_papel": resumo["por_papel"],
        "arquivo": resumo["arquivo"],
        "aplicado": resumo.get("aplicado", {}).get("snapshot") if resumo.get("aplicado") else None,
        "notificacao_secretaria": resumo.get("notificacao_secretaria"),
    }, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
