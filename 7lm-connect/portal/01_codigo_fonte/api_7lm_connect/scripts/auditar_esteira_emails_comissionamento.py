"""
Audita a esteira de eventos e e-mails do Comissionamento.

Uso seguro:
  python auditar_esteira_emails_comissionamento.py --limpar-ciclo-teste

Envio real restrito a allowlist:
  python auditar_esteira_emails_comissionamento.py \
    --limpar-ciclo-teste \
    --executar-envio-real \
    --destinatario hudson.porto@7lm.com.br \
    --nome-destinatario "Hudson Porto"
"""

from __future__ import annotations

import argparse
import asyncio
from datetime import date, datetime, timezone
from decimal import Decimal
import json
from pathlib import Path
import sys
import uuid
from typing import Any

from fastapi import HTTPException


API_DIR = Path(__file__).resolve().parents[1]
PORTAL_DIR = API_DIR.parents[1]
if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from banco import encerrar_pool_de_conexoes, iniciar_pool_de_conexoes  # noqa: E402
from configuracoes import (  # noqa: E402
    COMISSIONAMENTO_EMAIL_MODE,
    COMISSIONAMENTO_EMAIL_PROVIDER,
    COMISSIONAMENTO_EMAIL_SEND_ENABLED,
    ESQUEMA_COMISSIONAMENTO,
)
from repositorios.comissionamento import (  # noqa: E402
    atualizar_status_resultado,
    buscar_resultado_linha,
    registrar_evento_comissionamento,
    serializar_linha_resultado,
)
from repositorios.notificacoes_comissionamento import (  # noqa: E402
    atualizar_fila_status,
    criar_evento_notificacao,
    criar_notificacao_com_fila,
    obter_fila,
    obter_provider_ativo,
)
from servicos.notificacoes_comissionamento import (  # noqa: E402
    _allowlist,
    _json_objeto,
    _normalizar_email,
    PROXIMA_ACAO_USUARIO,
    enviar_microsoft_graph,
    humanizar_acao,
    humanizar_status,
    humanizar_transicao_status,
    mascarar_payload,
    renderizar_template,
)
from criar_fluxo_manual_comissionamento import criar_fluxo  # noqa: E402


CICLO_TESTE = "2026-06-fluxo-manual"
CICLO_AUDITORIA_LEGADO = "2026-06-email-audit"
RESULTADO_PJ = "manual-2026-06-calculo-base"
RESULTADO_REVISAO_NF = "manual-2026-06-revisao-nf"
RESULTADO_REJEICAO_COMERCIAL = "manual-2026-06-rejeicao-comercial"
RESULTADO_REFAZER_CALCULO_COMERCIAL = "manual-2026-06-refazer-calculo-comercial"
RESULTADO_REABRIR_EDITAR_REGRA = "manual-2026-06-reabrir-editar-regra"
RESULTADO_NF_PAGAMENTO = "manual-2026-06-nf-pagamento"
RESULTADO_NF_RECALCULO_RECOMECA = "manual-2026-06-nf-recalculo-recomeca"
LINK_PORTAL = "https://maquinadevendas7lm.app.br/comercial/comissionamento"
USUARIO_AUDITORIA = None
AGENTE_AUDITORIA = "auditar_esteira_emails_comissionamento.py"


def _agora_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _serializar(valor: Any) -> Any:
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, (date, datetime)):
        return valor.isoformat()
    if isinstance(valor, uuid.UUID):
        return str(valor)
    if isinstance(valor, dict):
        return {chave: _serializar(item) for chave, item in valor.items()}
    if isinstance(valor, list):
        return [_serializar(item) for item in valor]
    return valor


def _destinatario(nome: str, email: str) -> dict[str, Any]:
    return {
        "email": _normalizar_email(email),
        "nome": nome,
        "perfil": "auditoria_email",
        "canal": "email",
        "visibilidade": "ciclo",
        "pode_ver_valor": False,
    }


def _resumo_status(antes: dict[str, Any], depois: dict[str, Any]) -> dict[str, Any]:
    return {
        "status_anterior": antes.get("status"),
        "status_novo": depois.get("status"),
        "status_nf_anterior": antes.get("status_nf"),
        "status_nf_novo": depois.get("status_nf"),
        "status_financeiro_anterior": antes.get("status_financeiro"),
        "status_financeiro_novo": depois.get("status_financeiro"),
        "status_pagamento_anterior": antes.get("status_pagamento"),
        "status_pagamento_novo": depois.get("status_pagamento"),
    }


async def limpar_ciclo_auditoria_legado(conexao, esquema: str) -> None:
    await conexao.execute(
        f"""
        delete from {esquema}.notificacao_logs
        where fila_envio_id in (
            select f.fila_envio_id
            from {esquema}.notificacao_fila_envio f
            join {esquema}.notificacao_eventos e on e.evento_id = f.evento_id
            where e.ciclo_id = $1
        )
        """,
        CICLO_AUDITORIA_LEGADO,
    )
    await conexao.execute(
        f"""
        delete from {esquema}.notificacao_fila_envio f
        using {esquema}.notificacao_eventos e
        where f.evento_id = e.evento_id
          and e.ciclo_id = $1
        """,
        CICLO_AUDITORIA_LEGADO,
    )
    await conexao.execute(
        f"""
        delete from {esquema}.notificacao_destinatarios d
        using {esquema}.notificacoes n
        where d.notificacao_id = n.notificacao_id
          and n.ciclo_id = $1
        """,
        CICLO_AUDITORIA_LEGADO,
    )
    await conexao.execute(f"delete from {esquema}.notificacoes where ciclo_id = $1", CICLO_AUDITORIA_LEGADO)
    await conexao.execute(f"delete from {esquema}.notificacao_eventos where ciclo_id = $1", CICLO_AUDITORIA_LEGADO)
    await conexao.execute(f"delete from {esquema}.eventos where ciclo_id = $1", CICLO_AUDITORIA_LEGADO)
    await conexao.execute(f"delete from {esquema}.documentos where ciclo_id = $1", CICLO_AUDITORIA_LEGADO)
    await conexao.execute(f"delete from {esquema}.resultados where ciclo_id = $1", CICLO_AUDITORIA_LEGADO)
    await conexao.execute(f"delete from {esquema}.ciclos where ciclo_id = $1", CICLO_AUDITORIA_LEGADO)


async def validar_dados_teste(conexao, esquema: str) -> None:
    esperados = {
        RESULTADO_PJ,
        RESULTADO_REVISAO_NF,
        RESULTADO_REJEICAO_COMERCIAL,
        RESULTADO_REFAZER_CALCULO_COMERCIAL,
        RESULTADO_REABRIR_EDITAR_REGRA,
        RESULTADO_NF_PAGAMENTO,
        RESULTADO_NF_RECALCULO_RECOMECA,
    }
    encontrados = {
        linha["resultado_id"]
        for linha in await conexao.fetch(
            f"""
            select resultado_id
            from {esquema}.resultados
            where ciclo_id = $1
              and resultado_id = any($2::text[])
              and tipo_comissionado = 'PJ_AUTONOMO'
              and exige_nf is true
            """,
            CICLO_TESTE,
            sorted(esperados),
        )
    }
    faltantes = sorted(esperados - encontrados)
    if faltantes:
        raise RuntimeError(f"Massa manual inicial invalida ou incompleta: {', '.join(faltantes)}")


async def resetar_massa_manual() -> dict[str, Any]:
    resultado = await criar_fluxo()
    await encerrar_pool_de_conexoes()
    return resultado


async def _resultado(conexao, esquema: str, resultado_id: str) -> dict[str, Any]:
    linha = await buscar_resultado_linha(conexao, esquema, resultado_id)
    if not linha:
        raise RuntimeError(f"Resultado de auditoria nao encontrado: {resultado_id}")
    return serializar_linha_resultado(linha)


async def _processar_fila_especifica(
    conexao,
    esquema: str,
    *,
    fila_id: str,
    executar_envio_real: bool,
) -> dict[str, Any]:
    provider = await obter_provider_ativo(conexao, esquema, COMISSIONAMENTO_EMAIL_PROVIDER)
    provider_codigo = (provider or {}).get("codigo") or "fake"
    modo = str((provider or {}).get("modo") or COMISSIONAMENTO_EMAIL_MODE or "dry_run")
    fila = await obter_fila(conexao, esquema, fila_id)
    if not fila:
        raise RuntimeError(f"Fila nao encontrada: {fila_id}")

    email = _normalizar_email(fila.get("destinatario_email"))
    request_payload = mascarar_payload({
        "fila_id": fila["id"],
        "destinatario_email": email,
        "template_codigo": fila.get("template_codigo"),
        "provider": provider_codigo,
        "modo": modo,
        "auditoria": True,
    })

    if email not in _allowlist(provider):
        return await atualizar_fila_status(
            conexao,
            esquema,
            fila_envio_id=fila["id"],
            status_novo="falhou_permanente",
            provider=provider_codigo,
            request_payload=request_payload,
            response_payload={"bloqueado": "destinatario_fora_allowlist"},
            erro_codigo="destinatario_fora_allowlist",
            erro_mensagem="Destinatario bloqueado pela allowlist de teste.",
        )

    provider_message_id = f"dry-run-{uuid.uuid4()}"
    erro_codigo = None
    erro_mensagem = None
    response: dict[str, Any]

    envio_habilitado = (
        executar_envio_real
        and provider_codigo == "microsoft_graph"
        and COMISSIONAMENTO_EMAIL_SEND_ENABLED
        and modo == "teste_allowlist"
    )
    if envio_habilitado:
        try:
            payload_renderizado = _json_objeto(fila.get("payload_renderizado"))
            resultado_graph = enviar_microsoft_graph({
                "assunto": payload_renderizado.get("assunto") or "7LM Connect",
                "corpo_html": payload_renderizado.get("corpo_html") or payload_renderizado.get("corpo_texto") or "",
                "destinatario_email": email,
                "destinatario_nome": fila.get("destinatario_nome") or email,
                "correlation_id": payload_renderizado.get("correlation_id") or fila.get("id"),
                "template_codigo": fila.get("template_codigo"),
            })
            status_novo = resultado_graph["status"]
            response = resultado_graph.get("response") or {}
            provider_message_id = resultado_graph.get("provider_message_id") or provider_message_id
            erro_codigo = resultado_graph.get("erro_codigo")
            erro_mensagem = resultado_graph.get("erro_mensagem")
        except Exception as exc:
            status_novo = "falhou_retry"
            response = {"provider": "microsoft_graph", "erro": "excecao_mascarada"}
            erro_codigo = "graph_exception"
            erro_mensagem = str(exc)[:500]
    else:
        status_novo = "simulado"
        response = {
            "dry_run": True,
            "provider": provider_codigo,
            "send_enabled_env": bool(COMISSIONAMENTO_EMAIL_SEND_ENABLED),
            "executar_envio_real": False,
        }

    return await atualizar_fila_status(
        conexao,
        esquema,
        fila_envio_id=fila["id"],
        status_novo=status_novo,
        provider=provider_codigo,
        request_payload=request_payload,
        response_payload=response,
        provider_message_id=provider_message_id,
        erro_codigo=erro_codigo,
        erro_mensagem=erro_mensagem,
    )


async def _criar_notificacao_auditoria(
    conexao,
    esquema: str,
    *,
    evento_negocio_id: str,
    correlation_id: str,
    template_codigo: str,
    payload: dict[str, Any],
    destinatario: dict[str, Any],
    idempotency_key: str,
) -> dict[str, Any]:
    provider = await obter_provider_ativo(conexao, esquema, COMISSIONAMENTO_EMAIL_PROVIDER)
    if _normalizar_email(destinatario["email"]) not in _allowlist(provider):
        raise HTTPException(status_code=422, detail="Nenhum destinatario permitido pela allowlist de teste.")

    payload = {
        **payload,
        "ciclo": CICLO_TESTE,
        "ciclo_id": CICLO_TESTE,
        "link_comissionamento": LINK_PORTAL,
        "correlation_id": correlation_id,
    }
    renderizado = await renderizar_template(conexao, esquema, template_codigo, payload)
    evento_notificacao = await criar_evento_notificacao(
        conexao,
        esquema,
        evento_negocio_id=evento_negocio_id,
        correlation_id=correlation_id,
        ciclo_id=CICLO_TESTE,
        resultado_id=payload.get("resultado_id"),
        comissionado_id=payload.get("comissionado_id"),
        tipo_evento=template_codigo,
        origem="auditoria_esteira",
        payload=mascarar_payload(payload),
        idempotency_key=idempotency_key,
        usuario_id=USUARIO_AUDITORIA,
        servico=AGENTE_AUDITORIA,
    )
    notificacao = await criar_notificacao_com_fila(
        conexao,
        esquema,
        evento_id=evento_notificacao["id"],
        tipo_evento=template_codigo,
        titulo=renderizado["titulo"],
        resumo=renderizado["assunto"],
        link_acao=renderizado["cta_url"],
        prioridade="normal",
        ciclo_id=CICLO_TESTE,
        resultado_id=payload.get("resultado_id"),
        comissionado_id=payload.get("comissionado_id"),
        destinatarios=[destinatario],
        template=renderizado["template"],
        payload_renderizado={
            "assunto": renderizado["assunto"],
            "corpo_html": renderizado["corpo_html"],
            "corpo_texto": renderizado["corpo_texto"],
            "correlation_id": correlation_id,
            "from": "inovacao@7lm.com.br",
        },
        provider_codigo=(provider or {}).get("codigo") or "fake",
        idempotency_key=idempotency_key,
    )
    notificacao["evento_notificacao"] = evento_notificacao
    return notificacao


async def executar_passo(
    conexao,
    esquema: str,
    *,
    run_id: str,
    resultado_id: str,
    acao: str,
    evento_tipo: str,
    template_codigo: str,
    destinatario: dict[str, Any],
    nome_destinatario: str,
    executar_envio_real: bool,
    status: str | None = None,
    status_nf: str | None = None,
    status_financeiro: str | None = None,
    status_pagamento: str | None = None,
    destino_pacote: str = "Financeiro",
    quantidade_itens: int = 1,
    motivo: str | None = None,
    extra_payload: dict[str, Any] | None = None,
) -> dict[str, Any]:
    antes = await _resultado(conexao, esquema, resultado_id)
    depois = await atualizar_status_resultado(
        conexao,
        esquema,
        resultado_id,
        status=status,
        status_nf=status_nf,
        status_financeiro=status_financeiro,
        status_pagamento=status_pagamento,
    )
    if not depois:
        raise RuntimeError(f"Falha ao atualizar resultado: {resultado_id}")

    acao_usuario = humanizar_acao(acao)
    idempotency_key = f"{run_id}:{resultado_id}:{acao}:{template_codigo}"
    comentario = (
        motivo
        or f"Teste de auditoria da esteira: {acao_usuario} para {depois.get('nome')} ({CICLO_TESTE})."
    )
    evento_negocio = await registrar_evento_comissionamento(
        conexao,
        esquema,
        tipo_evento=evento_tipo,
        usuario_id=USUARIO_AUDITORIA,
        sessao_id=None,
        endereco_ip="127.0.0.1",
        agente_do_usuario=AGENTE_AUDITORIA,
        antes=antes,
        depois=depois,
        comentario=comentario,
        regra="auditoria_email_comissionamento",
        idempotency_key=idempotency_key,
    )
    correlation_id = f"comissionamento:auditoria:{run_id}:{resultado_id}:{acao}:{template_codigo}"
    status_usuario = humanizar_transicao_status(antes.get("status"), depois.get("status"))
    nf_usuario = humanizar_transicao_status(antes.get("status_nf"), depois.get("status_nf"))
    payload = {
        "nome_destinatario": nome_destinatario,
        "resultado_id": resultado_id,
        "comissionado_id": resultado_id,
        "nome_comissionado": depois.get("nome"),
        "etapa_anterior": humanizar_status(antes.get("status")),
        "etapa_nova": humanizar_status(depois.get("status")),
        "status_atual": status_usuario,
        "status_nf_atual": nf_usuario,
        "proxima_acao": PROXIMA_ACAO_USUARIO.get(template_codigo) or acao_usuario,
        "acao_executada": acao_usuario,
        "template_usado": template_codigo.replace("_", " "),
        "evento_negocio_id": evento_negocio["id"],
        "motivo": comentario,
        "prazo": "2 dias uteis",
        "quantidade_itens": quantidade_itens,
        "destino_pacote": destino_pacote,
        "aviso_teste": "Este e um teste real de auditoria da esteira de eventos e e-mails do Comissionamento.",
        **(extra_payload or {}),
    }
    notificacao = await _criar_notificacao_auditoria(
        conexao,
        esquema,
        evento_negocio_id=evento_negocio["id"],
        correlation_id=correlation_id,
        template_codigo=template_codigo,
        payload=payload,
        destinatario=destinatario,
        idempotency_key=idempotency_key,
    )

    filas_processadas = []
    for fila in notificacao.get("filas") or []:
        filas_processadas.append(await _processar_fila_especifica(
            conexao,
            esquema,
            fila_id=fila["id"],
            executar_envio_real=executar_envio_real,
        ))

    return _serializar({
        "acao": acao,
        "resultado_id": resultado_id,
        "comissionado": depois.get("nome"),
        "template": template_codigo,
        "destinatario": destinatario["email"],
        **_resumo_status(antes, depois),
        "evento_negocio": evento_negocio,
        "notificacao": {
            "id": notificacao.get("id"),
            "evento_notificacao": notificacao.get("evento_notificacao"),
            "filas": notificacao.get("filas"),
        },
        "filas_processadas": filas_processadas,
        "correlation_id": correlation_id,
        "criado_em": _agora_iso(),
    })


async def executar_evento_sem_email(
    conexao,
    esquema: str,
    *,
    run_id: str,
    resultado_id: str,
    acao: str,
    evento_tipo: str,
    status: str | None = None,
    status_nf: str | None = None,
    status_financeiro: str | None = None,
    status_pagamento: str | None = None,
    motivo: str,
) -> dict[str, Any]:
    antes = await _resultado(conexao, esquema, resultado_id)
    depois = await atualizar_status_resultado(
        conexao,
        esquema,
        resultado_id,
        status=status,
        status_nf=status_nf,
        status_financeiro=status_financeiro,
        status_pagamento=status_pagamento,
    )
    if not depois:
        raise RuntimeError(f"Falha ao atualizar resultado: {resultado_id}")
    evento_negocio = await registrar_evento_comissionamento(
        conexao,
        esquema,
        tipo_evento=evento_tipo,
        usuario_id=USUARIO_AUDITORIA,
        sessao_id=None,
        endereco_ip="127.0.0.1",
        agente_do_usuario=AGENTE_AUDITORIA,
        antes=antes,
        depois=depois,
        comentario=motivo,
        regra="auditoria_fluxo_manual_comissionamento",
        idempotency_key=f"{run_id}:{resultado_id}:{acao}:{evento_tipo}",
    )
    return _serializar({
        "acao": acao,
        "resultado_id": resultado_id,
        "comissionado": depois.get("nome"),
        "template": "sem_email",
        "destinatario": None,
        **_resumo_status(antes, depois),
        "evento_negocio": evento_negocio,
        "notificacao": None,
        "filas_processadas": [],
        "correlation_id": f"comissionamento:auditoria:{run_id}:{resultado_id}:{acao}:sem_email",
        "criado_em": _agora_iso(),
    })


async def executar_negativos(
    conexao,
    esquema: str,
    *,
    run_id: str,
    destinatario_bloqueado: str,
    nome_destinatario: str,
) -> list[dict[str, Any]]:
    negativos: list[dict[str, Any]] = []

    nao_pj = await conexao.fetchval(
        f"""
        select count(*)
        from {esquema}.resultados
        where ciclo_id = $1
          and (tipo_comissionado <> 'PJ_AUTONOMO' or exige_nf is not true)
        """,
        CICLO_TESTE,
    )
    if not nao_pj:
        negativos.append({
            "cenario": "Auditoria sem CLT no ciclo 2026-06-fluxo-manual",
            "resultado": "bloqueado_esperado",
            "motivo": "Todos os resultados de auditoria foram classificados como PJ_AUTONOMO com NF obrigatoria.",
            "fila_criada": False,
            "timestamp": _agora_iso(),
        })
    else:
        negativos.append({
            "cenario": "Auditoria sem CLT no ciclo 2026-06-fluxo-manual",
            "resultado": "falha_teste",
            "motivo": f"Foram encontrados {nao_pj} resultados que nao sao PJ_AUTONOMO com NF obrigatoria.",
            "fila_criada": False,
            "timestamp": _agora_iso(),
        })

    try:
        await _criar_notificacao_auditoria(
            conexao,
            esquema,
            evento_negocio_id=str(uuid.uuid4()),
            correlation_id=f"comissionamento:auditoria:{run_id}:destinatario_fora_allowlist",
            template_codigo="head_aprovacao_pendente",
            payload={
                "nome_destinatario": nome_destinatario,
                "resultado_id": RESULTADO_PJ,
                "comissionado_id": RESULTADO_PJ,
                "status_atual": "teste_negativo",
                "proxima_acao": "Bloquear destinatario fora da allowlist antes do Graph.",
                "motivo": "Teste negativo de allowlist.",
                "prazo": "1 dia util",
                "quantidade_itens": 1,
                "destino_pacote": "Auditoria",
            },
            destinatario=_destinatario("Destinatario Bloqueado", destinatario_bloqueado),
            idempotency_key=f"{run_id}:destinatario_fora_allowlist",
        )
        negativos.append({
            "cenario": "Destinatario fora da allowlist",
            "resultado": "falha_teste",
            "motivo": "Notificacao foi criada para destinatario fora da allowlist.",
            "destinatario": destinatario_bloqueado,
            "fila_criada": True,
            "timestamp": _agora_iso(),
        })
    except HTTPException as exc:
        negativos.append({
            "cenario": "Destinatario fora da allowlist",
            "resultado": "bloqueado_esperado",
            "motivo": exc.detail,
            "destinatario": destinatario_bloqueado,
            "fila_criada": False,
            "timestamp": _agora_iso(),
        })

    antes = await _resultado(conexao, esquema, RESULTADO_PJ)
    evento_negocio = await registrar_evento_comissionamento(
        conexao,
        esquema,
        tipo_evento="pagamento_concluido_bloqueado_auditoria",
        usuario_id=USUARIO_AUDITORIA,
        sessao_id=None,
        endereco_ip="127.0.0.1",
        agente_do_usuario=AGENTE_AUDITORIA,
        antes=antes,
        depois=antes,
        comentario="Teste negativo: pagamento_concluido/ERP fora do MVP de e-mails.",
        regra="auditoria_email_comissionamento",
        idempotency_key=f"{run_id}:pagamento_concluido_bloqueado",
    )
    negativos.append({
        "cenario": "pagamento_concluido nao gera e-mail",
        "resultado": "bloqueado_esperado",
        "motivo": "Escopo da auditoria para em pacote_pagamento_enviado; nenhuma notificacao foi criada.",
        "evento_negocio": evento_negocio,
        "fila_criada": False,
        "timestamp": _agora_iso(),
    })
    return _serializar(negativos)


async def executar_auditoria(args: argparse.Namespace) -> dict[str, Any]:
    destinatario_email = _normalizar_email(args.destinatario)
    run_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    destinatario = _destinatario(args.nome_destinatario, destinatario_email)
    reset_inicial = await resetar_massa_manual()
    pool = await iniciar_pool_de_conexoes()
    try:
        async with pool.acquire() as conexao:
            if args.limpar_ciclo_teste:
                await limpar_ciclo_auditoria_legado(conexao, ESQUEMA_COMISSIONAMENTO)
            await validar_dados_teste(conexao, ESQUEMA_COMISSIONAMENTO)

            provider = await obter_provider_ativo(conexao, ESQUEMA_COMISSIONAMENTO, COMISSIONAMENTO_EMAIL_PROVIDER)
            allowlist = sorted(_allowlist(provider))
            if destinatario_email not in allowlist:
                raise RuntimeError(f"Destinatario {destinatario_email} nao esta na allowlist configurada.")

            passos: list[dict[str, Any]] = []

            # Fluxo 1: primeira etapa -> NF -> recalculo/revisao.
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_REVISAO_NF,
                acao="enviar_head",
                evento_tipo="comissao_enviada_head",
                template_codigo="head_aprovacao_pendente",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="aguardando_head_comercial",
                destino_pacote="Head Comercial",
            ))
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_REVISAO_NF,
                acao="aprovar_head",
                evento_tipo="comissao_aprovada_head",
                template_codigo="comissionado_nf_solicitada",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="aguardando_nf",
                status_nf="solicitada",
                destino_pacote="Comissionado PJ/autonomo",
            ))
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_REVISAO_NF,
                acao="solicitar_ajuste",
                evento_tipo="recalculo_solicitado",
                template_codigo="secretaria_ajuste_solicitado",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="revisao_necessaria",
                status_nf="pendente_nf",
                status_financeiro="nao_enviado",
                status_pagamento="nao_enviado",
                destino_pacote="Secretaria",
                motivo="Teste de auditoria: Comissionado pediu revisao/recalculo na etapa de NF e voltou para Secretaria.",
            ))

            # Fluxo 2: Aprovacao Comercial reprova/devolve.
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_REJEICAO_COMERCIAL,
                acao="enviar_head",
                evento_tipo="comissao_enviada_head",
                template_codigo="head_aprovacao_pendente",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="aguardando_head_comercial",
                destino_pacote="Head Comercial",
            ))
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_REJEICAO_COMERCIAL,
                acao="rejeitar",
                evento_tipo="comissao_rejeitada_head",
                template_codigo="secretaria_rejeicao_head",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="revisao_necessaria",
                status_nf="pendente_nf",
                status_financeiro="nao_enviado",
                status_pagamento="nao_enviado",
                destino_pacote="Secretaria",
                quantidade_itens=1,
                motivo="Teste de auditoria: Aprovacao Comercial reprovou/devolveu e voltou para revisao necessaria.",
            ))

            # Fluxo 3: Aprovacao Comercial pede refazer calculo.
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_REFAZER_CALCULO_COMERCIAL,
                acao="enviar_head",
                evento_tipo="comissao_enviada_head",
                template_codigo="head_aprovacao_pendente",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="aguardando_head_comercial",
                destino_pacote="Head Comercial",
            ))
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_REFAZER_CALCULO_COMERCIAL,
                acao="solicitar_ajuste",
                evento_tipo="recalculo_solicitado",
                template_codigo="secretaria_ajuste_solicitado",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="revisao_necessaria",
                status_nf="pendente_nf",
                status_financeiro="nao_enviado",
                status_pagamento="nao_enviado",
                destino_pacote="Secretaria",
                quantidade_itens=1,
                motivo="Teste de auditoria: Aprovacao Comercial pediu refazer calculo e voltou para revisao necessaria.",
            ))

            # Fluxo 4: reabrir, editar regra e retomar esteira ate aprovacao.
            passos.append(await executar_evento_sem_email(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_REABRIR_EDITAR_REGRA,
                acao="editar_regra_01",
                evento_tipo="regra_01_editada",
                status="calculado",
                status_nf="pendente_nf",
                status_financeiro="nao_enviado",
                status_pagamento="nao_enviado",
                motivo="Teste de auditoria: Secretaria editou regra na comissao reaberta e recalculou para seguir a esteira.",
            ))
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_REABRIR_EDITAR_REGRA,
                acao="enviar_head",
                evento_tipo="comissao_enviada_head",
                template_codigo="head_aprovacao_pendente",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="aguardando_head_comercial",
                destino_pacote="Head Comercial",
            ))
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_REABRIR_EDITAR_REGRA,
                acao="aprovar_head",
                evento_tipo="comissao_aprovada_head",
                template_codigo="comissionado_nf_solicitada",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="aguardando_nf",
                status_nf="solicitada",
                destino_pacote="Comissionado PJ/autonomo",
                motivo="Teste de auditoria: Comissao reaberta, recalculada e aprovada pela Aprovacao Comercial.",
            ))

            # Fluxo 5: NF enviada e encaminhada para pagamento.
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_NF_PAGAMENTO,
                acao="enviar_head",
                evento_tipo="comissao_enviada_head",
                template_codigo="head_aprovacao_pendente",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="aguardando_head_comercial",
                destino_pacote="Head Comercial",
            ))
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_NF_PAGAMENTO,
                acao="aprovar_head",
                evento_tipo="comissao_aprovada_head",
                template_codigo="comissionado_nf_solicitada",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="aguardando_nf",
                status_nf="solicitada",
                destino_pacote="Comissionado PJ/autonomo",
            ))
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_NF_PAGAMENTO,
                acao="enviar_nf_financeiro",
                evento_tipo="nf_recebida",
                template_codigo="financeiro_pacote_pj_enviado",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="enviada_pagamento",
                status_nf="recebida",
                status_financeiro="pacote_enviado",
                status_pagamento="aguardando_pagamento",
                destino_pacote="Financeiro",
                quantidade_itens=1,
                motivo="Teste de auditoria: Nota Fiscal enviada e encaminhada ao Financeiro.",
                extra_payload={
                    "nf_enviada_por_nome": args.nome_destinatario,
                    "nf_enviada_por_email": destinatario_email,
                    "nf_numero": "AUD-1024",
                    "nf_data_emissao": "15/06/2026",
                    "nf_nome_arquivo": "nota-fiscal-auditoria.pdf",
                    "nf_observacao": "Teste de auditoria do fluxo direto ao Financeiro.",
                    "status_usuario": "Nota Fiscal enviada ao Financeiro",
                },
            ))

            # Fluxo 6: NF pede recalculo e recomeça a esteira.
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_NF_RECALCULO_RECOMECA,
                acao="enviar_head",
                evento_tipo="comissao_enviada_head",
                template_codigo="head_aprovacao_pendente",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="aguardando_head_comercial",
                destino_pacote="Head Comercial",
            ))
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_NF_RECALCULO_RECOMECA,
                acao="aprovar_head",
                evento_tipo="comissao_aprovada_head",
                template_codigo="comissionado_nf_solicitada",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="aguardando_nf",
                status_nf="solicitada",
                destino_pacote="Comissionado PJ/autonomo",
            ))
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_NF_RECALCULO_RECOMECA,
                acao="solicitar_ajuste",
                evento_tipo="recalculo_solicitado",
                template_codigo="secretaria_ajuste_solicitado",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="revisao_necessaria",
                status_nf="pendente_nf",
                status_financeiro="nao_enviado",
                status_pagamento="nao_enviado",
                destino_pacote="Secretaria",
                quantidade_itens=1,
                motivo="Teste de auditoria: Pedido de recalculo na NF voltou para revisao e recomecou a esteira.",
            ))
            passos.append(await executar_evento_sem_email(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_NF_RECALCULO_RECOMECA,
                acao="recalcular_secretaria",
                evento_tipo="regra_01_editada",
                status="calculado",
                status_nf="pendente_nf",
                status_financeiro="nao_enviado",
                status_pagamento="nao_enviado",
                motivo="Teste de auditoria: Secretaria recalculou apos retorno da NF para recomeçar o fluxo.",
            ))
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_NF_RECALCULO_RECOMECA,
                acao="enviar_head",
                evento_tipo="comissao_enviada_head",
                template_codigo="head_aprovacao_pendente",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="aguardando_head_comercial",
                destino_pacote="Head Comercial",
            ))
            passos.append(await executar_passo(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                resultado_id=RESULTADO_NF_RECALCULO_RECOMECA,
                acao="aprovar_head",
                evento_tipo="comissao_aprovada_head",
                template_codigo="comissionado_nf_solicitada",
                destinatario=destinatario,
                nome_destinatario=args.nome_destinatario,
                executar_envio_real=args.executar_envio_real,
                status="aguardando_nf",
                status_nf="solicitada",
                destino_pacote="Comissionado PJ/autonomo",
                motivo="Teste de auditoria: Fluxo recomecado apos recalculo e aprovado novamente ate NF.",
            ))

            negativos = await executar_negativos(
                conexao,
                ESQUEMA_COMISSIONAMENTO,
                run_id=run_id,
                destinatario_bloqueado=args.destinatario_fora_allowlist,
                nome_destinatario=args.nome_destinatario,
            )

            finais = {
                item["resultado_id"]: dict(item)
                for item in await conexao.fetch(
                    f"""
                    select resultado_id, status, status_nf, status_financeiro, status_pagamento
                    from {ESQUEMA_COMISSIONAMENTO}.resultados
                    where ciclo_id = $1
                      and resultado_id = any($2::text[])
                    """,
                    CICLO_TESTE,
                    [
                        RESULTADO_REVISAO_NF,
                        RESULTADO_REJEICAO_COMERCIAL,
                        RESULTADO_REFAZER_CALCULO_COMERCIAL,
                        RESULTADO_REABRIR_EDITAR_REGRA,
                        RESULTADO_NF_PAGAMENTO,
                        RESULTADO_NF_RECALCULO_RECOMECA,
                    ],
                )
            }
            validacoes_interface = {
                "comissionado_revisao_nf_primeira_etapa": finais[RESULTADO_REVISAO_NF]["status"] == "revisao_necessaria",
                "secretaria_rejeicao_comercial_primeira_etapa": finais[RESULTADO_REJEICAO_COMERCIAL]["status"] == "revisao_necessaria",
                "secretaria_refazer_calculo_primeira_etapa": finais[RESULTADO_REFAZER_CALCULO_COMERCIAL]["status"] == "revisao_necessaria",
                "historico_edicao_regra_e_aprovacao": finais[RESULTADO_REABRIR_EDITAR_REGRA]["status"] == "aguardando_nf",
                "nf_enviada_para_pagamento": finais[RESULTADO_NF_PAGAMENTO]["status"] == "enviada_pagamento"
                and finais[RESULTADO_NF_PAGAMENTO]["status_financeiro"] == "pacote_enviado",
                "nf_recalculo_recomecou_fluxo": finais[RESULTADO_NF_RECALCULO_RECOMECA]["status"] == "aguardando_nf",
            }

            filas = [fila for passo in passos for fila in passo.get("filas_processadas", [])]
            contagens = {
                "eventos_esperados": len(passos) + len(negativos),
                "emails_esperados": sum(1 for passo in passos if passo.get("template") != "sem_email"),
                "emails_aceitos_graph": sum(1 for fila in filas if fila.get("status") == "enviado_para_provider"),
                "emails_simulados": sum(1 for fila in filas if fila.get("status") == "simulado"),
                "falhas_permanentes": sum(1 for fila in filas if fila.get("status") == "falhou_permanente"),
                "falhas_retry": sum(1 for fila in filas if fila.get("status") == "falhou_retry"),
                "bloqueios_esperados": sum(1 for item in negativos if item.get("resultado") == "bloqueado_esperado"),
            }

            return _serializar({
                "run_id": run_id,
                "ciclo": CICLO_TESTE,
                "modo_execucao": "envio_real" if args.executar_envio_real else "dry_run",
                "provider_configurado": {
                    "provider": (provider or {}).get("codigo"),
                    "modo": (provider or {}).get("modo") or COMISSIONAMENTO_EMAIL_MODE,
                    "send_enabled_env": bool(COMISSIONAMENTO_EMAIL_SEND_ENABLED),
                    "provider_env": COMISSIONAMENTO_EMAIL_PROVIDER,
                    "allowlist": allowlist,
                    "destinatario_forcado": destinatario_email,
                },
                "dados_teste": {
                    "reset_inicial": reset_inicial,
                    "resultado_revisao_nf": RESULTADO_REVISAO_NF,
                    "resultado_rejeicao_comercial": RESULTADO_REJEICAO_COMERCIAL,
                    "resultado_refazer_calculo_comercial": RESULTADO_REFAZER_CALCULO_COMERCIAL,
                    "resultado_reabrir_editar_regra": RESULTADO_REABRIR_EDITAR_REGRA,
                    "resultado_nf_pagamento": RESULTADO_NF_PAGAMENTO,
                    "resultado_nf_recalculo_recomeca": RESULTADO_NF_RECALCULO_RECOMECA,
                },
                "passos": passos,
                "negativos": negativos,
                "validacoes_interface": validacoes_interface,
                "reset_final": "executado_no_finally",
                "contagens": contagens,
                "gerado_em": _agora_iso(),
            })
    finally:
        await encerrar_pool_de_conexoes()
        if not getattr(args, "nao_resetar_massa_manual", False):
            await resetar_massa_manual()


def _resolver_relatorio(caminho: str | None) -> Path:
    if caminho:
        return Path(caminho)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return (
        PORTAL_DIR
        / "03_registros"
        / "comissionamento"
        / "auditorias"
        / "emails"
        / f"comissionamento_email_audit_{timestamp}.json"
    )


def _imprimir_resumo(resultado: dict[str, Any], relatorio: Path) -> None:
    contagens = resultado["contagens"]
    print("Auditoria da esteira de e-mails do Comissionamento")
    print(f"Run ID: {resultado['run_id']}")
    print(f"Ciclo: {resultado['ciclo']}")
    print(f"Modo: {resultado['modo_execucao']}")
    print(f"Destinatario unico: {resultado['provider_configurado']['destinatario_forcado']}")
    print(f"Relatorio: {relatorio}")
    print("Contagens:")
    for chave, valor in contagens.items():
        print(f"  - {chave}: {valor}")
    print("Filas:")
    for passo in resultado["passos"]:
        status_filas = ", ".join(
            f"{fila.get('status')} ({fila.get('provider_message_id') or 'sem_message_id'})"
            for fila in passo.get("filas_processadas", [])
        )
        print(f"  - {passo['acao']} | {passo['template']} | {status_filas}")
    print("Negativos:")
    for item in resultado["negativos"]:
        print(f"  - {item['cenario']}: {item['resultado']}")
    print("Validacoes:")
    for chave, valor in resultado.get("validacoes_interface", {}).items():
        print(f"  - {chave}: {'ok' if valor else 'falha'}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Audita eventos e e-mails do Comissionamento.")
    parser.add_argument("--destinatario", default="hudson.porto@7lm.com.br")
    parser.add_argument("--nome-destinatario", default="Hudson Porto")
    parser.add_argument("--executar-envio-real", action="store_true")
    parser.add_argument("--limpar-ciclo-teste", action="store_true")
    parser.add_argument("--relatorio")
    parser.add_argument("--destinatario-fora-allowlist", default="fora.allowlist@example.com")
    parser.add_argument("--nao-resetar-massa-manual", action="store_true")
    args = parser.parse_args()

    relatorio = _resolver_relatorio(args.relatorio)
    relatorio.parent.mkdir(parents=True, exist_ok=True)
    resultado = asyncio.run(executar_auditoria(args))
    relatorio.write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    _imprimir_resumo(resultado, relatorio)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
