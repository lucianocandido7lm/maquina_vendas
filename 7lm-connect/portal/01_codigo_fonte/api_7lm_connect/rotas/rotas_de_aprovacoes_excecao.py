"""
Rotas de aprovacao excepcional do simulador comercial.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from configuracoes import ESQUEMA_COMERCIAL
from dependencias import obter_usuario_autenticado
from modelos.simulador import RequisicaoDecisaoAprovacaoExcecao
from repositorios.aprovacoes_excecao import (
    atualizar_aprovacao_excecao_status,
    buscar_aprovacao_excecao_por_id,
    contar_aprovacoes_excecao_pendentes,
    listar_aprovacoes_excecao,
    listar_aprovacoes_excecao_pendentes_resumo,
)
from repositorios.simulador import (
    atualizar_reserva_status,
    atualizar_status_imovel,
    buscar_reserva_ativa_por_imovel_lock,
    inserir_historico_status_imovel,
    obter_imovel_para_operacao_lock,
)
from servicos.simulador import serializar_aprovacao_excecao, serializar_reserva
from utilitarios.autorizacao import exigir_permissao_portal


rotas_de_aprovacoes_excecao = APIRouter()

STATUS_IMOVEL_PENDENTE_APROVACAO = "Pendente de aprovação"


def _obter_pool(request: Request):
    pool = getattr(request.app.state, "pool", None)
    if not pool:
        raise HTTPException(status_code=503, detail="Pool indisponivel.")
    return pool


def _normalizar_status_filtro(valor: str | None) -> str | None:
    texto = str(valor or "").strip().upper()
    if not texto or texto in {"TODAS", "TODOS", "HISTORICO"}:
        return None

    aliases = {
        "PENDENTES": "PENDENTE",
        "APROVADAS": "APROVADA",
        "REPROVADAS": "REPROVADA",
        "CANCELADAS": "CANCELADA",
    }
    return aliases.get(texto, texto)


@rotas_de_aprovacoes_excecao.get("/connect-comercial/aprovacoes-excecao/resumo")
async def obter_resumo_aprovacoes_excecao(
    request: Request,
    limite: int = Query(5, ge=1, le=20),
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "aprovacoes.excecao.manage",
            "Você não tem permissão para revisar aprovações excepcionais.",
        )

        total_pendentes = await contar_aprovacoes_excecao_pendentes(conexao, ESQUEMA_COMERCIAL)
        itens = await listar_aprovacoes_excecao_pendentes_resumo(conexao, ESQUEMA_COMERCIAL, limite=limite)

    return {
        "total_pendentes": total_pendentes,
        "itens": [serializar_aprovacao_excecao(item) for item in itens],
    }


@rotas_de_aprovacoes_excecao.get("/connect-comercial/aprovacoes-excecao")
async def listar_aprovacoes_excecao_rota(
    request: Request,
    status: str | None = Query(None),
    limite: int = Query(200, ge=1, le=500),
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    status_normalizado = _normalizar_status_filtro(status)

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "aprovacoes.excecao.view",
            "Você não tem permissão para visualizar aprovações excepcionais.",
        )

        itens = await listar_aprovacoes_excecao(
            conexao,
            ESQUEMA_COMERCIAL,
            status=status_normalizado,
            limite=limite,
        )
        total_pendentes = await contar_aprovacoes_excecao_pendentes(conexao, ESQUEMA_COMERCIAL)

    return {
        "status": status_normalizado,
        "total_pendentes": total_pendentes,
        "itens": [serializar_aprovacao_excecao(item) for item in itens],
    }


@rotas_de_aprovacoes_excecao.get("/connect-comercial/aprovacoes-excecao/{identificador_aprovacao}")
async def detalhar_aprovacao_excecao(
    identificador_aprovacao: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "aprovacoes.excecao.view",
            "Você não tem permissão para visualizar aprovações excepcionais.",
        )
        item = await buscar_aprovacao_excecao_por_id(
            conexao,
            ESQUEMA_COMERCIAL,
            identificador_aprovacao,
        )

    if not item:
        raise HTTPException(status_code=404, detail="Solicitação de aprovação não encontrada.")

    return {"item": serializar_aprovacao_excecao(item)}


@rotas_de_aprovacoes_excecao.post("/connect-comercial/aprovacoes-excecao/{identificador_aprovacao}/decisao")
async def decidir_aprovacao_excecao(
    identificador_aprovacao: str,
    payload: RequisicaoDecisaoAprovacaoExcecao,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    acao = str(payload.acao or "").strip().lower()
    observacoes = (payload.observacoes or "").strip() or None
    if acao not in {"aprovar", "reprovar"}:
        raise HTTPException(status_code=400, detail="Informe uma decisão válida: aprovar ou reprovar.")

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "aprovacoes.excecao.manage",
            "Você não tem permissão para decidir aprovações excepcionais.",
        )

        async with conexao.transaction():
            aprovacao = await buscar_aprovacao_excecao_por_id(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_aprovacao,
                for_update=True,
            )
            if not aprovacao:
                raise HTTPException(status_code=404, detail="Solicitação de aprovação não encontrada.")

            if str(aprovacao.get("status") or "").upper() != "PENDENTE":
                raise HTTPException(
                    status_code=409,
                    detail="Essa solicitação já foi concluida e não pode ser avaliada novamente.",
                )

            imovel = await obter_imovel_para_operacao_lock(
                conexao,
                ESQUEMA_COMERCIAL,
                aprovacao["identificador_imovel"],
            )
            if not imovel:
                raise HTTPException(status_code=404, detail="Imóvel vinculado a solicitação não encontrado.")

            reserva = await buscar_reserva_ativa_por_imovel_lock(
                conexao,
                ESQUEMA_COMERCIAL,
                aprovacao["identificador_imovel"],
            )
            if not reserva or str(reserva.get("identificador_reserva") or "") != str(aprovacao.get("identificador_reserva") or ""):
                raise HTTPException(
                    status_code=409,
                    detail="A solicitação não possui uma reserva pendente válida para decisão.",
                )

            if str(reserva.get("status") or "").upper() != "PENDENTE_APROVACAO":
                raise HTTPException(
                    status_code=409,
                    detail="A reserva vinculada já não está aguardando aprovação.",
                )

            aprovado = acao == "aprovar"
            novo_status_aprovacao = "APROVADA" if aprovado else "REPROVADA"
            novo_status_reserva = "ATIVA" if aprovado else "LIBERADA"
            novo_status_imovel = "Reservado" if aprovado else "Disponivel"

            reserva_atualizada = await atualizar_reserva_status(
                conexao,
                ESQUEMA_COMERCIAL,
                reserva["identificador_reserva"],
                novo_status_reserva,
                observacoes,
            )
            await atualizar_aprovacao_excecao_status(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_aprovacao,
                novo_status=novo_status_aprovacao,
                avaliado_por=identificador_usuario,
                avaliado_em=datetime.now(timezone.utc),
                observacoes_avaliacao=observacoes,
            )
            await atualizar_status_imovel(
                conexao,
                ESQUEMA_COMERCIAL,
                aprovacao["identificador_imovel"],
                novo_status_imovel,
            )
            await inserir_historico_status_imovel(
                conexao,
                ESQUEMA_COMERCIAL,
                {
                    "identificador_imovel": aprovacao["identificador_imovel"],
                    "status_anterior": imovel.get("status"),
                    "status_novo": novo_status_imovel,
                    "identificador_simulacao": aprovacao.get("identificador_simulacao"),
                    "identificador_cliente": aprovacao.get("identificador_cliente"),
                    "alterado_por": identificador_usuario,
                    "observacoes": observacoes,
                },
            )
            aprovacao_atualizada = await buscar_aprovacao_excecao_por_id(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_aprovacao,
            )

    return {
        "mensagem": (
            "Solicitação aprovada. O imóvel voltou para o fluxo comercial como reservado."
            if acao == "aprovar"
            else "Solicitação reprovada. O imóvel foi liberado novamente para disponibilidade."
        ),
        "item": serializar_aprovacao_excecao(aprovacao_atualizada),
        "reserva": serializar_reserva(reserva_atualizada),
        "status_imovel": novo_status_imovel,
    }
