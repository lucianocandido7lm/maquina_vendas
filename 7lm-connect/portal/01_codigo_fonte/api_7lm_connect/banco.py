"""
Autor: Willian Elias Franca
Projeto: 7LM Connect - Plataforma Integrada
Observação: arquivos em português, com nomes descritivos.
"""


import asyncpg
from typing import Optional
from configuracoes import (
    NOME_BANCO, USUARIO_BANCO, SENHA_BANCO, SERVIDOR_BANCO, PORTA_BANCO,
    POOL_MINIMO, POOL_MAXIMO
)

pool_de_conexoes: Optional[asyncpg.Pool] = None

async def iniciar_pool_de_conexoes() -> asyncpg.Pool:
    global pool_de_conexoes
    if pool_de_conexoes:
        return pool_de_conexoes

    pool_de_conexoes = await asyncpg.create_pool(
        user=USUARIO_BANCO,
        password=SENHA_BANCO,
        database=NOME_BANCO,
        host=SERVIDOR_BANCO,
        port=PORTA_BANCO,
        min_size=POOL_MINIMO,
        max_size=POOL_MAXIMO,
        server_settings={"client_encoding": "UTF8"},
    )
    return pool_de_conexoes

async def encerrar_pool_de_conexoes() -> None:
    global pool_de_conexoes
    if pool_de_conexoes:
        await pool_de_conexoes.close()
        pool_de_conexoes = None

