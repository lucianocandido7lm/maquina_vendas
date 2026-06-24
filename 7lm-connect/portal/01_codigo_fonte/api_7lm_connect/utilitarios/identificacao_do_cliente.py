"""
Autor: Willian Elias Franca
Projeto: 7LM Connect - Plataforma Integrada
Observação: arquivos em português, com nomes descritivos.
"""


from typing import Dict, Any
from fastapi import Request
from configuracoes import REGISTRAR_TODOS_CABECALHOS

VALOR_REDIGIDO = "[REDACTED]"
CHAVES_CABECALHO_SENSIVEIS = {
    "authorization",
    "cookie",
    "set-cookie",
    "x-api-key",
    "api-key",
    "proxy-authorization",
}

def obter_endereco_ip(request: Request) -> str:
    encaminhado = request.headers.get("x-forwarded-for")
    if encaminhado:
        return encaminhado.split(",")[0].strip()
    if request.client:
        return request.client.host
    return ""

def obter_agente_do_usuario(request: Request) -> str:
    return request.headers.get("user-agent", "")

def obter_origem(request: Request) -> str:
    return request.headers.get("origin", "")

def obter_referênciador(request: Request) -> str:
    return request.headers.get("referer", "")

def obter_referenciador(request: Request) -> str:
    return obter_referênciador(request)

def obter_idioma(request: Request) -> str:
    return request.headers.get("accept-language", "")

def obter_cabecalhos(request: Request) -> Dict[str, Any]:
    if REGISTRAR_TODOS_CABECALHOS:
        origem = dict(request.headers)
        return {
            chave: VALOR_REDIGIDO if chave.lower() in CHAVES_CABECALHO_SENSIVEIS else valor
            for chave, valor in origem.items()
        }

    principais = [
        "user-agent", "accept", "accept-language", "origin", "referer",
        "x-forwarded-for", "x-real-ip"
    ]
    retorno = {}
    for k in principais:
        if k in request.headers:
            retorno[k] = request.headers.get(k)
    return retorno
