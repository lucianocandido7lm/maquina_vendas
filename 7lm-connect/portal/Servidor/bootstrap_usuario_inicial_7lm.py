"""
Bootstrap do usuario inicial da 7LM.

Cria ou atualiza o usuario adm@7lm.com.br na tabela sevenlm_connect.usuario,
reaproveitando o hash e a configuracao atuais da API.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

import asyncpg


BASE = Path(__file__).resolve().parents[1] / "01_codigo_fonte" / "api_7lm_connect"
if str(BASE) not in sys.path:
    sys.path.insert(0, str(BASE))

from configuracoes import (  # noqa: E402
    ESQUEMA_BANCO,
    NOME_BANCO,
    PORTA_BANCO,
    SENHA_BANCO,
    SERVIDOR_BANCO,
    USUARIO_BANCO,
)
from utilitarios.seguranca import gerar_hash_senha  # noqa: E402


EMAIL_INICIAL = "adm@7lm.com.br"
SENHA_INICIAL = "123456"
NOME_INICIAL = "Administrador 7LM"
PERFIL_ADMIN = "Administrador do Portal"


async def garantir_usuario_inicial() -> None:
    conexao = await asyncpg.connect(
        host=SERVIDOR_BANCO,
        port=PORTA_BANCO,
        user=USUARIO_BANCO,
        password=SENHA_BANCO,
        database=NOME_BANCO,
    )

    try:
        async with conexao.transaction():
            senha_hash = gerar_hash_senha(SENHA_INICIAL)

            usuario = await conexao.fetchrow(
                f"""
                SELECT identificador_usuario::text AS identificador_usuario
                  FROM {ESQUEMA_BANCO}.usuario
                 WHERE lower(coalesce(correio_eletronico::text, '')) = lower($1)
                 LIMIT 1
                """,
                EMAIL_INICIAL,
            )

            if usuario:
                identificador_usuario = str(usuario["identificador_usuario"])
                await conexao.execute(
                    f"""
                    UPDATE {ESQUEMA_BANCO}.usuario
                       SET nome_completo = $2,
                           correio_eletronico = $3,
                           senha_hash = $4,
                           algoritmo_senha = 'argon2',
                           indicador_ativo = TRUE,
                           indicador_precisa_trocar_senha = FALSE,
                           quantidade_falhas_consecutivas = 0,
                           data_hora_bloqueado_ate = NULL
                     WHERE identificador_usuario = $1::uuid
                    """,
                    identificador_usuario,
                    NOME_INICIAL,
                    EMAIL_INICIAL,
                    senha_hash,
                )
            else:
                identificador_usuario = await conexao.fetchval(
                    f"""
                    INSERT INTO {ESQUEMA_BANCO}.usuario (
                        nome_completo,
                        correio_eletronico,
                        senha_hash,
                        algoritmo_senha,
                        indicador_ativo,
                        indicador_precisa_trocar_senha
                    )
                    VALUES ($1, $2, $3, 'argon2', TRUE, FALSE)
                    RETURNING identificador_usuario::text
                    """,
                    NOME_INICIAL,
                    EMAIL_INICIAL,
                    senha_hash,
                )

            identificador_perfil = await conexao.fetchval(
                f"""
                SELECT identificador_perfil
                  FROM {ESQUEMA_BANCO}.perfil
                 WHERE nome_perfil = $1
                 LIMIT 1
                """,
                PERFIL_ADMIN,
            )

            if identificador_perfil is not None:
                await conexao.execute(
                    f"""
                    INSERT INTO {ESQUEMA_BANCO}.usuario_perfil (
                        identificador_usuario,
                        identificador_perfil
                    )
                    VALUES ($1::uuid, $2)
                    ON CONFLICT DO NOTHING
                    """,
                    identificador_usuario,
                    identificador_perfil,
                )

        print("Usuario inicial garantido com sucesso.")
        print(f"E-mail: {EMAIL_INICIAL}")
        print("Senha: 123456")
    finally:
        await conexao.close()


if __name__ == "__main__":
    asyncio.run(garantir_usuario_inicial())
