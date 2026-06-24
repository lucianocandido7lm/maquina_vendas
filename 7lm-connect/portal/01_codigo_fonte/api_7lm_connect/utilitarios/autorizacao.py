"""
Helpers compartilhados de autorizacao do portal.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status


COMISSIONAMENTO_EMAILS_APROVACAO_COMERCIAL = {
    "gestaocomercial@7lm.com.br",
}

COMISSIONAMENTO_NOMES_APROVACAO_COMERCIAL = (
    "marcelo paiva",
    "marco narciso",
)

COMISSIONAMENTO_CARGOS_APROVACAO_COMERCIAL = (
    "diretor comercial",
    "diretoria comercial",
)

COMISSIONAMENTO_CARGOS_SECRETARIA = (
    "secretaria de vendas",
    "secretária de vendas",
)


PERMISSOES_PORTAL_IMOVEIS = (
    "imoveis.view",
    "imoveis.create",
    "imoveis.edit",
    "imoveis.delete",
    "imoveis.media.manage",
)

PERMISSOES_EQUIVALENTES = {
    "administracao.view": (
        "administracao.view",
        "rh.admin.acessos.view",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "administracao.manage": (
        "administracao.manage",
        "rh.admin.acessos.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "funcionarios.acesso.view": (
        "funcionarios.acesso.view",
        "funcionarios.acesso.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "funcionarios.acesso.manage": (
        "funcionarios.acesso.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "funcionarios.validacao.view": (
        "funcionarios.validacao.view",
        "funcionarios.validacao.manage",
        "funcionarios.acesso.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "funcionarios.validacao.manage": (
        "funcionarios.validacao.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "aprovacoes.excecao.view": (
        "aprovacoes.excecao.view",
        "aprovacoes.excecao.manage",
        "administracao.view",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "aprovacoes.excecao.manage": (
        "aprovacoes.excecao.manage",
        "administracao.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "metas.resultados.view": (
        "metas.resultados.view",
        "metas.resultados.manage",
        "metas.resultados.admin",
        "metas.resultados.gerenciais.manage",
        "metas.resultados.resultados.manage",
        "metas.resultados.import",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "metas.resultados.manage": (
        "metas.resultados.manage",
        "metas.resultados.admin",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "metas.resultados.admin": (
        "metas.resultados.admin",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "metas.resultados.gerenciais.manage": (
        "metas.resultados.gerenciais.manage",
        "metas.resultados.admin",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "metas.resultados.resultados.manage": (
        "metas.resultados.resultados.manage",
        "metas.resultados.admin",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "metas.resultados.import": (
        "metas.resultados.import",
        "metas.resultados.admin",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "dashboard.comercial.view": (
        "dashboard.comercial.view",
        "dashboard.comercial.manage",
        "administracao.view",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "dashboard.comercial.manage": (
        "dashboard.comercial.manage",
        "administracao.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "maquina.vendas.dashboard.view": (
        "maquina.vendas.dashboard.view",
        "maquina.vendas.dashboard.manage",
        "dashboard.comercial.view",
        "dashboard.comercial.manage",
        "imoveis.view",
        "administracao.view",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "maquina.vendas.dashboard.manage": (
        "maquina.vendas.dashboard.manage",
        "dashboard.comercial.manage",
        "administracao.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "clientes.view.all": (
        "clientes.view.all",
        "clientes.manage.all",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "comissionamento.view": (
        "comissionamento.view",
        "comissionamento.view.own",
        "comissionamento.view.all",
        "comissionamento.manage",
        "comissionamento.secretaria",
        "comissionamento.aprovar.head",
        "administracao.view",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "comissionamento.view.own": (
        "comissionamento.view.own",
        "comissionamento.view",
        "comissionamento.view.all",
        "comissionamento.manage",
        "comissionamento.secretaria",
        "maquina.vendas.dashboard.view",
        "maquina.vendas.dashboard.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "comissionamento.view.all": (
        "comissionamento.view.all",
        "comissionamento.manage",
        "comissionamento.secretaria",
        "comissionamento.aprovar.head",
        "administracao.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "comissionamento.manage": (
        "comissionamento.manage",
        "comissionamento.secretaria",
        "administracao.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "comissionamento.secretaria": (
        "comissionamento.secretaria",
        "comissionamento.manage",
        "administracao.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "comissionamento.regras.manage": (
        "comissionamento.regras.manage",
        "comissionamento.secretaria",
        "comissionamento.manage",
        "administracao.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "comissionamento.historico.view": (
        "comissionamento.historico.view",
        "comissionamento.secretaria",
        "comissionamento.manage",
        "administracao.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
    "comissionamento.aprovar.head": (
        "comissionamento.aprovar.head",
        "comissionamento.manage",
        "administracao.manage",
        "ACESSO_TOTAL",
        "GERENCIAR_ACESSO",
    ),
}


async def _contexto_comissionamento_usuario(conexao, identificador_usuario: str) -> dict[str, Any]:
    linha = await conexao.fetchrow(
        """
        select
            lower(coalesce(u.correio_eletronico::text, '')) as email,
            lower(coalesce(u.nome_completo, '')) as nome,
            lower(coalesce(fa.cargo, '')) as cargo,
            lower(coalesce(fa.perfil_acesso_padrao, p.nome_perfil, '')) as perfil
        from sevenlm_connect.usuario u
        left join sevenlm_connect.funcionario_acesso fa
            on fa.identificador_usuario = u.identificador_usuario
            or lower(fa.email::text) = lower(u.correio_eletronico::text)
            or lower(fa.nome) = lower(u.nome_completo)
        left join sevenlm_connect.perfil p on p.identificador_perfil = fa.identificador_perfil_acesso
        where u.identificador_usuario = $1::uuid
        order by fa.identificador_usuario is null, fa.ativo desc nulls last
        limit 1
        """,
        identificador_usuario,
    )
    if not linha:
        return {}
    return dict(linha)


def _texto_tem_algum(texto: str, termos: tuple[str, ...]) -> bool:
    normalizado = str(texto or "").lower()
    return any(termo in normalizado for termo in termos)


async def _usuario_possui_permissao_comissionamento_por_contexto(
    conexao,
    identificador_usuario: str,
    nome_permissao: str,
) -> bool:
    if not nome_permissao.startswith("comissionamento."):
        return False

    contexto = await _contexto_comissionamento_usuario(conexao, identificador_usuario)
    email = str(contexto.get("email") or "")
    nome = str(contexto.get("nome") or "")
    cargo = str(contexto.get("cargo") or "")
    perfil = str(contexto.get("perfil") or "")

    eh_secretaria = _texto_tem_algum(cargo, COMISSIONAMENTO_CARGOS_SECRETARIA) or _texto_tem_algum(
        perfil,
        COMISSIONAMENTO_CARGOS_SECRETARIA,
    )
    eh_aprovacao_comercial = (
        email in COMISSIONAMENTO_EMAILS_APROVACAO_COMERCIAL
        or _texto_tem_algum(nome, COMISSIONAMENTO_NOMES_APROVACAO_COMERCIAL)
        or _texto_tem_algum(cargo, COMISSIONAMENTO_CARGOS_APROVACAO_COMERCIAL)
        or _texto_tem_algum(perfil, COMISSIONAMENTO_CARGOS_APROVACAO_COMERCIAL)
    )

    if nome_permissao in {"comissionamento.secretaria", "comissionamento.regras.manage", "comissionamento.historico.view"}:
        return eh_secretaria
    if nome_permissao in {"comissionamento.aprovar.head", "comissionamento.view.all"}:
        return eh_aprovacao_comercial or eh_secretaria
    if nome_permissao in {"comissionamento.view", "comissionamento.view.own"}:
        if eh_secretaria or eh_aprovacao_comercial:
            return True
        return await usuario_possui_permissao(conexao, identificador_usuario, "maquina.vendas.dashboard.view")
    return False


async def usuario_possui_permissao(
    conexao,
    identificador_usuario: str,
    nome_permissao: str,
) -> bool:
    permissoes = PERMISSOES_EQUIVALENTES.get(nome_permissao, (nome_permissao,))
    possui = bool(
        await conexao.fetchval(
            """
            select coalesce(bool_or(
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, permissao.nome_permissao), false)
            ), false)
            from unnest($2::text[]) as permissao(nome_permissao)
            """,
            identificador_usuario,
            list(permissoes),
        )
    )
    if possui:
        return True
    return await _usuario_possui_permissao_comissionamento_por_contexto(
        conexao,
        identificador_usuario,
        nome_permissao,
    )


async def exigir_permissao_portal(
    conexao,
    identificador_usuario: str,
    nome_permissao: str,
    detalhe: str,
) -> None:
    if await usuario_possui_permissao(conexao, identificador_usuario, nome_permissao):
        return

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=detalhe,
    )


async def obter_acessos_portal_usuario(
    conexao,
    identificador_usuario: str,
) -> dict[str, bool]:
    linha = await conexao.fetchrow(
        """
        select
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'rh.acesso'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'rh.admin.acessos.view'), false)
            ) as rh_acesso,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'administracao.view'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'rh.admin.acessos.view'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as administracao_view,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'administracao.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'rh.admin.acessos.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as administracao_manage,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'funcionarios.acesso.view'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'funcionarios.acesso.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'funcionarios.validacao.view'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'funcionarios.validacao.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as funcionarios_acesso_view,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'funcionarios.acesso.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as funcionarios_acesso_manage,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'funcionarios.validacao.view'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'funcionarios.validacao.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'funcionarios.acesso.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as funcionarios_validacao_view,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'funcionarios.validacao.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as funcionarios_validacao_manage,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'aprovacoes.excecao.view'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'aprovacoes.excecao.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'administracao.view'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as aprovacoes_excecao_view,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'aprovacoes.excecao.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'administracao.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as aprovacoes_excecao_manage,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'metas.resultados.view'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'metas.resultados.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'metas.resultados.admin'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'metas.resultados.gerenciais.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'metas.resultados.resultados.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'metas.resultados.import'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as metas_resultados_view,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'metas.resultados.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'metas.resultados.admin'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as metas_resultados_manage,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'metas.resultados.admin'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as metas_resultados_admin,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'metas.resultados.gerenciais.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'metas.resultados.admin'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as metas_resultados_gerenciais_manage,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'metas.resultados.resultados.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'metas.resultados.admin'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as metas_resultados_resultados_manage,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'metas.resultados.import'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'metas.resultados.admin'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as metas_resultados_import,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'dashboard.comercial.view'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'dashboard.comercial.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'administracao.view'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as dashboard_comercial_view,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'dashboard.comercial.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'administracao.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as dashboard_comercial_manage,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'maquina.vendas.dashboard.view'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'maquina.vendas.dashboard.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'dashboard.comercial.view'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'dashboard.comercial.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'imoveis.view'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'administracao.view'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as maquina_vendas_dashboard_view,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'maquina.vendas.dashboard.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'dashboard.comercial.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'administracao.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as maquina_vendas_dashboard_manage,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'comissionamento.view'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'comissionamento.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'comissionamento.secretaria'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'administracao.view'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as comissionamento_view,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'comissionamento.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'comissionamento.secretaria'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'administracao.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as comissionamento_manage,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'comissionamento.secretaria'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'comissionamento.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'administracao.manage'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as comissionamento_secretaria,
            coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'imoveis.view'), false) as imoveis_view,
            coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'imoveis.create'), false) as imoveis_create,
            coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'imoveis.edit'), false) as imoveis_edit,
            coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'imoveis.delete'), false) as imoveis_delete,
            coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'imoveis.media.manage'), false) as imoveis_media_manage,
            (
                coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'clientes.view.all'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'clientes.manage.all'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'ACESSO_TOTAL'), false)
                or coalesce(sevenlm_connect.fn_usuario_tem_permissao($1::uuid, 'GERENCIAR_ACESSO'), false)
            ) as clientes_view_all
        """,
        identificador_usuario,
    )

    if not linha:
        return {
            "rh.acesso": False,
            "rh.admin.acessos.view": False,
            "administracao.view": False,
            "administracao.manage": False,
            "funcionarios.acesso.view": False,
            "funcionarios.acesso.manage": False,
            "funcionarios.validacao.view": False,
            "funcionarios.validacao.manage": False,
            "aprovacoes.excecao.view": False,
            "aprovacoes.excecao.manage": False,
            "metas.resultados.view": False,
            "metas.resultados.manage": False,
            "metas.resultados.admin": False,
            "metas.resultados.gerenciais.manage": False,
            "metas.resultados.resultados.manage": False,
            "metas.resultados.import": False,
            "dashboard.comercial.view": False,
            "dashboard.comercial.manage": False,
            "maquina.vendas.dashboard.view": False,
            "maquina.vendas.dashboard.manage": False,
            "comissionamento.view": False,
            "comissionamento.view.own": False,
            "comissionamento.view.all": False,
            "comissionamento.manage": False,
            "comissionamento.secretaria": False,
            "comissionamento.regras.manage": False,
            "comissionamento.historico.view": False,
            "comissionamento.aprovar.head": False,
            "imoveis.view": False,
            "imoveis.create": False,
            "imoveis.edit": False,
            "imoveis.delete": False,
            "imoveis.media.manage": False,
            "clientes.view.all": False,
        }

    administracao_view = bool(linha["administracao_view"])
    administracao_manage = bool(linha["administracao_manage"])
    contexto_comissionamento = await _contexto_comissionamento_usuario(conexao, identificador_usuario)
    email_comissionamento = str(contexto_comissionamento.get("email") or "")
    nome_comissionamento = str(contexto_comissionamento.get("nome") or "")
    cargo_comissionamento = str(contexto_comissionamento.get("cargo") or "")
    perfil_comissionamento = str(contexto_comissionamento.get("perfil") or "")
    contexto_secretaria = _texto_tem_algum(
        cargo_comissionamento,
        COMISSIONAMENTO_CARGOS_SECRETARIA,
    ) or _texto_tem_algum(
        perfil_comissionamento,
        COMISSIONAMENTO_CARGOS_SECRETARIA,
    )
    contexto_aprovacao_comercial = (
        email_comissionamento in COMISSIONAMENTO_EMAILS_APROVACAO_COMERCIAL
        or _texto_tem_algum(nome_comissionamento, COMISSIONAMENTO_NOMES_APROVACAO_COMERCIAL)
        or _texto_tem_algum(cargo_comissionamento, COMISSIONAMENTO_CARGOS_APROVACAO_COMERCIAL)
        or _texto_tem_algum(perfil_comissionamento, COMISSIONAMENTO_CARGOS_APROVACAO_COMERCIAL)
    )
    comissionamento_manage = bool(linha["comissionamento_manage"])
    comissionamento_secretaria = bool(linha["comissionamento_secretaria"]) or contexto_secretaria
    comissionamento_head = contexto_aprovacao_comercial or comissionamento_secretaria or administracao_manage or comissionamento_manage
    comissionamento_view_all = comissionamento_secretaria or comissionamento_head or administracao_manage
    comissionamento_view_own = (
        bool(linha["comissionamento_view"])
        or bool(linha["maquina_vendas_dashboard_view"])
        or comissionamento_view_all
    )
    comissionamento_view = bool(linha["comissionamento_view"]) or comissionamento_view_own

    return {
        "rh.acesso": bool(linha["rh_acesso"]),
        "rh.admin.acessos.view": administracao_view,
        "administracao.view": administracao_view,
        "administracao.manage": administracao_manage,
        "funcionarios.acesso.view": bool(linha["funcionarios_acesso_view"]),
        "funcionarios.acesso.manage": bool(linha["funcionarios_acesso_manage"]),
        "funcionarios.validacao.view": bool(linha["funcionarios_validacao_view"]),
        "funcionarios.validacao.manage": bool(linha["funcionarios_validacao_manage"]),
        "aprovacoes.excecao.view": bool(linha["aprovacoes_excecao_view"]),
        "aprovacoes.excecao.manage": bool(linha["aprovacoes_excecao_manage"]),
        "metas.resultados.view": bool(linha["metas_resultados_view"]),
        "metas.resultados.manage": bool(linha["metas_resultados_manage"]),
        "metas.resultados.admin": bool(linha["metas_resultados_admin"]),
        "metas.resultados.gerenciais.manage": bool(linha["metas_resultados_gerenciais_manage"]),
        "metas.resultados.resultados.manage": bool(linha["metas_resultados_resultados_manage"]),
        "metas.resultados.import": bool(linha["metas_resultados_import"]),
        "dashboard.comercial.view": bool(linha["dashboard_comercial_view"]),
        "dashboard.comercial.manage": bool(linha["dashboard_comercial_manage"]),
        "maquina.vendas.dashboard.view": bool(linha["maquina_vendas_dashboard_view"]),
        "maquina.vendas.dashboard.manage": bool(linha["maquina_vendas_dashboard_manage"]),
        "comissionamento.view": comissionamento_view,
        "comissionamento.view.own": comissionamento_view_own,
        "comissionamento.view.all": comissionamento_view_all,
        "comissionamento.manage": comissionamento_manage,
        "comissionamento.secretaria": comissionamento_secretaria,
        "comissionamento.regras.manage": comissionamento_secretaria or comissionamento_manage or administracao_manage,
        "comissionamento.historico.view": comissionamento_secretaria or comissionamento_manage or administracao_manage,
        "comissionamento.aprovar.head": comissionamento_head,
        "imoveis.view": bool(linha["imoveis_view"]),
        "imoveis.create": bool(linha["imoveis_create"]),
        "imoveis.edit": bool(linha["imoveis_edit"]),
        "imoveis.delete": bool(linha["imoveis_delete"]),
        "imoveis.media.manage": bool(linha["imoveis_media_manage"]),
        "clientes.view.all": bool(linha["clientes_view_all"]),
    }
