"""
Rotas do modulo de clientes (comercial).
"""

from __future__ import annotations

import asyncpg

from math import ceil

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, status

from configuracoes import (
    CLIENTES_TAMANHO_MAXIMO_DOCUMENTO_MB,
    CLIENTES_TAMANHO_MAXIMO_FOTO_MB,
    CLIENTES_TOTAL_MAXIMO_DOCUMENTOS_POR_ENVIO,
    CLIENTES_UPLOADS_DIRETORIO,
    CLIENTES_UPLOADS_URL_BASE,
    DIRETORIO_PUBLICO,
    ESQUEMA_COMERCIAL,
)
from dependencias import obter_usuario_autenticado
from modelos.clientes import (
    RequisicaoAtualizarCliente,
    RequisicaoAtualizarFlagsMembroComposicao,
    RequisicaoAtualizarMembroComposicao,
    RequisicaoAtualizarStatusMembroComposicao,
    RequisicaoCriarCliente,
    RequisicaoCriarMembroComposicao,
)
from repositorios.clientes import (
    buscar_cliente_por_cpf_normalizado,
    buscar_cliente_por_id,
    buscar_midia_cliente,
    contar_clientes,
    excluir_midia_cliente,
    excluir_cliente,
    listar_clientes as listar_clientes_repo,
    listar_midias_cliente,
    resumir_vinculos_exclusao_cliente,
)
from repositorios.composicao_familiar import (
    atualizar_flags_membro,
    atualizar_membro,
    atualizar_status_membro,
    buscar_membro_ativo_por_cpf_normalizado,
    buscar_membro_por_id,
    criar_membro,
    listar_membros_cliente,
)
from servicos.clientes import (
    atualizar_cliente as atualizar_cliente_servico,
    criar_cliente as criar_cliente_servico,
    normalizar_payload_cliente,
    recalcular_renda_total_cliente as recalcular_renda_total_cliente_servico,
    remover_arquivo_publico,
    remover_arquivos_publicos,
    salvar_documentos_cliente,
    serializar_cliente,
    substituir_foto_cliente,
)
from servicos.composicao_familiar import normalizar_payload_membro, serializar_membro
from utilitarios.autorizacao import exigir_permissao_portal
from utilitarios.clientes_acesso import (
    obter_usuario_responsavel_cliente,
    usuario_pode_ver_todos_clientes,
)


rotas_de_clientes = APIRouter()


def _obter_pool(request: Request):
    pool = getattr(request.app.state, "pool", None)
    if not pool:
        raise HTTPException(status_code=503, detail="Pool indisponivel.")
    return pool


def _normalizar_busca(valor: str) -> str:
    texto = str(valor or "").strip()
    if not texto:
        return "%%"
    return f"%{texto}%"


def _model_payload(payload) -> dict:
    if hasattr(payload, "model_dump"):
        return payload.model_dump()
    return payload.dict()


def _resumo_composicao(items: list[dict]) -> dict:
    total = len(items or [])
    ativos = [item for item in items if item.get("ativo")]
    return {
        "total": total,
        "ativos": len(ativos),
        "incluir_na_analise": len([item for item in ativos if item.get("incluir_na_analise")]),
        "compoe_renda": len([item for item in ativos if item.get("compoe_renda")]),
        "renda_total_ativa": sum(
            float(item.get("renda_total") or 0)
            for item in ativos
            if item.get("compoe_renda")
            and item.get("incluir_na_analise")
            and item.get("incluir_na_composicao_financeira")
        ),
    }


def _descricao_responsavel_cliente(
    cliente_existente: dict | None,
    *,
    identificador_usuario_atual: str | None = None,
) -> str:
    if not cliente_existente:
        return ""

    identificador_responsavel = str(cliente_existente.get("identificador_usuario_cadastro") or "").strip()
    nome_responsavel = str(cliente_existente.get("usuario_cadastro_nome") or "").strip()
    email_responsavel = str(cliente_existente.get("usuario_cadastro_email") or "").strip()

    if identificador_usuario_atual and identificador_responsavel and str(identificador_usuario_atual) == identificador_responsavel:
        return "por você"
    if nome_responsavel:
        return f"por {nome_responsavel}"
    if email_responsavel:
        return f"por {email_responsavel}"
    return ""


def _mensagem_cpf_cliente_duplicado(
    cliente_existente: dict | None,
    *,
    identificador_usuario_atual: str | None = None,
) -> str:
    responsavel = _descricao_responsavel_cliente(
        cliente_existente,
        identificador_usuario_atual=identificador_usuario_atual,
    )
    if responsavel == "por você":
        return "Este CPF já está cadastrado em outro cliente seu. Use o cadastro existente em vez de criar um novo."
    if responsavel:
        return f"Este CPF já está cadastrado {responsavel}. Outro corretor não pode cadastrar o mesmo cliente."
    return "Este CPF já está cadastrado na base comercial. Outro corretor não pode cadastrar o mesmo cliente."


async def _detalhar_cpf_cliente_duplicado(
    conexao,
    cpf_normalizado: str | None,
    *,
    identificador_usuario_atual: str | None = None,
    identificador_cliente_atual: str | None = None,
) -> str:
    if not cpf_normalizado:
        return "Este CPF já está cadastrado na base comercial. Outro corretor não pode cadastrar o mesmo cliente."

    cliente_existente = await buscar_cliente_por_cpf_normalizado(
        conexao,
        ESQUEMA_COMERCIAL,
        cpf_normalizado,
        ignorar_identificador_cliente=identificador_cliente_atual,
    )
    return _mensagem_cpf_cliente_duplicado(
        cliente_existente,
        identificador_usuario_atual=identificador_usuario_atual,
    )


async def _validar_cpf_cliente_disponivel(
    conexao,
    cpf_normalizado: str | None,
    *,
    identificador_cliente_atual: str | None = None,
    identificador_usuario_atual: str | None = None,
):
    if not cpf_normalizado:
        return

    cliente_existente = await buscar_cliente_por_cpf_normalizado(
        conexao,
        ESQUEMA_COMERCIAL,
        cpf_normalizado,
        ignorar_identificador_cliente=identificador_cliente_atual,
    )
    if cliente_existente:
        raise HTTPException(
            status_code=409,
            detail=_mensagem_cpf_cliente_duplicado(
                cliente_existente,
                identificador_usuario_atual=identificador_usuario_atual,
            ),
        )

    membro_existente = await buscar_membro_ativo_por_cpf_normalizado(
        conexao,
        ESQUEMA_COMERCIAL,
        cpf_normalizado,
    )
    if membro_existente:
        raise HTTPException(
            status_code=409,
            detail="Este CPF já está vinculado em composição familiar ativa e não pode ser reutilizado no cliente principal.",
        )


async def _validar_cpf_membro_disponivel(
    conexao,
    cpf_normalizado: str,
    identificador_cliente_principal: str,
    *,
    identificador_membro_atual: str | None = None,
):
    cliente_mesmo_cpf = await buscar_cliente_por_cpf_normalizado(
        conexao,
        ESQUEMA_COMERCIAL,
        cpf_normalizado,
        ignorar_identificador_cliente=None,
    )
    if cliente_mesmo_cpf:
        if str(cliente_mesmo_cpf["identificador_cliente"]) == str(identificador_cliente_principal):
            raise HTTPException(
                status_code=409,
                detail="O CPF do membro não pode ser igual ao CPF do cliente principal.",
            )
        raise HTTPException(
            status_code=409,
            detail="Este CPF já pertence a um cliente principal e não pode ser reaproveitado.",
        )

    membro_existente = await buscar_membro_ativo_por_cpf_normalizado(
        conexao,
        ESQUEMA_COMERCIAL,
        cpf_normalizado,
        ignorar_identificador_membro=identificador_membro_atual,
    )
    if membro_existente:
        raise HTTPException(
            status_code=409,
            detail="Este CPF já está vinculado em outra composição familiar ativa.",
        )


async def _sincronizar_renda_total_cliente(
    conexao,
    identificador_cliente: str,
    *,
    cliente_payload=None,
):
    cliente_base = cliente_payload
    if cliente_base is None:
        cliente_base = await buscar_cliente_por_id(conexao, ESQUEMA_COMERCIAL, identificador_cliente)
    if not cliente_base:
        raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    membros = await listar_membros_cliente(
        conexao,
        ESQUEMA_COMERCIAL,
        identificador_cliente,
        incluir_inativos=True,
    )
    return await recalcular_renda_total_cliente_servico(
        conexao,
        ESQUEMA_COMERCIAL,
        identificador_cliente,
        cliente_base,
        membros,
    )


async def _buscar_cliente_visível(conexao, identificador_cliente: str, identificador_usuario: str):
    pode_ver_todos = await usuario_pode_ver_todos_clientes(conexao, identificador_usuario)
    return await buscar_cliente_por_id(
        conexao,
        ESQUEMA_COMERCIAL,
        identificador_cliente,
        identificador_usuario_visibilidade=identificador_usuario,
        pode_ver_todos=pode_ver_todos,
    )


async def _serializar_cliente_com_midias(conexao, cliente: dict | None) -> dict:
    if not cliente:
        return {}
    identificador_cliente = str(cliente.get("identificador_cliente") or cliente.get("id") or "").strip()
    midias = await listar_midias_cliente(conexao, ESQUEMA_COMERCIAL, identificador_cliente)
    return serializar_cliente(cliente, midias=midias)


@rotas_de_clientes.get("/clientes")
async def listar_clientes(
    request: Request,
    q: str = Query("", description="Busca por nome, cpf, cidade ou email"),
    pagina: int = Query(1, ge=1),
    limite: int = Query(12, ge=1, le=200),
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    deslocamento = (pagina - 1) * limite

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "imoveis.view",
            "Você não tem permissão para visualizar clientes.",
        )

        busca = _normalizar_busca(q)
        pode_ver_todos = await usuario_pode_ver_todos_clientes(conexao, identificador_usuario)
        linhas = await listar_clientes_repo(
            conexao,
            ESQUEMA_COMERCIAL,
            busca=busca,
            limite=limite,
            deslocamento=deslocamento,
            identificador_usuario_visibilidade=identificador_usuario,
            pode_ver_todos=pode_ver_todos,
        )
        total = await contar_clientes(
            conexao,
            ESQUEMA_COMERCIAL,
            busca=busca,
            identificador_usuario_visibilidade=identificador_usuario,
            pode_ver_todos=pode_ver_todos,
        )

    total_paginas = max(1, ceil(total / limite)) if total else 1

    return {
        "items": [serializar_cliente(linha) for linha in linhas],
        "paginacao": {
            "página": pagina,
            "limite": limite,
            "total": total,
            "total_paginas": total_paginas,
            "tem_anterior": pagina > 1,
            "tem_proxima": pagina < total_paginas,
        },
    }


@rotas_de_clientes.get("/clientes/{identificador_cliente}")
async def buscar_cliente(
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
            "imoveis.view",
            "Você não tem permissão para visualizar clientes.",
        )

        cliente = await _buscar_cliente_visível(conexao, identificador_cliente, identificador_usuario)
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

        item = await _serializar_cliente_com_midias(conexao, cliente)

    return {"item": item}


@rotas_de_clientes.post("/clientes", status_code=status.HTTP_201_CREATED)
async def criar_cliente(
    payload: RequisicaoCriarCliente,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "imoveis.create",
            "Você não tem permissão para cadastrar clientes.",
        )

        try:
            dados = normalizar_payload_cliente(_model_payload(payload))
        except ValueError as erro:
            raise HTTPException(status_code=400, detail=str(erro)) from erro

        await _validar_cpf_cliente_disponivel(
            conexao,
            dados.get("cpf_normalizado"),
            identificador_usuario_atual=identificador_usuario,
        )
        responsavel = await obter_usuario_responsavel_cliente(conexao, identificador_usuario)
        dados["identificador_usuario_cadastro"] = responsavel["identificador_usuario"]
        dados["usuario_cadastro_nome"] = responsavel.get("nome_completo")
        dados["usuario_cadastro_email"] = responsavel.get("email")

        try:
            async with conexao.transaction():
                cliente = await criar_cliente_servico(
                    conexao,
                    ESQUEMA_COMERCIAL,
                    dados,
                    membros_composicao=[],
                )
        except asyncpg.UniqueViolationError as erro:
            if getattr(erro, "constraint_name", "") == "uq_cliente_cpf_normalizado":
                raise HTTPException(
                    status_code=409,
                    detail=await _detalhar_cpf_cliente_duplicado(
                        conexao,
                        dados.get("cpf_normalizado"),
                        identificador_usuario_atual=identificador_usuario,
                    ),
                ) from erro
            raise

    return {"mensagem": "Cliente cadastrado com sucesso.", "item": serializar_cliente(cliente)}


@rotas_de_clientes.put("/clientes/{identificador_cliente}")
async def atualizar_cliente(
    identificador_cliente: str,
    payload: RequisicaoAtualizarCliente,
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
            "Você não tem permissão para editar clientes.",
        )

        cliente_atual = await _buscar_cliente_visível(conexao, identificador_cliente, identificador_usuario)
        if not cliente_atual:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

        try:
            dados = normalizar_payload_cliente(_model_payload(payload))
        except ValueError as erro:
            raise HTTPException(status_code=400, detail=str(erro)) from erro

        await _validar_cpf_cliente_disponivel(
            conexao,
            dados.get("cpf_normalizado"),
            identificador_cliente_atual=identificador_cliente,
            identificador_usuario_atual=identificador_usuario,
        )
        membros_atuais = await listar_membros_cliente(
            conexao,
            ESQUEMA_COMERCIAL,
            identificador_cliente,
            incluir_inativos=True,
        )

        try:
            async with conexao.transaction():
                cliente = await atualizar_cliente_servico(
                    conexao,
                    ESQUEMA_COMERCIAL,
                    identificador_cliente,
                    dados,
                    membros_composicao=membros_atuais,
                )
                if not cliente:
                    raise HTTPException(status_code=404, detail="Cliente não encontrado.")
        except asyncpg.UniqueViolationError as erro:
            if getattr(erro, "constraint_name", "") == "uq_cliente_cpf_normalizado":
                raise HTTPException(
                    status_code=409,
                    detail=await _detalhar_cpf_cliente_duplicado(
                        conexao,
                        dados.get("cpf_normalizado"),
                        identificador_usuario_atual=identificador_usuario,
                        identificador_cliente_atual=identificador_cliente,
                    ),
                ) from erro
            raise

        item = await _serializar_cliente_com_midias(conexao, cliente)

    return {"mensagem": "Cliente atualizado com sucesso.", "item": item}


@rotas_de_clientes.delete("/clientes/{identificador_cliente}")
async def remover_cliente(
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
            "imoveis.edit",
            "Você não tem permissão para remover clientes.",
        )

        cliente = await _buscar_cliente_visível(conexao, identificador_cliente, identificador_usuario)
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

        midias = await listar_midias_cliente(conexao, ESQUEMA_COMERCIAL, identificador_cliente)
        vinculos = await resumir_vinculos_exclusao_cliente(conexao, ESQUEMA_COMERCIAL, identificador_cliente)
        if vinculos and (vinculos["reservas_convertidas"] or vinculos["imoveis_vendidos"] or vinculos["vendas_historico"]):
            raise HTTPException(
                status_code=409,
                detail="Este cliente possui venda vinculada e nao pode ser excluido.",
            )

        async with conexao.transaction():
            excluido = await excluir_cliente(conexao, ESQUEMA_COMERCIAL, identificador_cliente)
            if not excluido:
                raise HTTPException(status_code=404, detail="Cliente não encontrado.")

    remover_arquivos_publicos(DIRETORIO_PUBLICO, [item["caminho_arquivo"] for item in midias])

    return {"mensagem": "Cliente removido com sucesso.", "id": identificador_cliente}


@rotas_de_clientes.post("/clientes/{identificador_cliente}/foto", status_code=status.HTTP_201_CREATED)
async def upload_foto_cliente(
    identificador_cliente: str,
    request: Request,
    arquivo: UploadFile = File(...),
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "imoveis.edit",
            "Você não tem permissão para enviar foto do cliente.",
        )

        cliente = await _buscar_cliente_visível(conexao, identificador_cliente, identificador_usuario)
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

        async with conexao.transaction():
            resultado = await substituir_foto_cliente(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_cliente=identificador_cliente,
                arquivo=arquivo,
                diretorio_uploads=CLIENTES_UPLOADS_DIRETORIO,
                url_base_uploads=CLIENTES_UPLOADS_URL_BASE,
                limite_foto_bytes=CLIENTES_TAMANHO_MAXIMO_FOTO_MB * 1024 * 1024,
            )

        item = await _serializar_cliente_com_midias(conexao, cliente)

    remover_arquivos_publicos(
        DIRETORIO_PUBLICO,
        [midia["caminho_arquivo"] for midia in (resultado.get("midias_removidas") or [])],
    )

    return {
        "mensagem": "Foto do cliente atualizada com sucesso.",
        "foto": resultado.get("foto"),
        "item": item,
    }


@rotas_de_clientes.delete("/clientes/{identificador_cliente}/foto/{identificador_midia}")
async def remover_foto_cliente(
    identificador_cliente: str,
    identificador_midia: str,
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
            "Você não tem permissão para remover foto do cliente.",
        )

        cliente = await _buscar_cliente_visível(conexao, identificador_cliente, identificador_usuario)
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

        midia = await buscar_midia_cliente(
            conexao,
            ESQUEMA_COMERCIAL,
            identificador_cliente=identificador_cliente,
            identificador_midia=identificador_midia,
            tipo_arquivo="foto",
        )
        if not midia:
            raise HTTPException(status_code=404, detail="Foto do cliente não encontrada.")

        async with conexao.transaction():
            removida = await excluir_midia_cliente(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_cliente=identificador_cliente,
                identificador_midia=identificador_midia,
                tipo_arquivo="foto",
            )
            if not removida:
                raise HTTPException(status_code=404, detail="Foto do cliente não encontrada.")

        item = await _serializar_cliente_com_midias(conexao, cliente)

    remover_arquivo_publico(DIRETORIO_PUBLICO, midia["caminho_arquivo"])

    return {
        "mensagem": "Foto do cliente removida com sucesso.",
        "id": identificador_midia,
        "item": item,
    }


@rotas_de_clientes.post("/clientes/{identificador_cliente}/documentos", status_code=status.HTTP_201_CREATED)
async def upload_documentos_cliente(
    identificador_cliente: str,
    request: Request,
    arquivos: list[UploadFile] = File(...),
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    if not arquivos:
        raise HTTPException(status_code=400, detail="Selecione ao menos um documento para upload.")

    if len(arquivos) > CLIENTES_TOTAL_MAXIMO_DOCUMENTOS_POR_ENVIO:
        raise HTTPException(
            status_code=400,
            detail=f"Envie no máximo {CLIENTES_TOTAL_MAXIMO_DOCUMENTOS_POR_ENVIO} documentos por vez.",
        )

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "imoveis.edit",
            "Você não tem permissão para enviar documentos do cliente.",
        )

        cliente = await _buscar_cliente_visível(conexao, identificador_cliente, identificador_usuario)
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

        async with conexao.transaction():
            novos_documentos = await salvar_documentos_cliente(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_cliente=identificador_cliente,
                arquivos=arquivos,
                diretorio_uploads=CLIENTES_UPLOADS_DIRETORIO,
                url_base_uploads=CLIENTES_UPLOADS_URL_BASE,
                limite_documento_bytes=CLIENTES_TAMANHO_MAXIMO_DOCUMENTO_MB * 1024 * 1024,
            )

        item = await _serializar_cliente_com_midias(conexao, cliente)

    return {
        "mensagem": "Documentos enviados com sucesso.",
        "novos_documentos": novos_documentos,
        "item": item,
    }


@rotas_de_clientes.delete("/clientes/{identificador_cliente}/documentos/{identificador_midia}")
async def remover_documento_cliente(
    identificador_cliente: str,
    identificador_midia: str,
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
            "Você não tem permissão para remover documentos do cliente.",
        )

        cliente = await _buscar_cliente_visível(conexao, identificador_cliente, identificador_usuario)
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

        midia = await buscar_midia_cliente(
            conexao,
            ESQUEMA_COMERCIAL,
            identificador_cliente=identificador_cliente,
            identificador_midia=identificador_midia,
            tipo_arquivo="documento",
        )
        if not midia:
            raise HTTPException(status_code=404, detail="Documento do cliente não encontrado.")

        async with conexao.transaction():
            removido = await excluir_midia_cliente(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_cliente=identificador_cliente,
                identificador_midia=identificador_midia,
                tipo_arquivo="documento",
            )
            if not removido:
                raise HTTPException(status_code=404, detail="Documento do cliente não encontrado.")

        item = await _serializar_cliente_com_midias(conexao, cliente)

    remover_arquivo_publico(DIRETORIO_PUBLICO, midia["caminho_arquivo"])

    return {
        "mensagem": "Documento removido com sucesso.",
        "id": identificador_midia,
        "item": item,
    }


@rotas_de_clientes.get("/clientes/{identificador_cliente}/composicao-familiar")
async def listar_composicao_familiar(
    identificador_cliente: str,
    request: Request,
    incluir_inativos: bool = Query(True),
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "imoveis.view",
            "Você não tem permissão para visualizar composição familiar.",
        )

        cliente = await _buscar_cliente_visível(conexao, identificador_cliente, identificador_usuario)
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

        membros = await listar_membros_cliente(
            conexao,
            ESQUEMA_COMERCIAL,
            identificador_cliente,
            incluir_inativos=incluir_inativos,
        )

    itens = [serializar_membro(item) for item in membros]
    return {"items": itens, "resumo": _resumo_composicao(itens)}


@rotas_de_clientes.get("/clientes/{identificador_cliente}/composicao-familiar/{identificador_membro}")
async def buscar_membro_composicao(
    identificador_cliente: str,
    identificador_membro: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "imoveis.view",
            "Você não tem permissão para visualizar composição familiar.",
        )

        cliente = await _buscar_cliente_visível(conexao, identificador_cliente, identificador_usuario)
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

        membro = await buscar_membro_por_id(
            conexao,
            ESQUEMA_COMERCIAL,
            identificador_cliente,
            identificador_membro,
        )
        if not membro:
            raise HTTPException(status_code=404, detail="Membro da composição familiar não encontrado.")

    return {"item": serializar_membro(membro)}


@rotas_de_clientes.post(
    "/clientes/{identificador_cliente}/composicao-familiar",
    status_code=status.HTTP_201_CREATED,
)
async def criar_membro_composicao(
    identificador_cliente: str,
    payload: RequisicaoCriarMembroComposicao,
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
            "Você não tem permissão para editar composição familiar.",
        )

        cliente = await _buscar_cliente_visível(conexao, identificador_cliente, identificador_usuario)
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

        try:
            dados = normalizar_payload_membro(_model_payload(payload), endereco_cliente_principal=cliente)
        except ValueError as erro:
            raise HTTPException(status_code=400, detail=str(erro)) from erro

        dados["identificador_cliente_principal"] = identificador_cliente
        await _validar_cpf_membro_disponivel(conexao, dados["cpf_normalizado"], identificador_cliente)

        async with conexao.transaction():
            membro = await criar_membro(conexao, ESQUEMA_COMERCIAL, dados)
            await _sincronizar_renda_total_cliente(
                conexao,
                identificador_cliente,
                cliente_payload=cliente,
            )

    return {
        "mensagem": "Membro da composição familiar adicionado com sucesso.",
        "item": serializar_membro(membro),
    }


@rotas_de_clientes.put("/clientes/{identificador_cliente}/composicao-familiar/{identificador_membro}")
async def atualizar_membro_composicao(
    identificador_cliente: str,
    identificador_membro: str,
    payload: RequisicaoAtualizarMembroComposicao,
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
            "Você não tem permissão para editar composição familiar.",
        )

        cliente = await _buscar_cliente_visível(conexao, identificador_cliente, identificador_usuario)
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

        membro_atual = await buscar_membro_por_id(
            conexao,
            ESQUEMA_COMERCIAL,
            identificador_cliente,
            identificador_membro,
        )
        if not membro_atual:
            raise HTTPException(status_code=404, detail="Membro da composição familiar não encontrado.")

        try:
            dados = normalizar_payload_membro(_model_payload(payload), endereco_cliente_principal=cliente)
        except ValueError as erro:
            raise HTTPException(status_code=400, detail=str(erro)) from erro

        await _validar_cpf_membro_disponivel(
            conexao,
            dados["cpf_normalizado"],
            identificador_cliente,
            identificador_membro_atual=identificador_membro,
        )

        async with conexao.transaction():
            membro = await atualizar_membro(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_cliente,
                identificador_membro,
                dados,
            )
            if not membro:
                raise HTTPException(status_code=404, detail="Membro da composição familiar não encontrado.")
            await _sincronizar_renda_total_cliente(
                conexao,
                identificador_cliente,
                cliente_payload=cliente,
            )

    return {
        "mensagem": "Membro da composição familiar atualizado com sucesso.",
        "item": serializar_membro(membro),
    }


@rotas_de_clientes.patch("/clientes/{identificador_cliente}/composicao-familiar/{identificador_membro}/flags")
async def atualizar_flags_composicao(
    identificador_cliente: str,
    identificador_membro: str,
    payload: RequisicaoAtualizarFlagsMembroComposicao,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    dados = _model_payload(payload)

    if not any(valor is not None for valor in dados.values()):
        raise HTTPException(
            status_code=400,
            detail="Informe ao menos uma flag para atualizacao.",
        )

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "imoveis.edit",
            "Você não tem permissão para editar composição familiar.",
        )

        cliente = await _buscar_cliente_visível(conexao, identificador_cliente, identificador_usuario)
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

        membro = await buscar_membro_por_id(
            conexao,
            ESQUEMA_COMERCIAL,
            identificador_cliente,
            identificador_membro,
        )
        if not membro:
            raise HTTPException(status_code=404, detail="Membro da composição familiar não encontrado.")

        async with conexao.transaction():
            atualizado = await atualizar_flags_membro(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_cliente,
                identificador_membro,
                dados,
            )
            await _sincronizar_renda_total_cliente(
                conexao,
                identificador_cliente,
                cliente_payload=cliente,
            )

    return {
        "mensagem": "Flags da composição familiar atualizadas com sucesso.",
        "item": serializar_membro(atualizado),
    }


@rotas_de_clientes.patch("/clientes/{identificador_cliente}/composicao-familiar/{identificador_membro}/status")
async def atualizar_status_composicao(
    identificador_cliente: str,
    identificador_membro: str,
    payload: RequisicaoAtualizarStatusMembroComposicao,
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
            "Você não tem permissão para editar composição familiar.",
        )

        cliente = await _buscar_cliente_visível(conexao, identificador_cliente, identificador_usuario)
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

        membro = await buscar_membro_por_id(
            conexao,
            ESQUEMA_COMERCIAL,
            identificador_cliente,
            identificador_membro,
        )
        if not membro:
            raise HTTPException(status_code=404, detail="Membro da composição familiar não encontrado.")

        async with conexao.transaction():
            atualizado = await atualizar_status_membro(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_cliente,
                identificador_membro,
                payload.ativo,
            )
            await _sincronizar_renda_total_cliente(
                conexao,
                identificador_cliente,
                cliente_payload=cliente,
            )

    return {
        "mensagem": "Status do membro atualizado com sucesso.",
        "item": serializar_membro(atualizado),
    }


@rotas_de_clientes.delete("/clientes/{identificador_cliente}/composicao-familiar/{identificador_membro}")
async def desvincular_membro_composicao(
    identificador_cliente: str,
    identificador_membro: str,
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
            "Você não tem permissão para editar composição familiar.",
        )

        cliente = await _buscar_cliente_visível(conexao, identificador_cliente, identificador_usuario)
        if not cliente:
            raise HTTPException(status_code=404, detail="Cliente não encontrado.")

        membro = await buscar_membro_por_id(
            conexao,
            ESQUEMA_COMERCIAL,
            identificador_cliente,
            identificador_membro,
        )
        if not membro:
            raise HTTPException(status_code=404, detail="Membro da composição familiar não encontrado.")

        async with conexao.transaction():
            atualizado = await atualizar_status_membro(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_cliente,
                identificador_membro,
                False,
            )
            await _sincronizar_renda_total_cliente(
                conexao,
                identificador_cliente,
                cliente_payload=cliente,
            )

    return {
        "mensagem": "Membro desvinculado com sucesso.",
        "item": serializar_membro(atualizado),
    }
