"""
Servico de notificacoes do Comissionamento.

MVP seguro: cria eventos, renderiza templates e enfileira mensagens.
Microsoft Graph so envia quando provider, flag, credenciais e allowlist passam.
"""

from __future__ import annotations

import base64
from html import escape
import json
import mimetypes
import os
from pathlib import Path
import re
from urllib import error, parse, request
import uuid
from typing import Any

from fastapi import HTTPException

from configuracoes import (
    COMISSIONAMENTO_EMAIL_ALLOWLIST,
    COMISSIONAMENTO_EMAIL_FROM,
    COMISSIONAMENTO_EMAIL_MODE,
    COMISSIONAMENTO_EMAIL_PROVIDER,
    COMISSIONAMENTO_EMAIL_REDIRECT_TO,
    COMISSIONAMENTO_EMAIL_REPLY_TO,
    COMISSIONAMENTO_EMAIL_SEND_ENABLED,
    MS_GRAPH_MAX_RETRIES,
    MS_GRAPH_SENDMAIL_USER,
    MS_GRAPH_TIMEOUT_SECONDS,
)
from repositorios.notificacoes_comissionamento import (
    atualizar_fila_status,
    buscar_filas_pendentes,
    criar_evento_notificacao,
    criar_notificacao_com_fila,
    listar_templates,
    obter_fila,
    obter_provider_ativo,
    obter_template,
    resetar_fila_para_reenvio,
    salvar_template,
)


LINK_COMISSIONAMENTO = "/comercial/comissionamento"
RODAPE_EMAIL = "Esta mensagem foi enviada automaticamente pelo 7LM Connect. Acesse o portal para consultar detalhes protegidos."
ALLOWLIST_PADRAO = tuple(email.lower() for email in COMISSIONAMENTO_EMAIL_ALLOWLIST)
PORTAL_DIR = Path(__file__).resolve().parents[3]
EMAIL_LOGO_PATH = PORTAL_DIR / "02_publico" / "assets" / "7lm_logo.png"
EMAIL_LOGO_CID = "logo-7lm-comissionamento"


STATUS_USUARIO = {
    "calculado": "Comissao calculada",
    "calculado_seed": "Comissao calculada",
    "aguardando_head_comercial": "Aguardando aprovacao comercial",
    "aguardando_nf": "Aguardando envio da Nota Fiscal",
    "nf_em_validacao": "Nota Fiscal em validacao",
    "pronta_para_envio_pagamento": "Pagamento",
    "enviada_pagamento": "Pagamento",
    "pendente_nf": "Nota Fiscal pendente",
    "solicitada": "Nota Fiscal solicitada",
    "recebida": "Nota Fiscal recebida",
    "validada": "Nota Fiscal validada",
    "nao_aplicavel": "Nao se aplica",
    "nao_enviado": "Ainda nao enviado",
    "pacote_enviado": "Enviado para pagamento",
    "aguardando_pagamento": "Aguardando processamento do pagamento",
    "teste_negativo": "Teste de bloqueio de seguranca",
}


ACAO_USUARIO = {
    "enviar_head": "Enviar para aprovacao comercial",
    "aprovar_head": "Aprovar comissionamento",
    "aprovar_head_clt": "Aprovar comissionamento CLT",
    "rejeitar": "Devolver para revisao",
    "rejeitar_comissionado": "Comissao devolvida pela Diretoria Comercial",
    "solicitar_ajuste": "Pedir revisao/recalculo",
    "solicitar_nf": "Solicitar Nota Fiscal",
    "reenviar_lembrete_nf": "Enviar lembrete de Nota Fiscal",
    "registrar_nf_recebida": "Registrar Nota Fiscal recebida",
    "reenviar_nf": "Registrar reenvio da Nota Fiscal",
    "validar_nf": "Validar Nota Fiscal",
    "solicitar_correcao_nf": "Solicitar correcao da Nota Fiscal",
    "pacote_pronto": "Avisar que ha itens prontos para pacote",
    "enviar_pacote_pagamento": "Enviar pacote consolidado para pagamento",
    "enviar_pacote_pagamento_pj": "Enviar pacote PJ/autonomo ao Financeiro",
    "enviar_pacote_pagamento_clt": "Enviar pacote CLT para RH e Financeiro",
    "enviar_nf_financeiro": "Enviar Nota Fiscal ao Financeiro",
    "publicar_regra": "Publicar ajuste de regra",
}


PROXIMA_ACAO_USUARIO = {
    "head_aprovacao_pendente": "Acessar o portal para revisar as comissoes e registrar a aprovacao ou devolucao comercial.",
    "secretaria_ajuste_solicitado": "Acessar o portal para revisar o pedido de recalculo e iniciar a nova rodada da esteira.",
    "secretaria_rejeicao_head": "Acessar o portal para revisar a devolucao feita pela Diretoria Comercial.",
    "comissionado_rejeicao_diretoria": "Acessar o portal para consultar o motivo e acompanhar a proxima acao da Secretaria.",
    "comissionado_nf_solicitada": "Emitir e enviar a Nota Fiscal pelo portal dentro do prazo informado.",
    "comissionado_nf_lembrete": "Regularizar a Nota Fiscal pelo portal.",
    "secretaria_nf_recebida": "Acompanhar a Nota Fiscal recebida pelo portal. O fluxo ja seguiu para o destino operacional.",
    "comissionado_nf_rejeitada": "Corrigir a Nota Fiscal conforme orientacao e reenviar pelo portal.",
    "comissionado_nf_validada": "Acompanhar o andamento pelo portal; a Nota Fiscal seguira para o pacote.",
    "secretaria_pacote_pronto": "Revisar os itens prontos e montar o pacote consolidado.",
    "financeiro_pacote_pj_enviado": "Acessar o portal para consultar a Nota Fiscal e dar andamento ao processamento financeiro.",
    "rh_financeiro_pacote_clt_enviado": "Acessar o portal para consultar a comissao CLT enviada para RH e Financeiro.",
    "comissionado_regra_publicada": "Acessar o portal para consultar sua comissao atualizada.",
    "erro_integracao_email": "Consultar o historico de envios e reprocessar se necessario.",
    "resumo_diario_pendencias": "Acessar o painel para tratar as pendencias do ciclo.",
}


TEMPLATE_POR_ACAO = {
    "enviar_head": "head_aprovacao_pendente",
    "rejeitar": "secretaria_rejeicao_head",
    "rejeitar_comissionado": "comissionado_rejeicao_diretoria",
    "solicitar_ajuste": "secretaria_ajuste_solicitado",
    "solicitar_nf": "comissionado_nf_solicitada",
    "reenviar_lembrete_nf": "comissionado_nf_lembrete",
    "registrar_nf_recebida": "secretaria_nf_recebida",
    "enviar_nf_financeiro": "financeiro_pacote_pj_enviado",
    "validar_nf": "comissionado_nf_validada",
    "solicitar_correcao_nf": "comissionado_nf_rejeitada",
    "pacote_pronto": "secretaria_pacote_pronto",
    "publicar_regra": "comissionado_regra_publicada",
}

ACOES_ENVIO_REAL_DESTINATARIO = {
    "aprovar_head",
    "reenviar_lembrete_nf",
    "solicitar_correcao_nf",
    "validar_nf",
    "rejeitar_comissionado",
    "publicar_regra",
}

TEMPLATES_ENVIO_REAL_DESTINATARIO = {
    "comissionado_nf_solicitada",
    "comissionado_nf_lembrete",
    "comissionado_nf_validada",
    "comissionado_nf_rejeitada",
    "comissionado_rejeicao_diretoria",
    "comissionado_regra_publicada",
}


def _normalizar_email(valor: Any) -> str:
    return str(valor or "").strip().lower()


def _allowlist(provider: dict[str, Any] | None = None) -> set[str]:
    emails = set(ALLOWLIST_PADRAO)
    emails.update(_emails_redirecionamento())
    for email in (provider or {}).get("allowlist_destinatarios") or []:
        normalizado = _normalizar_email(email)
        if normalizado:
            emails.add(normalizado)
    return emails


def _emails_redirecionamento() -> tuple[str, ...]:
    emails: list[str] = []
    vistos: set[str] = set()
    for bloco in str(COMISSIONAMENTO_EMAIL_REDIRECT_TO or "").replace(";", ",").split(","):
        email = _normalizar_email(bloco)
        if not email or email in vistos:
            continue
        vistos.add(email)
        emails.append(email)
    return tuple(emails)


def _email_redirecionamento() -> str:
    return next(iter(_emails_redirecionamento()), "")


def _nome_redirecionamento(email: str) -> str:
    if email == "hudson.porto@7lm.com.br":
        return "Hudson Porto"
    if email == "fernanda.oliveira@7lm.com.br":
        return "Fernanda Leao Uchoa De Oliveira"
    return email.split("@", 1)[0].replace(".", " ").title()


def redirecionar_destinatarios_email(destinatarios: list[dict[str, Any]] | None) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    originais = _deduplicar_destinatarios(destinatarios or [])
    redirects = _emails_redirecionamento()
    if not redirects:
        return originais, originais
    return [({
        "email": email,
        "nome": _nome_redirecionamento(email),
        "perfil": "redirecionamento_temporario",
        "canal": "email",
        "visibilidade": "ciclo",
        "pode_ver_valor": False,
    }) for email in redirects], originais


def destinatarios_email_finais(email: Any) -> tuple[str, ...]:
    redirects = _emails_redirecionamento()
    if redirects:
        return redirects
    email_normalizado = _normalizar_email(email)
    return (email_normalizado,) if email_normalizado else tuple()


def destinatarios_graph_finais(mensagem: dict[str, Any]) -> list[dict[str, dict[str, str]]]:
    return [
        {
            "emailAddress": {
                "address": email,
                "name": _nome_redirecionamento(email) if email in _emails_redirecionamento() else (
                    mensagem.get("destinatario_nome") or email
                ),
            }
        }
        for email in destinatarios_email_finais(mensagem.get("destinatario_email"))
    ]


def destinatario_email_final(email: Any) -> str:
    return next(iter(destinatarios_email_finais(email)), "")


def _valor_texto(valor: Any) -> str:
    if valor is None or valor == "":
        return "-"
    if isinstance(valor, (dict, list, tuple, set)):
        return escape(str(valor))
    return escape(str(valor))


def humanizar_status(valor: Any) -> str:
    texto = str(valor or "").strip()
    if not texto:
        return "-"
    return STATUS_USUARIO.get(texto, texto.replace("_", " ").strip().capitalize())


def humanizar_acao(valor: Any) -> str:
    texto = str(valor or "").strip()
    if not texto:
        return "Acompanhar pelo portal"
    return ACAO_USUARIO.get(texto, texto.replace("_", " ").strip().capitalize())


def humanizar_transicao_status(antes: Any, depois: Any) -> str:
    antes_texto = humanizar_status(antes)
    depois_texto = humanizar_status(depois)
    if antes_texto == depois_texto:
        return depois_texto
    return f"De {antes_texto} para {depois_texto}"


def _texto_presente(valor: Any) -> str:
    texto = str(valor or "").strip()
    return "" if texto in {"", "-"} else texto


def renderizar_texto(modelo: str, variaveis: dict[str, Any]) -> str:
    def substituir(match: re.Match[str]) -> str:
        chave = match.group(1).strip()
        return _valor_texto(variaveis.get(chave, ""))

    return re.sub(r"{{\s*([a-zA-Z0-9_]+)\s*}}", substituir, modelo or "")


def montar_html_corporativo(titulo: str, corpo_html: str, cta_label: str | None, cta_url: str | None) -> str:
    return f"""<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#223047;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #d9e2ef;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="background:#0f2f4f;color:#ffffff;padding:18px 24px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="width:74px;vertical-align:middle;">
                      <img src="cid:{EMAIL_LOGO_CID}" alt="7LM" width="58" height="58" style="display:block;border:0;border-radius:8px;background:#ffffff;">
                    </td>
                    <td style="vertical-align:middle;">
                      <div style="font-size:13px;letter-spacing:.3px;text-transform:uppercase;">7LM Connect | Comissionamento</div>
                      <div style="font-size:22px;font-weight:700;margin-top:6px;">{escape(titulo)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;font-size:15px;line-height:1.55;">
                {corpo_html}
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e6edf5;padding:16px 24px;color:#667085;font-size:12px;line-height:1.45;">
                {escape(RODAPE_EMAIL)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def mascarar_payload(payload: dict[str, Any]) -> dict[str, Any]:
    mascarado = dict(payload or {})
    for campo in ("valor_bruto", "valor_liquido", "valor_nf"):
        if campo in mascarado:
            mascarado[campo] = "consulte_no_portal"
    if "documento" in mascarado:
        mascarado["documento"] = "link_protegido"
    if "conteudo" in mascarado:
        mascarado["conteudo"] = "mascarado"
    return mascarado


def _json_objeto(valor: Any) -> dict[str, Any]:
    if isinstance(valor, dict):
        return valor
    if isinstance(valor, str) and valor.strip():
        try:
            parsed = json.loads(valor)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def permite_destinatario_real(fila: dict[str, Any], payload_renderizado: dict[str, Any] | None = None) -> bool:
    payload = payload_renderizado if payload_renderizado is not None else _json_objeto(fila.get("payload_renderizado"))
    return (
        fila.get("template_codigo") in TEMPLATES_ENVIO_REAL_DESTINATARIO
        and payload.get("entrega_controlada") == "destinatario_real"
    )


def _env_secreto(nome: str, nome_ref: str) -> str:
    valor = os.getenv(nome)
    if valor:
        return valor.strip()
    arquivo = os.getenv(f"{nome}_FILE")
    if arquivo:
        try:
            return open(arquivo, "r", encoding="utf-8").read().strip()
        except OSError:
            return ""
    ref = os.getenv(nome_ref)
    if not ref:
        return ""
    ref = ref.strip()
    if not ref:
        return ""
    valor_ref = os.getenv(ref, "").strip()
    if valor_ref and ref.endswith("_FILE"):
        try:
            return open(valor_ref, "r", encoding="utf-8").read().strip()
        except OSError:
            return ""
    return valor_ref


def _graph_configuracao() -> dict[str, str]:
    return {
        "tenant_id": _env_secreto("MS_GRAPH_TENANT_ID", "MS_GRAPH_TENANT_ID_REF"),
        "client_id": _env_secreto("MS_GRAPH_CLIENT_ID", "MS_GRAPH_CLIENT_ID_REF"),
        "client_secret": _env_secreto("MS_GRAPH_CLIENT_SECRET", "MS_GRAPH_CLIENT_SECRET_REF"),
        "sendmail_user": MS_GRAPH_SENDMAIL_USER,
    }


def _http_form(url: str, data: dict[str, str]) -> tuple[int, dict[str, Any], dict[str, str]]:
    encoded = parse.urlencode(data).encode("utf-8")
    req = request.Request(
        url,
        data=encoded,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=MS_GRAPH_TIMEOUT_SECONDS) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            return resp.status, json.loads(raw) if raw else {}, dict(resp.headers)
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="ignore")
        try:
            payload = json.loads(raw) if raw else {}
        except Exception:
            payload = {"erro": raw[:500]}
        return exc.code, payload, dict(exc.headers)


def _http_json(url: str, *, headers: dict[str, str], data: dict[str, Any]) -> tuple[int, dict[str, Any], dict[str, str]]:
    req = request.Request(
        url,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=MS_GRAPH_TIMEOUT_SECONDS) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            return resp.status, json.loads(raw) if raw else {}, dict(resp.headers)
    except error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="ignore")
        try:
            payload = json.loads(raw) if raw else {}
        except Exception:
            payload = {"erro": raw[:500]}
        return exc.code, payload, dict(exc.headers)


def _obter_token_graph() -> str:
    cfg = _graph_configuracao()
    faltantes = [chave for chave in ("tenant_id", "client_id", "client_secret") if not cfg.get(chave)]
    if faltantes:
        raise RuntimeError(f"Configuracao Microsoft Graph incompleta: {', '.join(faltantes)}")
    status, payload, _headers = _http_form(
        f"https://login.microsoftonline.com/{cfg['tenant_id']}/oauth2/v2.0/token",
        {
            "client_id": cfg["client_id"],
            "client_secret": cfg["client_secret"],
            "scope": "https://graph.microsoft.com/.default",
            "grant_type": "client_credentials",
        },
    )
    token = payload.get("access_token")
    if status >= 400 or not token:
        erro = payload.get("error") or payload.get("error_description") or f"HTTP {status}"
        raise RuntimeError(f"Falha ao obter token Graph: {erro}")
    return str(token)


def _anexo_logo_inline() -> dict[str, Any] | None:
    try:
        conteudo = EMAIL_LOGO_PATH.read_bytes()
    except OSError:
        return None
    content_type = mimetypes.guess_type(str(EMAIL_LOGO_PATH))[0] or "image/png"
    return {
        "@odata.type": "#microsoft.graph.fileAttachment",
        "name": EMAIL_LOGO_PATH.name,
        "contentType": content_type,
        "contentBytes": base64.b64encode(conteudo).decode("ascii"),
        "isInline": True,
        "contentId": EMAIL_LOGO_CID,
    }


def montar_anexo_pdf_transiente(nome_arquivo: str, conteudo: bytes) -> dict[str, Any]:
    return {
        "@odata.type": "#microsoft.graph.fileAttachment",
        "name": nome_arquivo or "nota-fiscal.pdf",
        "contentType": "application/pdf",
        "contentBytes": base64.b64encode(conteudo).decode("ascii"),
    }


def enviar_microsoft_graph(mensagem: dict[str, Any]) -> dict[str, Any]:
    cfg = _graph_configuracao()
    if (cfg.get("sendmail_user") or "").lower() != "inovacao@7lm.com.br":
        raise RuntimeError("Mailbox Graph bloqueada: somente inovacao@7lm.com.br esta autorizada neste MVP.")
    token = _obter_token_graph()
    anexos = []
    logo = _anexo_logo_inline()
    if logo:
        anexos.append(logo)
    anexos.extend(mensagem.get("attachments") or [])
    payload = {
        "message": {
            "subject": mensagem["assunto"],
            "body": {"contentType": "HTML", "content": mensagem["corpo_html"]},
            "toRecipients": destinatarios_graph_finais(mensagem),
            "internetMessageHeaders": [
                {"name": "X-7LM-Correlation-Id", "value": mensagem.get("correlation_id") or ""},
                {"name": "X-7LM-Template", "value": mensagem.get("template_codigo") or ""},
                {"name": "X-7LM-Original-Recipient", "value": _normalizar_email(mensagem.get("destinatario_email"))},
            ],
            **({"attachments": anexos} if anexos else {}),
        },
        "saveToSentItems": True,
    }
    status, response_payload, headers = _http_json(
        f"https://graph.microsoft.com/v1.0/users/{cfg['sendmail_user']}/sendMail",
        headers={"Authorization": f"Bearer {token}"},
        data=payload,
    )
    if status == 202:
        return {
            "status": "enviado_para_provider",
            "provider_message_id": headers.get("request-id") or headers.get("client-request-id") or f"graph-{uuid.uuid4()}",
            "response": {"http_status": status, "request_id": headers.get("request-id")},
        }
    erro_mensagem = response_payload.get("error", {}).get("message") or response_payload.get("error_description") or f"HTTP {status}"
    if status in (429, 500, 502, 503, 504):
        return {
            "status": "falhou_retry",
            "erro_codigo": str(status),
            "erro_mensagem": erro_mensagem,
            "response": {"http_status": status, "retry_after": headers.get("Retry-After")},
        }
    return {
        "status": "falhou_permanente",
        "erro_codigo": str(status),
        "erro_mensagem": erro_mensagem,
        "response": {"http_status": status},
    }


def variaveis_padrao(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    payload = payload or {}
    codigo = _texto_presente(payload.get("codigo_comissao")) or _texto_presente(payload.get("resultado_id")) or _texto_presente(payload.get("id"))
    nome_ator = _texto_presente(payload.get("acao_executada_por_nome")) or _texto_presente(payload.get("nf_enviada_por_nome")) or "Usuário do portal"
    email_ator = _texto_presente(payload.get("acao_executada_por_email")) or _texto_presente(payload.get("nf_enviada_por_email")) or "e-mail não identificado"
    return {
        "ciclo": payload.get("ciclo") or payload.get("ciclo_id") or "ciclo atual",
        "nome_destinatario": payload.get("nome_destinatario") or "Equipe 7LM",
        "link_comissionamento": payload.get("link_comissionamento") or LINK_COMISSIONAMENTO,
        "prazo": payload.get("prazo") or payload.get("prazo_nf") or "2 dias uteis",
        "status_atual": payload.get("status_atual") or humanizar_status(payload.get("status")),
        "codigo_comissao": codigo or "Não informado",
        "etapa_anterior_usuario": _texto_presente(payload.get("etapa_anterior_usuario")) or humanizar_status(payload.get("status_anterior")),
        "etapa_nova_usuario": _texto_presente(payload.get("etapa_nova_usuario")) or humanizar_status(payload.get("status")),
        "acao_executada_por_nome": nome_ator,
        "acao_executada_por_email": email_ator,
        "acao_executada_por_perfil": _texto_presente(payload.get("acao_executada_por_perfil")) or "Portal",
        "nf_enviada_por_nome": _texto_presente(payload.get("nf_enviada_por_nome")) or nome_ator,
        "nf_enviada_por_email": _texto_presente(payload.get("nf_enviada_por_email")) or email_ator,
        "nf_anexo_email": _texto_presente(payload.get("nf_anexo_email")) or "PDF anexado neste e-mail.",
        "proxima_acao": payload.get("proxima_acao") or humanizar_acao(payload.get("acao_executada")),
        "motivo": payload.get("motivo") or payload.get("comentario") or "Nao informado",
        "quantidade_itens": payload.get("quantidade_itens") or 1,
        "destino_pacote": payload.get("destino_pacote") or "Financeiro",
        "correlation_id": payload.get("correlation_id") or str(uuid.uuid4()),
    }


async def renderizar_template(conexao, esquema: str, codigo: str, payload: dict[str, Any], versao: int | None = None) -> dict[str, Any]:
    template = await obter_template(conexao, esquema, codigo, versao)
    if not template:
        raise HTTPException(status_code=404, detail=f"Template de notificacao nao encontrado: {codigo}.")

    variaveis = variaveis_padrao(payload)
    variaveis.update({chave: valor for chave, valor in (payload or {}).items() if valor is not None})
    variaveis["correlation_id"] = variaveis.get("correlation_id") or str(uuid.uuid4())

    assunto = renderizar_texto(template["assunto"], variaveis)
    titulo = renderizar_texto(template["titulo"], variaveis)
    corpo_html_base = renderizar_texto(template["corpo_html"], variaveis)
    corpo_texto = renderizar_texto(template["corpo_texto"], variaveis)
    cta_url = renderizar_texto(template.get("cta_url_template") or LINK_COMISSIONAMENTO, variaveis)
    corpo_html = montar_html_corporativo(titulo, corpo_html_base, template.get("cta_label"), cta_url)

    return {
        "template": template,
        "variaveis": variaveis,
        "assunto": assunto,
        "titulo": titulo,
        "corpo_html": corpo_html,
        "corpo_texto": f"{corpo_texto}\n\n{RODAPE_EMAIL}",
        "cta_url": cta_url,
    }


def destinatarios_allowlist(perfis: list[str] | None = None, provider: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    perfis = perfis or ["teste"]
    redirects = _emails_redirecionamento()
    if redirects:
        return [{
            "email": email,
            "nome": _nome_redirecionamento(email),
            "perfil": "redirecionamento_temporario",
            "canal": "email",
            "visibilidade": "ciclo",
            "pode_ver_valor": False,
        } for email in redirects]
    destinatarios = []
    for email in sorted(_allowlist(provider)):
        destinatarios.append({
            "email": email,
            "nome": email.split("@", 1)[0].replace(".", " ").title(),
            "perfil": perfis[0] if len(perfis) == 1 else "allowlist_teste",
            "canal": "email",
            "visibilidade": "ciclo",
            "pode_ver_valor": False,
        })
    return destinatarios


def _deduplicar_destinatarios(destinatarios: list[dict[str, Any]]) -> list[dict[str, Any]]:
    vistos: set[str] = set()
    unicos: list[dict[str, Any]] = []
    for destino in destinatarios:
        email = _normalizar_email(destino.get("email"))
        if not email or email in vistos:
            continue
        vistos.add(email)
        unicos.append({**destino, "email": email})
    return unicos


async def _usuarios_por_permissao_ou_perfil(
    conexao,
    *,
    permissoes: list[str],
    perfis: list[str],
    perfil_destino: str,
) -> list[dict[str, Any]]:
    linhas = await conexao.fetch(
        """
        select distinct
            u.identificador_usuario::text as usuario_id,
            u.nome_completo as nome,
            u.correio_eletronico as email,
            coalesce(string_agg(distinct p.nome_perfil, ', ' order by p.nome_perfil), '') as perfis
        from sevenlm_connect.usuario u
        left join sevenlm_connect.usuario_perfil up on up.identificador_usuario = u.identificador_usuario
        left join sevenlm_connect.perfil p on p.identificador_perfil = up.identificador_perfil
        where coalesce(u.indicador_ativo, true) = true
          and nullif(trim(u.correio_eletronico::text), '') is not null
          and (
            exists (
                select 1
                from unnest($1::text[]) permissao(nome)
                where coalesce(sevenlm_connect.fn_usuario_tem_permissao(u.identificador_usuario, permissao.nome), false)
            )
            or exists (
                select 1
                from unnest($2::text[]) perfil(nome)
                where lower(coalesce(p.nome_perfil, '')) like '%' || lower(perfil.nome) || '%'
            )
          )
        group by u.identificador_usuario, u.nome_completo, u.correio_eletronico
        order by u.nome_completo
        limit 20
        """,
        permissoes,
        perfis,
    )
    return _deduplicar_destinatarios([
        {
            "email": linha["email"],
            "nome": linha["nome"],
            "perfil": perfil_destino,
            "perfil_origem": linha["perfis"],
            "usuario_id": linha["usuario_id"],
            "canal": "email",
            "visibilidade": "ciclo",
            "pode_ver_valor": False,
        }
        for linha in linhas
    ])


async def destinatarios_reais_por_acao(
    conexao,
    *,
    acao: str,
    antes: dict[str, Any],
    depois: dict[str, Any],
    exige_nf: bool,
    destino_pacote: str | None,
) -> list[dict[str, Any]]:
    registro = depois or antes or {}
    comissionado = []
    if registro.get("email"):
        comissionado.append({
            "email": registro.get("email"),
            "nome": registro.get("nome") or registro.get("nome_destinatario") or "Comissionado",
            "perfil": "comissionado",
            "usuario_id": registro.get("identificador_usuario"),
            "canal": "email",
            "visibilidade": "propria",
            "pode_ver_valor": False,
        })

    secretaria = await _usuarios_por_permissao_ou_perfil(
        conexao,
        permissoes=["comissionamento.secretaria", "comissionamento.manage", "administracao.manage"],
        perfis=["Secretaria", "Admin"],
        perfil_destino="secretaria_admin",
    )
    head = await _usuarios_por_permissao_ou_perfil(
        conexao,
        permissoes=["comissionamento.aprovar.head"],
        perfis=["Head"],
        perfil_destino="head",
    )
    financeiro_rh = await _usuarios_por_permissao_ou_perfil(
        conexao,
        permissoes=["comissionamento.financeiro", "comissionamento.rh"],
        perfis=["Financeiro", "RH", "Recursos Humanos"],
        perfil_destino="financeiro_rh",
    )

    if acao in ("enviar_head",):
        return _deduplicar_destinatarios(head or secretaria)
    if acao in ("aprovar_head", "reenviar_lembrete_nf", "solicitar_correcao_nf", "validar_nf") and exige_nf:
        return _deduplicar_destinatarios(comissionado or secretaria)
    if acao in ("publicar_regra",):
        return _deduplicar_destinatarios(comissionado or secretaria)
    if acao in ("aprovar_head", "enviar_pacote_pagamento") and not exige_nf:
        return _deduplicar_destinatarios(financeiro_rh or secretaria)
    if acao in ("enviar_nf_financeiro", "enviar_pacote_pagamento"):
        return _deduplicar_destinatarios(financeiro_rh or secretaria)
    if acao in ("solicitar_ajuste", "recalculo_solicitado"):
        return _deduplicar_destinatarios(secretaria)
    if acao in ("rejeitar_comissionado",):
        return _deduplicar_destinatarios(comissionado)
    if acao in ("rejeitar",):
        return _deduplicar_destinatarios(secretaria)
    destino = (destino_pacote or "").lower()
    if "financeiro" in destino or "rh" in destino:
        return _deduplicar_destinatarios(financeiro_rh or secretaria)
    return _deduplicar_destinatarios(secretaria or comissionado)


def template_por_acao(acao: str, exige_nf: bool = True, destino_pacote: str | None = None) -> str | None:
    if acao == "aprovar_head":
        return "comissionado_nf_solicitada" if exige_nf else "rh_financeiro_pacote_clt_enviado"
    if acao == "enviar_pacote_pagamento":
        destino = (destino_pacote or "").upper()
        if "RH" in destino or "CLT" in destino:
            return "rh_financeiro_pacote_clt_enviado"
        return "financeiro_pacote_pj_enviado"
    if acao == "registrar_pagamento":
        return None
    return TEMPLATE_POR_ACAO.get(acao)


async def tabelas_notificacao_disponiveis(conexao, esquema: str) -> bool:
    linha = await conexao.fetchrow("select to_regclass($1) as tabela", f"{esquema}.notificacao_templates")
    return bool(linha and linha["tabela"])


async def criar_notificacao_de_acao(
    conexao,
    esquema: str,
    *,
    acao: str,
    evento_negocio_id: str | None,
    antes: dict[str, Any],
    depois: dict[str, Any],
    exige_nf: bool,
    comentario: str | None,
    idempotency_key: str | None,
    usuario_id: str | None,
    origem: str = "transicao",
    quantidade_itens: int = 1,
    destino_pacote: str | None = None,
    extra_payload: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    codigo_template = template_por_acao(acao, exige_nf=exige_nf, destino_pacote=destino_pacote)
    if not codigo_template:
        return None
    if not await tabelas_notificacao_disponiveis(conexao, esquema):
        return {
            "status": "notificacoes_nao_migradas",
            "acao": acao,
            "template_codigo": codigo_template,
            "mensagem": "Migration de notificacoes ainda nao aplicada; transicao de negocio preservada.",
        }

    provider = await obter_provider_ativo(conexao, esquema, COMISSIONAMENTO_EMAIL_PROVIDER)
    provider_codigo = (provider or {}).get("codigo") or "fake"
    correlation_id = f"comissionamento:{acao}:{depois.get('ciclo_id') or antes.get('ciclo_id') or 'ciclo'}:{depois.get('id') or antes.get('id') or 'consolidado'}:{idempotency_key or uuid.uuid4()}"
    payload_base = {
        **mascarar_payload(antes),
        **mascarar_payload(depois),
        "ciclo": depois.get("ciclo_id") or antes.get("ciclo_id"),
        "resultado_id": depois.get("id") or antes.get("id"),
        "codigo_comissao": depois.get("codigo_comissao") or antes.get("codigo_comissao") or depois.get("id") or antes.get("id"),
        "nome_comissionado": depois.get("nome") or antes.get("nome"),
        "email_comissionado": depois.get("email") or antes.get("email"),
        "cargo_comissionado": depois.get("cargo") or antes.get("cargo") or depois.get("funcao") or antes.get("funcao"),
        "perfil_comissionado": depois.get("perfil_acesso") or antes.get("perfil_acesso"),
        "tipo_comissionado": depois.get("tipo_comissionado") or antes.get("tipo_comissionado"),
        "papel_comissionamento": depois.get("papel_comissionamento") or antes.get("papel_comissionamento"),
        "origem_identidade": depois.get("origem_identidade") or antes.get("origem_identidade"),
        "validacao_lideranca": depois.get("validacao_lideranca") or antes.get("validacao_lideranca"),
        "status_atual": humanizar_transicao_status(antes.get("status"), depois.get("status")),
        "etapa_anterior_usuario": humanizar_status(antes.get("status")),
        "etapa_nova_usuario": humanizar_status(depois.get("status")),
        "status_nf_usuario": humanizar_status(depois.get("status_nf") or antes.get("status_nf")),
        "status_pagamento_usuario": humanizar_status(depois.get("status_pagamento") or antes.get("status_pagamento")),
        "acao_executada": humanizar_acao(acao),
        "motivo": comentario,
        "proxima_acao": PROXIMA_ACAO_USUARIO.get(codigo_template) or humanizar_acao(acao),
        "quantidade_itens": quantidade_itens,
        "destino_pacote": destino_pacote or ("Financeiro" if exige_nf else "RH e Financeiro"),
        "correlation_id": correlation_id,
        **mascarar_payload(extra_payload or {}),
    }
    payload = {**variaveis_padrao(payload_base), **payload_base}
    payload["codigo_comissao"] = (
        _texto_presente(payload.get("codigo_comissao"))
        or _texto_presente(payload.get("resultado_id"))
        or _texto_presente(depois.get("id"))
        or _texto_presente(antes.get("id"))
        or "Não informado"
    )
    payload["etapa_anterior_usuario"] = _texto_presente(payload.get("etapa_anterior_usuario")) or humanizar_status(antes.get("status"))
    payload["etapa_nova_usuario"] = _texto_presente(payload.get("etapa_nova_usuario")) or humanizar_status(depois.get("status"))
    payload["acao_executada_por_nome"] = _texto_presente(payload.get("acao_executada_por_nome")) or "Usuário do portal"
    payload["acao_executada_por_email"] = _texto_presente(payload.get("acao_executada_por_email")) or "e-mail não identificado"
    payload["nf_enviada_por_nome"] = _texto_presente(payload.get("nf_enviada_por_nome")) or payload["acao_executada_por_nome"]
    payload["nf_enviada_por_email"] = _texto_presente(payload.get("nf_enviada_por_email")) or payload["acao_executada_por_email"]
    payload["nf_anexo_email"] = _texto_presente(payload.get("nf_anexo_email")) or "PDF anexado neste e-mail."
    destinatarios_reais = await destinatarios_reais_por_acao(
        conexao,
        acao=acao,
        antes=antes,
        depois=depois,
        exige_nf=exige_nf,
        destino_pacote=destino_pacote,
    )
    payload["destinatarios_reais"] = [
        {
            "email": destino.get("email"),
            "nome": destino.get("nome"),
            "perfil": destino.get("perfil"),
            "usuario_id": destino.get("usuario_id"),
        }
        for destino in destinatarios_reais
    ]
    renderizado = await renderizar_template(conexao, esquema, codigo_template, payload)
    evento = await criar_evento_notificacao(
        conexao,
        esquema,
        evento_negocio_id=evento_negocio_id,
        correlation_id=correlation_id,
        ciclo_id=depois.get("ciclo_id") or antes.get("ciclo_id"),
        resultado_id=depois.get("id") or antes.get("id"),
        comissionado_id=depois.get("id") or antes.get("id"),
        tipo_evento=codigo_template,
        origem=origem,
        payload=payload,
        idempotency_key=idempotency_key,
        usuario_id=usuario_id,
    )
    envio_destinatario_real = acao in ACOES_ENVIO_REAL_DESTINATARIO
    destinatarios_base = destinatarios_reais if envio_destinatario_real else destinatarios_allowlist(provider=provider)
    destinatarios, destinatarios_originais = redirecionar_destinatarios_email(destinatarios_base)
    return await criar_notificacao_com_fila(
        conexao,
        esquema,
        evento_id=evento["id"],
        tipo_evento=codigo_template,
        titulo=renderizado["titulo"],
        resumo=renderizado["assunto"],
        link_acao=renderizado["cta_url"],
        prioridade="normal",
        ciclo_id=payload.get("ciclo"),
        resultado_id=depois.get("id") or antes.get("id"),
        comissionado_id=depois.get("id") or antes.get("id"),
        destinatarios=destinatarios,
        template=renderizado["template"],
        payload_renderizado={
            "assunto": renderizado["assunto"],
            "corpo_html": renderizado["corpo_html"],
            "corpo_texto": renderizado["corpo_texto"],
            "from": COMISSIONAMENTO_EMAIL_FROM,
            "reply_to": COMISSIONAMENTO_EMAIL_REPLY_TO,
            "correlation_id": correlation_id,
            "destinatarios_reais": payload["destinatarios_reais"],
            "destinatarios_originais": destinatarios_originais,
            "redirecionado_para": list(_emails_redirecionamento()) or None,
            "entrega_controlada": "destinatario_real" if envio_destinatario_real else "teste_allowlist",
        },
        provider_codigo=provider_codigo,
        idempotency_key=idempotency_key,
    )


async def criar_notificacao_manual(
    conexao,
    esquema: str,
    *,
    template_codigo: str,
    payload: dict[str, Any],
    destinatarios: list[dict[str, Any]] | None,
    usuario_id: str | None,
    idempotency_key: str | None,
) -> dict[str, Any]:
    provider = await obter_provider_ativo(conexao, esquema, COMISSIONAMENTO_EMAIL_PROVIDER)
    allowlist = _allowlist(provider)
    destinos, destinos_originais = redirecionar_destinatarios_email(destinatarios or destinatarios_allowlist(provider=provider))
    destinos_filtrados = [destino for destino in destinos if _normalizar_email(destino.get("email")) in allowlist]
    if not destinos_filtrados:
        raise HTTPException(status_code=422, detail="Nenhum destinatario permitido pela allowlist de teste.")

    correlation_id = f"comissionamento:manual:{template_codigo}:{payload.get('ciclo') or payload.get('ciclo_id') or 'ciclo'}:{idempotency_key or uuid.uuid4()}"
    payload = {**variaveis_padrao(payload), **(payload or {}), "correlation_id": correlation_id}
    renderizado = await renderizar_template(conexao, esquema, template_codigo, payload)
    evento = await criar_evento_notificacao(
        conexao,
        esquema,
        evento_negocio_id=None,
        correlation_id=correlation_id,
        ciclo_id=payload.get("ciclo") or payload.get("ciclo_id"),
        resultado_id=payload.get("resultado_id"),
        comissionado_id=payload.get("comissionado_id"),
        tipo_evento=template_codigo,
        origem="manual",
        payload=mascarar_payload(payload),
        idempotency_key=idempotency_key,
        usuario_id=usuario_id,
    )
    return await criar_notificacao_com_fila(
        conexao,
        esquema,
        evento_id=evento["id"],
        tipo_evento=template_codigo,
        titulo=renderizado["titulo"],
        resumo=renderizado["assunto"],
        link_acao=renderizado["cta_url"],
        prioridade="normal",
        ciclo_id=payload.get("ciclo") or payload.get("ciclo_id"),
        resultado_id=payload.get("resultado_id"),
        comissionado_id=payload.get("comissionado_id"),
        destinatarios=destinos_filtrados,
        template=renderizado["template"],
        payload_renderizado={
            "assunto": renderizado["assunto"],
            "corpo_html": renderizado["corpo_html"],
            "corpo_texto": renderizado["corpo_texto"],
            "from": COMISSIONAMENTO_EMAIL_FROM,
            "reply_to": COMISSIONAMENTO_EMAIL_REPLY_TO,
            "correlation_id": correlation_id,
            "destinatarios_originais": destinos_originais,
            "redirecionado_para": list(_emails_redirecionamento()) or None,
        },
        provider_codigo=(provider or {}).get("codigo") or "fake",
        idempotency_key=idempotency_key,
    )


async def _processar_fila_item(
    conexao,
    esquema: str,
    *,
    fila: dict[str, Any],
    provider: dict[str, Any] | None,
    provider_codigo: str,
    modo: str,
    allowlist: set[str],
    anexos_transientes: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    email_original = _normalizar_email(fila.get("destinatario_email"))
    email = destinatario_email_final(email_original)
    payload_renderizado = _json_objeto(fila.get("payload_renderizado"))
    destinatario_real_permitido = permite_destinatario_real(fila, payload_renderizado)
    request_payload = mascarar_payload({
        "fila_id": fila["id"],
        "destinatario_email": email,
        "destinatario_email_original": email_original,
        "template_codigo": fila.get("template_codigo"),
        "provider": provider_codigo,
        "modo": modo,
        "entrega_controlada": payload_renderizado.get("entrega_controlada"),
    })
    if email not in allowlist and not destinatario_real_permitido:
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
    if provider_codigo == "microsoft_graph" and COMISSIONAMENTO_EMAIL_SEND_ENABLED and modo == "teste_allowlist":
        try:
            resultado_graph = enviar_microsoft_graph({
                "assunto": payload_renderizado.get("assunto") or "7LM Connect",
                "corpo_html": payload_renderizado.get("corpo_html") or payload_renderizado.get("corpo_texto") or "",
                "destinatario_email": email,
                "destinatario_nome": fila.get("destinatario_nome") or email,
                "correlation_id": payload_renderizado.get("correlation_id") or fila.get("id"),
                "template_codigo": fila.get("template_codigo"),
                "attachments": anexos_transientes or [],
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
        response = {"dry_run": True, "provider": provider_codigo, "send_enabled": False}

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


async def processar_filas_especificas(
    conexao,
    esquema: str,
    fila_ids: list[str],
    anexos_transientes_por_fila: dict[str, list[dict[str, Any]]] | None = None,
) -> dict[str, Any]:
    provider = await obter_provider_ativo(conexao, esquema, COMISSIONAMENTO_EMAIL_PROVIDER)
    provider_codigo = (provider or {}).get("codigo") or "fake"
    modo = str((provider or {}).get("modo") or COMISSIONAMENTO_EMAIL_MODE or "dry_run")
    allowlist = _allowlist(provider)
    processadas = []
    for fila_id in fila_ids:
        fila = await obter_fila(conexao, esquema, fila_id)
        if not fila or fila.get("status") not in {"pendente", "falhou_retry"}:
            continue
        processadas.append(await _processar_fila_item(
            conexao,
            esquema,
            fila=fila,
            provider=provider,
            provider_codigo=provider_codigo,
            modo=modo,
            allowlist=allowlist,
            anexos_transientes=(anexos_transientes_por_fila or {}).get(fila_id),
        ))
    return {"processadas": processadas, "quantidade": len(processadas), "provider": provider_codigo, "modo": modo}


async def processar_fila(conexao, esquema: str, limite: int = 25) -> dict[str, Any]:
    provider = await obter_provider_ativo(conexao, esquema, COMISSIONAMENTO_EMAIL_PROVIDER)
    provider_codigo = (provider or {}).get("codigo") or "fake"
    modo = str((provider or {}).get("modo") or COMISSIONAMENTO_EMAIL_MODE or "dry_run")
    allowlist = _allowlist(provider)
    filas = await buscar_filas_pendentes(conexao, esquema, limite)
    processadas = []

    for fila in filas:
        processadas.append(await _processar_fila_item(
            conexao,
            esquema,
            fila=fila,
            provider=provider,
            provider_codigo=provider_codigo,
            modo=modo,
            allowlist=allowlist,
            anexos_transientes=None,
        ))
    return {"processadas": processadas, "quantidade": len(processadas), "provider": provider_codigo, "modo": modo}


async def testar_provider_seguro(conexao, esquema: str) -> dict[str, Any]:
    provider = await obter_provider_ativo(conexao, esquema, COMISSIONAMENTO_EMAIL_PROVIDER)
    provider_codigo = (provider or {}).get("codigo") or "fake"
    cfg = _graph_configuracao()
    return {
        "status": "ok",
        "provider": provider_codigo,
        "modo": (provider or {}).get("modo") or COMISSIONAMENTO_EMAIL_MODE,
        "send_enabled": bool(COMISSIONAMENTO_EMAIL_SEND_ENABLED),
        "remetente": COMISSIONAMENTO_EMAIL_FROM,
        "reply_to": COMISSIONAMENTO_EMAIL_REPLY_TO,
        "allowlist": sorted(_allowlist(provider)),
        "microsoft_graph": {
            "sendmail_user": MS_GRAPH_SENDMAIL_USER,
            "timeout_seconds": MS_GRAPH_TIMEOUT_SECONDS,
            "max_retries": MS_GRAPH_MAX_RETRIES,
            "tenant_configurado": bool(cfg["tenant_id"]),
            "client_configurado": bool(cfg["client_id"]),
            "credencial_configurada": bool(cfg["client_secret"]),
            "pronto_para_envio_real": bool(
                provider_codigo == "microsoft_graph"
                and COMISSIONAMENTO_EMAIL_SEND_ENABLED
                and ((provider or {}).get("modo") or COMISSIONAMENTO_EMAIL_MODE) == "teste_allowlist"
                and cfg["tenant_id"]
                and cfg["client_id"]
                and cfg["client_secret"]
                and MS_GRAPH_SENDMAIL_USER.lower() == "inovacao@7lm.com.br"
            ),
        },
        "mensagem": "Teste seguro executado sem envio real.",
    }


async def listar_templates_ou_erro(conexao, esquema: str) -> list[dict[str, Any]]:
    return await listar_templates(conexao, esquema)


async def salvar_template_configurado(conexao, esquema: str, payload: dict[str, Any], usuario_id: str | None) -> dict[str, Any]:
    obrigatorios = ["codigo", "assunto", "titulo", "corpo_html", "corpo_texto"]
    faltantes = [campo for campo in obrigatorios if not payload.get(campo)]
    if faltantes:
        raise HTTPException(status_code=422, detail=f"Campos obrigatorios ausentes: {', '.join(faltantes)}")
    return await salvar_template(conexao, esquema, payload, usuario_id)


async def preparar_reenvio(conexao, esquema: str, fila_envio_id: str, idempotency_key: str | None) -> dict[str, Any]:
    fila = await resetar_fila_para_reenvio(conexao, esquema, fila_envio_id, idempotency_key)
    if not fila:
        raise HTTPException(status_code=404, detail="Envio de notificacao nao encontrado.")
    return fila
