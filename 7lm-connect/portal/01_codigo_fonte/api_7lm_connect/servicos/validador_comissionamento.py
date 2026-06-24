import asyncpg
from typing import Any
from banco import iniciar_pool_de_conexoes
from configuracoes import ESQUEMA_BANCO

async def resolver_indicador(codigo: str) -> str:
    """
    Resolve o código amigável do frontend para o código oficial do banco.
    Valida contra o catálogo oficial connect_comercial.indicadores_meta.
    """
    if not codigo:
        return "indicador_invalido"
    normalizado = str(codigo).lower().strip()
    
    pool = await iniciar_pool_de_conexoes()
    async with pool.acquire() as conexao:
        linha = await conexao.fetchrow(
            f"""
            SELECT codigo_indicador, ativo
            FROM connect_comercial.indicadores_meta
            WHERE LOWER(codigo_indicador) = $1 OR LOWER(nome) = $1
            """,
            normalizado
        )
        if not linha:
            return "indicador_invalido"
        if not linha["ativo"]:
            return "indicador_invalido"
        return linha["codigo_indicador"]

async def resolver_identidade(registro: dict[str, Any]) -> dict[str, Any]:
    """
    Resolve a pessoa oficial do registro baseado na hierarquia de prioridades.
    1. identificador_usuario
    2. identificador_funcionario
    3. email
    4. documento
    5. hierarquia_snapshot (fallback, tratado no select de metas se for string)
    """
    usuario_id = registro.get("identificador_usuario")
    funcionario_id = registro.get("identificador_funcionario")
    email = registro.get("email")
    documento = registro.get("documento")
    nome = registro.get("nome")
    
    if usuario_id:
        criterio = "usuario_direto"
        pessoa_id = str(usuario_id)
    elif funcionario_id:
        criterio = "funcionario_oficial"
        pessoa_id = str(funcionario_id)
    elif email:
        criterio = "email_oficial"
        pessoa_id = str(email)
    elif documento:
        criterio = "documento_oficial"
        pessoa_id = str(documento)
    elif nome:
        criterio = "hierarquia_snapshot"
        pessoa_id = str(nome)
    else:
        criterio = "sem_vinculo"
        pessoa_id = None

    return {
        "pessoa_id": pessoa_id,
        "criterio_vinculo": criterio
    }
