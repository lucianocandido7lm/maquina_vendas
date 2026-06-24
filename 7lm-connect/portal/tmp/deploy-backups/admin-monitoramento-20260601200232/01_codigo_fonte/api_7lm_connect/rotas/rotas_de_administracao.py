"""
Autor: Willian Elias Franca
Projeto: 7LM Connect - Administracao do Sistema
Observação: tudo vindo do banco, sem mock.
"""

from __future__ import annotations

from base64 import b64decode
from binascii import Error as BinasciiError
from datetime import date, datetime, timezone
from typing import Optional, Any
from uuid import UUID
import json
import time

from fastapi import APIRouter, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from configuracoes import SENHA_PADRAO_USUARIO
from repositorios.usuarios import buscar_usuario_por_chave, listar_usuarios
from servicos.usuarios import (
    atualizar_usuario_manual as atualizar_usuario_manual_servico,
    criar_usuario_manual as criar_usuario_manual_servico,
)
from servicos.funcionarios_acesso import (
    atualizar_status_diario,
    gerar_quadro_diario,
    importar_funcionarios_planilha,
    listar_funcionarios,
    listar_quadro_diario,
    obter_funcionario,
    salvar_funcionario,
)
from utilitarios.autorizacao import obter_acessos_portal_usuario as obter_acessos_portal_usuario_compartilhado
from utilitarios.identificacao_do_cliente import (
    obter_agente_do_usuario,
    obter_endereco_ip,
)
from utilitarios.seguranca import gerar_hash_senha, ler_token_de_acesso

rotas_de_administracao = APIRouter()

_CACHE_USUARIO_AUTENTICADO_TTL_SEGUNDOS = 30
_CACHE_CONTEXTO_ADMIN_TTL_SEGUNDOS = 300
_CACHE_USUARIO_AUTENTICADO: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_CONTEXTO_ADMIN: dict[str, tuple[float, dict[str, Any]]] = {}
_ADMIN_PERMISSOES_VISUALIZACAO = (
    "administracao.view",
    "rh.admin.acessos.view",
    "ACESSO_TOTAL",
    "GERENCIAR_ACESSO",
)
_ADMIN_PERMISSOES_GERENCIAMENTO = (
    "administracao.manage",
    "rh.admin.acessos.manage",
    "ACESSO_TOTAL",
    "GERENCIAR_ACESSO",
)
_FUNCIONARIOS_PERMISSOES_VISUALIZACAO = (
    "funcionarios.acesso.view",
    "funcionarios.acesso.manage",
    "ACESSO_TOTAL",
    "GERENCIAR_ACESSO",
)
_FUNCIONARIOS_PERMISSOES_GERENCIAMENTO = (
    "funcionarios.acesso.manage",
    "ACESSO_TOTAL",
    "GERENCIAR_ACESSO",
)
_ADMIN_FUNCIONARIOS_PERMISSOES_VISUALIZACAO = tuple(
    dict.fromkeys(_ADMIN_PERMISSOES_VISUALIZACAO + _FUNCIONARIOS_PERMISSOES_VISUALIZACAO)
)
_ADMIN_FUNCIONARIOS_PERMISSOES_GERENCIAMENTO = tuple(
    dict.fromkeys(_ADMIN_PERMISSOES_GERENCIAMENTO + _FUNCIONARIOS_PERMISSOES_GERENCIAMENTO)
)


# =========================================================
# MODELOS
# =========================================================

class CorpoCriarUsuarioManual(BaseModel):
    nome_completo: str = Field(..., min_length=3)
    correio_eletronico: str = Field(..., min_length=3, max_length=255)
    senha: str = Field(..., min_length=6)
    matricula: Optional[str] = None
    codigo_setor: Optional[str] = None
    indicador_ativo: bool = True
    indicador_precisa_trocar_senha: bool = False


class CorpoAtualizarUsuarioManual(BaseModel):
    nome_completo: str = Field(..., min_length=3)
    correio_eletronico: str = Field(..., min_length=3, max_length=255)
    matricula: Optional[str] = None
    codigo_setor: Optional[str] = None
    indicador_ativo: bool = True


class CorpoAtribuirPerfilUsuario(BaseModel):
    identificador_perfil: int
    observacao: Optional[str] = None


class CorpoAtribuirPermissaoUsuario(BaseModel):
    identificador_permissao: int
    indicador_permitido: bool
    origem_regra: str = "MANUAL"
    observacao: Optional[str] = None


class CorpoAtribuirPerfilSetor(BaseModel):
    identificador_perfil: int
    observacao: Optional[str] = None


class CorpoForcarTrocaSenha(BaseModel):
    indicador_precisa_trocar_senha: bool = True


class CorpoResetarSenha(BaseModel):
    nova_senha: str = Field(..., min_length=6)
    forcar_troca_na_proxima_entrada: bool = True


class CorpoPerfilPrincipalUsuario(BaseModel):
    identificador_perfil: Optional[int] = None
    limpar_regras_diretas: bool = True
    indicador_ativo: Optional[bool] = None
    forcar_troca_na_proxima_entrada: bool = False


class CorpoFuncionarioAcesso(BaseModel):
    tipo_funcionario: str = Field("FUNCIONARIO", min_length=2, max_length=20)
    tipo_vinculo: Optional[str] = None
    documento: Optional[str] = None
    matricula: Optional[str] = None
    email: Optional[str] = None
    nome: str = Field(..., min_length=2)
    telefone: Optional[str] = None
    cargo: Optional[str] = None
    imobiliaria: Optional[str] = None
    gestor_documento: Optional[str] = None
    gestor_email: Optional[str] = None
    gestor: Optional[str] = None
    coordenador_documento: Optional[str] = None
    coordenador_email: Optional[str] = None
    coordenador: Optional[str] = None
    gerente_documento: Optional[str] = None
    gerente_email: Optional[str] = None
    gerente: Optional[str] = None
    diretor_documento: Optional[str] = None
    diretor_email: Optional[str] = None
    diretor: Optional[str] = None
    regional: Optional[str] = None
    regiao: Optional[str] = None
    ativo_negocio: Optional[bool] = None
    ativo: bool = True
    ativo_login: Optional[bool] = None
    data_admissao: Optional[date] = None
    data_inicio_vigencia: Optional[date] = None
    data_fim_vigencia: Optional[date] = None
    referencia_origem: Optional[str] = None
    origem_planilha: Optional[str] = "MANUAL"
    cadastrado_por: Optional[str] = None
    observacao: Optional[str] = None


class CorpoImportarFuncionariosPlanilha(BaseModel):
    nome_arquivo: Optional[str] = None
    conteudo_base64: str = Field(..., min_length=10)


class CorpoGerarQuadroDiario(BaseModel):
    data_status: Optional[date] = None


class CorpoAtualizarStatusDiario(BaseModel):
    status_operacional: Optional[str] = None
    status_negocio: Optional[str] = None
    status_login: Optional[str] = None
    observacao: Optional[str] = None


class CorpoProvisionarFuncionario(BaseModel):
    senha: str = Field(..., min_length=6)
    identificador_perfil: Optional[int] = None
    codigo_setor: Optional[str] = None
    indicador_ativo: bool = True
    forcar_troca_na_proxima_entrada: bool = True


# =========================================================
# HELPERS
# =========================================================

def _agora_utc() -> datetime:
    return datetime.now(timezone.utc)


def _uuid_ou_none(valor: Optional[str]) -> Optional[UUID]:
    if not valor:
        return None
    try:
        return UUID(str(valor))
    except Exception:
        return None


def _normalizar_texto(valor: Optional[str]) -> str:
    return (valor or "").strip()


def _valor_usuario(usuario: Any, *chaves: str) -> Any:
    dados = dict(usuario or {})
    for chave in chaves:
        if chave in dados:
            return dados.get(chave)
    return None


def _matricula_usuario(usuario: Any) -> Optional[str]:
    return _valor_usuario(usuario, "matricula", "matrícula")


def _decodificar_arquivo_base64(valor: str) -> bytes:
    bruto = _normalizar_texto(valor)
    if "," in bruto and bruto.lower().startswith("data:"):
        bruto = bruto.split(",", 1)[1]
    try:
        return b64decode(bruto, validate=True)
    except (BinasciiError, ValueError) as erro:
        raise HTTPException(status_code=400, detail="Arquivo em base64 invalido.") from erro


def _identificador_legivel_usuario(usuario: dict[str, Any]) -> str:
    return (
        _normalizar_texto(usuario.get("correio_eletronico"))
        or _normalizar_texto(usuario.get("matricula"))
        or _normalizar_texto(usuario.get("matrícula"))
        or str(usuario.get("identificador_usuario") or "usuário")
    )


async def _garantir_setor_catalogado(
    conexao,
    codigo_setor: Optional[str],
    nome_setor: Optional[str] = None,
) -> Optional[str]:
    codigo_normalizado = _normalizar_texto(codigo_setor)
    if not codigo_normalizado:
        return None

    existente = await conexao.fetchval(
        """
        select codigo_setor
        from sevenlm_connect.setor
        where codigo_setor = $1
        limit 1
        """,
        codigo_normalizado,
    )
    if existente:
        return codigo_normalizado

    nome_normalizado = _normalizar_texto(nome_setor)
    if not nome_normalizado:
        return None

    await conexao.execute(
        """
        insert into sevenlm_connect.setor (codigo_setor, nome_setor)
        values ($1, $2)
        on conflict (codigo_setor)
        do update set
            nome_setor = excluded.nome_setor,
            data_hora_atualizado_em = now()
        """,
        codigo_normalizado,
        nome_normalizado,
    )

    return codigo_normalizado


async def _garantir_perfil_existente(conexao, identificador_perfil: int) -> dict[str, Any]:
    perfil = await conexao.fetchrow(
        """
        select
            identificador_perfil,
            nome_perfil,
            descricao_perfil
        from sevenlm_connect.perfil
        where identificador_perfil = $1
        limit 1
        """,
        identificador_perfil,
    )
    if not perfil:
        raise HTTPException(
            status_code=404,
            detail="Perfil informado não foi encontrado."
        )
    return dict(perfil)


async def _garantir_permissao_existente(conexao, identificador_permissao: int) -> dict[str, Any]:
    permissao = await conexao.fetchrow(
        """
        select
            identificador_permissao,
            nome_permissao,
            descricao_permissao
        from sevenlm_connect.permissao
        where identificador_permissao = $1
        limit 1
        """,
        identificador_permissao,
    )
    if not permissao:
        raise HTTPException(
            status_code=404,
            detail="Permissão informada não foi encontrada."
        )
    return dict(permissao)


def _extrair_token_bearer(request: Request) -> str:
    autorizacao = request.headers.get("authorization", "")
    if not autorizacao.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de acesso não informado."
        )
    return autorizacao.split(" ", 1)[1].strip()


def _ler_cache_temporario(cache: dict[str, tuple[float, Any]], chave: str) -> Any:
    registro = cache.get(chave)
    if not registro:
        return None

    expira_em, valor = registro
    if expira_em <= time.monotonic():
        cache.pop(chave, None)
        return None

    return valor


def _gravar_cache_temporario(
    cache: dict[str, tuple[float, Any]],
    chave: str,
    valor: Any,
    ttl_segundos: int,
) -> Any:
    cache[chave] = (time.monotonic() + ttl_segundos, valor)
    return valor


def _chave_cache_usuario_autenticado(
    identificador_usuario: str,
    identificador_sessao: Optional[str],
    exigir_gerenciamento: bool,
) -> str:
    return "|".join(
        [
            str(identificador_usuario or ""),
            str(identificador_sessao or ""),
            "manage" if exigir_gerenciamento else "view",
        ]
    )


async def _usuario_possui_qualquer_permissao(
    conexao,
    identificador_usuario: str,
    nomes_permissao: tuple[str, ...],
) -> bool:
    linha = await conexao.fetchrow(
        """
        select bool_or(
            coalesce(
                sevenlm_connect.fn_usuario_tem_permissao($1::uuid, permissao.nome_permissao),
                false
            )
        ) as possui
        from unnest($2::text[]) as permissao(nome_permissao)
        """,
        identificador_usuario,
        list(nomes_permissao),
    )
    return bool(linha["possui"]) if linha else False


async def _obter_acessos_portal_usuario(
    conexao,
    identificador_usuario: str,
) -> dict[str, bool]:
    return await obter_acessos_portal_usuario_compartilhado(conexao, identificador_usuario)


async def _obter_catalogos_admin(pool) -> dict[str, list[dict[str, Any]]]:
    cache = _ler_cache_temporario(_CACHE_CONTEXTO_ADMIN, "catalogos")
    if cache is not None:
        return cache

    async with pool.acquire() as conexao:
        perfis = await conexao.fetch(
            """
            select
                identificador_perfil as id,
                nome_perfil,
                descricao_perfil
            from sevenlm_connect.perfil
            order by nome_perfil
            """
        )

        permissoes = await conexao.fetch(
            """
            select
                identificador_permissao as id,
                nome_permissao,
                descricao_permissao
            from sevenlm_connect.permissao
            order by nome_permissao
            """
        )

        setores = await conexao.fetch(
            """
            select
                s.codigo_setor,
                coalesce(nullif(s.nome_setor, ''), s.codigo_setor) as nome_setor
            from sevenlm_connect.setor s
            order by nome_setor
            """
        )

        try:
            recursos = await conexao.fetch(
                """
                select
                    identificador_recurso,
                    codigo_modulo,
                    codigo_recurso,
                    nome_recurso,
                    rota_recurso,
                    indicador_ativo
                from sevenlm_connect.portal_recurso
                order by codigo_modulo, ordem_exibicao, nome_recurso
                """
            )
        except Exception:
            recursos = []

    catalogos = {
        "perfis_disponiveis": [dict(r) for r in perfis],
        "permissoes_disponiveis": [dict(r) for r in permissoes],
        "setores_disponiveis": [dict(r) for r in setores],
        "recursos_disponiveis": [dict(r) for r in recursos],
    }

    return _gravar_cache_temporario(
        _CACHE_CONTEXTO_ADMIN,
        "catalogos",
        catalogos,
        _CACHE_CONTEXTO_ADMIN_TTL_SEGUNDOS,
    )


async def _obter_usuario_autenticado_cached(
    request: Request,
    exigir_gerenciamento: bool = False,
) -> dict[str, Any]:
    token = _extrair_token_bearer(request)
    payload = ler_token_de_acesso(token, validar_expiracao=True)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado."
        )

    identificador_usuario = payload.get("sub")
    identificador_sessao = payload.get("sid")

    if not identificador_usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sem identificador de usuário."
        )

    chave_cache = _chave_cache_usuario_autenticado(
        str(identificador_usuario),
        identificador_sessao,
        exigir_gerenciamento,
    )
    cache = _ler_cache_temporario(_CACHE_USUARIO_AUTENTICADO, chave_cache)
    if cache is not None:
        return dict(cache)

    usuario = await _obter_usuario_autenticado(request, exigir_gerenciamento=exigir_gerenciamento)
    return dict(
        _gravar_cache_temporario(
            _CACHE_USUARIO_AUTENTICADO,
            chave_cache,
            dict(usuario),
            _CACHE_USUARIO_AUTENTICADO_TTL_SEGUNDOS,
        )
    )


async def _obter_usuario_autenticado(
    request: Request,
    exigir_gerenciamento: bool = False,
    permissoes_visualizacao: tuple[str, ...] = _ADMIN_PERMISSOES_VISUALIZACAO,
    permissoes_gerenciamento: tuple[str, ...] = _ADMIN_PERMISSOES_GERENCIAMENTO,
    nome_area: str = "Administração",
) -> dict[str, Any]:
    token = _extrair_token_bearer(request)
    payload = ler_token_de_acesso(token, validar_expiracao=True)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado."
        )

    identificador_usuario = payload.get("sub")
    identificador_sessao = payload.get("sid")

    if not identificador_usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sem identificador de usuário."
        )

    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        usuario = await conexao.fetchrow(
            """
            select
                identificador_usuario,
                matricula,
                nome_completo,
                correio_eletronico::text as correio_eletronico,
                indicador_ativo,
                indicador_precisa_trocar_senha,
                data_hora_ultimo_login
            from sevenlm_connect.usuario
            where identificador_usuario = $1::uuid
            """,
            identificador_usuario,
        )

        if not usuario:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuário autenticado não encontrado."
            )

        if not usuario["indicador_ativo"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuário autenticado está inativo."
            )

        pode_ver = await _usuario_possui_qualquer_permissao(
            conexao,
            str(identificador_usuario),
            permissoes_visualizacao,
        )
        pode_gerenciar = await _usuario_possui_qualquer_permissao(
            conexao,
            str(identificador_usuario),
            permissoes_gerenciamento,
        )

        if not pode_ver:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Usuário sem permissão para acessar {nome_area}."
            )

        if exigir_gerenciamento and not pode_gerenciar:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Usuário sem permissão de gerenciamento em {nome_area}."
            )

        return {
            "identificador_usuario": str(usuario["identificador_usuario"]),
            "identificador_sessao": identificador_sessao,
            "matricula": _matricula_usuario(usuario),
            "matrícula": _matricula_usuario(usuario),
            "nome_completo": usuario["nome_completo"],
            "correio_eletronico": usuario["correio_eletronico"],
            "pode_ver": pode_ver,
            "pode_gerenciar": pode_gerenciar,
        }


async def _obter_usuario_funcionarios(
    request: Request,
    exigir_gerenciamento: bool = False,
) -> dict[str, Any]:
    return await _obter_usuario_autenticado(
        request,
        exigir_gerenciamento=exigir_gerenciamento,
        permissoes_visualizacao=_FUNCIONARIOS_PERMISSOES_VISUALIZACAO,
        permissoes_gerenciamento=_FUNCIONARIOS_PERMISSOES_GERENCIAMENTO,
        nome_area="Funcionários",
    )


async def _obter_usuario_portal_autenticado(request: Request) -> dict[str, Any]:
    token = _extrair_token_bearer(request)
    payload = ler_token_de_acesso(token, validar_expiracao=True)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado."
        )

    identificador_usuario = payload.get("sub")
    identificador_sessao = payload.get("sid")

    if not identificador_usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token sem identificador de usuário."
        )

    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        usuario = await conexao.fetchrow(
            """
            select
                identificador_usuario,
                matricula,
                nome_completo,
                correio_eletronico::text as correio_eletronico,
                indicador_ativo,
                indicador_precisa_trocar_senha,
                data_hora_ultimo_login
            from sevenlm_connect.usuario
            where identificador_usuario = $1::uuid
            """,
            identificador_usuario,
        )

        if not usuario:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuário autenticado não encontrado."
            )

        if not usuario["indicador_ativo"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Usuário autenticado está inativo."
            )

        acessos_portal = await _obter_acessos_portal_usuario(
            conexao,
            str(identificador_usuario),
        )
        pode_ver = bool(acessos_portal.get("administracao.view"))
        pode_gerenciar = bool(acessos_portal.get("administracao.manage"))

        return {
            "identificador_usuario": str(usuario["identificador_usuario"]),
            "identificador_sessao": identificador_sessao,
            "matricula": _matricula_usuario(usuario),
            "matrícula": _matricula_usuario(usuario),
            "nome_completo": usuario["nome_completo"],
            "correio_eletronico": usuario["correio_eletronico"],
            "indicador_precisa_trocar_senha": bool(usuario["indicador_precisa_trocar_senha"]),
            "pode_ver": pode_ver,
            "pode_gerenciar": pode_gerenciar,
            "acessos_portal": acessos_portal,
        }


async def _registrar_evento_auditoria(
    conexao,
    request: Request,
    executor: dict[str, Any],
    tipo_evento: str,
    descricao_evento: str,
    detalhes_evento: Optional[dict[str, Any]] = None,
) -> None:
    detalhes_evento_json = json.dumps(
        detalhes_evento or {},
        ensure_ascii=False,
        default=str,
    )
    identificador_sessao = executor.get("identificador_sessao")
    if identificador_sessao:
        sessao_existe = await conexao.fetchval(
            """
            select 1
            from sevenlm_connect.sessao
            where identificador_sessao = $1::uuid
            limit 1
            """,
            identificador_sessao,
        )
        if not sessao_existe:
            identificador_sessao = None

    await conexao.execute(
        """
        insert into sevenlm_connect.auditoria_evento (
            identificador_usuario,
            identificador_sessao,
            tipo_evento,
            descricao_evento,
            detalhes_evento,
            endereco_ip,
            agente_do_usuario,
            data_hora_evento
        )
        values ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6, $7, now())
        """,
        executor["identificador_usuario"],
        identificador_sessao,
        tipo_evento,
        descricao_evento,
        detalhes_evento_json,
        obter_endereco_ip(request),
        obter_agente_do_usuario(request),
    )


async def _obter_quadro_mais_recente_por_matricula(conexao, matricula: str):
    matricula_normalizada = _normalizar_texto(matricula)
    if not matricula_normalizada:
        return None

    linha = await conexao.fetchrow(
        """
        select
            identificador_funcionario::text as identificador_funcionario,
            coalesce(matricula, documento) as cd_matricula,
            nome as no_nome,
            tipo_funcionario as no_cargo,
            tipo_funcionario as no_cargo_resumido,
            data_hora_atualizado_em::date as dt_data,
            case when coalesce(ativo, true) then 'ATIVO' else 'INATIVO' end as no_status_operacional,
            case when ativo_login is true then 'LIBERADO' when ativo_login is false then 'BLOQUEADO' else 'PENDENTE' end as no_status_gip,
            case when ativo_negocio is true then 'SIM' when ativo_negocio is false then 'NAO' else 'PENDENTE' end as no_gh_ativo,
            gestor as no_setor,
            regional as no_subsetor,
            regiao as no_site_nome
        from sevenlm_connect.funcionario_acesso
        where matricula = $1
           or documento = regexp_replace($1, '\\D', '', 'g')
           or lower(coalesce(email::text, '')) = lower($1)
        order by data_hora_atualizado_em desc
        limit 1
        """,
        matricula_normalizada,
    )
    return dict(linha) if linha else None


async def _resolver_usuario_ou_colaborador(conexao, chave: str) -> dict[str, Any]:
    chave = _normalizar_texto(chave)
    if not chave:
        raise HTTPException(status_code=400, detail="Chave do usuário não informada.")

    usuario = await buscar_usuario_por_chave(conexao, "sevenlm_connect", chave)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado."
        )

    quadro = await _obter_quadro_mais_recente_por_matricula(
        conexao,
        _matricula_usuario(usuario) or usuario["correio_eletronico"] or "",
    )

    return {
        "usuário": dict(usuario),
        "quadro": quadro,
        "matricula_referência": _matricula_usuario(usuario) or usuario["identificador_usuario"],
    }


async def _garantir_usuario_existente(conexao, chave: str) -> dict[str, Any]:
    resolvido = await _resolver_usuario_ou_colaborador(conexao, chave)
    usuario = resolvido["usuário"]
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuário não encontrado."
        )
    return resolvido


async def _listar_setores_usuario(conexao, identificador_usuario: Optional[str], matricula_referência: Optional[str]):
    if not identificador_usuario:
        return []

    linhas = await conexao.fetch(
        """
        select distinct
            us.codigo_setor,
            coalesce(s.nome_setor, us.codigo_setor) as nome_setor
        from sevenlm_connect.usuario_setor us
        left join sevenlm_connect.setor s
          on s.codigo_setor = us.codigo_setor
        where us.identificador_usuario = $1::uuid
        order by nome_setor
        """,
        identificador_usuario,
    )

    return [dict(l) for l in linhas]


async def _listar_perfis_usuario(conexao, identificador_usuario: str):
    linhas = await conexao.fetch(
        """
        select
            up.identificador_perfil,
            p.nome_perfil,
            p.descricao_perfil,
            'USUARIO' as origem,
            up.data_hora_concedido_em
        from sevenlm_connect.usuario_perfil up
        join sevenlm_connect.perfil p
          on p.identificador_perfil = up.identificador_perfil
        where up.identificador_usuario = $1::uuid
        order by p.nome_perfil
        """,
        identificador_usuario,
    )
    return [dict(l) for l in linhas]


async def _listar_permissoes_diretas(conexao, identificador_usuario: str):
    linhas = await conexao.fetch(
        """
        select
            up.identificador_permissao,
            p.nome_permissao,
            p.descricao_permissao,
            up.indicador_permitido,
            up.origem_regra,
            up.observacao,
            up.data_hora_concedido_em,
            up.data_hora_revogado_em
        from sevenlm_connect.usuario_permissao up
        join sevenlm_connect.permissao p
          on p.identificador_permissao = up.identificador_permissao
        where up.identificador_usuario = $1::uuid
          and up.data_hora_revogado_em is null
        order by p.nome_permissao
        """,
        identificador_usuario,
    )
    return [dict(l) for l in linhas]


async def _listar_setores_perfis(conexao, setores: list[dict[str, Any]]):
    resultado = []

    for setor in setores:
        linhas = await conexao.fetch(
            """
            select
                p.nome_perfil
            from sevenlm_connect.setor_perfil sp
            join sevenlm_connect.perfil p
              on p.identificador_perfil = sp.identificador_perfil
            where sp.codigo_setor = $1
              and coalesce(sp.indicador_ativo, true) = true
            order by p.nome_perfil
            """,
            setor["codigo_setor"],
        )

        resultado.append({
            "codigo_setor": setor["codigo_setor"],
            "nome_setor": setor["nome_setor"],
            "perfis": [l["nome_perfil"] for l in linhas]
        })

    return resultado


async def _listar_acesso_efetivo(conexao, identificador_usuario: str):
    try:
        linhas = await conexao.fetch(
            """
            select
                pr.codigo_modulo,
                pr.codigo_recurso,
                pr.nome_recurso,
                pr.rota_recurso,
                pr.indicador_em_construcao,
                pr.icone_recurso,
                sevenlm_connect.fn_usuario_pode_visualizar_recurso($1::uuid, pr.codigo_modulo, pr.codigo_recurso) as pode_visualizar,
                case
                    when pr.identificador_permissao_gerenciar is not null
                    then sevenlm_connect.fn_usuario_tem_permissao($1::uuid, pmg.nome_permissao)
                    else false
                end as pode_gerenciar
            from sevenlm_connect.portal_recurso pr
            left join sevenlm_connect.permissao pmg
              on pmg.identificador_permissao = pr.identificador_permissao_gerenciar
            where pr.indicador_ativo = true
            order by pr.codigo_modulo, pr.ordem_exibicao, pr.nome_recurso
            """,
            identificador_usuario,
        )
    except Exception:
        return []

    resposta = []
    for linha in linhas:
        item = dict(linha)
        acoes = []
        if item.get("pode_visualizar"):
            acoes.append("view")
        if item.get("pode_gerenciar"):
            acoes.append("manage")
        item["acoes"] = acoes
        resposta.append(item)

    return resposta


# =========================================================
# ROTAS AUXILIARES
# =========================================================

@rotas_de_administracao.get("/me")
async def me(request: Request):
    usuario = await _obter_usuario_portal_autenticado(request)
    return {"usuario": usuario, "usuário": usuario}


@rotas_de_administracao.get("/admin/contexto")
async def admin_contexto(request: Request):
    usuario = await _obter_usuario_autenticado(
        request,
        exigir_gerenciamento=False,
        permissoes_visualizacao=_ADMIN_FUNCIONARIOS_PERMISSOES_VISUALIZACAO,
        permissoes_gerenciamento=_ADMIN_FUNCIONARIOS_PERMISSOES_GERENCIAMENTO,
        nome_area="Administração ou Funcionários",
    )
    pool = request.app.state.pool
    catalogos = await _obter_catalogos_admin(pool)

    return {
        "allowed": True,
        "manage": usuario["pode_gerenciar"],
        "usuario_logado": usuario,
        **catalogos,
    }


# =========================================================
# FUNCIONARIOS / QUADRO DIARIO
# =========================================================

@rotas_de_administracao.get("/admin/funcionarios")
async def listar_funcionarios_admin(
    request: Request,
    q: str = Query("", description="Busca por nome, e-mail, documento, matricula ou lideranca"),
    tipo: str = Query("", description="FUNCIONARIO, CORRETOR, SDR ou OUTRO"),
    status: str = Query("", description="ATIVO, INATIVO, COM_LOGIN ou SEM_LOGIN"),
    vinculo: str = Query("", description="CLT, PJ ou AUTONOMO"),
    imobiliaria: str = Query("", description="Filtro por imobiliaria"),
    login: str = Query("", description="LIBERADO, BLOQUEADO, SEM_EMAIL ou PENDENTE"),
    limite: int = Query(150, ge=1, le=1000),
):
    await _obter_usuario_funcionarios(request, exigir_gerenciamento=False)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        items = await listar_funcionarios(
            conexao,
            termo=q,
            tipo=tipo,
            status=status,
            vinculo=vinculo,
            imobiliaria=imobiliaria,
            login=login,
            limite=limite,
        )

    return {"items": items}


@rotas_de_administracao.post("/admin/funcionarios")
async def criar_funcionario_admin(
    corpo: CorpoFuncionarioAcesso,
    request: Request,
):
    executor = await _obter_usuario_funcionarios(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        async with conexao.transaction():
            funcionario, criado = await salvar_funcionario(conexao, corpo.dict())
            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_FUNCIONARIO_CRIADO" if criado else "ADMIN_FUNCIONARIO_ATUALIZADO",
                descricao_evento=f"Funcionario {funcionario.get('nome')} salvo no cadastro de funcionarios.",
                detalhes_evento={
                    "identificador_funcionario": funcionario.get("identificador_funcionario"),
                    "tipo_funcionario": funcionario.get("tipo_funcionario"),
                    "tipo_vinculo": funcionario.get("tipo_vinculo"),
                    "email": funcionario.get("email"),
                    "documento": funcionario.get("documento"),
                    "matricula": funcionario.get("matricula"),
                    "telefone": funcionario.get("telefone"),
                },
            )

    return {"mensagem": "Funcionario salvo com sucesso.", "funcionario": funcionario}


@rotas_de_administracao.put("/admin/funcionarios/{identificador_funcionario}")
async def atualizar_funcionario_admin(
    identificador_funcionario: str,
    corpo: CorpoFuncionarioAcesso,
    request: Request,
):
    executor = await _obter_usuario_funcionarios(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        async with conexao.transaction():
            funcionario, _ = await salvar_funcionario(
                conexao,
                corpo.dict(),
                identificador_funcionario=identificador_funcionario,
            )
            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_FUNCIONARIO_ATUALIZADO",
                descricao_evento=f"Funcionario {funcionario.get('nome')} atualizado no cadastro de funcionarios.",
                detalhes_evento={
                    "identificador_funcionario": funcionario.get("identificador_funcionario"),
                    "tipo_funcionario": funcionario.get("tipo_funcionario"),
                    "tipo_vinculo": funcionario.get("tipo_vinculo"),
                    "email": funcionario.get("email"),
                    "documento": funcionario.get("documento"),
                    "matricula": funcionario.get("matricula"),
                    "telefone": funcionario.get("telefone"),
                },
            )

    return {"mensagem": "Funcionario atualizado com sucesso.", "funcionario": funcionario}


@rotas_de_administracao.post("/admin/funcionarios/importar-planilha")
async def importar_funcionarios_admin(
    corpo: CorpoImportarFuncionariosPlanilha,
    request: Request,
):
    executor = await _obter_usuario_funcionarios(request, exigir_gerenciamento=True)
    conteudo = _decodificar_arquivo_base64(corpo.conteudo_base64)

    if len(conteudo) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Planilha acima do limite de 20 MB.")

    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        async with conexao.transaction():
            resultado = await importar_funcionarios_planilha(conexao, conteudo)
            await gerar_quadro_diario(conexao, date.today())
            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_FUNCIONARIOS_IMPORTADOS",
                descricao_evento="Planilha de funcionarios importada no cadastro de funcionarios.",
                detalhes_evento={
                    "nome_arquivo": corpo.nome_arquivo,
                    **resultado,
                },
            )

    return {
        "mensagem": "Planilha importada com sucesso.",
        **resultado,
    }


@rotas_de_administracao.post("/admin/funcionarios/{identificador_funcionario}/provisionar")
async def provisionar_funcionario_admin(
    identificador_funcionario: str,
    corpo: CorpoProvisionarFuncionario,
    request: Request,
):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        async with conexao.transaction():
            funcionario = await obter_funcionario(conexao, identificador_funcionario)
            email = _normalizar_texto(funcionario.get("email"))
            documento = _normalizar_texto(funcionario.get("documento"))
            matricula = _normalizar_texto(funcionario.get("matricula"))
            nome = _normalizar_texto(funcionario.get("nome"))

            if not email:
                raise HTTPException(status_code=422, detail="Funcionario sem e-mail nao pode receber login.")

            usuario = await buscar_usuario_por_chave(conexao, "sevenlm_connect", email)
            if not usuario and documento:
                usuario = await buscar_usuario_por_chave(conexao, "sevenlm_connect", documento)

            if usuario:
                identificador_usuario = str(usuario["identificador_usuario"])
                await conexao.execute(
                    """
                    update sevenlm_connect.usuario
                       set indicador_ativo = $2,
                           indicador_precisa_trocar_senha = $3
                     where identificador_usuario = $1::uuid
                    """,
                    identificador_usuario,
                    corpo.indicador_ativo,
                    corpo.forcar_troca_na_proxima_entrada,
                )
            else:
                novo = await criar_usuario_manual_servico(
                    conexao,
                    "sevenlm_connect",
                    nome_completo=nome,
                    correio_eletronico=email,
                    senha=corpo.senha,
                    matricula=matricula or documento or None,
                    indicador_ativo=corpo.indicador_ativo,
                    indicador_precisa_trocar_senha=corpo.forcar_troca_na_proxima_entrada,
                )
                identificador_usuario = str(novo["identificador_usuario"])

            codigo_setor = _normalizar_texto(corpo.codigo_setor)
            if codigo_setor:
                codigo_setor = await _garantir_setor_catalogado(conexao, codigo_setor, codigo_setor)
                if codigo_setor:
                    await conexao.execute(
                        """
                        insert into sevenlm_connect.usuario_setor (
                            identificador_usuario,
                            codigo_setor
                        )
                        values ($1::uuid, $2)
                        on conflict do nothing
                        """,
                        identificador_usuario,
                        codigo_setor,
                    )

            if corpo.identificador_perfil:
                await _garantir_perfil_existente(conexao, corpo.identificador_perfil)
                await conexao.execute(
                    """
                    insert into sevenlm_connect.usuario_perfil (
                        identificador_usuario,
                        identificador_perfil
                    )
                    values ($1::uuid, $2)
                    on conflict do nothing
                    """,
                    identificador_usuario,
                    corpo.identificador_perfil,
                )

            await conexao.execute(
                """
                update sevenlm_connect.funcionario_acesso
                   set identificador_usuario = $2::uuid,
                       ativo_login = true,
                       data_hora_atualizado_em = now()
                 where identificador_funcionario = $1::uuid
                """,
                identificador_funcionario,
                identificador_usuario,
            )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_FUNCIONARIO_PROVISIONADO",
                descricao_evento=f"Acesso de portal provisionado para {nome}.",
                detalhes_evento={
                    "identificador_funcionario": identificador_funcionario,
                    "identificador_usuario": identificador_usuario,
                    "email": email,
                    "codigo_setor": codigo_setor,
                    "identificador_perfil": corpo.identificador_perfil,
                },
            )

    return {
        "mensagem": "Acesso provisionado com sucesso.",
        "identificador_usuario": identificador_usuario,
    }


@rotas_de_administracao.get("/admin/funcionarios/quadro-diario")
async def listar_quadro_diario_admin(
    request: Request,
    data_status: Optional[date] = Query(None),
    q: str = Query(""),
    tipo: str = Query(""),
):
    await _obter_usuario_funcionarios(request, exigir_gerenciamento=False)
    data_referencia = data_status or date.today()
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        items = await listar_quadro_diario(conexao, data_referencia, termo=q, tipo=tipo)

    return {"items": items, "data_status": data_referencia}


@rotas_de_administracao.post("/admin/funcionarios/quadro-diario/gerar")
async def gerar_quadro_diario_admin(
    corpo: CorpoGerarQuadroDiario,
    request: Request,
):
    executor = await _obter_usuario_funcionarios(request, exigir_gerenciamento=True)
    data_status = corpo.data_status or date.today()
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        async with conexao.transaction():
            novos = await gerar_quadro_diario(conexao, data_status)
            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_QUADRO_DIARIO_GERADO",
                descricao_evento=f"Quadro diario de funcionarios gerado para {data_status}.",
                detalhes_evento={
                    "data_status": str(data_status),
                    "novas_linhas": novos,
                },
            )
            items = await listar_quadro_diario(conexao, data_status)

    return {
        "mensagem": "Quadro diario gerado com sucesso.",
        "novas_linhas": novos,
        "items": items,
        "data_status": data_status,
    }


@rotas_de_administracao.put("/admin/funcionarios/quadro-diario/{identificador_status}")
async def atualizar_quadro_diario_admin(
    identificador_status: str,
    corpo: CorpoAtualizarStatusDiario,
    request: Request,
):
    executor = await _obter_usuario_funcionarios(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        async with conexao.transaction():
            item = await atualizar_status_diario(
                conexao,
                identificador_status=identificador_status,
                status_operacional=corpo.status_operacional,
                status_negocio=corpo.status_negocio,
                status_login=corpo.status_login,
                observacao=corpo.observacao,
                atualizado_por=executor["identificador_usuario"],
            )
            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_QUADRO_DIARIO_ATUALIZADO",
                descricao_evento="Linha do quadro diario de funcionarios atualizada.",
                detalhes_evento={
                    "identificador_status": identificador_status,
                    "status_operacional": corpo.status_operacional,
                    "status_negocio": corpo.status_negocio,
                    "status_login": corpo.status_login,
                },
            )

    return {"mensagem": "Quadro diario atualizado com sucesso.", "item": item}


# =========================================================
# BUSCA / DETALHE
# =========================================================

@rotas_de_administracao.get("/admin/usuarios")
async def buscar_usuarios(
    request: Request,
    q: str = Query("", description="Busca por nome, e-mail, matrícula ou identificador"),
    limite: int = Query(20, ge=1, le=100),
):
    await _obter_usuario_autenticado(request, exigir_gerenciamento=False)
    pool = request.app.state.pool

    termo = f"%{_normalizar_texto(q)}%"

    async with pool.acquire() as conexao:
        linhas = await listar_usuarios(conexao, "sevenlm_connect", termo, limite)

    return {
        "items": [
            {
                **dict(l),
                "origem_cadastro": "USUARIO_MANUAL",
                "requer_provisionamento": False,
            }
            for l in linhas
        ]
    }


@rotas_de_administracao.get("/admin/usuarios/{chave}")
async def detalhar_usuario(chave: str, request: Request):
    await _obter_usuario_autenticado(request, exigir_gerenciamento=False)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        resolvido = await _resolver_usuario_ou_colaborador(conexao, chave)
        usuario = resolvido["usuário"]
        quadro = resolvido.get("quadro")
        matricula_referência = resolvido["matricula_referência"]

        identificador_usuario = str(usuario["identificador_usuario"]) if usuario else None

        setores = await _listar_setores_usuario(conexao, identificador_usuario, matricula_referência)
        perfis = await _listar_perfis_usuario(conexao, identificador_usuario) if identificador_usuario else []
        permissoes_diretas = await _listar_permissoes_diretas(conexao, identificador_usuario) if identificador_usuario else []
        setores_perfis = await _listar_setores_perfis(conexao, setores)
        acesso_efetivo = await _listar_acesso_efetivo(conexao, identificador_usuario) if identificador_usuario else []
    usuario_resposta = {
        "identificador_usuario": str(usuario["identificador_usuario"]),
        "matricula": _matricula_usuario(usuario),
        "matrícula": _matricula_usuario(usuario),
        "nome_completo": usuario["nome_completo"],
        "correio_eletronico": usuario["correio_eletronico"],
        "indicador_ativo": usuario["indicador_ativo"],
        "indicador_precisa_trocar_senha": usuario["indicador_precisa_trocar_senha"],
        "indicador_mfa_habilitado": usuario["indicador_mfa_habilitado"],
        "quantidade_falhas_consecutivas": usuario["quantidade_falhas_consecutivas"],
        "data_hora_bloqueado_ate": usuario["data_hora_bloqueado_ate"],
        "data_hora_ultimo_login": usuario["data_hora_ultimo_login"],
        "origem_cadastro": "USUARIO_MANUAL",
        "requer_provisionamento": False,
        "elegivel_por_quadro": bool(quadro),
        "pode_acessar_portal": bool(usuario["indicador_ativo"]),
    }

    return {
        "usuario": usuario_resposta,
        "usuário": usuario_resposta,
        "quadro": quadro,
        "setores": setores,
        "perfis": perfis,
        "permissoes_diretas": permissoes_diretas,
        "setores_perfis": setores_perfis,
        "acesso_efetivo": acesso_efetivo,
    }


# =========================================================
# PROVISIONAMENTO / CRIAÇÃO DE USUÁRIO
# =========================================================

@rotas_de_administracao.post("/admin/usuarios")
@rotas_de_administracao.post("/admin/usuarios/externo")
async def criar_usuario_manual(
    corpo: CorpoCriarUsuarioManual,
    request: Request,
):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        async with conexao.transaction():
            novo = await criar_usuario_manual_servico(
                conexao,
                "sevenlm_connect",
                nome_completo=corpo.nome_completo,
                correio_eletronico=corpo.correio_eletronico,
                senha=corpo.senha,
                matricula=corpo.matricula,
                indicador_ativo=corpo.indicador_ativo,
                indicador_precisa_trocar_senha=corpo.indicador_precisa_trocar_senha,
            )

            codigo_setor_sincronizado = None
            if _normalizar_texto(corpo.codigo_setor):
                codigo_setor_sincronizado = await _garantir_setor_catalogado(
                    conexao,
                    corpo.codigo_setor,
                )
                if not codigo_setor_sincronizado:
                    raise HTTPException(
                        status_code=409,
                        detail="O setor informado não está catalogado e não pôde ser sincronizado."
                    )

            if codigo_setor_sincronizado:
                await conexao.execute(
                    """
                    insert into sevenlm_connect.usuario_setor (
                        identificador_usuario,
                        codigo_setor
                    )
                    values ($1::uuid, $2)
                    on conflict do nothing
                    """,
                    str(novo["identificador_usuario"]),
                    codigo_setor_sincronizado,
                )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_USUARIO_MANUAL_CRIADO",
                descricao_evento=f"Usuário manual criado para {_identificador_legivel_usuario(dict(novo))}.",
                detalhes_evento={
                    "identificador_usuario_alvo": str(novo["identificador_usuario"]),
                    "nome_completo": corpo.nome_completo,
                    "correio_eletronico": corpo.correio_eletronico,
                    "matrícula": corpo.matricula,
                    "codigo_setor": codigo_setor_sincronizado,
                    "indicador_ativo": corpo.indicador_ativo,
                },
            )

    return {
        "mensagem": "Usuário criado com sucesso.",
        "usuário": dict(novo),
    }


@rotas_de_administracao.put("/admin/usuarios/{chave}")
async def atualizar_usuario_manual(
    chave: str,
    corpo: CorpoAtualizarUsuarioManual,
    request: Request,
):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        resolvido = await _garantir_usuario_existente(conexao, chave)
        usuario = resolvido["usuário"]

        async with conexao.transaction():
            atualizado = await atualizar_usuario_manual_servico(
                conexao,
                "sevenlm_connect",
                identificador_usuario=str(usuario["identificador_usuario"]),
                nome_completo=corpo.nome_completo,
                correio_eletronico=corpo.correio_eletronico,
                matricula=corpo.matricula,
                indicador_ativo=corpo.indicador_ativo,
            )

            await conexao.execute(
                """
                delete from sevenlm_connect.usuario_setor
                where identificador_usuario = $1::uuid
                """,
                str(usuario["identificador_usuario"]),
            )

            codigo_setor_sincronizado = None
            if _normalizar_texto(corpo.codigo_setor):
                codigo_setor_sincronizado = await _garantir_setor_catalogado(
                    conexao,
                    corpo.codigo_setor,
                )
                if not codigo_setor_sincronizado:
                    raise HTTPException(
                        status_code=409,
                        detail="O setor informado não ésta catalogado e não pode ser utilizado."
                    )

                await conexao.execute(
                    """
                    insert into sevenlm_connect.usuario_setor (
                        identificador_usuario,
                        codigo_setor
                    )
                    values ($1::uuid, $2)
                    on conflict do nothing
                    """,
                    str(usuario["identificador_usuario"]),
                    codigo_setor_sincronizado,
                )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_USUARIO_MANUAL_ATUALIZADO",
                descricao_evento=f"Usuário {_identificador_legivel_usuario(dict(atualizado))} atualizado manualmente.",
                detalhes_evento={
                    "identificador_usuario_alvo": str(usuario["identificador_usuario"]),
                    "nome_completo": corpo.nome_completo,
                    "correio_eletronico": corpo.correio_eletronico,
                    "matrícula": corpo.matricula,
                    "codigo_setor": codigo_setor_sincronizado,
                    "indicador_ativo": corpo.indicador_ativo,
                },
            )

    return {
        "mensagem": "Usuário atualizado com sucesso.",
        "usuário": dict(atualizado),
    }


# =========================================================
# PERFIS / PERMISSÕES / SETOR
# =========================================================

@rotas_de_administracao.post("/admin/usuarios/{chave}/perfis")
async def atribuir_perfil_usuario(
    chave: str,
    corpo: CorpoAtribuirPerfilUsuario,
    request: Request,
):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        resolvido = await _garantir_usuario_existente(conexao, chave)
        usuario = resolvido["usuário"]
        await _garantir_perfil_existente(conexao, corpo.identificador_perfil)

        async with conexao.transaction():
            await conexao.execute(
                """
                insert into sevenlm_connect.usuario_perfil (
                    identificador_usuario,
                    identificador_perfil
                )
                values ($1::uuid, $2)
                on conflict do nothing
                """,
                str(usuario["identificador_usuario"]),
                corpo.identificador_perfil,
            )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_PERFIL_ATRIBUIDO_USUARIO",
                descricao_evento=f"Perfil {corpo.identificador_perfil} atribuido ao usuário {_identificador_legivel_usuario(usuario)}.",
                detalhes_evento={
                    "identificador_usuario_alvo": str(usuario["identificador_usuario"]),
                    "identificador_alvo": _identificador_legivel_usuario(usuario),
                    "identificador_perfil": corpo.identificador_perfil,
                    "observação": corpo.observacao,
                },
            )

    return {"mensagem": "Perfil atribuído com sucesso."}


@rotas_de_administracao.delete("/admin/usuarios/{chave}/perfis/{identificador_perfil}")
async def remover_perfil_usuario(
    chave: str,
    identificador_perfil: int,
    request: Request,
):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        resolvido = await _garantir_usuario_existente(conexao, chave)
        usuario = resolvido["usuário"]

        async with conexao.transaction():
            await conexao.execute(
                """
                delete from sevenlm_connect.usuario_perfil
                where identificador_usuario = $1::uuid
                  and identificador_perfil = $2
                """,
                str(usuario["identificador_usuario"]),
                identificador_perfil,
            )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_PERFIL_REMOVIDO_USUARIO",
                descricao_evento=f"Perfil {identificador_perfil} removido do usuário {_identificador_legivel_usuario(usuario)}.",
                detalhes_evento={
                    "identificador_usuario_alvo": str(usuario["identificador_usuario"]),
                    "identificador_alvo": _identificador_legivel_usuario(usuario),
                    "identificador_perfil": identificador_perfil,
                },
            )

    return {"mensagem": "Perfil removido com sucesso."}


@rotas_de_administracao.put("/admin/usuarios/{chave}/perfil-principal")
async def definir_perfil_principal_usuario(
    chave: str,
    corpo: CorpoPerfilPrincipalUsuario,
    request: Request,
):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        resolvido = await _garantir_usuario_existente(conexao, chave)
        usuario = resolvido["usuário"]
        identificador_usuario = str(usuario["identificador_usuario"])
        identificador_executor = str(executor.get("identificador_usuario") or "")

        if corpo.identificador_perfil:
            await _garantir_perfil_existente(conexao, corpo.identificador_perfil)

        if identificador_usuario == identificador_executor and not corpo.identificador_perfil:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Não é permitido remover o próprio perfil administrativo nesta tela.",
            )

        async with conexao.transaction():
            await conexao.execute(
                """
                delete from sevenlm_connect.usuario_perfil
                where identificador_usuario = $1::uuid
                """,
                identificador_usuario,
            )

            if corpo.identificador_perfil:
                await conexao.execute(
                    """
                    insert into sevenlm_connect.usuario_perfil (
                        identificador_usuario,
                        identificador_perfil
                    )
                    values ($1::uuid, $2)
                    on conflict do nothing
                    """,
                    identificador_usuario,
                    corpo.identificador_perfil,
                )

            if corpo.limpar_regras_diretas:
                await conexao.execute(
                    """
                    update sevenlm_connect.usuario_permissao
                       set data_hora_revogado_em = now(),
                           identificador_usuario_responsavel = $2::uuid
                     where identificador_usuario = $1::uuid
                       and data_hora_revogado_em is null
                    """,
                    identificador_usuario,
                    identificador_executor,
                )

            if corpo.indicador_ativo is not None:
                await conexao.execute(
                    """
                    update sevenlm_connect.usuario
                       set indicador_ativo = $2,
                           indicador_precisa_trocar_senha = case
                               when $3 then true
                               else indicador_precisa_trocar_senha
                           end
                     where identificador_usuario = $1::uuid
                    """,
                    identificador_usuario,
                    corpo.indicador_ativo,
                    corpo.forcar_troca_na_proxima_entrada,
                )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_PERFIL_PRINCIPAL_DEFINIDO",
                descricao_evento=f"Perfil principal definido para {_identificador_legivel_usuario(usuario)}.",
                detalhes_evento={
                    "identificador_usuario_alvo": identificador_usuario,
                    "identificador_alvo": _identificador_legivel_usuario(usuario),
                    "identificador_perfil": corpo.identificador_perfil,
                    "limpar_regras_diretas": corpo.limpar_regras_diretas,
                    "indicador_ativo": corpo.indicador_ativo,
                    "forcar_troca_na_proxima_entrada": corpo.forcar_troca_na_proxima_entrada,
                },
            )

    _CACHE_USUARIO_AUTENTICADO.clear()
    return {"mensagem": "Liberação de acesso atualizada com sucesso."}


@rotas_de_administracao.post("/admin/usuarios/{chave}/permissoes")
async def atribuir_permissao_direta_usuario(
    chave: str,
    corpo: CorpoAtribuirPermissaoUsuario,
    request: Request,
):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        resolvido = await _garantir_usuario_existente(conexao, chave)
        usuario = resolvido["usuário"]
        await _garantir_permissao_existente(conexao, corpo.identificador_permissao)

        async with conexao.transaction():
            await conexao.execute(
                """
                insert into sevenlm_connect.usuario_permissao (
                    identificador_usuario,
                    identificador_permissao,
                    indicador_permitido,
                    origem_regra,
                    identificador_usuario_responsavel,
                    observacao,
                    data_hora_revogado_em
                )
                values ($1::uuid, $2, $3, $4, $5::uuid, $6, null)
                on conflict (identificador_usuario, identificador_permissao)
                do update set
                    indicador_permitido = excluded.indicador_permitido,
                    origem_regra = excluded.origem_regra,
                    identificador_usuario_responsavel = excluded.identificador_usuario_responsavel,
                    observacao = excluded.observacao,
                    data_hora_concedido_em = now(),
                    data_hora_revogado_em = null
                """,
                str(usuario["identificador_usuario"]),
                corpo.identificador_permissao,
                corpo.indicador_permitido,
                corpo.origem_regra,
                executor["identificador_usuario"],
                corpo.observacao,
            )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_PERMISSAO_DIRETA_ATRIBUIDA",
                descricao_evento=f"Permissão {corpo.identificador_permissao} atribuída ao usuário {_identificador_legivel_usuario(usuario)}.",
                detalhes_evento={
                    "identificador_usuario_alvo": str(usuario["identificador_usuario"]),
                    "identificador_alvo": _identificador_legivel_usuario(usuario),
                    "identificador_permissao": corpo.identificador_permissao,
                    "indicador_permitido": corpo.indicador_permitido,
                    "origem_regra": corpo.origem_regra,
                    "observação": corpo.observacao,
                },
            )

    return {"mensagem": "Permissão direta salva com sucesso."}


@rotas_de_administracao.delete("/admin/usuarios/{chave}/permissoes/{identificador_permissao}")
async def revogar_permissao_direta_usuario(
    chave: str,
    identificador_permissao: int,
    request: Request,
):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        resolvido = await _garantir_usuario_existente(conexao, chave)
        usuario = resolvido["usuário"]

        async with conexao.transaction():
            await conexao.execute(
                """
                update sevenlm_connect.usuario_permissao
                   set data_hora_revogado_em = now(),
                       identificador_usuario_responsavel = $3::uuid
                 where identificador_usuario = $1::uuid
                   and identificador_permissao = $2
                   and data_hora_revogado_em is null
                """,
                str(usuario["identificador_usuario"]),
                identificador_permissao,
                executor["identificador_usuario"],
            )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_PERMISSAO_DIRETA_REVOGADA",
                descricao_evento=f"Permissão {identificador_permissao} revogada do usuário {_identificador_legivel_usuario(usuario)}.",
                detalhes_evento={
                    "identificador_usuario_alvo": str(usuario["identificador_usuario"]),
                    "identificador_alvo": _identificador_legivel_usuario(usuario),
                    "identificador_permissao": identificador_permissao,
                },
            )

    return {"mensagem": "Permissão direta revogada com sucesso."}


@rotas_de_administracao.get("/admin/setores")
async def listar_setores(request: Request):
    await _obter_usuario_autenticado(request, exigir_gerenciamento=False)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        linhas = await conexao.fetch(
            """
            select
                codigo_setor,
                coalesce(nullif(nome_setor, ''), codigo_setor) as nome_setor
            from sevenlm_connect.setor
            order by nome_setor
            """
        )

    return {"items": [dict(l) for l in linhas]}


@rotas_de_administracao.post("/admin/setores/{codigo_setor}/perfis")
async def atribuir_perfil_setor(
    codigo_setor: str,
    corpo: CorpoAtribuirPerfilSetor,
    request: Request,
):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        async with conexao.transaction():
            await _garantir_perfil_existente(conexao, corpo.identificador_perfil)
            codigo_setor_catalogado = await _garantir_setor_catalogado(conexao, codigo_setor)
            if not codigo_setor_catalogado:
                raise HTTPException(
                    status_code=404,
                    detail="Setor informado não foi encontrado no catálogo."
                )

            await conexao.execute(
                """
                insert into sevenlm_connect.setor_perfil (
                    codigo_setor,
                    identificador_perfil,
                    indicador_ativo,
                    identificador_usuario_responsavel,
                    observacao
                )
                values ($1, $2, true, $3::uuid, $4)
                on conflict (codigo_setor, identificador_perfil)
                do update set
                    indicador_ativo = true,
                    identificador_usuario_responsavel = excluded.identificador_usuario_responsavel,
                    data_hora_concedido_em = now(),
                    observacao = excluded.observacao
                """,
                codigo_setor_catalogado,
                corpo.identificador_perfil,
                executor["identificador_usuario"],
                corpo.observacao,
            )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_PERFIL_ATRIBUIDO_SETOR",
                descricao_evento=f"Perfil {corpo.identificador_perfil} atribuído ao setor {codigo_setor_catalogado}.",
                detalhes_evento={
                    "codigo_setor": codigo_setor_catalogado,
                    "identificador_perfil": corpo.identificador_perfil,
                    "observação": corpo.observacao,
                },
            )

    return {"mensagem": "Perfil atribuído ao setor com sucesso."}


@rotas_de_administracao.delete("/admin/setores/{codigo_setor}/perfis/{identificador_perfil}")
async def remover_perfil_setor(
    codigo_setor: str,
    identificador_perfil: int,
    request: Request,
):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        async with conexao.transaction():
            await conexao.execute(
                """
                delete from sevenlm_connect.setor_perfil
                where codigo_setor = $1
                  and identificador_perfil = $2
                """,
                codigo_setor,
                identificador_perfil,
            )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_PERFIL_REMOVIDO_SETOR",
                descricao_evento=f"Perfil {identificador_perfil} removido do setor {codigo_setor}.",
                detalhes_evento={
                    "codigo_setor": codigo_setor,
                    "identificador_perfil": identificador_perfil,
                },
            )

    return {"mensagem": "Perfil removido do setor com sucesso."}


# =========================================================
# AÇÕES ADMINISTRATIVAS NO USUÁRIO
# =========================================================

@rotas_de_administracao.post("/admin/usuarios/{chave}/forcar-troca-senha")
async def forcar_troca_de_senha(
    chave: str,
    corpo: CorpoForcarTrocaSenha,
    request: Request,
):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        resolvido = await _garantir_usuario_existente(conexao, chave)
        usuario = resolvido["usuário"]

        async with conexao.transaction():
            await conexao.execute(
                """
                update sevenlm_connect.usuario
                   set indicador_precisa_trocar_senha = $2
                 where identificador_usuario = $1::uuid
                """,
                str(usuario["identificador_usuario"]),
                corpo.indicador_precisa_trocar_senha,
            )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_TROCA_SENHA_FORCADA",
                descricao_evento=f"Flag de troca de senha alterada para {_identificador_legivel_usuario(usuario)}.",
                detalhes_evento={
                    "identificador_usuario_alvo": str(usuario["identificador_usuario"]),
                    "identificador_alvo": _identificador_legivel_usuario(usuario),
                    "indicador_precisa_trocar_senha": corpo.indicador_precisa_trocar_senha,
                },
            )

    return {"mensagem": "Flag de troca de senha atualizada com sucesso."}


@rotas_de_administracao.post("/admin/usuarios/{chave}/resetar-senha")
async def resetar_senha_usuario(
    chave: str,
    corpo: CorpoResetarSenha,
    request: Request,
):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    senha_hash = gerar_hash_senha(corpo.nova_senha)

    async with pool.acquire() as conexao:
        resolvido = await _garantir_usuario_existente(conexao, chave)
        usuario = resolvido["usuário"]

        async with conexao.transaction():
            await conexao.execute(
                """
                update sevenlm_connect.usuario
                   set senha_hash = $2,
                       algoritmo_senha = 'argon2',
                       indicador_precisa_trocar_senha = $3,
                       quantidade_falhas_consecutivas = 0,
                       data_hora_bloqueado_ate = null
                 where identificador_usuario = $1::uuid
                """,
                str(usuario["identificador_usuario"]),
                senha_hash,
                corpo.forcar_troca_na_proxima_entrada,
            )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_SENHA_RESETADA",
                descricao_evento=f"Senha resetada para {_identificador_legivel_usuario(usuario)}.",
                detalhes_evento={
                    "identificador_usuario_alvo": str(usuario["identificador_usuario"]),
                    "identificador_alvo": _identificador_legivel_usuario(usuario),
                    "forcar_troca_na_proxima_entrada": corpo.forcar_troca_na_proxima_entrada,
                },
            )

    return {"mensagem": "Senha resetada com sucesso."}


@rotas_de_administracao.post("/admin/usuarios/{chave}/resetar-senha-padrao")
async def resetar_senha_padrao_usuario(
    chave: str,
    request: Request,
):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    senha_temporaria = _normalizar_texto(SENHA_PADRAO_USUARIO)
    if len(senha_temporaria) < 6:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Senha padrão do servidor não configurada com tamanho mínimo.",
        )

    senha_hash = gerar_hash_senha(senha_temporaria)

    async with pool.acquire() as conexao:
        resolvido = await _garantir_usuario_existente(conexao, chave)
        usuario = resolvido["usuário"]

        async with conexao.transaction():
            await conexao.execute(
                """
                update sevenlm_connect.usuario
                   set senha_hash = $2,
                       algoritmo_senha = 'argon2',
                       indicador_precisa_trocar_senha = true,
                       quantidade_falhas_consecutivas = 0,
                       data_hora_bloqueado_ate = null
                 where identificador_usuario = $1::uuid
                """,
                str(usuario["identificador_usuario"]),
                senha_hash,
            )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_SENHA_PADRAO_RESETADA",
                descricao_evento=f"Senha padrão aplicada para {_identificador_legivel_usuario(usuario)}.",
                detalhes_evento={
                    "identificador_usuario_alvo": str(usuario["identificador_usuario"]),
                    "identificador_alvo": _identificador_legivel_usuario(usuario),
                    "forcar_troca_na_proxima_entrada": True,
                },
            )

    return {"mensagem": "Senha padrão aplicada. O usuário será obrigado a trocar no próximo acesso."}


@rotas_de_administracao.post("/admin/usuarios/{chave}/resetar-mfa")
async def resetar_mfa_usuario(chave: str, request: Request):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        resolvido = await _garantir_usuario_existente(conexao, chave)
        usuario = resolvido["usuário"]

        async with conexao.transaction():
            await conexao.execute(
                """
                update sevenlm_connect.usuario
                   set indicador_mfa_habilitado = false,
                       mfa_totp_segredo_enc = null,
                       mfa_totp_confirmado_em = null
                 where identificador_usuario = $1::uuid
                """,
                str(usuario["identificador_usuario"]),
            )

            await conexao.execute(
                """
                update sevenlm_connect.mfa_desafio
                   set situacao = 'CANCELADO'
                 where identificador_usuario = $1::uuid
                   and situacao = 'ABERTO'
                """,
                str(usuario["identificador_usuario"]),
            )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_MFA_RESETADO",
                descricao_evento=f"MFA resetado para {_identificador_legivel_usuario(usuario)}.",
                detalhes_evento={
                    "identificador_usuario_alvo": str(usuario["identificador_usuario"]),
                    "identificador_alvo": _identificador_legivel_usuario(usuario),
                },
            )

    return {"mensagem": "MFA resetado com sucesso. O usuário deverá configurar novamente no próximo acesso."}


@rotas_de_administracao.post("/admin/usuarios/{chave}/desbloquear")
async def desbloquear_usuario(chave: str, request: Request):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        resolvido = await _garantir_usuario_existente(conexao, chave)
        usuario = resolvido["usuário"]

        async with conexao.transaction():
            await conexao.execute(
                """
                update sevenlm_connect.usuario
                   set quantidade_falhas_consecutivas = 0,
                       data_hora_bloqueado_ate = null
                 where identificador_usuario = $1::uuid
                """,
                str(usuario["identificador_usuario"]),
            )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_USUARIO_DESBLOQUEADO",
                descricao_evento=f"Usuário {_identificador_legivel_usuario(usuario)} desbloqueado.",
                detalhes_evento={
                    "identificador_usuario_alvo": str(usuario["identificador_usuario"]),
                    "identificador_alvo": _identificador_legivel_usuario(usuario),
                },
            )

    return {"mensagem": "Usuário desbloqueado com sucesso."}


@rotas_de_administracao.post("/admin/usuarios/{chave}/ativar")
async def ativar_usuario(chave: str, request: Request):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        resolvido = await _garantir_usuario_existente(conexao, chave)
        usuario = resolvido["usuário"]

        async with conexao.transaction():
            await conexao.execute(
                """
                update sevenlm_connect.usuario
                   set indicador_ativo = true
                 where identificador_usuario = $1::uuid
                """,
                str(usuario["identificador_usuario"]),
            )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_USUARIO_ATIVADO",
                descricao_evento=f"Usuário {_identificador_legivel_usuario(usuario)} ativado.",
                detalhes_evento={
                    "identificador_usuario_alvo": str(usuario["identificador_usuario"]),
                    "identificador_alvo": _identificador_legivel_usuario(usuario),
                },
            )

    return {"mensagem": "Usuário ativado com sucesso."}


@rotas_de_administracao.post("/admin/usuarios/{chave}/desativar")
async def desativar_usuario(chave: str, request: Request):
    executor = await _obter_usuario_autenticado(request, exigir_gerenciamento=True)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        resolvido = await _garantir_usuario_existente(conexao, chave)
        usuario = resolvido["usuário"]

        async with conexao.transaction():
            await conexao.execute(
                """
                update sevenlm_connect.usuario
                   set indicador_ativo = false
                 where identificador_usuario = $1::uuid
                """,
                str(usuario["identificador_usuario"]),
            )

            await _registrar_evento_auditoria(
                conexao=conexao,
                request=request,
                executor=executor,
                tipo_evento="ADMIN_USUARIO_DESATIVADO",
                descricao_evento=f"Usuário {_identificador_legivel_usuario(usuario)} desativado.",
                detalhes_evento={
                    "identificador_usuario_alvo": str(usuario["identificador_usuario"]),
                    "identificador_alvo": _identificador_legivel_usuario(usuario),
                },
            )

    return {"mensagem": "Usuário desativado com sucesso."}


# =========================================================
# AUDITORIA
# =========================================================

@rotas_de_administracao.get("/admin/auditoria")
async def listar_auditoria(
    request: Request,
    limite: int = Query(50, ge=1, le=200),
):
    await _obter_usuario_autenticado(request, exigir_gerenciamento=False)
    pool = request.app.state.pool

    async with pool.acquire() as conexao:
        linhas = await conexao.fetch(
            """
            select
                tipo_evento,
                descricao_evento as descricao,
                detalhes_evento,
                identificador_usuario::text as criado_por,
                data_hora_evento,
                data_hora_criacao
            from sevenlm_connect.auditoria_evento
            where tipo_evento like 'ADMIN_%'
               or tipo_evento like 'RH_%'
            order by data_hora_evento desc, data_hora_criacao desc
            limit $1
            """,
            limite,
        )

    itens = []
    for linha in linhas:
        item = dict(linha)
        item["titulo"] = item["tipo_evento"].replace("_", " ").title()
        itens.append(item)

    return {"items": itens}
