"""
Helpers compartilhados de autorizacao do portal.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status


PERMISSOES_PORTAL_IMOVEIS = (
    "imoveis.view",
    "imoveis.create",
    "imoveis.edit",
    "imoveis.delete",
    "imoveis.media.manage",
)


async def usuario_possui_permissao(
    conexao,
    identificador_usuario: str,
    nome_permissao: str,
) -> bool:
    return bool(
        await conexao.fetchval(
            """
            select coalesce(
                sevenlm_connect.fn_usuario_tem_permissao($1::uuid, $2),
                false
            )
            """,
            identificador_usuario,
            nome_permissao,
        )
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
            "imoveis.view": False,
            "imoveis.create": False,
            "imoveis.edit": False,
            "imoveis.delete": False,
            "imoveis.media.manage": False,
            "clientes.view.all": False,
        }

    administracao_view = bool(linha["administracao_view"])
    administracao_manage = bool(linha["administracao_manage"])

    return {
        "rh.acesso": bool(linha["rh_acesso"]),
        "rh.admin.acessos.view": administracao_view,
        "administracao.view": administracao_view,
        "administracao.manage": administracao_manage,
        "imoveis.view": bool(linha["imoveis_view"]),
        "imoveis.create": bool(linha["imoveis_create"]),
        "imoveis.edit": bool(linha["imoveis_edit"]),
        "imoveis.delete": bool(linha["imoveis_delete"]),
        "imoveis.media.manage": bool(linha["imoveis_media_manage"]),
        "clientes.view.all": bool(linha["clientes_view_all"]),
    }
