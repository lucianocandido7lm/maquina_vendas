"""
Rotas do modulo de imoveis.
"""

from __future__ import annotations

import asyncio
import json
from math import ceil
import re
from typing import Any, Iterable
import unicodedata
from urllib.parse import quote, urlencode
from urllib.request import Request as HttpRequest, urlopen

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response

from configuracoes import (
    DIRETORIO_PUBLICO,
    ESQUEMA_COMERCIAL,
    IMOVEIS_IMPORTACAO_TAMANHO_MAXIMO_PLANILHA_MB,
    IMOVEIS_TAMANHO_MAXIMO_IMAGEM_MB,
    IMOVEIS_TAMANHO_MAXIMO_VIDEO_MB,
    IMOVEIS_TOTAL_MAXIMO_ARQUIVOS_POR_ENVIO,
    IMOVEIS_UPLOADS_DIRETORIO,
    IMOVEIS_UPLOADS_URL_BASE,
)
from dependencias import obter_usuario_autenticado
from modelos.imoveis import RequisicaoAtualizarImovel, RequisicaoCriarImovel, RequisicaoRegistrarEvolucaoObra
from repositorios.imoveis import (
    buscar_imovel_por_id,
    buscar_midia_imovel,
    contar_imoveis,
    excluir_imovel,
    excluir_midia_imovel,
    listar_evolucao_obra,
    listar_imoveis as listar_imoveis_repositorio,
    listar_imoveis_para_exportacao,
    listar_midias_imovel,
)
from servicos.imoveis import (
    atualizar_imovel as atualizar_imovel_servico,
    criar_imovel as criar_imovel_servico,
    gerar_arquivo_exportacao_imoveis,
    importar_imoveis_em_lote,
    registrar_evolucao_obra as registrar_evolucao_obra_servico,
    registrar_evolucao_obra_lote_mesmo_endereco as registrar_evolucao_obra_lote_mesmo_endereco_servico,
    remover_arquivo_publico,
    remover_arquivos_publicos,
    salvar_midias_do_imovel,
    serializar_evolucao_obra,
    serializar_imovel,
    serializar_midia,
)
from utilitarios.autorizacao import exigir_permissao_portal, usuario_possui_permissao


rotas_de_imoveis = APIRouter()


def _obter_pool(request: Request):
    pool = getattr(request.app.state, "pool", None)
    if not pool:
        raise HTTPException(status_code=503, detail="Pool indisponivel.")
    return pool


def _normalizar_filtro_texto(valor: str) -> str | None:
    texto = str(valor or "").strip()
    if not texto:
        return None
    return f"%{texto}%"


async def _exigir_qualquer_permissao(
    conexao,
    identificador_usuario: str,
    permissoes: Iterable[str],
    detalhe: str,
) -> None:
    for permissao in permissoes:
        if await usuario_possui_permissao(conexao, identificador_usuario, permissao):
            return

    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detalhe)


def _extrair_primeira_coordenada(payload: Any) -> dict[str, str] | None:
    if not isinstance(payload, dict):
        return None

    itens = payload.get("features")
    if not isinstance(itens, list) or not itens:
        return None

    item = itens[0]
    if not isinstance(item, dict):
        return None

    geometria = item.get("geometry")
    if not isinstance(geometria, dict):
        return None

    coordenadas = geometria.get("coordinates")
    if not isinstance(coordenadas, (list, tuple)) or len(coordenadas) < 2:
        return None

    longitude, latitude = coordenadas[0], coordenadas[1]
    if not isinstance(latitude, (int, float)) or not isinstance(longitude, (int, float)):
        return None

    propriedades = item.get("properties")
    rotulo_partes: list[str] = []
    if isinstance(propriedades, dict):
        for chave in ("name", "city", "state", "country"):
            valor = str(propriedades.get(chave) or "").strip()
            if valor and valor not in rotulo_partes:
                rotulo_partes.append(valor)

    return {
        "lat": str(latitude),
        "lon": str(longitude),
        "rotulo": ", ".join(rotulo_partes),
        "cidade": str(propriedades.get("city") or "").strip() if isinstance(propriedades, dict) else "",
        "estado": str(propriedades.get("state") or "").strip() if isinstance(propriedades, dict) else "",
        "pais": str(propriedades.get("country") or "").strip() if isinstance(propriedades, dict) else "",
        "fonte": "photon",
    }


def _normalizar_texto_geocodificacao(valor: str) -> str:
    texto = str(valor or "").strip()
    if not texto:
        return ""
    texto = unicodedata.normalize("NFD", texto)
    texto = "".join(caractere for caractere in texto if unicodedata.category(caractere) != "Mn")
    texto = re.sub(r"[^a-zA-Z0-9]+", " ", texto).strip().lower()
    return re.sub(r"\s+", " ", texto)


def _partes_consulta_geocodificacao(consulta: str) -> list[str]:
    return [_normalizar_texto_geocodificacao(parte) for parte in str(consulta or "").split(",") if _normalizar_texto_geocodificacao(parte)]


def _resultado_compativel_com_consulta(consulta: str, resultado: dict[str, str] | None) -> bool:
    if not resultado:
        return False

    partes = _partes_consulta_geocodificacao(consulta)
    if len(partes) < 2:
        return True

    cidade_esperada = partes[-3] if len(partes) >= 3 else ""
    estado_esperado = partes[-2] if len(partes) >= 2 else ""
    pais_esperado = partes[-1] if len(partes) >= 1 else ""

    cidade_resultado = _normalizar_texto_geocodificacao(resultado.get("cidade", ""))
    estado_resultado = _normalizar_texto_geocodificacao(resultado.get("estado", ""))
    pais_resultado = _normalizar_texto_geocodificacao(resultado.get("pais", ""))
    rotulo_resultado = _normalizar_texto_geocodificacao(resultado.get("rotulo", ""))

    if pais_esperado and pais_resultado and pais_esperado not in pais_resultado and pais_esperado not in rotulo_resultado:
        return False
    if estado_esperado and estado_esperado not in estado_resultado and estado_esperado not in rotulo_resultado:
        return False
    if cidade_esperada and cidade_esperada not in cidade_resultado and cidade_esperada not in rotulo_resultado:
        return False

    return True


def _consultar_geocodificacao_externa(consulta: str) -> dict[str, str] | None:
    consulta_limpa = " ".join(str(consulta or "").split())
    candidatos: list[str] = []
    consulta_ascii = ", ".join(parte for parte in _partes_consulta_geocodificacao(consulta_limpa) if parte)
    if consulta_ascii:
        candidatos.append(consulta_ascii)

    partes = _partes_consulta_geocodificacao(consulta_limpa)
    if len(partes) >= 3:
        cidade_estado_pais = ", ".join(partes[-3:])
        if cidade_estado_pais and cidade_estado_pais not in candidatos:
            candidatos.append(cidade_estado_pais)

    for candidato in candidatos:
        parametros = urlencode({"limit": "1", "q": candidato})
        url = f"https://photon.komoot.io/api/?{parametros}"
        requisicao = HttpRequest(
            url,
            headers={
                "Accept": "application/json",
                "User-Agent": "7LM Connect Portal/1.0",
            },
        )
        with urlopen(requisicao, timeout=8) as resposta:
            conteudo = resposta.read().decode("utf-8")
        resultado = _extrair_primeira_coordenada(json.loads(conteudo))
        if _resultado_compativel_com_consulta(consulta_limpa or candidato, resultado):
            return resultado

    return None


@rotas_de_imoveis.get("/imoveis")
async def listar_imoveis(
    request: Request,
    q: str = Query("", description="Busca por titulo"),
    cidade: str = Query("", description="Filtro por cidade"),
    bairro: str = Query("", description="Filtro por bairro"),
    status_imovel: str = Query("", alias="status", description="Filtro por status"),
    pagina: int = Query(1, ge=1),
    limite: int = Query(12, ge=1, le=1000),
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
            "Voce nao tem permissao para visualizar imoveis.",
        )

        busca_titulo = _normalizar_filtro_texto(q) or "%%"
        filtro_cidade = _normalizar_filtro_texto(cidade)
        filtro_bairro = _normalizar_filtro_texto(bairro)
        filtro_status = _normalizar_filtro_texto(status_imovel)

        linhas = await listar_imoveis_repositorio(
            conexao,
            ESQUEMA_COMERCIAL,
            busca_titulo=busca_titulo,
            cidade=filtro_cidade,
            bairro=filtro_bairro,
            status=filtro_status,
            limite=limite,
            deslocamento=deslocamento,
        )
        total = await contar_imoveis(
            conexao,
            ESQUEMA_COMERCIAL,
            busca_titulo=busca_titulo,
            cidade=filtro_cidade,
            bairro=filtro_bairro,
            status=filtro_status,
        )

    total_paginas = max(1, ceil(total / limite)) if total else 1

    return {
        "items": [serializar_imovel(linha) for linha in linhas],
        "paginacao": {
            "pagina": pagina,
            "limite": limite,
            "total": total,
            "total_paginas": total_paginas,
            "tem_anterior": pagina > 1,
            "tem_proxima": pagina < total_paginas,
        },
    }


@rotas_de_imoveis.get("/imoveis/exportacao")
async def exportar_imoveis(
    request: Request,
    formato: str = Query("xlsx", description="Formato do arquivo: csv, xlsx ou pdf"),
    q: str = Query("", description="Busca por titulo"),
    cidade: str = Query("", description="Filtro por cidade"),
    bairro: str = Query("", description="Filtro por bairro"),
    status_imovel: str = Query("", alias="status", description="Filtro por status"),
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "imoveis.view",
            "Voce nao tem permissao para exportar imoveis.",
        )

        busca_titulo = _normalizar_filtro_texto(q) or "%%"
        filtro_cidade = _normalizar_filtro_texto(cidade)
        filtro_bairro = _normalizar_filtro_texto(bairro)
        filtro_status = _normalizar_filtro_texto(status_imovel)

        linhas = await listar_imoveis_para_exportacao(
            conexao,
            ESQUEMA_COMERCIAL,
            busca_titulo=busca_titulo,
            cidade=filtro_cidade,
            bairro=filtro_bairro,
            status=filtro_status,
        )

    filtros = {
        "q": q,
        "cidade": cidade,
        "bairro": bairro,
        "status": status_imovel,
    }
    conteudo, media_type, nome_arquivo = gerar_arquivo_exportacao_imoveis(
        formato,
        [serializar_imovel(linha) for linha in linhas],
        filtros,
    )
    nome_arquivo_quoted = quote(nome_arquivo)
    return Response(
        content=conteudo,
        media_type=media_type,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{nome_arquivo}"; '
                f"filename*=UTF-8''{nome_arquivo_quoted}"
            ),
            "Cache-Control": "no-store",
        },
    )


@rotas_de_imoveis.get("/imoveis/geocodificar")
async def geocodificar_localizacao_imovel(
    request: Request,
    q: str = Query("", description="Consulta textual para localizar o imovel"),
    usuario=Depends(obter_usuario_autenticado),
):
    consulta = " ".join(str(q or "").split())
    if len(consulta) < 3:
        raise HTTPException(status_code=400, detail="Informe uma localizacao valida para consultar o mapa.")

    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    async with pool.acquire() as conexao:
        await _exigir_qualquer_permissao(
            conexao,
            identificador_usuario,
            ("imoveis.view", "imoveis.edit", "imoveis.media.manage"),
            "Voce nao tem permissao para consultar a localizacao deste imovel.",
        )

    try:
        resultado = await asyncio.to_thread(_consultar_geocodificacao_externa, consulta)
    except Exception:
        resultado = None

    return {"resultado": resultado}


@rotas_de_imoveis.get("/imoveis/{identificador_imovel}")
async def buscar_imovel(
    identificador_imovel: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    async with pool.acquire() as conexao:
        await _exigir_qualquer_permissao(
            conexao,
            identificador_usuario,
            ("imoveis.view", "imoveis.edit", "imoveis.media.manage"),
            "Voce nao tem permissao para acessar os dados deste imovel.",
        )

        imovel = await buscar_imovel_por_id(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
        if not imovel:
            raise HTTPException(status_code=404, detail="Imovel nao encontrado.")

        midias = await listar_midias_imovel(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
        evolucao_obra = await listar_evolucao_obra(conexao, ESQUEMA_COMERCIAL, identificador_imovel)

    return {"item": serializar_imovel(imovel, midias=midias, evolucao_obra=evolucao_obra)}


@rotas_de_imoveis.get("/imoveis/{identificador_imovel}/evolucao-obra")
async def listar_historico_evolucao_obra(
    identificador_imovel: str,
    request: Request,
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    async with pool.acquire() as conexao:
        await _exigir_qualquer_permissao(
            conexao,
            identificador_usuario,
            ("imoveis.view", "imoveis.edit", "imoveis.media.manage"),
            "Voce nao tem permissao para acessar a evolucao da obra deste imovel.",
        )

        imovel = await buscar_imovel_por_id(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
        if not imovel:
            raise HTTPException(status_code=404, detail="Imovel nao encontrado.")

        historico = await listar_evolucao_obra(conexao, ESQUEMA_COMERCIAL, identificador_imovel)

    return {"items": [serializar_evolucao_obra(item) for item in historico]}


@rotas_de_imoveis.post("/imoveis/{identificador_imovel}/evolucao-obra", status_code=status.HTTP_201_CREATED)
async def registrar_evolucao_obra(
    identificador_imovel: str,
    payload: RequisicaoRegistrarEvolucaoObra,
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
            "Voce nao tem permissao para registrar a evolucao da obra.",
        )

        imovel_atual = await buscar_imovel_por_id(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
        if not imovel_atual:
            raise HTTPException(status_code=404, detail="Imovel nao encontrado.")

        async with conexao.transaction():
            evolucao, imovel = await registrar_evolucao_obra_servico(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_imovel,
                payload.dict(),
                registrado_por=identificador_usuario,
            )

        midias = await listar_midias_imovel(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
        historico = await listar_evolucao_obra(conexao, ESQUEMA_COMERCIAL, identificador_imovel)

    return {
        "mensagem": "Evolucao da obra registrada com sucesso.",
        "evolucao": serializar_evolucao_obra(evolucao),
        "historico": [serializar_evolucao_obra(item) for item in historico],
        "item": serializar_imovel(imovel, midias=midias, evolucao_obra=historico),
    }


@rotas_de_imoveis.post("/imoveis/{identificador_imovel}/evolucao-obra/lote-endereco", status_code=status.HTTP_201_CREATED)
async def registrar_evolucao_obra_lote_endereco(
    identificador_imovel: str,
    payload: RequisicaoRegistrarEvolucaoObra,
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
            "Voce nao tem permissao para registrar a evolucao da obra em lote.",
        )

        async with conexao.transaction():
            resultado = await registrar_evolucao_obra_lote_mesmo_endereco_servico(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_imovel,
                payload.dict(),
                registrado_por=identificador_usuario,
            )
            if not resultado:
                raise HTTPException(status_code=404, detail="Imovel nao encontrado.")

        midias = await listar_midias_imovel(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
        historico = await listar_evolucao_obra(conexao, ESQUEMA_COMERCIAL, identificador_imovel)

    total = resultado["total_atualizados"]
    return {
        "mensagem": f"Evolucao aplicada em {total} imovel(is) do mesmo endereco.",
        "total_atualizados": total,
        "evolucoes": [serializar_evolucao_obra(item) for item in resultado["registros"]],
        "imoveis_atualizados": [serializar_imovel(item) for item in resultado["imoveis"]],
        "historico": [serializar_evolucao_obra(item) for item in historico],
        "item": serializar_imovel(resultado["imovel_referencia"], midias=midias, evolucao_obra=historico),
    }


@rotas_de_imoveis.post("/imoveis", status_code=status.HTTP_201_CREATED)
async def criar_imovel(
    payload: RequisicaoCriarImovel,
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
            "Voce nao tem permissao para cadastrar imoveis.",
        )

        async with conexao.transaction():
            imovel = await criar_imovel_servico(
                conexao,
                ESQUEMA_COMERCIAL,
                payload.dict(),
                registrado_por=identificador_usuario,
            )

    return {"mensagem": "Imovel cadastrado com sucesso.", "item": serializar_imovel(imovel)}


@rotas_de_imoveis.post("/imoveis/importacao")
async def importar_imoveis(
    request: Request,
    arquivo: UploadFile = File(...),
    cidade_padrao: str = Form(...),
    bairro_padrao: str = Form(...),
    estado_padrao: str = Form(""),
    cep_padrao: str = Form(""),
    endereco_base: str = Form(""),
    tipo_imovel_padrao: str = Form("Apartamento"),
    status_padrao: str = Form("Disponivel"),
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]
    conteudo_arquivo = b""

    try:
        conteudo_arquivo = await arquivo.read()
    finally:
        try:
            await arquivo.close()
        except Exception:
            pass

    if not conteudo_arquivo:
        raise HTTPException(status_code=400, detail="Selecione uma planilha Excel para importar.")

    limite_bytes = IMOVEIS_IMPORTACAO_TAMANHO_MAXIMO_PLANILHA_MB * 1024 * 1024
    if len(conteudo_arquivo) > limite_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"A planilha excede o limite de {IMOVEIS_IMPORTACAO_TAMANHO_MAXIMO_PLANILHA_MB} MB.",
        )

    contexto_importacao = {
        "cidade_padrao": cidade_padrao,
        "bairro_padrao": bairro_padrao,
        "estado_padrao": estado_padrao,
        "cep_padrao": cep_padrao,
        "endereco_base": endereco_base,
        "tipo_imovel_padrao": tipo_imovel_padrao,
        "status_padrao": status_padrao,
    }

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "imoveis.create",
            "Voce nao tem permissao para importar imoveis em lote.",
        )

        resumo = await importar_imoveis_em_lote(
            conexao,
            ESQUEMA_COMERCIAL,
            conteudo_arquivo=conteudo_arquivo,
            nome_arquivo=arquivo.filename or "planilha.xlsx",
            contexto=contexto_importacao,
            registrado_por=identificador_usuario,
        )

    mensagem = f"Importacao concluida com {resumo['total_importados']} imovel(is) importado(s)."
    if resumo["total_ignorados"] or resumo["total_erros"]:
        mensagem = (
            f"{mensagem} {resumo['total_ignorados']} linha(s) ignorada(s) "
            f"e {resumo['total_erros']} com erro."
        )

    return {"mensagem": mensagem, "resumo": resumo}


@rotas_de_imoveis.put("/imoveis/{identificador_imovel}")
async def atualizar_imovel(
    identificador_imovel: str,
    payload: RequisicaoAtualizarImovel,
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
            "Voce nao tem permissao para editar imoveis.",
        )

        async with conexao.transaction():
            imovel = await atualizar_imovel_servico(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_imovel,
                payload.dict(),
                registrado_por=identificador_usuario,
            )
            if not imovel:
                raise HTTPException(status_code=404, detail="Imovel nao encontrado.")

        midias = await listar_midias_imovel(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
        evolucao_obra = await listar_evolucao_obra(conexao, ESQUEMA_COMERCIAL, identificador_imovel)

    return {"mensagem": "Imovel atualizado com sucesso.", "item": serializar_imovel(imovel, midias=midias, evolucao_obra=evolucao_obra)}


@rotas_de_imoveis.delete("/imoveis/{identificador_imovel}")
async def remover_imovel(
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
            "imoveis.delete",
            "Voce nao tem permissao para excluir imoveis.",
        )

        imovel = await buscar_imovel_por_id(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
        if not imovel:
            raise HTTPException(status_code=404, detail="Imovel nao encontrado.")

        midias = await listar_midias_imovel(conexao, ESQUEMA_COMERCIAL, identificador_imovel)

        async with conexao.transaction():
            excluido = await excluir_imovel(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
            if not excluido:
                raise HTTPException(status_code=404, detail="Imovel nao encontrado.")

    remover_arquivos_publicos(DIRETORIO_PUBLICO, [midia["caminho_arquivo"] for midia in midias])

    return {"mensagem": "Imovel excluido com sucesso.", "id": identificador_imovel}


@rotas_de_imoveis.post("/imoveis/{identificador_imovel}/midias", status_code=status.HTTP_201_CREATED)
async def upload_midias(
    identificador_imovel: str,
    request: Request,
    arquivos: list[UploadFile] = File(...),
    usuario=Depends(obter_usuario_autenticado),
):
    pool = _obter_pool(request)
    identificador_usuario = usuario["identificador_usuario"]

    if not arquivos:
        raise HTTPException(status_code=400, detail="Selecione ao menos um arquivo para upload.")

    if len(arquivos) > IMOVEIS_TOTAL_MAXIMO_ARQUIVOS_POR_ENVIO:
        raise HTTPException(
            status_code=400,
            detail=f"Envie no maximo {IMOVEIS_TOTAL_MAXIMO_ARQUIVOS_POR_ENVIO} arquivos por vez.",
        )

    async with pool.acquire() as conexao:
        await exigir_permissao_portal(
            conexao,
            identificador_usuario,
            "imoveis.media.manage",
            "Voce nao tem permissao para enviar ou remover midias dos imoveis.",
        )

        imovel = await buscar_imovel_por_id(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
        if not imovel:
            raise HTTPException(status_code=404, detail="Imovel nao encontrado.")

        async with conexao.transaction():
            novas_midias = await salvar_midias_do_imovel(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_imovel=identificador_imovel,
                arquivos=arquivos,
                diretorio_uploads=IMOVEIS_UPLOADS_DIRETORIO,
                diretorio_publico=DIRETORIO_PUBLICO,
                url_base_uploads=IMOVEIS_UPLOADS_URL_BASE,
                limite_imagem_bytes=IMOVEIS_TAMANHO_MAXIMO_IMAGEM_MB * 1024 * 1024,
                limite_video_bytes=IMOVEIS_TAMANHO_MAXIMO_VIDEO_MB * 1024 * 1024,
            )

        midias_atualizadas = await listar_midias_imovel(conexao, ESQUEMA_COMERCIAL, identificador_imovel)

    return {
        "mensagem": "Midias enviadas com sucesso.",
        "novas_midias": novas_midias,
        "midias": [serializar_midia(midia) for midia in midias_atualizadas],
    }


@rotas_de_imoveis.delete("/imoveis/{identificador_imovel}/midias/{identificador_midia}")
async def remover_midia(
    identificador_imovel: str,
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
            "imoveis.media.manage",
            "Voce nao tem permissao para enviar ou remover midias dos imoveis.",
        )

        imovel = await buscar_imovel_por_id(conexao, ESQUEMA_COMERCIAL, identificador_imovel)
        if not imovel:
            raise HTTPException(status_code=404, detail="Imovel nao encontrado.")

        midia = await buscar_midia_imovel(
            conexao,
            ESQUEMA_COMERCIAL,
            identificador_imovel=identificador_imovel,
            identificador_midia=identificador_midia,
        )
        if not midia:
            raise HTTPException(status_code=404, detail="Midia nao encontrada.")

        async with conexao.transaction():
            removida = await excluir_midia_imovel(
                conexao,
                ESQUEMA_COMERCIAL,
                identificador_imovel=identificador_imovel,
                identificador_midia=identificador_midia,
            )
            if not removida:
                raise HTTPException(status_code=404, detail="Midia nao encontrada.")

        midias_atualizadas = await listar_midias_imovel(conexao, ESQUEMA_COMERCIAL, identificador_imovel)

    remover_arquivo_publico(DIRETORIO_PUBLICO, midia["caminho_arquivo"])

    return {
        "mensagem": "Midia removida com sucesso.",
        "id": identificador_midia,
        "midias": [serializar_midia(midia) for midia in midias_atualizadas],
    }
