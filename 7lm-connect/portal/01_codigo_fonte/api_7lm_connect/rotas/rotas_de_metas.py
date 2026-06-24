"""
Rotas do modulo de Metas e Resultados.
"""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status

from configuracoes import ESQUEMA_COMERCIAL
from dependencias import obter_usuario_autenticado
from modelos.metas import (
    RequisicaoAtualizarIndicadorMeta,
    RequisicaoImportacaoMetas,
    RequisicaoIndicadorMeta,
    RequisicaoMetaColaborador,
    RequisicaoMetaGerencial,
    RequisicaoResultadoMeta,
)
from repositorios.metas import (
    atualizar_indicador,
    atualizar_resultado,
    buscar_indicador_por_id,
    buscar_meta_colaborador_por_id,
    buscar_meta_colaborador_ativa,
    buscar_meta_gerencial_por_id,
    buscar_meta_gerencial_ativa,
    buscar_resultado_por_id,
    buscar_usuario_meta,
    calcular_meta_automatica_gestor,
    criar_indicador,
    inativar_meta_colaborador,
    inativar_meta_gerencial,
    inserir_meta_colaborador,
    inserir_meta_gerencial,
    inserir_resultado,
    listar_historico_geral,
    listar_historico_meta,
    listar_indicadores,
    listar_metas_colaboradores,
    listar_metas_gerenciais,
    listar_referencias,
    listar_resultados,
    listar_subordinados_gestor,
    listar_usuarios_meta,
    maior_versao_meta_colaborador,
    maior_versao_meta_gerencial,
    registrar_historico,
)
from servicos.metas import (
    calcular_atingimento,
    calcular_faltante,
    calcular_limite_alteracao,
    calcular_meta_potencial_colaborador,
    classificar_status_meta,
    detectar_escopo_visualizacao_metas,
    enriquecer_calculo_meta,
    exigir_prazo_alteracao,
    extrair_linhas_planilha,
    filtrar_referencias_por_escopo,
    normalizar_codigo,
    normalizar_origem_meta,
    normalizar_origem_resultado,
    normalizar_regra_meta,
    normalizar_data_importacao,
    normalizar_tipo_meta_gerencial,
    normalizar_tipo_usuario,
    preparar_nova_versao_meta,
    resolver_meta_oficial_gestor,
    serializar_decimal,
    usuario_no_escopo_visualizacao,
    usuario_pode_gerenciar_subordinado,
    validar_linha_importacao_colaborador,
    validar_linha_importacao_gerencial,
    validar_vigencia,
)
from utilitarios.autorizacao import exigir_permissao_portal, usuario_possui_permissao


rotas_de_metas = APIRouter()


def _obter_pool(request: Request):
    pool = getattr(request.app.state, "pool", None)
    if not pool:
        raise HTTPException(status_code=503, detail="Pool indisponível.")
    return pool


def _payload(modelo) -> dict[str, Any]:
    if hasattr(modelo, "model_dump"):
        return modelo.model_dump(exclude_unset=True)
    return modelo.dict(exclude_unset=True)


def _serializar(valor: Any):
    if isinstance(valor, Decimal):
        return float(valor)
    if isinstance(valor, (date, datetime)):
        return valor.isoformat()
    if isinstance(valor, list):
        return [_serializar(item) for item in valor]
    if isinstance(valor, dict):
        return {chave: _serializar(item) for chave, item in valor.items()}
    return valor


def _filtros_comuns(
    mes: int | None = None,
    ano: int | None = None,
    equipe: str | None = None,
    gestor: str | None = None,
    corretor: str | None = None,
    indicador: str | None = None,
    regional: str | None = None,
    empreendimento: str | None = None,
    tipo_meta: str | None = None,
    origem_meta: str | None = None,
    origem_resultado: str | None = None,
    pessoa: str | None = None,
) -> dict[str, Any]:
    return {
        "mes": mes,
        "ano": ano,
        "equipe": equipe,
        "gestor": gestor,
        "corretor": corretor,
        "indicador": indicador,
        "regional": regional,
        "empreendimento": empreendimento,
        "tipo_meta": normalizar_codigo(tipo_meta) if tipo_meta else None,
        "origem_meta": normalizar_codigo(origem_meta) if origem_meta else None,
        "origem_resultado": normalizar_codigo(origem_resultado) if origem_resultado else None,
        "pessoa": pessoa,
    }


def _meses_anteriores(mes: int, ano: int, quantidade: int = 3) -> list[tuple[int, int]]:
    indice_mes = int(ano) * 12 + int(mes) - 1
    return [
        ((indice_mes - deslocamento) % 12 + 1, (indice_mes - deslocamento) // 12)
        for deslocamento in range(int(quantidade), 0, -1)
    ]


async def _listar_nomes_perfis_usuario(conexao, identificador_usuario: str) -> list[str]:
    linhas = await conexao.fetch(
        """
        select p.nome_perfil
        from sevenlm_connect.usuario_perfil up
        join sevenlm_connect.perfil p
          on p.identificador_perfil = up.identificador_perfil
        where up.identificador_usuario = $1::uuid
        order by p.nome_perfil
        """,
        identificador_usuario,
    )
    return [str(linha["nome_perfil"]) for linha in linhas if linha.get("nome_perfil")]


async def _contexto_permissoes(conexao, identificador_usuario: str) -> dict[str, Any]:
    admin = await usuario_possui_permissao(conexao, identificador_usuario, "metas.resultados.admin")
    manage = await usuario_possui_permissao(conexao, identificador_usuario, "metas.resultados.manage")
    gerenciais = await usuario_possui_permissao(conexao, identificador_usuario, "metas.resultados.gerenciais.manage")
    resultados = await usuario_possui_permissao(conexao, identificador_usuario, "metas.resultados.resultados.manage")
    importar = await usuario_possui_permissao(conexao, identificador_usuario, "metas.resultados.import")
    perfis = await _listar_nomes_perfis_usuario(conexao, identificador_usuario)
    escopo = detectar_escopo_visualizacao_metas(
        perfis=perfis,
        usuario_admin=bool(admin),
        usuario_manage=bool(manage or admin),
        usuario_gerenciais=bool(gerenciais or admin),
        usuario_resultados=bool(resultados or admin),
    )
    subordinados = await listar_subordinados_gestor(conexao, ESQUEMA_COMERCIAL, identificador_usuario) if escopo == "GESTOR" else []
    return {
        "admin": bool(admin),
        "manage": bool(manage or admin),
        "gerenciais": bool(gerenciais or admin),
        "resultados": bool(resultados or admin),
        "importar": bool(importar or admin),
        "perfis": perfis,
        "escopo": escopo,
        "subordinados": subordinados,
    }


async def _exigir_gerencia_colaborador(
    conexao,
    identificador_usuario: str,
    identificador_alvo: str,
    permissoes: dict[str, bool],
) -> None:
    if permissoes.get("admin"):
        return
    subordinados = await listar_subordinados_gestor(conexao, ESQUEMA_COMERCIAL, identificador_usuario)
    if usuario_pode_gerenciar_subordinado(
        usuario_admin=False,
        identificador_usuario=identificador_usuario,
        identificador_alvo=identificador_alvo,
        subordinados=set(subordinados),
    ):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Você só pode alterar metas de colaboradores vinculados à sua equipe.",
    )


def _erro_escopo_visualizacao() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="VocÃª sÃ³ pode visualizar dados do seu escopo comercial.",
    )


def _permitidos_escopo(permissoes: dict[str, Any], identificador_usuario: str) -> set[str] | None:
    if str(permissoes.get("escopo") or "PESSOAL") == "GLOBAL":
        return None
    permitidos = {str(identificador_usuario)}
    if str(permissoes.get("escopo") or "") == "GESTOR":
        permitidos.update(str(item) for item in (permissoes.get("subordinados") or []) if item)
    return permitidos


def _garantir_alvo_no_escopo(permissoes: dict[str, Any], identificador_usuario: str, alvo_usuario: str | None) -> None:
    if not alvo_usuario:
        return
    if usuario_no_escopo_visualizacao(
        escopo=permissoes.get("escopo") or "PESSOAL",
        identificador_usuario=identificador_usuario,
        identificador_alvo=alvo_usuario,
        subordinados=permissoes.get("subordinados") or [],
    ):
        return
    raise _erro_escopo_visualizacao()


def _filtrar_historico_por_escopo(itens: list[dict[str, Any]], permissoes: dict[str, Any], identificador_usuario: str) -> list[dict[str, Any]]:
    permitidos = _permitidos_escopo(permissoes, identificador_usuario)
    if permitidos is None:
        return itens
    return [
        item for item in itens
        if str(item.get("pessoa_impactada_id") or "") in permitidos
    ]


def _normalizar_payload_colaborador(payload: dict[str, Any], tipo_usuario: str, identificador_usuario: str) -> dict[str, Any]:
    dados = dict(payload)
    dados["tipo_usuario"] = normalizar_tipo_usuario(tipo_usuario)
    dados["origem_meta"] = normalizar_origem_meta(dados.get("origem_meta", "MANUAL"))
    dados["data_inicio"] = normalizar_data_importacao(dados.get("data_inicio")) or dados.get("data_inicio")
    dados["data_fim"] = normalizar_data_importacao(dados.get("data_fim")) or dados.get("data_fim")
    dados["criado_por"] = identificador_usuario
    dados["alterado_por"] = identificador_usuario
    validar_vigencia(dados["data_inicio"], dados["data_fim"])
    return dados


def _normalizar_payload_gerencial(payload: dict[str, Any], identificador_usuario: str) -> dict[str, Any]:
    dados = dict(payload)
    dados["tipo_meta"] = normalizar_tipo_meta_gerencial(dados.get("tipo_meta"))
    dados["origem_meta"] = normalizar_origem_meta(dados.get("origem_meta", "MANUAL"))
    dados["meta_regra"] = normalizar_regra_meta(dados.get("meta_regra"))
    dados["data_inicio"] = normalizar_data_importacao(dados.get("data_inicio")) or dados.get("data_inicio")
    dados["data_fim"] = normalizar_data_importacao(dados.get("data_fim")) or dados.get("data_fim")
    dados["criado_por"] = identificador_usuario
    dados["alterado_por"] = identificador_usuario
    if not dados.get("pessoa_id"):
        dados["pessoa_id"] = None
    validar_vigencia(dados["data_inicio"], dados["data_fim"])
    return dados


async def _criar_versao_colaborador(conexao, tipo_usuario: str, payload: dict[str, Any], identificador_usuario: str):
    dados = _normalizar_payload_colaborador(payload, tipo_usuario, identificador_usuario)
    await _garantir_usuario_e_indicador(conexao, dados["usuario_id"], int(dados["indicador_id"]))
    if dados["tipo_usuario"] == "CORRETOR":
        exigir_prazo_alteracao(int(dados["mes_referencia"]), int(dados["ano_referencia"]))
        dados["meta_potencial"] = calcular_meta_potencial_colaborador(dados["tipo_usuario"], dados.get("meta_valor"))
    else:
        soma_corretores = await calcular_meta_automatica_gestor(
            conexao,
            ESQUEMA_COMERCIAL,
            dados["usuario_id"],
            int(dados["indicador_id"]),
            int(dados["mes_referencia"]),
            int(dados["ano_referencia"]),
        )
        dados["meta_potencial"] = calcular_meta_potencial_colaborador(dados["tipo_usuario"], dados.get("meta_valor"), soma_corretores)

    anterior = await buscar_meta_colaborador_ativa(conexao, ESQUEMA_COMERCIAL, dados, for_update=True)
    maior_versao = await maior_versao_meta_colaborador(conexao, ESQUEMA_COMERCIAL, dados)
    versao = preparar_nova_versao_meta(anterior, dados["data_inicio"], maior_versao)
    dados["versao"] = versao["versao"]

    if anterior:
        anterior_inativada = await inativar_meta_colaborador(
            conexao,
            ESQUEMA_COMERCIAL,
            anterior["id"],
            data_fim=versao["data_fim_anterior"],
            alterado_por=identificador_usuario,
            motivo=dados.get("motivo_alteracao"),
        )
        await registrar_historico(
            conexao,
            ESQUEMA_COMERCIAL,
            {
                "meta_id": anterior["id"],
                "tipo_meta": "COLABORADOR",
                "acao": "INATIVACAO",
                "valor_anterior": anterior,
                "valor_novo": anterior_inativada,
                "usuario_responsavel": identificador_usuario,
                "motivo": dados.get("motivo_alteracao"),
            },
        )

    nova = await inserir_meta_colaborador(conexao, ESQUEMA_COMERCIAL, dados)
    await registrar_historico(
        conexao,
        ESQUEMA_COMERCIAL,
        {
            "meta_id": nova["id"],
            "tipo_meta": "COLABORADOR",
            "acao": "ALTERACAO" if anterior else "CRIACAO",
            "valor_anterior": anterior,
            "valor_novo": nova,
            "usuario_responsavel": identificador_usuario,
            "motivo": dados.get("motivo_alteracao"),
        },
    )
    return nova


async def _criar_versao_gerencial(conexao, payload: dict[str, Any], identificador_usuario: str):
    dados = _normalizar_payload_gerencial(payload, identificador_usuario)
    if dados.get("pessoa_id"):
        usuario = await buscar_usuario_meta(conexao, dados["pessoa_id"])
        if not usuario:
            raise HTTPException(status_code=404, detail="Pessoa informada não foi encontrada.")
    indicador = await buscar_indicador_por_id(conexao, ESQUEMA_COMERCIAL, int(dados["indicador_id"]))
    if not indicador:
        raise HTTPException(status_code=404, detail="Indicador informado não foi encontrado.")

    anterior = await buscar_meta_gerencial_ativa(conexao, ESQUEMA_COMERCIAL, dados, for_update=True)
    maior_versao = await maior_versao_meta_gerencial(conexao, ESQUEMA_COMERCIAL, dados)
    versao = preparar_nova_versao_meta(anterior, dados["data_inicio"], maior_versao)
    dados["versao"] = versao["versao"]

    if anterior:
        anterior_inativada = await inativar_meta_gerencial(
            conexao,
            ESQUEMA_COMERCIAL,
            anterior["id"],
            data_fim=versao["data_fim_anterior"],
            alterado_por=identificador_usuario,
        )
        await registrar_historico(
            conexao,
            ESQUEMA_COMERCIAL,
            {
                "meta_id": anterior["id"],
                "tipo_meta": "GERENCIAL",
                "acao": "INATIVACAO",
                "valor_anterior": anterior,
                "valor_novo": anterior_inativada,
                "usuario_responsavel": identificador_usuario,
                "motivo": dados.get("observacao"),
            },
        )

    nova = await inserir_meta_gerencial(conexao, ESQUEMA_COMERCIAL, dados)
    await registrar_historico(
        conexao,
        ESQUEMA_COMERCIAL,
        {
            "meta_id": nova["id"],
            "tipo_meta": "GERENCIAL",
            "acao": "ALTERACAO" if anterior else "CRIACAO",
            "valor_anterior": anterior,
            "valor_novo": nova,
            "usuario_responsavel": identificador_usuario,
            "motivo": dados.get("observacao"),
        },
    )
    return nova


async def _garantir_usuario_e_indicador(conexao, usuario_id: str, indicador_id: int):
    usuario = await buscar_usuario_meta(conexao, usuario_id)
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário informado não foi encontrado.")
    if not usuario.get("indicador_ativo"):
        raise HTTPException(status_code=409, detail="Usuário informado está inativo.")
    indicador = await buscar_indicador_por_id(conexao, ESQUEMA_COMERCIAL, indicador_id)
    if not indicador:
        raise HTTPException(status_code=404, detail="Indicador informado não foi encontrado.")
    return usuario, indicador


async def _aplicar_escopo_leitura(conexao, filtros: dict[str, Any], identificador_usuario: str, permissoes: dict[str, Any], *, gestores: bool = False):
    if permissoes.get("escopo") == "GLOBAL":
        return filtros

    filtros = dict(filtros)
    _garantir_alvo_no_escopo(permissoes, identificador_usuario, filtros.get("corretor"))
    _garantir_alvo_no_escopo(permissoes, identificador_usuario, filtros.get("pessoa"))

    if filtros.get("gestor") and str(filtros.get("gestor")) != str(identificador_usuario):
        raise _erro_escopo_visualizacao()

    if permissoes.get("escopo") == "GESTOR":
        filtros["gestor"] = identificador_usuario
        if gestores:
            filtros["corretor"] = None
        return filtros

    filtros["corretor"] = identificador_usuario
    if filtros.get("pessoa") and str(filtros.get("pessoa")) != str(identificador_usuario):
        raise _erro_escopo_visualizacao()
    if "pessoa" in filtros and not filtros.get("pessoa"):
        filtros["pessoa"] = identificador_usuario
    return filtros


def _montar_dashboard(items: list[dict[str, Any]], mes: int | None = None, ano: int | None = None):
    enriquecidos = [enriquecer_calculo_meta(dict(item)) for item in items]
    meta_total = sum(Decimal(str(item.get("meta_valor") or 0)) for item in enriquecidos)
    realizado_total = sum(Decimal(str(item.get("valor_realizado") or 0)) for item in enriquecidos)
    atingimento = calcular_atingimento(realizado_total, meta_total)
    faltante = calcular_faltante(realizado_total, meta_total)

    hoje = date.today()
    if mes and ano:
        from calendar import monthrange
        fim = date(int(ano), int(mes), monthrange(int(ano), int(mes))[1])
    else:
        from calendar import monthrange
        fim = date(hoje.year, hoje.month, monthrange(hoje.year, hoje.month)[1])
    dias_restantes = max((fim - hoje).days, 0)
    dias_corridos = max(hoje.day, 1)
    projecao = (realizado_total / Decimal(dias_corridos)) * Decimal(fim.day) if realizado_total > 0 else Decimal("0")

    return {
        "resumo": {
            "meta_total": serializar_decimal(meta_total),
            "realizado": serializar_decimal(realizado_total),
            "atingimento_percentual": serializar_decimal(atingimento),
            "faltante": serializar_decimal(faltante),
            "dias_restantes": dias_restantes,
            "projecao_fechamento": serializar_decimal(projecao),
        },
        "itens": [_serializar(item) for item in enriquecidos],
    }


@rotas_de_metas.get("/metas/referencias")
async def obter_referencias_metas(request: Request, usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, identificador_usuario, "metas.resultados.view", "Você não tem permissão para visualizar metas.")
        permissoes = await _contexto_permissoes(conexao, identificador_usuario)
        referencias = filtrar_referencias_por_escopo(
            await listar_referencias(conexao, ESQUEMA_COMERCIAL),
            escopo=permissoes.get("escopo") or "PESSOAL",
            identificador_usuario=identificador_usuario,
            subordinados=permissoes.get("subordinados") or [],
        )
    return _serializar({"referencias": referencias, "permissoes": permissoes})


@rotas_de_metas.get("/metas/indicadores")
async def listar_indicadores_meta(request: Request, incluir_inativos: bool = Query(False), usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.view", "Você não tem permissão para visualizar indicadores.")
        itens = await listar_indicadores(conexao, ESQUEMA_COMERCIAL, incluir_inativos)
    return _serializar({"itens": itens})


@rotas_de_metas.post("/metas/indicadores")
async def criar_indicador_meta(payload: RequisicaoIndicadorMeta, request: Request, usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.admin", "Você não tem permissão para criar indicadores.")
        item = await criar_indicador(conexao, ESQUEMA_COMERCIAL, _payload(payload))
    return _serializar({"mensagem": "Indicador cadastrado com sucesso.", "item": item})


@rotas_de_metas.put("/metas/indicadores/{indicador_id}")
async def atualizar_indicador_meta(indicador_id: int, payload: RequisicaoAtualizarIndicadorMeta, request: Request, usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.admin", "Você não tem permissão para alterar indicadores.")
        item = await atualizar_indicador(conexao, ESQUEMA_COMERCIAL, indicador_id, _payload(payload))
    if not item:
        raise HTTPException(status_code=404, detail="Indicador não encontrado.")
    return _serializar({"mensagem": "Indicador alterado com sucesso.", "item": item})


async def _listar_colaborador_por_tipo(request: Request, usuario, tipo_usuario: str, filtros: dict[str, Any], gestores: bool = False):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, identificador_usuario, "metas.resultados.view", "Você não tem permissão para visualizar metas.")
        permissoes = await _contexto_permissoes(conexao, identificador_usuario)
        filtros = await _aplicar_escopo_leitura(conexao, filtros, identificador_usuario, permissoes, gestores=gestores)
        itens = await listar_metas_colaboradores(conexao, ESQUEMA_COMERCIAL, tipo_usuario=tipo_usuario, filtros=filtros)
    itens = [enriquecer_calculo_meta(dict(item)) for item in itens]
    return _serializar({"itens": itens, "total": len(itens), "prazo_alteracao": _serializar(calcular_limite_alteracao(filtros.get("mes") or date.today().month, filtros.get("ano") or date.today().year))})


@rotas_de_metas.get("/metas/corretores")
async def listar_metas_corretores(request: Request, mes: int | None = None, ano: int | None = None, equipe: str | None = None, gestor: str | None = None, corretor: str | None = None, indicador: str | None = None, origem_meta: str | None = None, usuario=Depends(obter_usuario_autenticado)):
    filtros = _filtros_comuns(mes=mes, ano=ano, equipe=equipe, gestor=gestor, corretor=corretor, indicador=indicador, origem_meta=origem_meta)
    return await _listar_colaborador_por_tipo(request, usuario, "CORRETOR", filtros)


@rotas_de_metas.post("/metas/corretores")
async def criar_meta_corretor(payload: RequisicaoMetaColaborador, request: Request, usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    dados = _payload(payload)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, identificador_usuario, "metas.resultados.manage", "Você não tem permissão para alterar metas de corretores.")
        permissoes = await _contexto_permissoes(conexao, identificador_usuario)
        await _exigir_gerencia_colaborador(conexao, identificador_usuario, dados["usuario_id"], permissoes)
        async with conexao.transaction():
            item = await _criar_versao_colaborador(conexao, "CORRETOR", dados, identificador_usuario)
    return _serializar({"mensagem": "Meta cadastrada com sucesso. Uma nova versão foi criada.", "item": item})


@rotas_de_metas.put("/metas/corretores/{meta_id}")
async def atualizar_meta_corretor(meta_id: str, payload: RequisicaoMetaColaborador, request: Request, usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    dados = _payload(payload)
    async with pool.acquire() as conexao:
        existente = await buscar_meta_colaborador_por_id(conexao, ESQUEMA_COMERCIAL, meta_id)
        if not existente:
            raise HTTPException(status_code=404, detail="Meta não encontrada.")
        await exigir_permissao_portal(conexao, identificador_usuario, "metas.resultados.manage", "Você não tem permissão para alterar metas de corretores.")
        permissoes = await _contexto_permissoes(conexao, identificador_usuario)
        await _exigir_gerencia_colaborador(conexao, identificador_usuario, dados["usuario_id"], permissoes)
        async with conexao.transaction():
            item = await _criar_versao_colaborador(conexao, "CORRETOR", dados, identificador_usuario)
    return _serializar({"mensagem": "Meta alterada com sucesso. Uma nova versão foi criada.", "item": item})


@rotas_de_metas.get("/metas/corretores/{meta_id}/historico")
async def historico_meta_corretor(meta_id: str, request: Request, usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.view", "Você não tem permissão para visualizar histórico.")
        permissoes = await _contexto_permissoes(conexao, usuario["identificador_usuario"])
        meta = await buscar_meta_colaborador_por_id(conexao, ESQUEMA_COMERCIAL, meta_id)
        if not meta:
            raise HTTPException(status_code=404, detail="Meta nÃ£o encontrada.")
        _garantir_alvo_no_escopo(permissoes, usuario["identificador_usuario"], meta.get("usuario_id"))
        itens = await listar_historico_meta(conexao, ESQUEMA_COMERCIAL, meta_id, "COLABORADOR")
    return _serializar({"itens": itens})


@rotas_de_metas.get("/metas/gestores")
async def listar_metas_gestores(request: Request, mes: int | None = None, ano: int | None = None, equipe: str | None = None, gestor: str | None = None, indicador: str | None = None, origem_meta: str | None = None, usuario=Depends(obter_usuario_autenticado)):
    mes_ref = int(mes or date.today().month)
    ano_ref = int(ano or date.today().year)
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, identificador_usuario, "metas.resultados.view", "Você não tem permissão para visualizar metas de gestores.")
        permissoes = await _contexto_permissoes(conexao, identificador_usuario)
        usuarios = await listar_usuarios_meta(conexao, limite=1000)
        indicadores = await listar_indicadores(conexao, ESQUEMA_COMERCIAL, incluir_inativos=False)
        if indicador:
            indicador_normalizado = normalizar_codigo(indicador)
            indicadores = [item for item in indicadores if normalizar_codigo(item["codigo"]) == indicador_normalizado or str(item["id"]) == str(indicador)]

        itens = []
        for gestor_item in usuarios:
            perfis = " ".join(str(perfil) for perfil in (gestor_item.get("perfis") or [])).lower()
            eh_gestor = "gestor" in perfis or "gerente" in perfis or "coordenador" in perfis or permissoes.get("admin")
            if not eh_gestor:
                continue
            if gestor and gestor_item["identificador_usuario"] != gestor:
                continue
            if permissoes.get("escopo") != "GLOBAL" and gestor_item["identificador_usuario"] != identificador_usuario:
                continue
            for indicador_item in indicadores:
                automatica = await calcular_meta_automatica_gestor(
                    conexao,
                    ESQUEMA_COMERCIAL,
                    gestor_item["identificador_usuario"],
                    indicador_item["id"],
                    mes_ref,
                    ano_ref,
                )
                manual = await buscar_meta_colaborador_ativa(
                    conexao,
                    ESQUEMA_COMERCIAL,
                    {
                        "usuario_id": gestor_item["identificador_usuario"],
                        "tipo_usuario": "GESTOR",
                        "indicador_id": indicador_item["id"],
                        "mes_referencia": mes_ref,
                        "ano_referencia": ano_ref,
                        "origem_meta": "MANUAL",
                    },
                )
                oficial = resolver_meta_oficial_gestor(manual.get("meta_valor") if manual else None, automatica)
                if origem_meta and oficial["origem_meta"] != normalizar_codigo(origem_meta):
                    continue
                historico_automatica = []
                for mes_hist, ano_hist in _meses_anteriores(mes_ref, ano_ref):
                    valor_hist = await calcular_meta_automatica_gestor(
                        conexao,
                        ESQUEMA_COMERCIAL,
                        gestor_item["identificador_usuario"],
                        indicador_item["id"],
                        mes_hist,
                        ano_hist,
                    )
                    historico_automatica.append({
                        "mes": mes_hist,
                        "ano": ano_hist,
                        "meta_valor": valor_hist,
                    })
                itens.append({
                    "id": manual.get("id") if manual else None,
                    "usuario_id": gestor_item["identificador_usuario"],
                    "usuario_nome": gestor_item["nome_completo"],
                    "usuario_email": gestor_item.get("correio_eletronico"),
                    "tipo_usuario": "GESTOR",
                    "indicador_id": indicador_item["id"],
                    "indicador_codigo": indicador_item["codigo"],
                    "indicador_nome": indicador_item["nome"],
                    "mes_referencia": mes_ref,
                    "ano_referencia": ano_ref,
                    "meta_potencial": automatica,
                    "meta_automatica": automatica,
                    "meta_manual": manual.get("meta_valor") if manual else None,
                    "meta_valor": oficial["meta_oficial"],
                    "meta_oficial": oficial["meta_oficial"],
                    "origem_meta": oficial["origem_meta"],
                    "data_inicio": manual.get("data_inicio") if manual else date(ano_ref, mes_ref, 1),
                    "data_fim": manual.get("data_fim") if manual else None,
                    "versao": manual.get("versao") if manual else 0,
                    "ativo": True,
                    "historico_meta_3_meses": historico_automatica,
                    "historico_meta_potencial_3_meses": historico_automatica,
                })
    return _serializar({"itens": itens, "total": len(itens)})


@rotas_de_metas.post("/metas/gestores")
async def criar_meta_gestor(payload: RequisicaoMetaColaborador, request: Request, usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    dados = _payload(payload)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, identificador_usuario, "metas.resultados.manage", "Você não tem permissão para alterar metas de gestores.")
        permissoes = await _contexto_permissoes(conexao, identificador_usuario)
        if not permissoes.get("admin") and dados["usuario_id"] != identificador_usuario:
            raise HTTPException(status_code=403, detail="Gestor só pode alterar a própria meta manual.")
        async with conexao.transaction():
            item = await _criar_versao_colaborador(conexao, "GESTOR", dados, identificador_usuario)
    return _serializar({"mensagem": "Meta manual do gestor cadastrada com sucesso.", "item": item})


@rotas_de_metas.put("/metas/gestores/{meta_id}")
async def atualizar_meta_gestor(meta_id: str, payload: RequisicaoMetaColaborador, request: Request, usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    dados = _payload(payload)
    async with pool.acquire() as conexao:
        existente = await buscar_meta_colaborador_por_id(conexao, ESQUEMA_COMERCIAL, meta_id)
        if not existente:
            raise HTTPException(status_code=404, detail="Meta não encontrada.")
        await exigir_permissao_portal(conexao, identificador_usuario, "metas.resultados.manage", "Você não tem permissão para alterar metas de gestores.")
        permissoes = await _contexto_permissoes(conexao, identificador_usuario)
        if not permissoes.get("admin") and dados["usuario_id"] != identificador_usuario:
            raise HTTPException(status_code=403, detail="Gestor só pode alterar a própria meta manual.")
        async with conexao.transaction():
            item = await _criar_versao_colaborador(conexao, "GESTOR", dados, identificador_usuario)
    return _serializar({"mensagem": "Meta manual do gestor alterada com sucesso.", "item": item})


@rotas_de_metas.get("/metas/gestores/{gestor_id}/historico")
async def historico_meta_gestor(gestor_id: str, request: Request, usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.view", "Você não tem permissão para visualizar histórico.")
        permissoes = await _contexto_permissoes(conexao, usuario["identificador_usuario"])
        meta = await buscar_meta_colaborador_por_id(conexao, ESQUEMA_COMERCIAL, gestor_id)
        if not meta:
            raise HTTPException(status_code=404, detail="Meta nÃ£o encontrada.")
        _garantir_alvo_no_escopo(permissoes, usuario["identificador_usuario"], meta.get("usuario_id"))
        itens = await listar_historico_meta(conexao, ESQUEMA_COMERCIAL, gestor_id, "COLABORADOR")
    return _serializar({"itens": itens})


@rotas_de_metas.get("/metas/gestores/{gestor_id}/meta-automatica")
async def obter_meta_automatica_gestor(gestor_id: str, request: Request, indicador_id: int = Query(...), mes: int = Query(..., ge=1, le=12), ano: int = Query(..., ge=2000, le=2100), usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.view", "Você não tem permissão para visualizar metas.")
        permissoes = await _contexto_permissoes(conexao, usuario["identificador_usuario"])
        _garantir_alvo_no_escopo(permissoes, usuario["identificador_usuario"], gestor_id)
        automatica = await calcular_meta_automatica_gestor(conexao, ESQUEMA_COMERCIAL, gestor_id, indicador_id, mes, ano)
        manual = await buscar_meta_colaborador_ativa(
            conexao,
            ESQUEMA_COMERCIAL,
            {
                "usuario_id": gestor_id,
                "tipo_usuario": "GESTOR",
                "indicador_id": indicador_id,
                "mes_referencia": mes,
                "ano_referencia": ano,
                "origem_meta": "MANUAL",
            },
        )
    oficial = resolver_meta_oficial_gestor(manual.get("meta_valor") if manual else None, automatica)
    return _serializar({"meta": oficial, "meta_manual": manual, "meta_potencial": automatica})


async def _listar_gerenciais_com_filtros(request: Request, usuario, *, mes: int | None = None, ano: int | None = None, tipo_meta: str | None = None, regional: str | None = None, empreendimento: str | None = None, indicador: str | None = None, pessoa: str | None = None, origem_meta: str | None = None):
    filtros = _filtros_comuns(mes=mes, ano=ano, tipo_meta=tipo_meta, regional=regional, empreendimento=empreendimento, indicador=indicador, pessoa=pessoa, origem_meta=origem_meta)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.view", "Você não tem permissão para visualizar metas gerenciais.")
        permissoes = await _contexto_permissoes(conexao, usuario["identificador_usuario"])
        if filtros.get("pessoa"):
            _garantir_alvo_no_escopo(permissoes, usuario["identificador_usuario"], filtros.get("pessoa"))
        elif permissoes.get("escopo") != "GLOBAL":
            filtros["pessoa"] = usuario["identificador_usuario"]
        itens = await listar_metas_gerenciais(conexao, ESQUEMA_COMERCIAL, filtros)
    return _serializar({"itens": itens, "total": len(itens)})


@rotas_de_metas.get("/metas/gerenciais")
async def listar_gerenciais(request: Request, mes: int | None = None, ano: int | None = None, tipo_meta: str | None = None, regional: str | None = None, empreendimento: str | None = None, indicador: str | None = None, pessoa: str | None = None, origem_meta: str | None = None, usuario=Depends(obter_usuario_autenticado)):
    return await _listar_gerenciais_com_filtros(
        request,
        usuario,
        mes=mes,
        ano=ano,
        tipo_meta=tipo_meta,
        regional=regional,
        empreendimento=empreendimento,
        indicador=indicador,
        pessoa=pessoa,
        origem_meta=origem_meta,
    )


@rotas_de_metas.get("/metas/regionais")
async def listar_regionais(request: Request, mes: int | None = None, ano: int | None = None, regional: str | None = None, indicador: str | None = None, pessoa: str | None = None, origem_meta: str | None = None, usuario=Depends(obter_usuario_autenticado)):
    return await _listar_gerenciais_com_filtros(
        request,
        usuario,
        mes=mes,
        ano=ano,
        tipo_meta="REGIONAL",
        regional=regional,
        indicador=indicador,
        pessoa=pessoa,
        origem_meta=origem_meta,
    )


@rotas_de_metas.post("/metas/gerenciais")
async def criar_gerencial(payload: RequisicaoMetaGerencial, request: Request, usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.gerenciais.manage", "Você não tem permissão para alterar metas gerenciais.")
        async with conexao.transaction():
            item = await _criar_versao_gerencial(conexao, _payload(payload), usuario["identificador_usuario"])
    return _serializar({"mensagem": "Meta gerencial cadastrada com sucesso.", "item": item})


@rotas_de_metas.post("/metas/regionais")
async def criar_regional(payload: RequisicaoMetaGerencial, request: Request, usuario=Depends(obter_usuario_autenticado)):
    dados = _payload(payload)
    dados["tipo_meta"] = "REGIONAL"
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.gerenciais.manage", "Você não tem permissão para alterar metas regionais.")
        async with conexao.transaction():
            item = await _criar_versao_gerencial(conexao, dados, usuario["identificador_usuario"])
    return _serializar({"mensagem": "Meta regional cadastrada com sucesso.", "item": item})


@rotas_de_metas.put("/metas/gerenciais/{meta_id}")
async def atualizar_gerencial(meta_id: str, payload: RequisicaoMetaGerencial, request: Request, usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        existente = await buscar_meta_gerencial_por_id(conexao, ESQUEMA_COMERCIAL, meta_id)
        if not existente:
            raise HTTPException(status_code=404, detail="Meta gerencial não encontrada.")
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.gerenciais.manage", "Você não tem permissão para alterar metas gerenciais.")
        async with conexao.transaction():
            item = await _criar_versao_gerencial(conexao, _payload(payload), usuario["identificador_usuario"])
    return _serializar({"mensagem": "Meta gerencial alterada com sucesso. Uma nova versão foi criada.", "item": item})


@rotas_de_metas.put("/metas/regionais/{meta_id}")
async def atualizar_regional(meta_id: str, payload: RequisicaoMetaGerencial, request: Request, usuario=Depends(obter_usuario_autenticado)):
    dados = _payload(payload)
    dados["tipo_meta"] = "REGIONAL"
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        existente = await buscar_meta_gerencial_por_id(conexao, ESQUEMA_COMERCIAL, meta_id)
        if not existente:
            raise HTTPException(status_code=404, detail="Meta regional não encontrada.")
        if existente.get("tipo_meta") != "REGIONAL":
            raise HTTPException(status_code=409, detail="A meta informada não é regional.")
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.gerenciais.manage", "Você não tem permissão para alterar metas regionais.")
        async with conexao.transaction():
            item = await _criar_versao_gerencial(conexao, dados, usuario["identificador_usuario"])
    return _serializar({"mensagem": "Meta regional alterada com sucesso. Uma nova versão foi criada.", "item": item})


@rotas_de_metas.get("/metas/gerenciais/{meta_id}/historico")
async def historico_gerencial(meta_id: str, request: Request, usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.view", "Você não tem permissão para visualizar histórico.")
        permissoes = await _contexto_permissoes(conexao, usuario["identificador_usuario"])
        meta = await buscar_meta_gerencial_por_id(conexao, ESQUEMA_COMERCIAL, meta_id)
        if not meta:
            raise HTTPException(status_code=404, detail="Meta gerencial nÃ£o encontrada.")
        _garantir_alvo_no_escopo(permissoes, usuario["identificador_usuario"], meta.get("pessoa_id"))
        itens = await listar_historico_meta(conexao, ESQUEMA_COMERCIAL, meta_id, "GERENCIAL")
    return _serializar({"itens": itens})


@rotas_de_metas.get("/resultados/metas")
async def listar_resultados_metas(request: Request, mes: int | None = None, ano: int | None = None, equipe: str | None = None, gestor: str | None = None, corretor: str | None = None, indicador: str | None = None, origem_resultado: str | None = None, usuario=Depends(obter_usuario_autenticado)):
    filtros = _filtros_comuns(mes=mes, ano=ano, equipe=equipe, gestor=gestor, corretor=corretor, indicador=indicador, origem_resultado=origem_resultado)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.view", "Você não tem permissão para visualizar resultados.")
        permissoes = await _contexto_permissoes(conexao, usuario["identificador_usuario"])
        filtros = await _aplicar_escopo_leitura(conexao, filtros, usuario["identificador_usuario"], permissoes)
        itens = await listar_resultados(conexao, ESQUEMA_COMERCIAL, filtros)
    return _serializar({"itens": itens, "total": len(itens)})


@rotas_de_metas.post("/resultados/metas")
async def criar_resultado_meta(payload: RequisicaoResultadoMeta, request: Request, usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    dados = _payload(payload)
    dados["origem_resultado"] = normalizar_origem_resultado(dados.get("origem_resultado", "MANUAL"))
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.resultados.manage", "Você não tem permissão para lançar resultados.")
        permissoes = await _contexto_permissoes(conexao, usuario["identificador_usuario"])
        _garantir_alvo_no_escopo(permissoes, usuario["identificador_usuario"], dados["usuario_id"])
        await _garantir_usuario_e_indicador(conexao, dados["usuario_id"], int(dados["indicador_id"]))
        item = await inserir_resultado(conexao, ESQUEMA_COMERCIAL, dados)
    return _serializar({"mensagem": "Resultado lançado com sucesso.", "item": item})


@rotas_de_metas.put("/resultados/metas/{resultado_id}")
async def atualizar_resultado_meta(resultado_id: str, payload: RequisicaoResultadoMeta, request: Request, usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    dados = _payload(payload)
    dados["origem_resultado"] = normalizar_origem_resultado(dados.get("origem_resultado", "MANUAL"))
    async with pool.acquire() as conexao:
        existente = await buscar_resultado_por_id(conexao, ESQUEMA_COMERCIAL, resultado_id)
        if not existente:
            raise HTTPException(status_code=404, detail="Resultado não encontrado.")
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.resultados.manage", "Você não tem permissão para alterar resultados.")
        permissoes = await _contexto_permissoes(conexao, usuario["identificador_usuario"])
        _garantir_alvo_no_escopo(permissoes, usuario["identificador_usuario"], dados["usuario_id"])
        await _garantir_usuario_e_indicador(conexao, dados["usuario_id"], int(dados["indicador_id"]))
        item = await atualizar_resultado(conexao, ESQUEMA_COMERCIAL, resultado_id, dados)
    return _serializar({"mensagem": "Resultado alterado com sucesso.", "item": item})


@rotas_de_metas.get("/metas/dashboard")
async def dashboard_metas(request: Request, mes: int | None = None, ano: int | None = None, equipe: str | None = None, gestor: str | None = None, corretor: str | None = None, indicador: str | None = None, usuario=Depends(obter_usuario_autenticado)):
    filtros = _filtros_comuns(mes=mes, ano=ano, equipe=equipe, gestor=gestor, corretor=corretor, indicador=indicador)
    pool = _obter_pool(request)
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.view", "Você não tem permissão para visualizar dashboard.")
        permissoes = await _contexto_permissoes(conexao, usuario["identificador_usuario"])
        filtros = await _aplicar_escopo_leitura(conexao, filtros, usuario["identificador_usuario"], permissoes)
        itens = await listar_metas_colaboradores(conexao, ESQUEMA_COMERCIAL, tipo_usuario=None, filtros=filtros)
    return _serializar(_montar_dashboard([dict(item) for item in itens], mes=mes, ano=ano))


@rotas_de_metas.get("/metas/dashboard/corretor/{corretor_id}")
async def dashboard_corretor(corretor_id: str, request: Request, mes: int | None = None, ano: int | None = None, indicador: str | None = None, usuario=Depends(obter_usuario_autenticado)):
    return await dashboard_metas(request, mes=mes, ano=ano, corretor=corretor_id, indicador=indicador, usuario=usuario)


@rotas_de_metas.get("/metas/dashboard/gestor/{gestor_id}")
async def dashboard_gestor(gestor_id: str, request: Request, mes: int | None = None, ano: int | None = None, indicador: str | None = None, usuario=Depends(obter_usuario_autenticado)):
    return await dashboard_metas(request, mes=mes, ano=ano, gestor=gestor_id, indicador=indicador, usuario=usuario)


@rotas_de_metas.get("/metas/dashboard/ranking")
async def ranking_metas(request: Request, mes: int | None = None, ano: int | None = None, equipe: str | None = None, gestor: str | None = None, indicador: str | None = None, usuario=Depends(obter_usuario_autenticado)):
    dashboard = await dashboard_metas(request, mes=mes, ano=ano, equipe=equipe, gestor=gestor, indicador=indicador, usuario=usuario)
    itens = sorted(dashboard["itens"], key=lambda item: item.get("atingimento_percentual") or -1, reverse=True)
    return {"itens": itens[:50]}


@rotas_de_metas.get("/metas/dashboard/indicadores-criticos")
async def indicadores_criticos(request: Request, mes: int | None = None, ano: int | None = None, equipe: str | None = None, gestor: str | None = None, usuario=Depends(obter_usuario_autenticado)):
    dashboard = await dashboard_metas(request, mes=mes, ano=ano, equipe=equipe, gestor=gestor, usuario=usuario)
    itens = [
        item for item in dashboard["itens"]
        if item.get("status_resultado") in {"Crítico", "Abaixo do esperado", "Sem resultado lançado", "Sem meta cadastrada"}
    ]
    return {"itens": itens[:100]}


@rotas_de_metas.get("/metas/historico")
async def historico_metas(
    request: Request,
    mes: int | None = None,
    ano: int | None = None,
    pessoa: str | None = None,
    corretor: str | None = None,
    indicador: str | None = None,
    tipo_meta: str | None = None,
    acao: str | None = None,
    usuario_responsavel: str | None = None,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    filtros = {
        "mes": mes,
        "ano": ano,
        "pessoa": pessoa or corretor,
        "indicador": indicador,
        "tipo_meta": normalizar_codigo(tipo_meta) if tipo_meta else None,
        "acao": normalizar_codigo(acao) if acao else None,
        "usuario_responsavel": usuario_responsavel,
    }
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.view", "Você não tem permissão para visualizar histórico.")
        permissoes = await _contexto_permissoes(conexao, usuario["identificador_usuario"])
        if filtros.get("pessoa"):
            _garantir_alvo_no_escopo(permissoes, usuario["identificador_usuario"], filtros.get("pessoa"))
        itens = await listar_historico_geral(conexao, ESQUEMA_COMERCIAL, filtros)
    itens = _filtrar_historico_por_escopo(itens, permissoes, usuario["identificador_usuario"])
    return _serializar({"itens": itens})


@rotas_de_metas.post("/metas/importacao/preview")
async def preview_importacao_metas(request: Request, arquivo: UploadFile = File(...), usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    conteudo = await arquivo.read()
    abas = extrair_linhas_planilha(conteudo, arquivo.filename or "")
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.import", "Você não tem permissão para importar metas.")
        indicadores = await listar_indicadores(conexao, ESQUEMA_COMERCIAL, incluir_inativos=False)
        usuarios = await listar_usuarios_meta(conexao, limite=2000)
    indicadores_por_codigo = {normalizar_codigo(item["codigo"]): item for item in indicadores}
    from servicos.metas import remover_acentos
    usuarios_por_nome = {remover_acentos(item["nome_completo"]).lower(): item for item in usuarios}

    linhas_preview: list[dict[str, Any]] = []
    for nome_aba, linhas in abas.items():
        for indice, linha in enumerate(linhas, start=2):
            chaves = {normalizar_codigo(chave) for chave in linha.keys()}
            if "FUNCIONARIO" in chaves:
                validada = validar_linha_importacao_colaborador(linha, indicadores_por_codigo=indicadores_por_codigo, usuarios_por_nome=usuarios_por_nome)
                modelo = "COLABORADOR"
            else:
                validada = validar_linha_importacao_gerencial(linha, indicadores_por_codigo=indicadores_por_codigo, usuarios_por_nome=usuarios_por_nome)
                modelo = "GERENCIAL"
            linhas_preview.append({
                "aba": nome_aba,
                "linha": indice,
                "modelo": modelo,
                **validada,
            })
    return _serializar({
        "total_linhas": len(linhas_preview),
        "validas": len([item for item in linhas_preview if item["valida"]]),
        "invalidas": len([item for item in linhas_preview if not item["valida"]]),
        "linhas": linhas_preview,
    })


@rotas_de_metas.post("/metas/importacao/confirmar")
async def confirmar_importacao_metas(payload: RequisicaoImportacaoMetas, request: Request, usuario=Depends(obter_usuario_autenticado)):
    pool = _obter_pool(request)
    linhas = _payload(payload).get("linhas") or []
    gravadas: list[dict[str, Any]] = []
    erros: list[dict[str, Any]] = []
    async with pool.acquire() as conexao:
        await exigir_permissao_portal(conexao, usuario["identificador_usuario"], "metas.resultados.import", "Você não tem permissão para importar metas.")
        async with conexao.transaction():
            for indice, linha in enumerate(linhas, start=1):
                try:
                    modelo = normalizar_codigo(linha.get("modelo"))
                    dados = linha.get("dados") or linha
                    if modelo == "COLABORADOR":
                        dados = {
                            **dados,
                            "mes_referencia": dados["data_inicio"].month if isinstance(dados.get("data_inicio"), date) else int(str(dados.get("data_inicio"))[5:7]),
                            "ano_referencia": dados["data_inicio"].year if isinstance(dados.get("data_inicio"), date) else int(str(dados.get("data_inicio"))[:4]),
                            "origem_meta": "MANUAL",
                        }
                        item = await _criar_versao_colaborador(conexao, "CORRETOR", dados, usuario["identificador_usuario"])
                    elif modelo == "GERENCIAL":
                        dados = {
                            **dados,
                            "mes_referencia": dados["data_inicio"].month if isinstance(dados.get("data_inicio"), date) else int(str(dados.get("data_inicio"))[5:7]),
                            "ano_referencia": dados["data_inicio"].year if isinstance(dados.get("data_inicio"), date) else int(str(dados.get("data_inicio"))[:4]),
                            "origem_meta": "MANUAL",
                        }
                        item = await _criar_versao_gerencial(conexao, dados, usuario["identificador_usuario"])
                    else:
                        raise ValueError("Modelo de importação inválido.")
                    gravadas.append(item)
                except Exception as erro:
                    erros.append({"linha": indice, "erro": str(getattr(erro, "detail", erro))})
    return _serializar({"mensagem": "Importação processada.", "gravadas": len(gravadas), "erros": erros, "itens": gravadas})
