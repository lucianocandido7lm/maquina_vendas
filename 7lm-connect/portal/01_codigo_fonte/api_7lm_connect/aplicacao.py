"""
Aplicacao principal da API do portal.
Nesta fase, a base institucional 7LM Connect preserva autenticacao, MFA, acesso e banco.
Rotas legadas indevidas foram retiradas da exposicao publica nesta fase institucional.
"""

import asyncio
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from banco import encerrar_pool_de_conexoes, iniciar_pool_de_conexoes
from configuracoes import CORS_ORIGENS_PERMITIDAS, SERVIDOR_HOST, SERVIDOR_PORTA, SERVIDOR_TRABALHADORES
from rotas.rotas_de_administracao import rotas_de_administracao
from rotas.rotas_de_aprovacoes_excecao import rotas_de_aprovacoes_excecao
from rotas.rotas_de_clientes import rotas_de_clientes
from rotas.rotas_de_comissionamento import rotas_de_comissionamento
from rotas.rotas_de_dashboard_comercial import rotas_de_dashboard_comercial
from rotas.rotas_de_entrada import rotas_de_entrada
from rotas.rotas_de_imoveis import rotas_de_imoveis
from rotas.rotas_de_maq_credito import rotas_de_maq_credito
from rotas.rotas_de_metas import rotas_de_metas
from rotas.rotas_de_mfa import rotas_de_mfa
from rotas.rotas_de_preferencias_visuais import rotas_de_preferencias_visuais
from rotas.rotas_de_relatorios import rotas_de_relatorios
from rotas.rotas_de_simulador import rotas_de_simulador
from utilitarios.auditoria import (
    calcular_hash_corpo,
    encerrar_consumidor,
    enfileirar_registro_tecnico,
    iniciar_fila_e_consumidor,
    novo_identificador_requisicao,
    preparar_corpo_requisicao_para_auditoria,
)
from utilitarios.identificacao_do_cliente import (
    obter_agente_do_usuario,
    obter_cabecalhos,
    obter_endereco_ip,
    obter_origem,
    obter_referenciador,
)
from utilitarios.seguranca import ler_token_de_acesso
from modulos.maq_credito.db import init_db as iniciar_banco_maq_credito


@asynccontextmanager
async def ciclo_de_vida(aplicacao: FastAPI):
    pool = await iniciar_pool_de_conexoes()
    aplicacao.state.pool = pool
    await iniciar_fila_e_consumidor(pool)
    await asyncio.to_thread(iniciar_banco_maq_credito)

    try:
        yield
    finally:
        await encerrar_consumidor()

        try:
            aplicacao.state.pool = None
        except Exception:
            pass

        await encerrar_pool_de_conexoes()


aplicacao = FastAPI(
    title="7LM - API",
    version="0.1.0",
    default_response_class=ORJSONResponse,
    lifespan=ciclo_de_vida,
)

aplicacao.add_middleware(
    CORSMiddleware,
    allow_origins=list(CORS_ORIGENS_PERMITIDAS),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["x-identificador-requisicao"],
)

aplicacao.include_router(rotas_de_entrada, tags=["entrada"])
aplicacao.include_router(rotas_de_relatorios, tags=["relatorios"])
aplicacao.include_router(rotas_de_preferencias_visuais, tags=["preferencias_visuais"])
aplicacao.include_router(rotas_de_administracao, prefix="/api", tags=["administracao"])
aplicacao.include_router(rotas_de_aprovacoes_excecao, prefix="/api", tags=["aprovacoes_excecao"])
aplicacao.include_router(rotas_de_clientes, prefix="/api", tags=["clientes"])
aplicacao.include_router(rotas_de_comissionamento, prefix="/api", tags=["comissionamento"])
aplicacao.include_router(rotas_de_dashboard_comercial, prefix="/api", tags=["dashboard_comercial"])
aplicacao.include_router(rotas_de_imoveis, prefix="/api", tags=["imoveis"])
aplicacao.include_router(rotas_de_maq_credito, prefix="/api", tags=["maq_credito"])
aplicacao.include_router(rotas_de_metas, prefix="/api", tags=["metas_resultados"])
aplicacao.include_router(rotas_de_simulador, prefix="/api", tags=["simulador"])
aplicacao.include_router(rotas_de_mfa, tags=["mfa"])


@aplicacao.get("/saude")
async def saude():
    return {"status": "ok"}


PREFIXOS_SENSIVEIS = (
    "/entrada",
    "/mfa",
    "/api/entrada",
    "/api/mfa",
    "/api/auth",
)

CAMINHOS_SENSIVEIS_EXATOS = {
    "/entrada/login",
    "/entrada/atualizar-credencial",
    "/entrada/saida",
    "/entrada/mfa/iniciar",
    "/entrada/mfa/confirmar",
    "/entrada/mfa/verificar",
    "/entrada/mfa/desativar",
    "/mfa/iniciar",
    "/mfa/confirmar",
    "/mfa/verificar",
    "/mfa/desativar",
}


def _eh_caminho_sensivel(path: str) -> bool:
    if path in CAMINHOS_SENSIVEIS_EXATOS:
        return True
    for prefixo in PREFIXOS_SENSIVEIS:
        if path == prefixo or path.startswith(prefixo + "/"):
            return True
    return False


@aplicacao.middleware("http")
async def middleware_registro_tecnico(request: Request, call_next):
    identificador_requisicao = novo_identificador_requisicao()
    inicio = time.time()

    endereco_ip = obter_endereco_ip(request)
    agente_do_usuario = obter_agente_do_usuario(request)
    origem = obter_origem(request)
    referenciador = obter_referenciador(request)
    cabecalhos = obter_cabecalhos(request)

    corpo_hash = None
    corpo_tamanho = None
    corpo_auditoria = {}
    path = request.url.path or ""
    caminho_sensivel = _eh_caminho_sensivel(path)

    try:
        corpo = await request.body()
        if corpo:
            corpo_tamanho = len(corpo)
            corpo_hash = calcular_hash_corpo(corpo)
            corpo_auditoria = preparar_corpo_requisicao_para_auditoria(
                corpo,
                request.headers.get("content-type", ""),
                sensivel=caminho_sensivel,
            )
    except Exception:
        corpo_auditoria = {}

    identificador_usuario = None
    identificador_sessao = None
    autorizacao = request.headers.get("authorization", "")
    if autorizacao.lower().startswith("bearer "):
        token = autorizacao.split(" ", 1)[1].strip()
        payload = ler_token_de_acesso(token, validar_expiracao=False)
        if payload:
            identificador_usuario = payload.get("sub")
            identificador_sessao = payload.get("sid")

    resposta = await call_next(request)
    duracao_ms = int((time.time() - inicio) * 1000)

    tamanho_resposta = None
    try:
        if "content-length" in resposta.headers:
            tamanho_resposta = int(resposta.headers.get("content-length"))
    except Exception:
        tamanho_resposta = None

    registro = {
        "identificador_requisicao": identificador_requisicao,
        "identificador_usuario": identificador_usuario,
        "identificador_sessao": identificador_sessao,
        "metodo_http": request.method,
        "caminho_http": path,
        "consulta_http": request.url.query,
        "codigo_resposta_http": resposta.status_code,
        "duracao_milisegundos": duracao_ms,
        "tamanho_resposta_bytes": tamanho_resposta,
        "endereco_ip": endereco_ip,
        "agente_do_usuario": agente_do_usuario,
        "origem": origem,
        "referenciador": referenciador,
        "cabecalhos_http": cabecalhos,
        "corpo_requisicao_hash": corpo_hash,
        "corpo_requisicao_tamanho": corpo_tamanho,
        **corpo_auditoria,
    }

    await enfileirar_registro_tecnico(registro)
    resposta.headers["x-identificador-requisicao"] = identificador_requisicao
    return resposta


if __name__ == "__main__":
    os.chdir(Path(__file__).resolve().parent)

    import uvicorn

    trabalhadores = int(SERVIDOR_TRABALHADORES)
    if os.name == "nt" and trabalhadores > 1:
        trabalhadores = 1

    uvicorn.run(
        "aplicacao:aplicacao",
        host=SERVIDOR_HOST,
        port=int(SERVIDOR_PORTA),
        reload=False,
        workers=trabalhadores,
    )
