"""
Regras compartilhadas de visibilidade para clientes comerciais.
"""

from __future__ import annotations

from typing import Any

from utilitarios.autorizacao import usuario_possui_permissao


PERMISSOES_CLIENTES_VER_TODOS = (
    "clientes.view.all",
    "clientes.manage.all",
    "administracao.view",
    "administracao.manage",
    "rh.admin.acessos.view",
    "rh.admin.acessos.manage",
    "ACESSO_TOTAL",
    "GERENCIAR_ACESSO",
)


async def usuario_pode_ver_todos_clientes(conexao, identificador_usuario: str) -> bool:
    for permissao in PERMISSOES_CLIENTES_VER_TODOS:
        if await usuario_possui_permissao(conexao, identificador_usuario, permissao):
            return True
    return False


async def obter_usuario_responsavel_cliente(conexao, identificador_usuario: str) -> dict[str, Any]:
    usuario = await conexao.fetchrow(
        """
        select
            identificador_usuario::text as identificador_usuario,
            nome_completo,
            nullif(trim(coalesce(correio_eletronico::text, '')), '') as email,
            nullif(trim(coalesce(matricula, '')), '') as matricula
          from sevenlm_connect.usuario
         where identificador_usuario = $1::uuid
         limit 1
        """,
        identificador_usuario,
    )

    if not usuario:
        return {
            "identificador_usuario": str(identificador_usuario),
            "nome_completo": "Usuário do portal",
            "email": None,
            "matrícula": None,
        }

    return dict(usuario)
