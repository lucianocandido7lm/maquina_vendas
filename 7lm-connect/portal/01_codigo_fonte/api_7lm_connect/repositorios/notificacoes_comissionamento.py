"""
Repositorio de notificacoes do Comissionamento.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
import json
from typing import Any


def _serializar(valor: Any) -> Any:
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, (date, datetime)):
        return valor.isoformat()
    return valor


def _linha_dict(linha) -> dict[str, Any]:
    return {chave: _serializar(valor) for chave, valor in dict(linha).items()}


async def obter_provider_ativo(conexao, esquema: str, codigo_preferido: str) -> dict[str, Any] | None:
    linha = await conexao.fetchrow(
        f"""
        select
            provider_id::text as id,
            codigo,
            nome,
            tipo,
            ativo,
            modo,
            remetente_padrao,
            tenant_ref,
            client_id_ref,
            secret_ref,
            cert_ref,
            configuracao,
            limites_operacionais,
            allowlist_destinatarios
        from {esquema}.notificacao_providers
        where codigo = $1
        """,
        codigo_preferido,
    )
    if linha:
        return _linha_dict(linha)
    linha = await conexao.fetchrow(
        f"""
        select
            provider_id::text as id,
            codigo,
            nome,
            tipo,
            ativo,
            modo,
            remetente_padrao,
            tenant_ref,
            client_id_ref,
            secret_ref,
            cert_ref,
            configuracao,
            limites_operacionais,
            allowlist_destinatarios
        from {esquema}.notificacao_providers
        where codigo = 'fake'
        """
    )
    return _linha_dict(linha) if linha else None


async def listar_templates(conexao, esquema: str, somente_ativos: bool = True) -> list[dict[str, Any]]:
    linhas = await conexao.fetch(
        f"""
        select
            template_id::text as id,
            codigo,
            versao,
            canal,
            assunto,
            titulo,
            corpo_html,
            corpo_texto,
            cta_label,
            cta_url_template,
            variaveis_obrigatorias,
            politica_mascaramento,
            ativo,
            publicado_em,
            criado_em
        from {esquema}.notificacao_templates
        where ($1::boolean = false or ativo = true)
        order by codigo, versao desc
        """,
        somente_ativos,
    )
    return [_linha_dict(linha) for linha in linhas]


async def obter_template(conexao, esquema: str, codigo: str, versao: int | None = None, canal: str = "email") -> dict[str, Any] | None:
    linha = await conexao.fetchrow(
        f"""
        select
            template_id::text as id,
            codigo,
            versao,
            canal,
            assunto,
            titulo,
            corpo_html,
            corpo_texto,
            cta_label,
            cta_url_template,
            variaveis_obrigatorias,
            politica_mascaramento,
            ativo
        from {esquema}.notificacao_templates
        where codigo = $1
          and canal = $2
          and ativo = true
          and ($3::integer is null or versao = $3)
        order by versao desc
        limit 1
        """,
        codigo,
        canal,
        versao,
    )
    return _linha_dict(linha) if linha else None


async def salvar_template(conexao, esquema: str, payload: dict[str, Any], usuario_id: str | None) -> dict[str, Any]:
    linha = await conexao.fetchrow(
        f"""
        insert into {esquema}.notificacao_templates (
            codigo,
            versao,
            canal,
            assunto,
            titulo,
            corpo_html,
            corpo_texto,
            cta_label,
            cta_url_template,
            variaveis_obrigatorias,
            politica_mascaramento,
            ativo,
            criado_por_usuario_id
        )
        values (
            $1,
            coalesce($2::integer, 1),
            coalesce($3, 'email'),
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            coalesce($10::text[], array[]::text[]),
            coalesce($11::jsonb, '{{}}'::jsonb),
            coalesce($12::boolean, true),
            $13::uuid
        )
        on conflict (codigo, versao, canal) do update set
            assunto = excluded.assunto,
            titulo = excluded.titulo,
            corpo_html = excluded.corpo_html,
            corpo_texto = excluded.corpo_texto,
            cta_label = excluded.cta_label,
            cta_url_template = excluded.cta_url_template,
            variaveis_obrigatorias = excluded.variaveis_obrigatorias,
            politica_mascaramento = excluded.politica_mascaramento,
            ativo = excluded.ativo
        returning template_id::text as id, codigo, versao, canal, assunto, titulo, ativo
        """,
        payload.get("codigo"),
        payload.get("versao"),
        payload.get("canal") or "email",
        payload.get("assunto"),
        payload.get("titulo"),
        payload.get("corpo_html"),
        payload.get("corpo_texto"),
        payload.get("cta_label"),
        payload.get("cta_url_template"),
        payload.get("variaveis_obrigatorias") or [],
        json.dumps(payload.get("politica_mascaramento") or {}),
        payload.get("ativo", True),
        usuario_id,
    )
    return _linha_dict(linha)


async def criar_evento_notificacao(
    conexao,
    esquema: str,
    *,
    evento_negocio_id: str | None,
    correlation_id: str,
    ciclo_id: str | None,
    resultado_id: str | None,
    comissionado_id: str | None,
    tipo_evento: str,
    origem: str,
    payload: dict[str, Any],
    idempotency_key: str | None,
    usuario_id: str | None,
    servico: str | None = None,
) -> dict[str, Any]:
    linha = await conexao.fetchrow(
        f"""
        insert into {esquema}.notificacao_eventos (
            evento_negocio_id,
            correlation_id,
            ciclo_id,
            resultado_id,
            comissionado_id,
            tipo_evento,
            origem,
            payload,
            idempotency_key,
            criado_por_usuario_id,
            criado_por_servico
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10::uuid, $11)
        on conflict (correlation_id) do update set
            payload = excluded.payload
        returning evento_id::text as id, correlation_id, tipo_evento, ciclo_id, resultado_id, criado_em
        """,
        evento_negocio_id,
        correlation_id,
        ciclo_id,
        resultado_id,
        comissionado_id,
        tipo_evento,
        origem,
        json.dumps(payload),
        idempotency_key,
        usuario_id,
        servico,
    )
    return _linha_dict(linha)


async def criar_notificacao_com_fila(
    conexao,
    esquema: str,
    *,
    evento_id: str,
    tipo_evento: str,
    titulo: str,
    resumo: str,
    link_acao: str,
    prioridade: str,
    ciclo_id: str | None,
    resultado_id: str | None,
    comissionado_id: str | None,
    destinatarios: list[dict[str, Any]],
    template: dict[str, Any],
    payload_renderizado: dict[str, Any],
    provider_codigo: str,
    idempotency_key: str | None,
) -> dict[str, Any]:
    notificacao = await conexao.fetchrow(
        f"""
        insert into {esquema}.notificacoes (
            evento_id,
            tipo_evento,
            titulo,
            resumo,
            link_acao,
            prioridade,
            ciclo_id,
            resultado_id,
            comissionado_id
        )
        values ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9)
        returning notificacao_id::text as id, tipo_evento, titulo, resumo, status, criado_em
        """,
        evento_id,
        tipo_evento,
        titulo,
        resumo,
        link_acao,
        prioridade,
        ciclo_id,
        resultado_id,
        comissionado_id,
    )
    notificacao_dict = _linha_dict(notificacao)
    filas: list[dict[str, Any]] = []

    for destinatario in destinatarios:
        destino_linha = await conexao.fetchrow(
            f"""
            insert into {esquema}.notificacao_destinatarios (
                notificacao_id,
                usuario_id,
                email,
                nome,
                perfil,
                canal,
                visibilidade,
                pode_ver_valor
            )
            values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8)
            returning destinatario_id::text as id, email, nome, perfil, canal, lida_em
            """,
            notificacao_dict["id"],
            destinatario.get("usuario_id"),
            destinatario.get("email"),
            destinatario.get("nome"),
            destinatario.get("perfil") or "configurado",
            destinatario.get("canal") or "email",
            destinatario.get("visibilidade") or "ciclo",
            bool(destinatario.get("pode_ver_valor", False)),
        )
        destino = _linha_dict(destino_linha)
        fila = await conexao.fetchrow(
            f"""
            insert into {esquema}.notificacao_fila_envio (
                evento_id,
                notificacao_id,
                destinatario_id,
                template_id,
                template_codigo,
                template_versao,
                canal,
                destinatario_email,
                destinatario_nome,
                payload_renderizado,
                provider_codigo,
                idempotency_key
            )
            values ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, $9, $10::jsonb, $11, $12)
            on conflict (evento_id, destinatario_email, canal, template_codigo, template_versao) do update set
                status = 'ignorado_idempotencia',
                processado_em = now()
            returning fila_envio_id::text as id, status, destinatario_email, template_codigo, template_versao
            """,
            evento_id,
            notificacao_dict["id"],
            destino["id"],
            template.get("id"),
            template["codigo"],
            template["versao"],
            destino.get("canal") or "email",
            destino.get("email"),
            destino.get("nome"),
            json.dumps(payload_renderizado),
            provider_codigo,
            idempotency_key,
        )
        filas.append(_linha_dict(fila))

    notificacao_dict["filas"] = filas
    return notificacao_dict


async def listar_notificacoes_usuario(
    conexao,
    esquema: str,
    *,
    usuario_id: str | None,
    email: str | None,
    pode_ver_tudo: bool,
    ciclo_id: str | None = None,
) -> list[dict[str, Any]]:
    linhas = await conexao.fetch(
        f"""
        select
            n.notificacao_id::text as id,
            d.destinatario_id::text as destinatario_id,
            n.tipo_evento,
            n.titulo,
            n.resumo,
            n.link_acao,
            n.prioridade,
            n.ciclo_id,
            n.resultado_id,
            n.status,
            d.email,
            d.nome,
            d.perfil,
            d.canal,
            d.lida_em,
            n.criado_em
        from {esquema}.notificacoes n
        join {esquema}.notificacao_destinatarios d on d.notificacao_id = n.notificacao_id
        where ($1::boolean = true or d.usuario_id = $2::uuid or lower(coalesce(d.email, '')) = lower(coalesce($3, '')))
          and ($4::text is null or n.ciclo_id = $4)
        order by n.criado_em desc
        limit 200
        """,
        pode_ver_tudo,
        usuario_id,
        email,
        ciclo_id,
    )
    return [_linha_dict(linha) for linha in linhas]


async def marcar_destinatario_lido(conexao, esquema: str, destinatario_id: str, usuario_id: str | None, pode_ver_tudo: bool) -> dict[str, Any] | None:
    linha = await conexao.fetchrow(
        f"""
        update {esquema}.notificacao_destinatarios
        set lida_em = coalesce(lida_em, now())
        where destinatario_id = $1::uuid
          and ($2::boolean = true or usuario_id = $3::uuid)
        returning destinatario_id::text as id, lida_em
        """,
        destinatario_id,
        pode_ver_tudo,
        usuario_id,
    )
    return _linha_dict(linha) if linha else None


async def listar_historico_envios(conexao, esquema: str, ciclo_id: str | None = None, status: str | None = None) -> list[dict[str, Any]]:
    linhas = await conexao.fetch(
        f"""
        select
            f.fila_envio_id::text as id,
            e.correlation_id,
            e.tipo_evento,
            e.ciclo_id,
            e.resultado_id,
            n.titulo,
            f.template_codigo,
            f.template_versao,
            f.canal,
            f.destinatario_email,
            f.destinatario_nome,
            f.provider_codigo,
            f.status,
            f.tentativas,
            f.provider_message_id,
            f.criado_em,
            f.processado_em
        from {esquema}.notificacao_fila_envio f
        join {esquema}.notificacao_eventos e on e.evento_id = f.evento_id
        join {esquema}.notificacoes n on n.notificacao_id = f.notificacao_id
        where ($1::text is null or e.ciclo_id = $1)
          and ($2::text is null or f.status = $2)
        order by f.criado_em desc
        limit 300
        """,
        ciclo_id,
        status,
    )
    return [_linha_dict(linha) for linha in linhas]


async def obter_fila(conexao, esquema: str, fila_envio_id: str) -> dict[str, Any] | None:
    linha = await conexao.fetchrow(
        f"""
        select
            f.fila_envio_id::text as id,
            f.evento_id::text,
            f.notificacao_id::text,
            f.destinatario_id::text,
            f.template_codigo,
            f.template_versao,
            f.canal,
            f.destinatario_email,
            f.destinatario_nome,
            f.payload_renderizado,
            f.status,
            f.tentativas,
            f.provider_codigo,
            f.idempotency_key
        from {esquema}.notificacao_fila_envio f
        where f.fila_envio_id = $1::uuid
        """,
        fila_envio_id,
    )
    return _linha_dict(linha) if linha else None


async def resetar_fila_para_reenvio(conexao, esquema: str, fila_envio_id: str, idempotency_key: str | None) -> dict[str, Any] | None:
    linha = await conexao.fetchrow(
        f"""
        update {esquema}.notificacao_fila_envio
        set status = 'pendente',
            tentativas = 0,
            proxima_tentativa_em = null,
            processado_em = null,
            idempotency_key = coalesce($2, idempotency_key)
        where fila_envio_id = $1::uuid
        returning fila_envio_id::text as id, status, destinatario_email, template_codigo
        """,
        fila_envio_id,
        idempotency_key,
    )
    return _linha_dict(linha) if linha else None


async def buscar_filas_pendentes(conexao, esquema: str, limite: int = 25) -> list[dict[str, Any]]:
    linhas = await conexao.fetch(
        f"""
        select
            fila_envio_id::text as id,
            evento_id::text,
            template_codigo,
            template_versao,
            canal,
            destinatario_email,
            destinatario_nome,
            payload_renderizado,
            status,
            tentativas,
            provider_codigo
        from {esquema}.notificacao_fila_envio
        where status in ('pendente', 'falhou_retry')
          and (proxima_tentativa_em is null or proxima_tentativa_em <= now())
        order by criado_em
        limit $1
        """,
        limite,
    )
    return [_linha_dict(linha) for linha in linhas]


async def atualizar_fila_status(
    conexao,
    esquema: str,
    *,
    fila_envio_id: str,
    status_novo: str,
    provider: str,
    request_payload: dict[str, Any],
    response_payload: dict[str, Any],
    erro_codigo: str | None = None,
    erro_mensagem: str | None = None,
    provider_message_id: str | None = None,
) -> dict[str, Any]:
    atual = await conexao.fetchrow(
        f"""
        select status, evento_id::text as evento_id, tentativas
        from {esquema}.notificacao_fila_envio
        where fila_envio_id = $1::uuid
        for update
        """,
        fila_envio_id,
    )
    status_anterior = atual["status"] if atual else None
    linha = await conexao.fetchrow(
        f"""
        update {esquema}.notificacao_fila_envio
        set status = $2,
            tentativas = tentativas + 1,
            provider_codigo = $3,
            provider_message_id = coalesce($4, provider_message_id),
            processado_em = now()
        where fila_envio_id = $1::uuid
        returning fila_envio_id::text as id, status, tentativas, provider_message_id
        """,
        fila_envio_id,
        status_novo,
        provider,
        provider_message_id,
    )
    await conexao.execute(
        f"""
        insert into {esquema}.notificacao_logs (
            fila_envio_id,
            evento_id,
            status_anterior,
            status_novo,
            provider,
            provider_message_id,
            request_payload_mascarado,
            response_payload_mascarado,
            erro_codigo,
            erro_mensagem
        )
        values ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)
        """,
        fila_envio_id,
        atual["evento_id"] if atual else None,
        status_anterior,
        status_novo,
        provider,
        provider_message_id,
        json.dumps(request_payload),
        json.dumps(response_payload),
        erro_codigo,
        erro_mensagem,
    )
    return _linha_dict(linha)


async def listar_regras_escalonamento(conexao, esquema: str) -> list[dict[str, Any]]:
    linhas = await conexao.fetch(
        f"""
        select
            regra_escalonamento_id::text as id,
            tipo_evento_origem,
            perfil_fluxo,
            status_origem,
            prazo_quantidade,
            prazo_unidade,
            lembrete_antes_quantidade,
            lembrete_antes_unidade,
            escalonar_apos_quantidade,
            escalonar_apos_unidade,
            destinatarios_escalonamento,
            ativo,
            atualizado_em
        from {esquema}.notificacao_regras_escalonamento
        order by tipo_evento_origem
        """
    )
    return [_linha_dict(linha) for linha in linhas]
