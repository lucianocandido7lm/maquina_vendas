"""
Cria um ciclo manual de validacao do fluxo de Comissionamento.

O ciclo usa dados reais ja resolvidos no ciclo produtivo 2026-06:
identidade, hierarquia, cargos, localidades e valores. Fica isolado para
teste de botoes, eventos e e-mails.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
import sys

BASE_API = Path(__file__).resolve().parents[1]
if str(BASE_API) not in sys.path:
    sys.path.insert(0, str(BASE_API))

from banco import encerrar_pool_de_conexoes, iniciar_pool_de_conexoes  # noqa: E402
from configuracoes import ESQUEMA_COMISSIONAMENTO  # noqa: E402
from repositorios.comissionamento import (  # noqa: E402
    buscar_resultado_por_id,
    registrar_evento_comissionamento,
    serializar_linha_resultado,
)
from servicos.notificacoes_comissionamento import criar_notificacao_de_acao  # noqa: E402


CICLO_MANUAL = "2026-06-fluxo-manual"
AGENTE_TESTE = "criar_fluxo_manual_comissionamento.py"

CENARIOS_DEMO = [
    {
        "id": "manual-2026-06-calculo-base",
        "rotulo": "Calculada 01",
        "cenario": "calculada_sem_alteracao_01",
        "status": "calculado",
        "status_nf": "pendente_nf",
        "status_financeiro": "nao_enviado",
        "status_pagamento": "nao_enviado",
        "acao_notificacao": None,
        "evento": "teste_manual.calculada_sem_alteracao",
        "descricao": "Comissao real de junho em Calculada/Revisao, sem alteracao no fluxo.",
    },
    {
        "id": "manual-2026-06-calculo-base-2",
        "rotulo": "Calculada 02",
        "cenario": "calculada_sem_alteracao_02",
        "status": "calculado",
        "status_nf": "pendente_nf",
        "status_financeiro": "nao_enviado",
        "status_pagamento": "nao_enviado",
        "acao_notificacao": None,
        "evento": "teste_manual.calculada_sem_alteracao",
        "descricao": "Segunda comissao real de junho em Calculada/Revisao, sem alteracao no fluxo.",
    },
    {
        "id": "manual-2026-06-reajuste-comissionado",
        "rotulo": "Reajuste Comissionado",
        "cenario": "aprovada_comercial_reajuste_comissionado",
        "status": "revisao_necessaria",
        "status_nf": "pendente_nf",
        "status_financeiro": "nao_enviado",
        "status_pagamento": "nao_enviado",
        "acao_notificacao": None,
        "evento": "teste_manual.reajuste_comissionado",
        "descricao": "Comissao aprovada pela Aprovacao Comercial; comissionado pediu reajuste e voltou para Calculada/Revisao.",
        "historico_reajuste_comissionado": True,
    },
]


def _cenarios_pj() -> list[dict]:
    return [dict(cenario) for cenario in CENARIOS_DEMO]


async def _limpar_ciclo_manual(conn) -> None:
    await conn.execute(
        f"""
        delete from {ESQUEMA_COMISSIONAMENTO}.idempotency_keys
        where chave like $1
        """,
        f"{CICLO_MANUAL}:%",
    )
    await conn.execute(
        f"""
        delete from {ESQUEMA_COMISSIONAMENTO}.notificacao_logs
        where fila_envio_id in (
            select f.fila_envio_id
            from {ESQUEMA_COMISSIONAMENTO}.notificacao_fila_envio f
            join {ESQUEMA_COMISSIONAMENTO}.notificacao_eventos e on e.evento_id = f.evento_id
            where e.ciclo_id = $1
        )
        """,
        CICLO_MANUAL,
    )
    await conn.execute(
        f"""
        delete from {ESQUEMA_COMISSIONAMENTO}.notificacao_fila_envio f
        using {ESQUEMA_COMISSIONAMENTO}.notificacao_eventos e
        where f.evento_id = e.evento_id
          and e.ciclo_id = $1
        """,
        CICLO_MANUAL,
    )
    await conn.execute(
        f"""
        delete from {ESQUEMA_COMISSIONAMENTO}.notificacao_destinatarios d
        using {ESQUEMA_COMISSIONAMENTO}.notificacoes n
        where d.notificacao_id = n.notificacao_id
          and n.ciclo_id = $1
        """,
        CICLO_MANUAL,
    )
    await conn.execute(f"delete from {ESQUEMA_COMISSIONAMENTO}.notificacoes where ciclo_id = $1", CICLO_MANUAL)
    await conn.execute(f"delete from {ESQUEMA_COMISSIONAMENTO}.notificacao_eventos where ciclo_id = $1", CICLO_MANUAL)
    await conn.execute(f"delete from {ESQUEMA_COMISSIONAMENTO}.eventos where ciclo_id = $1", CICLO_MANUAL)
    await conn.execute(f"delete from {ESQUEMA_COMISSIONAMENTO}.documentos where ciclo_id = $1", CICLO_MANUAL)
    await conn.execute(f"delete from {ESQUEMA_COMISSIONAMENTO}.resultados where ciclo_id = $1", CICLO_MANUAL)
    await conn.execute(f"delete from {ESQUEMA_COMISSIONAMENTO}.ciclos where ciclo_id = $1", CICLO_MANUAL)


async def _fontes_2026_06(conn) -> list[dict]:
    pjs = [
        dict(linha)
        for linha in await conn.fetch(
            f"""
            select resultado_id, nome
            from {ESQUEMA_COMISSIONAMENTO}.resultados
            where ciclo_id = '2026-06'
              and exige_nf = true
              and origem = 'banco_producao_identidade'
            order by
              case when valor_bruto > 0 then 0 else 1 end,
              case when nullif(trim(email), '') is null then 1 else 0 end,
              nome
            """
        )
    ]
    return pjs


async def _copiar_resultado(conn, fonte_id: str, cenario: dict, origem_extra: str) -> dict:
    linha = await conn.fetchrow(
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
        select
            $1,
            $2,
            funcao,
            cidade,
            nome,
            'PJ_AUTONOMO',
            valor_bruto,
            desconto_distrato,
            $4,
            $5,
            $6,
            $7,
            true,
            $3,
            identificador_usuario,
            identificador_funcionario,
            documento,
            email,
            cargo,
            perfil_acesso,
            papel_comissionamento,
            origem_identidade,
            validacao_lideranca
        from {ESQUEMA_COMISSIONAMENTO}.resultados
        where resultado_id = $8
        returning resultado_id
        """,
        cenario["id"],
        CICLO_MANUAL,
        origem_extra,
        cenario["status"],
        cenario["status_nf"],
        cenario["status_financeiro"],
        cenario["status_pagamento"],
        fonte_id,
    )
    if not linha:
        raise RuntimeError(f"Resultado base nao encontrado no ciclo 2026-06: {fonte_id}")
    resultado = await buscar_resultado_por_id(conn, ESQUEMA_COMISSIONAMENTO, cenario["id"])
    if not resultado:
        raise RuntimeError(f"Resultado manual nao encontrado apos insert: {cenario['id']}")
    return resultado


async def _registrar_documento_nf(conn, resultado: dict) -> None:
    valor_nf = (resultado.get("valores") or {}).get("liquido") or resultado.get("valor_liquido") or resultado.get("valor_bruto") or 0
    await conn.execute(
        f"""
        insert into {ESQUEMA_COMISSIONAMENTO}.documentos (
            resultado_id,
            ciclo_id,
            tipo_documento,
            nome_arquivo,
            content_type,
            tamanho_bytes,
            numero_nf,
            data_emissao,
            valor_nf,
            observacao,
            conteudo,
            status_documento
        )
        values ($1, $2, 'nota_fiscal', 'nf-teste-fluxo-manual.pdf', 'application/pdf', 2048, 'NF-TESTE-2026-06', current_date, $3, 'Metadado de teste; PDF nao armazenado no portal.', null, 'recebido')
        """,
        resultado["id"],
        CICLO_MANUAL,
        valor_nf,
    )


async def _registrar_cenario(conn, resultado: dict, cenario: dict) -> dict:
    antes = {
        **resultado,
        "status": cenario.get("antes_status") or "calculado",
        "status_nf": cenario.get("antes_status_nf") or ("pendente_nf" if resultado.get("exige_nf") else "nao_aplicavel"),
        "status_financeiro": cenario.get("antes_status_financeiro") or "nao_enviado",
        "status_pagamento": cenario.get("antes_status_pagamento") or "nao_enviado",
    }
    comentario = f"{cenario['descricao']} Decisoes: aprovador configuravel por ciclo; valores somente no portal autenticado; SLA NF ate 2 dias; disparo manual apenas Secretaria."
    evento = await registrar_evento_comissionamento(
        conn,
        ESQUEMA_COMISSIONAMENTO,
        tipo_evento=cenario["evento"],
        usuario_id=None,
        sessao_id=None,
        endereco_ip="127.0.0.1",
        agente_do_usuario=AGENTE_TESTE,
        antes=antes,
        depois=resultado,
        comentario=comentario,
        regra="teste_manual_2026_06",
        idempotency_key=f"{CICLO_MANUAL}:{cenario['id']}:{cenario['evento']}",
    )
    notificacao = None
    if cenario.get("acao_notificacao"):
        notificacao = await criar_notificacao_de_acao(
            conn,
            ESQUEMA_COMISSIONAMENTO,
            acao=cenario["acao_notificacao"],
            evento_negocio_id=evento["id"],
            antes=antes,
            depois=resultado,
            exige_nf=bool(resultado.get("exige_nf")),
            comentario=comentario,
            idempotency_key=f"{CICLO_MANUAL}:notificacao:{cenario['id']}:{cenario['acao_notificacao']}",
            usuario_id=None,
            origem="teste_manual",
            destino_pacote=("Financeiro e RH" if not resultado.get("exige_nf") else "Financeiro"),
            extra_payload={
                "nome_destinatario": "Destinatario de teste em allowlist",
                "acao_executada_por_nome": "Secretaria de Vendas",
                "acao_executada_por_email": "secretaria@7lm.com.br",
                "acao_executada_por_perfil": "Secretaria",
                "prazo": "2 dias uteis",
                "nf_numero": "NF-TESTE-2026-06",
                "nf_data_emissao": "2026-06-15",
                "nf_nome_arquivo": "nf-teste-fluxo-manual.pdf",
                "nf_observacao": "Teste controlado: valor deve ser consultado somente no portal autenticado.",
            },
        )
    return {
        "cenario": cenario["cenario"],
        "resultado_id": resultado["id"],
        "codigo_comissao": resultado.get("codigo_comissao"),
        "nome": resultado["nome"],
        "status": resultado["fluxo"]["status_aprovacao"],
        "status_nf": resultado["fluxo"]["status_nf"],
        "status_financeiro": resultado["fluxo"]["status_financeiro"],
        "status_pagamento": resultado["fluxo"]["status_pagamento"],
        "acoes_permitidas": resultado["fluxo"]["acoes_permitidas"],
        "evento_id": evento["id"],
        "notificacao_id": (notificacao or {}).get("id") if isinstance(notificacao, dict) else None,
        "filas_email": len((notificacao or {}).get("filas") or []) if isinstance(notificacao, dict) else 0,
        "descricao": cenario["descricao"],
    }


async def _registrar_historico_reajuste_comissionado(conn, resultado: dict, cenario: dict) -> None:
    aprovado = {
        **resultado,
        "status": "aguardando_nf",
        "status_nf": "solicitada",
        "status_financeiro": "nao_enviado",
        "status_pagamento": "nao_enviado",
    }
    evento_aprovacao = await registrar_evento_comissionamento(
        conn,
        ESQUEMA_COMISSIONAMENTO,
        tipo_evento="comissao_aprovada_head",
        usuario_id=None,
        sessao_id=None,
        endereco_ip="127.0.0.1",
        agente_do_usuario=AGENTE_TESTE,
        antes={
            **resultado,
            "status": "aguardando_head_comercial",
            "status_nf": "pendente_nf",
            "status_financeiro": "nao_enviado",
            "status_pagamento": "nao_enviado",
        },
        depois=aprovado,
        comentario="Historico demonstrativo: Aprovacao Comercial aprovou a comissao antes do pedido de reajuste.",
        regra="fluxo_manual_2026_06",
        idempotency_key=f"{CICLO_MANUAL}:{cenario['id']}:historico:comissao_aprovada_head",
    )
    await conn.execute(
        f"update {ESQUEMA_COMISSIONAMENTO}.eventos set criado_em = now() - interval '2 minutes' where evento_id = $1::uuid",
        evento_aprovacao["id"],
    )
    evento_recalculo = await registrar_evento_comissionamento(
        conn,
        ESQUEMA_COMISSIONAMENTO,
        tipo_evento="recalculo_solicitado",
        usuario_id=None,
        sessao_id=None,
        endereco_ip="127.0.0.1",
        agente_do_usuario=AGENTE_TESTE,
        antes=aprovado,
        depois=resultado,
        comentario="Historico demonstrativo: comissionado pediu reajuste/recalculo; comissao voltou para Calculada/Revisao.",
        regra="fluxo_manual_2026_06",
        idempotency_key=f"{CICLO_MANUAL}:{cenario['id']}:historico:recalculo_solicitado",
    )
    await conn.execute(
        f"update {ESQUEMA_COMISSIONAMENTO}.eventos set criado_em = now() - interval '1 minute' where evento_id = $1::uuid",
        evento_recalculo["id"],
    )


async def criar_fluxo() -> dict:
    pool = await iniciar_pool_de_conexoes()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await _limpar_ciclo_manual(conn)
            cenarios_pj = _cenarios_pj()
            fontes_pj = await _fontes_2026_06(conn)
            if len(fontes_pj) < len(cenarios_pj):
                raise RuntimeError(
                    f"Ciclo 2026-06 precisa ter ao menos {len(cenarios_pj)} PJ/autonomos para montar cenarios; encontrados {len(fontes_pj)}."
                )
            await conn.execute(
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
                values ($1, 6, 2026, 'Junho/2026 - Fluxo Manual', 'teste_manual_banco', 'calculado', date '2026-07-15', 2)
                """,
                CICLO_MANUAL,
            )

            comissoes = []
            for fonte, cenario in zip(fontes_pj, cenarios_pj):
                resultado = await _copiar_resultado(
                    conn,
                    fonte["resultado_id"],
                    cenario,
                    f"teste_manual_{cenario['cenario']}_banco",
                )
                if cenario.get("documento_nf"):
                    await _registrar_documento_nf(conn, resultado)
                comissoes.append(await _registrar_cenario(conn, resultado, cenario))
                if cenario.get("historico_reajuste_comissionado"):
                    await _registrar_historico_reajuste_comissionado(conn, resultado, cenario)

            resumo = await conn.fetchrow(
                f"""
                select
                    count(*) as resultados,
                    count(*) filter (where exige_nf) as pjs_autonomos,
                    count(*) filter (where not exige_nf) as clt,
                    count(*) filter (where status in ('calculado', 'revisao_necessaria')) as em_secretaria,
                    count(*) filter (where status = 'aguardando_head_comercial') as em_aprovacao,
                    count(*) filter (where status = 'aguardando_nf') as aguardando_nf,
                    count(*) filter (where status = 'enviada_pagamento') as pagamento
                from {ESQUEMA_COMISSIONAMENTO}.resultados
                where ciclo_id = $1
                """,
                CICLO_MANUAL,
            )
            eventos = await conn.fetchval(
                f"select count(*) from {ESQUEMA_COMISSIONAMENTO}.eventos where ciclo_id = $1",
                CICLO_MANUAL,
            )
            filas = await conn.fetchval(
                f"""
                select count(*)
                from {ESQUEMA_COMISSIONAMENTO}.notificacao_fila_envio f
                join {ESQUEMA_COMISSIONAMENTO}.notificacao_eventos e on e.evento_id = f.evento_id
                where e.ciclo_id = $1
                """,
                CICLO_MANUAL,
            )

            return {
                "ciclo_id": CICLO_MANUAL,
                "fonte": "copias isoladas de dados reais do ciclo 2026-06",
                "decisoes_aplicadas": {
                    "aprovador": "perfil configuravel por ciclo",
                    "valores_email": "somente no portal autenticado",
                    "destino_financeiro": "individual e pacote consolidado",
                    "prazo_nf_dias": 2,
                    "disparo_manual": "apenas Secretaria",
                    "escopo_produtivo": "2026-06",
                },
                "resumo": {chave: resumo[chave] for chave in resumo.keys()},
                "eventos": eventos or 0,
                "filas_email_controladas": filas or 0,
                "comissoes": comissoes,
            }


async def main() -> None:
    try:
        resultado = await criar_fluxo()
        print(json.dumps(resultado, ensure_ascii=False, indent=2, default=str))
    finally:
        await encerrar_pool_de_conexoes()


if __name__ == "__main__":
    asyncio.run(main())
