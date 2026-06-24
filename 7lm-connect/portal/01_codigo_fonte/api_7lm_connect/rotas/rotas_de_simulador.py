"""
Rotas do simulador comercial inteligente.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from configuracoes import ESQUEMA_COMERCIAL
from dependencias import obter_usuario_autenticado
from modelos.simulador import (
    RequisicaoAtualizarComplementoRenda,
    RequisicaoCalcularSimulacao,
    RequisicaoCriarComplementoRenda,
    RequisicaoOperacaoImovel,
    RequisicaoSalvarSimulacao,
    RequisicaoSugerirImoveis,
)
from repositorios.aprovacoes_excecao import (
    atualizar_aprovacao_excecao_status,
    buscar_aprovacao_excecao_por_id,
    buscar_aprovacao_excecao_aprovada,
    buscar_aprovacao_excecao_pendente_por_reserva_lock,
    criar_aprovacao_excecao,
)
from repositorios.imoveis import buscar_imovel_por_id, listar_midias_imovel
from repositorios.simulador import (
    atualizar_reserva_operacao,
    atualizar_reserva_status,
    atualizar_simulacao,
    atualizar_status_imovel,
    buscar_cliente_para_simulador_por_id,
    buscar_complemento_renda_por_id,
    buscar_imovel_para_simulador_por_id,
    buscar_reserva_ativa_por_imovel_lock,
    buscar_simulacao_por_id,
    criar_complemento_renda,
    criar_imovel_reserva,
    criar_simulacao,
    excluir_complemento_renda,
    inserir_historico_status_imovel,
    inserir_parcelas_simulacao,
    listar_clientes_aprovados_para_simulador,
    listar_complementos_renda,
    listar_imoveis_para_simulador,
    listar_parcelas_simulacao,
    listar_reservas_ativas_cliente,
    listar_simulacoes_cliente,
    obter_imovel_para_operacao_lock,
    substituir_parcelas_simulacao,
    atualizar_complemento_renda,
)
from servicos.imoveis import serializar_imovel
from servicos.simulador import (
    DESCONTO_IMOVEL_MAXIMO,
    analisar_aprovacao_excecao,
    calcular_simulacao_comercial,
    consolidar_nucleo_familiar,
    montar_identificacao_imovel_simulador,
    montar_payload_simulacao_persistencia,
    normalizar_payload_complemento,
    serializar_aprovacao_excecao,
    serializar_complemento_renda,
    serializar_reserva,
    serializar_simulacao,
    sugerir_imoveis_inteligentes,
    validar_operacao_final,
)
from utilitarios.autorizacao import exigir_permissao_portal
from utilitarios.clientes_acesso import usuario_pode_ver_todos_clientes
from validacoes.imoveis import (
    calcular_data_entrega_dinamica,
    calcular_meses_ate_entrega_dinamica,
    calcular_valor_garantido_padrao,
)


rotas_de_simulador = APIRouter()

DECIMAL_ZERO = Decimal("0.00")
PERMISSAO_SIMULADOR_VIEW = "maquina.vendas.dashboard.view"


def _decimal_monetario(valor) -> Decimal:
    if valor in (None, ""):
        return DECIMAL_ZERO
    try:
        return Decimal(str(valor)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError, TypeError):
        return DECIMAL_ZERO


def _ajustar_faixa_preco_por_valor_negociado(payload: dict, valor):
    if valor in (None, ""):
        return None

    desconto = min(
        max(_decimal_monetario(payload.get("desconto_imovel") or payload.get("incentivo_7lm")), DECIMAL_ZERO),
        DESCONTO_IMOVEL_MAXIMO,
    )
    sobrepreco = max(_decimal_monetario(payload.get("sobrepreco")), DECIMAL_ZERO)
    valor_filtro = _decimal_monetario(valor)
    valor_cadastrado_equivalente = valor_filtro - sobrepreco + desconto

    return max(valor_cadastrado_equivalente, DECIMAL_ZERO)


def _obter_pool(request: Request):
    pool = getattr(request.app.state, "pool", None)
    if not pool:
        raise HTTPException(status_code=503, detail="Pool indisponivel.")
    return pool


def _model_dump_simulador(payload) -> dict:
    dados = payload.model_dump()
    campos_informados = getattr(payload, "model_fields_set", None)
    if campos_informados is None:
        campos_informados = getattr(payload, "__fields_set__", set())
    if dados.get("desconto_imovel") in (None, "") and dados.get("incentivo_7lm") not in (None, ""):
        dados["desconto_imovel"] = dados.get("incentivo_7lm")

    parceiro = str(dados.get("parceiro_simulacao") or "").strip().lower()
    if "creditur" in parceiro or "creditu" in parceiro:
        if "meses_pre_entrega" not in campos_informados:
            dados["meses_pre_entrega"] = None
        if "meses_pos_entrega" not in campos_informados:
            dados["meses_pos_entrega"] = None
    return dados


def _normalizar_like(valor: str | None) -> str | None:
    texto = str(valor or "").strip()
    if not texto:
        return None
    return f"%{texto}%"


def _normalizar_status(valor: str | None) -> str | None:
    texto = str(valor or "").strip()
    return texto or None


def _normalizar_busca(valor: str | None) -> str:
    texto = str(valor or "").strip()
    if not texto:
        return "%%"
    return f"%{texto}%"


def _serializar_cliente_simulador(item) -> dict:
    linha = dict(item or {})
    parametros_simulacao = linha.get("parametros_simulacao") or {}
    if isinstance(parametros_simulacao, str):
        try:
            parametros_simulacao = json.loads(parametros_simulacao)
        except Exception:
            parametros_simulacao = {}
    if not isinstance(parametros_simulacao, dict):
        parametros_simulacao = {}
    return {
        "id": str(linha.get("identificador_cliente") or ""),
        "nome_completo": linha.get("nome_completo"),
        "cpf": linha.get("cpf"),
        "email": linha.get("email"),
        "telefone": linha.get("telefone") or linha.get("celular"),
        "cidade": linha.get("cidade"),
        "renda_principal": linha.get("renda_principal"),
        "renda_total": linha.get("renda_total"),
        "status_documental": linha.get("status_documental"),
        "aprovado": bool(linha.get("aprovado", True)),
        "parametros_simulacao": parametros_simulacao,
        "identificador_usuario_cadastro": linha.get("identificador_usuario_cadastro"),
        "usuario_cadastro_nome": linha.get("usuario_cadastro_nome"),
        "usuario_cadastro_email": linha.get("usuario_cadastro_email"),
    }


def _serializar_imovel_card(item) -> dict:
    linha = dict(item or {})
    identificacao = montar_identificacao_imovel_simulador(linha)
    data_entrega = calcular_data_entrega_dinamica()
    meses_pre_entrega = calcular_meses_ate_entrega_dinamica()
    meses_pos_bruto = max(
        0,
        min(80, int(24 if linha.get("meses_pos_entrega") in (None, "") else linha.get("meses_pos_entrega"))),
    )
    meses_pos_limite = max(0, min(80 - max(meses_pre_entrega, 0), 80))
    valor_garantido = linha.get("valor_garantido") or calcular_valor_garantido_padrao(
        linha.get("valor"),
        linha.get("percentual_fechamento_minimo") or 0.70,
    )
    return {
        "id": str(linha.get("identificador_imovel") or ""),
        "titulo": identificacao["titulo"],
        "titulo_original": identificacao["titulo_original"],
        "descricao": linha.get("descricao"),
        "empreendimento": linha.get("empreendimento") or linha.get("titulo"),
        "tipologia": linha.get("tipo_imovel"),
        "tipo_imovel": linha.get("tipo_imovel"),
        "cidade": linha.get("cidade"),
        "bairro": linha.get("bairro"),
        "estado": linha.get("estado"),
        "endereco": linha.get("endereco"),
        "cep": linha.get("cep"),
        "valor": linha.get("valor"),
        "area_m2": linha.get("area_m2"),
        "status": linha.get("status"),
        "dormitorios": linha.get("quartos"),
        "quartos": linha.get("quartos"),
        "banheiros": linha.get("banheiros"),
        "vagas": linha.get("vagas_garagem"),
        "tipo_garagem": linha.get("tipo_garagem") or "carro",
        "data_entrega": data_entrega.isoformat(),
        "meses_pre_entrega": meses_pre_entrega,
        "meses_pos_entrega": min(meses_pos_bruto, meses_pos_limite),
        "percentual_conclusao_obra": linha.get("percentual_conclusao_obra") or 0,
        "percentual_fechamento_minimo": linha.get("percentual_fechamento_minimo") or 0.70,
        "valor_garantido": valor_garantido,
        "valor_parcela_minima_pre_obra": linha.get("valor_parcela_minima_pre_obra") or 0,
        "valor_desconto_minimo": linha.get("valor_desconto_minimo") or 0,
        "valor_incentivo_minimo": linha.get("valor_desconto_minimo") or 0,
        "valor_desconto_maximo": linha.get("valor_desconto_maximo") or 50000,
        "valor_incentivo_maximo": linha.get("valor_desconto_maximo") or 50000,
        "quantidade_desconto_reservas_vendas": linha.get("quantidade_desconto_reservas_vendas") or 0,
        "quantidade_incentivo_reservas_vendas": linha.get("quantidade_desconto_reservas_vendas") or 0,
        "foto_principal": linha.get("foto_principal"),
        "agrupamento": identificacao["agrupamento"],
        "detalhes_comerciais": identificacao["detalhes_comerciais"],
        "reserva_ativa": serializar_reserva(linha, prefixo="reserva_")
        if linha.get("reserva_identificador_reserva")
        else None,
    }


async def _buscar_cliente_visivel_simulador(conexao, identificador_cliente: str, identificador_usuario: str):
    pode_ver_todos = await usuario_pode_ver_todos_clientes(conexao, identificador_usuario)
    cliente = await buscar_cliente_para_simulador_por_id(
        conexao,
        ESQUEMA_COMERCIAL,
        identificador_cliente,
        identificador_usuario_visibilidade=identificador_usuario,
        pode_ver_todos=pode_ver_todos,
    )
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")
    return cliente


async def _obter_cliente_e_complementos(conexao, identificador_cliente: str, identificador_usuario: str):
    cliente = await _buscar_cliente_visivel_simulador(conexao, identificador_cliente, identificador_usuario)
    complementos = await listar_complementos_renda(conexao, ESQUEMA_COMERCIAL, identificador_cliente)
    return cliente, complementos


async def _garantir_cliente_visivel(conexao, identificador_cliente: str, identificador_usuario: str):
    return await _buscar_cliente_visivel_simulador(conexao, identificador_cliente, identificador_usuario)


async def _obter_imovel_detalhado(conexao, identificador_imovel: str) -> dict:
    imovel = await buscar_imovel_por_id(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    midias = await listar_midias_imovel(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
    return serializar_imovel(imovel, midias=midias, usar_prazo_entrega_dinamico=True)


def _montar_filtros_consulta(payload: dict) -> dict:
    filtros = payload.get("filtros") or {}
    incluir_indisponiveis = bool(payload.get("incluir_indisponiveis"))

    status_filtro = _normalizar_status(filtros.get("status"))
    if not incluir_indisponiveis and not status_filtro:
        status_filtro = "Disponivel"

    return {
        "empreendimento": _normalizar_like(filtros.get("empreendimento")),
        "cidade": _normalizar_like(filtros.get("cidade")),
        "bairro": _normalizar_like(filtros.get("bairro")),
        "tipologia": _normalizar_like(filtros.get("tipologia")),
        "dormitorios": filtros.get("dormitorios"),
        "faixa_preco_min": _ajustar_faixa_preco_por_valor_negociado(payload, filtros.get("faixa_preco_min")),
        "faixa_preco_max": _ajustar_faixa_preco_por_valor_negociado(payload, filtros.get("faixa_preco_max")),
        "area_min_m2": filtros.get("area_min_m2"),
        "area_max_m2": filtros.get("area_max_m2"),
        "status": status_filtro,
    }


@rotas_de_simulador.get("/connect-comercial/simulador/clientes-aprovados")
async def listar_clientes_aprovados(
    request: Request,
    q: str = Query("", description="Busca por nome, CPF, email ou cidade"),
    limite: int = Query(12, ge=1, le=80),
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            PERMISSAO_SIMULADOR_VIEW,
            "Você não tem permissão para listar clientes do simulador.",
        )

        pode_ver_todos = await usuario_pode_ver_todos_clientes(conexao, identificador_usuario)
        clientes = await listar_clientes_aprovados_para_simulador(
            conexao,
            ESQUEMA_COMERCIAL,
            busca=_normalizar_busca(q),
            limite=limite,
            identificador_usuario_visibilidade=identificador_usuario,
            pode_ver_todos=pode_ver_todos,
        )

    return {"items": [_serializar_cliente_simulador(item) for item in clientes]}


@rotas_de_simulador.get("/connect-comercial/simulador/clientes/{identificador_cliente}/contexto")
async def obter_contexto_cliente_simulador(
    identificador_cliente: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            PERMISSAO_SIMULADOR_VIEW,
            "Você não tem permissão para visualizar contexto do cliente.",
        )

        cliente, complementos = await _obter_cliente_e_complementos(conexao, identificador_cliente, identificador_usuario)
        reservas_ativas = await listar_reservas_ativas_cliente(conexao, ESQUEMA_COMERCIAL, identificador_cliente)

    consolidacao = consolidar_nucleo_familiar(cliente, complementos)

    return {
        "cliente": _serializar_cliente_simulador(cliente),
        "complementos": [serializar_complemento_renda(item) for item in complementos],
        "reservas_ativas": [serializar_reserva(item) for item in reservas_ativas],
        "consolidacao": consolidacao,
    }


@rotas_de_simulador.get("/connect-comercial/simulador/imoveis/{identificador_imovel}")
async def obter_imovel_simulador(
    identificador_imovel: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            PERMISSAO_SIMULADOR_VIEW,
            "Você não tem permissão para visualizar o imóvel no simulador.",
        )

        imovel = await _obter_imovel_detalhado(conexao, identificador_imovel)

    return {"item": imovel}


@rotas_de_simulador.post("/connect-comercial/simulador/sugerir-imoveis")
async def sugerir_imoveis(
    payload: RequisicaoSugerirImoveis,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    dados_payload = _model_dump_simulador(payload)

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            PERMISSAO_SIMULADOR_VIEW,
            "Você não tem permissão para usar o simulador comercial.",
        )

        cliente, complementos = await _obter_cliente_e_complementos(conexao, dados_payload["cliente_id"], identificador_usuario)
        reservas_ativas = await listar_reservas_ativas_cliente(conexao, ESQUEMA_COMERCIAL, dados_payload["cliente_id"])

        filtros = _montar_filtros_consulta(dados_payload)
        imoveis = await listar_imoveis_para_simulador(
            conexao,
            ESQUEMA_COMERCIAL,
            empreendimento=filtros["empreendimento"],
            cidade=filtros["cidade"],
            bairro=filtros["bairro"],
            tipologia=filtros["tipologia"],
            dormitorios=filtros["dormitorios"],
            faixa_preco_min=filtros["faixa_preco_min"],
            faixa_preco_max=filtros["faixa_preco_max"],
            area_min_m2=filtros["area_min_m2"],
            area_max_m2=filtros["area_max_m2"],
            status=filtros["status"],
            limite=max(20, dados_payload["limite_sugestoes"] * 4),
        )

    sugestao = await asyncio.to_thread(
        sugerir_imoveis_inteligentes,
        cliente,
        complementos,
        imoveis,
        dados_payload,
        limite=dados_payload["limite_sugestoes"],
    )

    return {
        "cliente": _serializar_cliente_simulador(cliente),
        "complementos": [serializar_complemento_renda(item) for item in complementos],
        "reservas_ativas": [serializar_reserva(item) for item in reservas_ativas],
        "consolidacao": consolidar_nucleo_familiar(cliente, complementos),
        "sugestao": sugestao,
    }


@rotas_de_simulador.post("/connect-comercial/simulador/calcular")
async def calcular(
    payload: RequisicaoCalcularSimulacao,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    dados_payload = _model_dump_simulador(payload)

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            PERMISSAO_SIMULADOR_VIEW,
            "Você não tem permissão para calcular simulacoes.",
        )

        cliente, complementos = await _obter_cliente_e_complementos(conexao, dados_payload["cliente_id"], identificador_usuario)
        imovel = await buscar_imovel_para_simulador_por_id(
            conexao,
            ESQUEMA_COMERCIAL,
            dados_payload["imovel_id"],
        )
        if not imovel:
            raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

        resultado = calcular_simulacao_comercial(cliente, complementos, imovel, dados_payload)
        async with conexao.transaction():
            reserva_bloqueio, status_imovel = await _bloquear_imovel_para_simulacao(
                conexao,
                dados_payload["imovel_id"],
                dados_payload["cliente_id"],
                identificador_usuario,
                observacoes=dados_payload.get("observacoes_comerciais"),
            )
        imovel_atualizado = await buscar_imovel_para_simulador_por_id(
            conexao,
            ESQUEMA_COMERCIAL,
            dados_payload["imovel_id"],
        )

    return {
        "resultado": resultado,
        "imovel": _serializar_imovel_card(imovel_atualizado or imovel),
        "reserva": serializar_reserva(reserva_bloqueio) if reserva_bloqueio else None,
        "status_imovel": status_imovel,
    }


@rotas_de_simulador.post("/connect-comercial/simulador/salvar", status_code=status.HTTP_201_CREATED)
async def salvar(
    payload: RequisicaoSalvarSimulacao,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    dados_payload = _model_dump_simulador(payload)

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            PERMISSAO_SIMULADOR_VIEW,
            "Você não tem permissão para salvar simulações.",
        )

        cliente, complementos = await _obter_cliente_e_complementos(conexao, dados_payload["cliente_id"], identificador_usuario)
        imovel = await buscar_imovel_para_simulador_por_id(
            conexao,
            ESQUEMA_COMERCIAL,
            dados_payload["imovel_id"],
        )
        if not imovel:
            raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

        calculo = calcular_simulacao_comercial(cliente, complementos, imovel, dados_payload)

        payload_persistencia = montar_payload_simulacao_persistencia(
            calculo,
            identificador_cliente=dados_payload["cliente_id"],
            identificador_imovel=dados_payload["imovel_id"],
            identificador_corretor=identificador_usuario,
            payload_snapshot_extra=dados_payload.get("payload_snapshot_extra") or {},
        )

        demonstrativo = calculo.get("demonstrativo") or []

        async with conexao.transaction():
            simulacao = await criar_simulacao(conexao, ESQUEMA_COMERCIAL, payload_persistencia)
            await inserir_parcelas_simulacao(
                conexao,
                ESQUEMA_COMERCIAL,
                simulacao["identificador_simulacao"],
                demonstrativo,
            )
            reserva_bloqueio, status_imovel = await _bloquear_imovel_para_simulacao(
                conexao,
                dados_payload["imovel_id"],
                dados_payload["cliente_id"],
                identificador_usuario,
                identificador_simulacao=simulacao["identificador_simulacao"],
                observacoes=dados_payload.get("observacoes_comerciais"),
            )

        parcelas = await listar_parcelas_simulacao(
            conexao,
            ESQUEMA_COMERCIAL,
            simulacao["identificador_simulacao"],
        )

    return {
        "mensagem": "Simulação salva com sucesso.",
        "item": serializar_simulacao(simulacao, parcelas=parcelas),
        "reserva": serializar_reserva(reserva_bloqueio) if reserva_bloqueio else None,
        "status_imovel": status_imovel,
    }


@rotas_de_simulador.post("/connect-comercial/simulador/autosalvar", status_code=status.HTTP_200_OK)
async def autosalvar(
    payload: RequisicaoSalvarSimulacao,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    dados_payload = _model_dump_simulador(payload)
    identificador_simulacao = dados_payload.get("simulacao_id")

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            PERMISSAO_SIMULADOR_VIEW,
            "Você não tem permissão para salvar simulações.",
        )

        cliente, complementos = await _obter_cliente_e_complementos(conexao, dados_payload["cliente_id"], identificador_usuario)
        imovel = await buscar_imovel_para_simulador_por_id(
            conexao,
            ESQUEMA_COMERCIAL,
            dados_payload["imovel_id"],
        )
        if not imovel:
            raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

        simulacao_existente = None
        if identificador_simulacao:
            simulacao_existente = await buscar_simulacao_por_id(conexao, ESQUEMA_COMERCIAL, identificador_simulacao)
            if simulacao_existente:
                if str(simulacao_existente.get("identificador_corretor") or "") != str(identificador_usuario):
                    raise HTTPException(status_code=403, detail="Esta simulação pertence a outro usuário.")
                if str(simulacao_existente.get("identificador_cliente") or "") != str(dados_payload["cliente_id"]):
                    identificador_simulacao = None
                    simulacao_existente = None
                elif str(simulacao_existente.get("identificador_imovel") or "") != str(dados_payload["imovel_id"]):
                    identificador_simulacao = None
                    simulacao_existente = None

        calculo = calcular_simulacao_comercial(cliente, complementos, imovel, dados_payload)
        payload_persistencia = montar_payload_simulacao_persistencia(
            calculo,
            identificador_cliente=dados_payload["cliente_id"],
            identificador_imovel=dados_payload["imovel_id"],
            identificador_corretor=identificador_usuario,
            payload_snapshot_extra=dados_payload.get("payload_snapshot_extra") or {},
        )
        demonstrativo = calculo.get("demonstrativo") or []

        async with conexao.transaction():
            if simulacao_existente and identificador_simulacao:
                simulacao = await atualizar_simulacao(
                    conexao,
                    ESQUEMA_COMERCIAL,
                    identificador_simulacao,
                    payload_persistencia,
                )
                await substituir_parcelas_simulacao(
                    conexao,
                    ESQUEMA_COMERCIAL,
                    identificador_simulacao,
                    demonstrativo,
                )
            else:
                simulacao = await criar_simulacao(conexao, ESQUEMA_COMERCIAL, payload_persistencia)
                await inserir_parcelas_simulacao(
                    conexao,
                    ESQUEMA_COMERCIAL,
                    simulacao["identificador_simulacao"],
                    demonstrativo,
                )

        parcelas = await listar_parcelas_simulacao(
            conexao,
            ESQUEMA_COMERCIAL,
            simulacao["identificador_simulacao"],
        )

    return {
        "mensagem": "Simulação salva automaticamente.",
        "item": serializar_simulacao(simulacao, parcelas=parcelas),
    }


@rotas_de_simulador.get("/connect-comercial/simulador/{identificador_simulacao:uuid}")
async def obter_simulacao(
    identificador_simulacao: UUID,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    identificador_simulacao_str = str(identificador_simulacao)

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            PERMISSAO_SIMULADOR_VIEW,
            "Você não tem permissão para visualizar simulacoes.",
        )

        simulacao = await buscar_simulacao_por_id(conexao, ESQUEMA_COMERCIAL, identificador_simulacao_str)
        if not simulacao:
            raise HTTPException(status_code=404, detail="Simulação não encontrada.")

        await _garantir_cliente_visivel(conexao, simulacao["identificador_cliente"], identificador_usuario)
        parcelas = await listar_parcelas_simulacao(conexao, ESQUEMA_COMERCIAL, identificador_simulacao_str)

    return {"item": serializar_simulacao(simulacao, parcelas=parcelas)}


@rotas_de_simulador.get("/connect-comercial/clientes/{identificador_cliente}/simulacoes")
async def listar_simulacoes_do_cliente(
    identificador_cliente: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            PERMISSAO_SIMULADOR_VIEW,
            "Você não tem permissão para visualizar simulacoes.",
        )

        await _garantir_cliente_visivel(conexao, identificador_cliente, identificador_usuario)

        simulacoes = await listar_simulacoes_cliente(conexao, ESQUEMA_COMERCIAL, identificador_cliente, limite=40)

    return {"items": [serializar_simulacao(item) for item in simulacoes]}


@rotas_de_simulador.get("/connect-comercial/clientes/{identificador_cliente}/complementos-renda")
async def listar_complementos(
    identificador_cliente: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            PERMISSAO_SIMULADOR_VIEW,
            "Você não tem permissão para visualizar complemento de renda.",
        )

        await _garantir_cliente_visivel(conexao, identificador_cliente, identificador_usuario)

        complementos = await listar_complementos_renda(conexao, ESQUEMA_COMERCIAL, identificador_cliente)

    return {"items": [serializar_complemento_renda(item) for item in complementos]}


@rotas_de_simulador.post("/connect-comercial/clientes/{identificador_cliente}/complementos-renda", status_code=status.HTTP_201_CREATED)
async def criar_complemento(
    identificador_cliente: str,
    payload: RequisicaoCriarComplementoRenda,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    try:
        dados_payload = normalizar_payload_complemento(payload.model_dump())
    except ValueError as erro:
        raise HTTPException(status_code=400, detail=str(erro)) from erro

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "imoveis.edit",
            "Você não tem permissão para gerenciar complemento de renda.",
        )

        await _garantir_cliente_visivel(conexao, identificador_cliente, identificador_usuario)

        dados_payload["identificador_cliente"] = identificador_cliente

        async with conexao.transaction():
            complemento = await criar_complemento_renda(conexao, ESQUEMA_COMERCIAL, dados_payload)

    return {
        "mensagem": "Complemento de renda adicionado com sucesso.",
        "item": serializar_complemento_renda(complemento),
    }


@rotas_de_simulador.put("/connect-comercial/clientes/{identificador_cliente}/complementos-renda/{identificador_complemento}")
async def atualizar_complemento(
    identificador_cliente: str,
    identificador_complemento: str,
    payload: RequisicaoAtualizarComplementoRenda,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    try:
        dados_payload = normalizar_payload_complemento(payload.model_dump())
    except ValueError as erro:
        raise HTTPException(status_code=400, detail=str(erro)) from erro

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "imoveis.edit",
            "Você não tem permissão para gerenciar complemento de renda.",
        )

        await _garantir_cliente_visivel(conexao, identificador_cliente, identificador_usuario)
        existente = await buscar_complemento_renda_por_id(
            conexao,
            ESQUEMA_COMERCIAL,
            identificador_cliente,
            identificador_complemento,
        )
        if not existente:
            raise HTTPException(status_code=404, detail="Complemento de renda não encontrado.")

        async with conexao.transaction():
            complemento = await atualizar_complemento_renda(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_cliente,
                identificador_complemento,
                dados_payload,
            )

    return {
        "mensagem": "Complemento de renda atualizado com sucesso.",
        "item": serializar_complemento_renda(complemento),
    }


@rotas_de_simulador.delete("/connect-comercial/clientes/{identificador_cliente}/complementos-renda/{identificador_complemento}")
async def excluir_complemento(
    identificador_cliente: str,
    identificador_complemento: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "imoveis.edit",
            "Você não tem permissão para gerenciar complemento de renda.",
        )

        await _garantir_cliente_visivel(conexao, identificador_cliente, identificador_usuario)
        async with conexao.transaction():
            removido = await excluir_complemento_renda(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_cliente,
                identificador_complemento,
            )

        if not removido:
            raise HTTPException(status_code=404, detail="Complemento de renda não encontrado.")

    return {"mensagem": "Complemento de renda removido com sucesso.", "id": identificador_complemento}


STATUS_IMOVEL_PENDENTE_APROVACAO = "Pendente de aprovação"


def _status_operacional_normalizado(status_atual: str) -> str:
    return str(status_atual or "").strip().lower()


def _reserva_pertence_ao_cliente(reserva, identificador_cliente: str | None) -> bool:
    if not reserva:
        return False
    cliente_reserva = str(reserva.get("identificador_cliente") or "")
    cliente_operacao = str(identificador_cliente or "")
    return bool(cliente_reserva and cliente_operacao and cliente_reserva == cliente_operacao)


async def _bloquear_imovel_para_simulacao(
    conexao,
    identificador_imovel: str,
    identificador_cliente: str,
    identificador_usuario: str,
    *,
    identificador_simulacao: str | None = None,
    expiracao_em=None,
    observacoes: str | None = None,
):
    imovel = await obter_imovel_para_operacao_lock(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
    if not imovel:
        raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

    status_atual = _status_operacional_normalizado(imovel.get("status"))
    reserva_ativa = await buscar_reserva_ativa_por_imovel_lock(conexao, ESQUEMA_COMERCIAL, identificador_imovel)

    if reserva_ativa:
        if not _reserva_pertence_ao_cliente(reserva_ativa, identificador_cliente):
            raise HTTPException(status_code=409, detail="Este imóvel já está bloqueado para outro atendimento.")

        status_reserva = str(reserva_ativa.get("status") or "").upper()
        if status_reserva == "PENDENTE_APROVACAO":
            return reserva_ativa, STATUS_IMOVEL_PENDENTE_APROVACAO

        reserva = reserva_ativa
        simulacao_atual = str(reserva_ativa.get("identificador_simulacao") or "")
        if identificador_simulacao and simulacao_atual != str(identificador_simulacao):
            reserva = await atualizar_reserva_operacao(
                conexao,
                ESQUEMA_COMERCIAL,
                reserva_ativa["identificador_reserva"],
                identificador_simulacao=identificador_simulacao,
                observacoes=observacoes,
            )

        if status_atual != "reservado":
            await atualizar_status_imovel(conexao, ESQUEMA_COMERCIAL, identificador_imovel, "Reservado")
            await inserir_historico_status_imovel(
                conexao,
                ESQUEMA_COMERCIAL,
                {
                    "identificador_imovel": identificador_imovel,
                    "status_anterior": imovel.get("status"),
                    "status_novo": "Reservado",
                    "identificador_simulacao": identificador_simulacao or reserva.get("identificador_simulacao"),
                    "identificador_cliente": identificador_cliente,
                    "alterado_por": identificador_usuario,
                    "observacoes": observacoes or "Bloqueio automático ao simular imóvel.",
                },
            )

        return reserva, "Reservado"

    if status_atual != "disponivel":
        raise HTTPException(status_code=409, detail="Este imóvel não está disponível para simulação.")

    reserva = await criar_imovel_reserva(
        conexao,
        ESQUEMA_COMERCIAL,
        {
            "identificador_imovel": identificador_imovel,
            "identificador_cliente": identificador_cliente,
            "identificador_simulacao": identificador_simulacao,
            "status": "ATIVA",
            "reservado_por": identificador_usuario,
            "reservado_em": datetime.now(timezone.utc),
            "expiracao_em": expiracao_em,
            "observacoes": observacoes or "Bloqueio automático ao simular imóvel.",
        },
    )

    await atualizar_status_imovel(conexao, ESQUEMA_COMERCIAL, identificador_imovel, "Reservado")
    await inserir_historico_status_imovel(
        conexao,
        ESQUEMA_COMERCIAL,
        {
            "identificador_imovel": identificador_imovel,
            "status_anterior": imovel.get("status"),
            "status_novo": "Reservado",
            "identificador_simulacao": identificador_simulacao,
            "identificador_cliente": identificador_cliente,
            "alterado_por": identificador_usuario,
            "observacoes": observacoes or "Bloqueio automático ao simular imóvel.",
        },
    )

    return reserva, "Reservado"


async def _carregar_simulacao_operacao(
    conexao,
    identificador_simulacao: str,
    identificador_imovel: str,
):
    simulacao = await buscar_simulacao_por_id(conexao, ESQUEMA_COMERCIAL, identificador_simulacao)
    if not simulacao:
        raise HTTPException(status_code=404, detail="Simulação não encontrada para esta operação.")

    if str(simulacao["identificador_imovel"]) != str(identificador_imovel):
        raise HTTPException(status_code=400, detail="A simulacao informada não pertence ao imóvel selecionado.")

    return simulacao, serializar_simulacao(simulacao)


async def _obter_simulacao_acao(
    conexao,
    identificador_simulacao: str,
    identificador_imovel: str,
    acao: str,
    *,
    identificador_cliente: str | None = None,
):
    simulacao, simulacao_serializada = await _carregar_simulacao_operacao(
        conexao,
        identificador_simulacao,
        identificador_imovel,
    )
    valido, erros = validar_operacao_final(simulacao_serializada, acao)
    if not valido:
        aprovacao = None
        identificador_cliente_busca = identificador_cliente or str(simulacao.get("identificador_cliente") or "")
        if acao == "vender" and identificador_cliente_busca:
            aprovacao = await buscar_aprovacao_excecao_aprovada(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_imovel=identificador_imovel,
                identificador_cliente=identificador_cliente_busca,
                identificador_simulacao=identificador_simulacao,
            )
        if not aprovacao:
            raise HTTPException(status_code=409, detail={"mensagem": "Operação bloqueada pela validação comercial.", "erros": erros})
        return simulacao, aprovacao

    return simulacao, None


def _montar_motivo_aprovacao_excecao(analise: dict) -> str:
    gatilhos = analise.get("gatilhos_pendentes") or []
    if not gatilhos:
        return "Operação submetida para validação gerencial."
    if "composicao_familiar" in gatilhos and len(gatilhos) == 1:
        return "Operação com composição familiar exige validação cadastral e aprovação do gestor."

    rotulos = {
        "garantido": "garantido",
        "garantido_pre_obra": "garantido pré-obra",
        "validacao_comercial": "validação comercial",
        "desconto_comercial": "incentivo 7LM",
        "valor_negociado": "valor negociado",
        "composicao_familiar": "composição familiar",
        "sobrepreco_zerado": "sobrepreço zerado",
    }
    texto_gatilhos = ", ".join(rotulos.get(item, str(item)) for item in gatilhos)
    return f"Operação próxima dos gatilhos comerciais: {texto_gatilhos}."


@rotas_de_simulador.post("/connect-comercial/imoveis/{identificador_imovel}/reservar")
async def reservar_imovel(
    identificador_imovel: str,
    payload: RequisicaoOperacaoImovel,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    dados_payload = payload.model_dump()

    if not dados_payload.get("simulacao_id"):
        raise HTTPException(status_code=400, detail="Informe a simulacao para reservar o imóvel.")

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "imoveis.edit",
            "Você não tem permissão para reservar imóveis.",
        )

        async with conexao.transaction():
            simulacao, _ = await _obter_simulacao_acao(
                conexao,
                dados_payload["simulacao_id"],
                identificador_imovel,
                "reservar",
            )
            await _garantir_cliente_visivel(conexao, simulacao["identificador_cliente"], identificador_usuario)
            identificador_cliente_operacao = dados_payload.get("cliente_id") or simulacao.get("identificador_cliente")
            if str(identificador_cliente_operacao) != str(simulacao.get("identificador_cliente")):
                raise HTTPException(status_code=400, detail="O cliente informado não pertence a simulacao selecionada.")

            reserva, status_imovel = await _bloquear_imovel_para_simulacao(
                conexao,
                identificador_imovel,
                identificador_cliente_operacao,
                identificador_usuario,
                identificador_simulacao=dados_payload.get("simulacao_id"),
                expiracao_em=dados_payload.get("expiracao_em"),
                observacoes=dados_payload.get("observacoes"),
            )

    return {
        "mensagem": "Imóvel reservado com sucesso.",
        "reserva": serializar_reserva(reserva),
        "status_imovel": status_imovel,
    }


@rotas_de_simulador.post("/connect-comercial/imoveis/{identificador_imovel}/submeter-aprovacao")
async def submeter_aprovacao_excecao(
    identificador_imovel: str,
    payload: RequisicaoOperacaoImovel,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    dados_payload = payload.model_dump()

    if not dados_payload.get("simulacao_id"):
        raise HTTPException(status_code=400, detail="Informe a simulacao antes de submeter para aprovação.")

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            PERMISSAO_SIMULADOR_VIEW,
            "Você não tem permissão para submeter solicitações de aprovação.",
        )

        async with conexao.transaction():
            simulacao, simulacao_serializada = await _carregar_simulacao_operacao(
                conexao,
                dados_payload["simulacao_id"],
                identificador_imovel,
            )
            await _garantir_cliente_visivel(conexao, simulacao["identificador_cliente"], identificador_usuario)

            identificador_cliente_operacao = dados_payload.get("cliente_id") or simulacao.get("identificador_cliente")
            if str(identificador_cliente_operacao) != str(simulacao.get("identificador_cliente")):
                raise HTTPException(status_code=400, detail="O cliente informado não pertence a simulacao selecionada.")

            analise_aprovacao = analisar_aprovacao_excecao(simulacao_serializada)
            if not analise_aprovacao.get("necessaria"):
                raise HTTPException(
                    status_code=409,
                    detail={
                        "mensagem": "Esta operação já atende os gatilhos comerciais. Reserve normalmente a unidade.",
                        "aprovacao_excecao": analise_aprovacao,
                    },
                )
            if not analise_aprovacao.get("permitida"):
                raise HTTPException(
                    status_code=409,
                    detail={
                        "mensagem": "A operação ainda não pode seguir para aprovação gerencial.",
                        "aprovacao_excecao": analise_aprovacao,
                    },
                )

            imovel = await obter_imovel_para_operacao_lock(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
            if not imovel:
                raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

            status_atual = _status_operacional_normalizado(imovel.get("status"))
            reserva_ativa = await buscar_reserva_ativa_por_imovel_lock(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
            if reserva_ativa:
                if not _reserva_pertence_ao_cliente(reserva_ativa, identificador_cliente_operacao):
                    raise HTTPException(status_code=409, detail="Já existe uma reserva ou solicitação ativa para outro cliente.")
                if str(reserva_ativa.get("status") or "").upper() == "PENDENTE_APROVACAO":
                    raise HTTPException(status_code=409, detail="Já existe solicitação ativa para este imóvel.")
                reserva = await atualizar_reserva_operacao(
                    conexao,
                    ESQUEMA_COMERCIAL,
                    reserva_ativa["identificador_reserva"],
                    novo_status="PENDENTE_APROVACAO",
                    identificador_simulacao=dados_payload.get("simulacao_id"),
                    observacoes=dados_payload.get("observacoes"),
                )
            else:
                if status_atual != "disponivel":
                    raise HTTPException(
                        status_code=409,
                        detail="Somente imoveis disponíveis podem ser submetidos para aprovação gerencial.",
                    )
                reserva = await criar_imovel_reserva(
                    conexao,
                    ESQUEMA_COMERCIAL,
                    {
                        "identificador_imovel": identificador_imovel,
                        "identificador_cliente": identificador_cliente_operacao,
                        "identificador_simulacao": dados_payload.get("simulacao_id"),
                        "status": "PENDENTE_APROVACAO",
                        "reservado_por": identificador_usuario,
                        "reservado_em": datetime.now(timezone.utc),
                        "expiracao_em": None,
                        "observacoes": dados_payload.get("observacoes"),
                    },
                )

            await atualizar_status_imovel(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_imovel,
                STATUS_IMOVEL_PENDENTE_APROVACAO,
            )
            await inserir_historico_status_imovel(
                conexao,
                ESQUEMA_COMERCIAL,
                {
                    "identificador_imovel": identificador_imovel,
                    "status_anterior": imovel.get("status"),
                    "status_novo": STATUS_IMOVEL_PENDENTE_APROVACAO,
                    "identificador_simulacao": dados_payload.get("simulacao_id"),
                    "identificador_cliente": identificador_cliente_operacao,
                    "alterado_por": identificador_usuario,
                    "observacoes": dados_payload.get("observacoes") or _montar_motivo_aprovacao_excecao(analise_aprovacao),
                },
            )

            aprovacao_criada = await criar_aprovacao_excecao(
                conexao,
                ESQUEMA_COMERCIAL,
                {
                    "identificador_imovel": identificador_imovel,
                    "identificador_cliente": identificador_cliente_operacao,
                    "identificador_simulacao": dados_payload.get("simulacao_id"),
                    "identificador_reserva": reserva["identificador_reserva"],
                    "status": "PENDENTE",
                    "motivo": _montar_motivo_aprovacao_excecao(analise_aprovacao),
                    "observacoes_solicitacao": dados_payload.get("observacoes"),
                    "solicitado_por": identificador_usuario,
                    "solicitado_em": datetime.now(timezone.utc),
                    "payload_snapshot": {
                        "simulacao": simulacao_serializada,
                        "aprovacao_excecao": analise_aprovacao,
                    },
                    "valor_garantido_planejado": analise_aprovacao.get("valor_garantido_planejado"),
                    "valor_garantido_real": analise_aprovacao.get("valor_garantido_real"),
                    "valor_garantido_pre_obra_planejado": analise_aprovacao.get("valor_garantido_pre_obra_planejado"),
                    "valor_garantido_pre_obra_real": analise_aprovacao.get("valor_garantido_pre_obra_real"),
                    "gap_garantia": analise_aprovacao.get("gap_garantia"),
                    "gap_pre_obra": analise_aprovacao.get("gap_pre_obra"),
                    "percentual_gap_garantia": analise_aprovacao.get("percentual_gap_garantia"),
                    "percentual_gap_pre_obra": analise_aprovacao.get("percentual_gap_pre_obra"),
                },
            )
            aprovacao = await buscar_aprovacao_excecao_por_id(
                conexao,
                ESQUEMA_COMERCIAL,
                aprovacao_criada["identificador_aprovacao"],
            )

    return {
        "mensagem": "Solicitação enviada para aprovação do gestor com sucesso.",
        "reserva": serializar_reserva(reserva),
        "status_imovel": STATUS_IMOVEL_PENDENTE_APROVACAO,
        "aprovacao_excecao": serializar_aprovacao_excecao(aprovacao),
    }


@rotas_de_simulador.post("/connect-comercial/imoveis/{identificador_imovel}/vender")
async def vender_imovel(
    identificador_imovel: str,
    payload: RequisicaoOperacaoImovel,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    dados_payload = payload.model_dump()

    if not dados_payload.get("simulacao_id"):
        raise HTTPException(status_code=400, detail="Informe a simulacao para vender o imóvel.")

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "imoveis.edit",
            "Você não tem permissão para vender imóveis.",
        )

        async with conexao.transaction():
            identificador_cliente_operacao = dados_payload.get("cliente_id")
            simulacao, aprovacao_excecao_aprovada = await _obter_simulacao_acao(
                conexao,
                dados_payload["simulacao_id"],
                identificador_imovel,
                "vender",
                identificador_cliente=identificador_cliente_operacao,
            )
            await _garantir_cliente_visivel(conexao, simulacao["identificador_cliente"], identificador_usuario)
            identificador_cliente_operacao = identificador_cliente_operacao or simulacao.get("identificador_cliente")
            if str(identificador_cliente_operacao) != str(simulacao.get("identificador_cliente")):
                raise HTTPException(status_code=400, detail="O cliente informado não pertence a simulacao selecionada.")

            simulacao_serializada = serializar_simulacao(simulacao)
            analise_aprovacao = analisar_aprovacao_excecao(simulacao_serializada)
            if analise_aprovacao.get("necessaria") and not aprovacao_excecao_aprovada:
                aprovacao_excecao_aprovada = await buscar_aprovacao_excecao_aprovada(
                    conexao,
                    ESQUEMA_COMERCIAL,
                    identificador_imovel=identificador_imovel,
                    identificador_cliente=identificador_cliente_operacao,
                    identificador_simulacao=dados_payload["simulacao_id"],
                )
            if analise_aprovacao.get("necessaria") and not aprovacao_excecao_aprovada:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "mensagem": "Esta operação precisa da aprovação do gestor antes da venda.",
                        "aprovacao_excecao": analise_aprovacao,
                    },
                )

            imovel = await obter_imovel_para_operacao_lock(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
            if not imovel:
                raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

            status_atual = _status_operacional_normalizado(imovel.get("status"))
            if status_atual in ("vendido", "inativo"):
                raise HTTPException(status_code=409, detail="Imovel indisponivel para venda.")
            if status_atual == _status_operacional_normalizado(STATUS_IMOVEL_PENDENTE_APROVACAO):
                raise HTTPException(status_code=409, detail="Esta unidade ainda depende da aprovação do gestor antes da venda.")

            reserva_ativa = await buscar_reserva_ativa_por_imovel_lock(conexao, ESQUEMA_COMERCIAL, identificador_imovel)

            if status_atual == "reservado" and not reserva_ativa:
                raise HTTPException(status_code=409, detail="Imóvel reservado sem registro ativo de reserva. Corrija antes da venda.")

            identificador_cliente = identificador_cliente_operacao

            if reserva_ativa:
                cliente_reserva = str(reserva_ativa.get("identificador_cliente") or "")
                if cliente_reserva and str(cliente_reserva) != str(identificador_cliente):
                    raise HTTPException(status_code=409, detail="Existe reserva ativa para outro cliente.")
                if str(reserva_ativa.get("status") or "").upper() == "PENDENTE_APROVACAO":
                    raise HTTPException(status_code=409, detail="A solicitação ainda está aguardando decisão do gestor.")

                reserva = await atualizar_reserva_operacao(
                    conexao,
                    ESQUEMA_COMERCIAL,
                    reserva_ativa["identificador_reserva"],
                    novo_status="CONVERTIDA",
                    identificador_simulacao=dados_payload.get("simulacao_id"),
                    observacoes=dados_payload.get("observacoes"),
                )
            else:
                reserva = await criar_imovel_reserva(
                    conexao,
                    ESQUEMA_COMERCIAL,
                    {
                        "identificador_imovel": identificador_imovel,
                        "identificador_cliente": identificador_cliente,
                        "identificador_simulacao": dados_payload.get("simulacao_id"),
                        "status": "CONVERTIDA",
                        "reservado_por": identificador_usuario,
                        "reservado_em": datetime.now(timezone.utc),
                        "expiracao_em": None,
                        "observacoes": dados_payload.get("observacoes"),
                    },
                )

            await atualizar_status_imovel(conexao, ESQUEMA_COMERCIAL, identificador_imovel, "Vendido")
            await inserir_historico_status_imovel(
                conexao,
                ESQUEMA_COMERCIAL,
                {
                    "identificador_imovel": identificador_imovel,
                    "status_anterior": imovel.get("status"),
                    "status_novo": "Vendido",
                    "identificador_simulacao": dados_payload.get("simulacao_id"),
                    "identificador_cliente": identificador_cliente,
                    "alterado_por": identificador_usuario,
                    "observacoes": dados_payload.get("observacoes"),
                },
            )

    return {
        "mensagem": (
            "Imovel vendido com sucesso via aprovação gerencial."
            if aprovacao_excecao_aprovada
            else "Imovel vendido com sucesso."
        ),
        "reserva": serializar_reserva(reserva),
        "status_imovel": "Vendido",
        "aprovacao_excecao": serializar_aprovacao_excecao(aprovacao_excecao_aprovada) if aprovacao_excecao_aprovada else None,
    }


@rotas_de_simulador.post("/connect-comercial/imoveis/{identificador_imovel}/liberar-reserva")
async def liberar_reserva(
    identificador_imovel: str,
    payload: RequisicaoOperacaoImovel,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    dados_payload = payload.model_dump()

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "imoveis.edit",
            "Você não tem permissão para liberar reservas.",
        )

        async with conexao.transaction():
            imovel = await obter_imovel_para_operacao_lock(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
            if not imovel:
                raise HTTPException(status_code=404, detail="Imóvel não encontrado.")

            status_atual = _status_operacional_normalizado(imovel.get("status"))
            reserva_ativa = await buscar_reserva_ativa_por_imovel_lock(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
            if not reserva_ativa:
                if status_atual not in ("reservado", _status_operacional_normalizado(STATUS_IMOVEL_PENDENTE_APROVACAO)):
                    raise HTTPException(status_code=409, detail="Somente imoveis reservados ou pendentes de aprovação podem ser liberados.")
                raise HTTPException(status_code=409, detail="Não existe reserva ativa para este imóvel.")
            if status_atual in ("vendido", "inativo"):
                raise HTTPException(status_code=409, detail="Somente imoveis reservados ou pendentes de aprovação podem ser liberados.")

            await _garantir_cliente_visivel(conexao, reserva_ativa["identificador_cliente"], identificador_usuario)
            aprovacao_pendente = None
            if str(reserva_ativa.get("status") or "").upper() == "PENDENTE_APROVACAO":
                aprovacao_pendente = await buscar_aprovacao_excecao_pendente_por_reserva_lock(
                    conexao,
                    ESQUEMA_COMERCIAL,
                    reserva_ativa["identificador_reserva"],
                )

            reserva = await atualizar_reserva_status(
                conexao,
                ESQUEMA_COMERCIAL,
                reserva_ativa["identificador_reserva"],
                "LIBERADA",
                dados_payload.get("observacoes"),
            )

            if aprovacao_pendente:
                await atualizar_aprovacao_excecao_status(
                    conexao,
                    ESQUEMA_COMERCIAL,
                    aprovacao_pendente["identificador_aprovacao"],
                    novo_status="CANCELADA",
                    avaliado_por=identificador_usuario,
                    avaliado_em=datetime.now(timezone.utc),
                    observacoes_avaliacao=dados_payload.get("observacoes"),
                )

            await atualizar_status_imovel(conexao, ESQUEMA_COMERCIAL, identificador_imovel, "Disponivel")
            await inserir_historico_status_imovel(
                conexao,
                ESQUEMA_COMERCIAL,
                {
                    "identificador_imovel": identificador_imovel,
                    "status_anterior": imovel.get("status"),
                    "status_novo": "Disponivel",
                    "identificador_simulacao": reserva_ativa.get("identificador_simulacao"),
                    "identificador_cliente": reserva_ativa.get("identificador_cliente"),
                    "alterado_por": identificador_usuario,
                    "observacoes": dados_payload.get("observacoes"),
                },
            )

    return {
        "mensagem": (
            "Solicitação de aprovação cancelada com sucesso."
            if aprovacao_pendente
            else "Reserva liberada com sucesso."
        ),
        "reserva": serializar_reserva(reserva),
        "status_imovel": "Disponivel",
    }
