"""
Servicos relacionados a operacoes de usuarios.
"""

from __future__ import annotations

from typing import Optional

from fastapi import HTTPException

from repositorios.usuarios import (
    existe_usuario_por_email,
    existe_usuario_por_matricula,
    inserir_usuario_manual,
    atualizar_usuario_manual as atualizar_usuario_manual_repositorio,
)
from utilitarios.seguranca import gerar_hash_senha
from validacoes.usuarios import (
    normalizar_email,
    normalizar_matricula,
    normalizar_nome_completo,
    normalizar_senha,
)


async def criar_usuario_manual(
    conexao,
    esquema: str,
    *,
    nome_completo: str,
    correio_eletronico: str,
    senha: str,
    matricula: Optional[str] = None,
    indicador_ativo: bool = True,
    indicador_precisa_trocar_senha: bool = False,
):
    nome = normalizar_nome_completo(nome_completo)
    email = normalizar_email(correio_eletronico, obrigatorio=True)
    senha_normalizada = normalizar_senha(senha)
    matricula_normalizada = normalizar_matricula(matricula)

    if await existe_usuario_por_email(conexao, esquema, email):
        raise HTTPException(status_code=409, detail="Ja existe usuario com este e-mail.")

    if await existe_usuario_por_matricula(conexao, esquema, matricula_normalizada):
        raise HTTPException(status_code=409, detail="Ja existe usuario com esta matricula.")

    senha_hash = gerar_hash_senha(senha_normalizada)

    return await inserir_usuario_manual(
        conexao,
        esquema,
        matricula=matricula_normalizada,
        nome_completo=nome,
        correio_eletronico=email,
        senha_hash=senha_hash,
        indicador_ativo=bool(indicador_ativo),
        indicador_precisa_trocar_senha=bool(indicador_precisa_trocar_senha),
    )


async def atualizar_usuario_manual(
    conexao,
    esquema: str,
    *,
    identificador_usuario: str,
    nome_completo: str,
    correio_eletronico: str,
    matricula: Optional[str] = None,
    indicador_ativo: bool = True,
):
    nome = normalizar_nome_completo(nome_completo)
    email = normalizar_email(correio_eletronico, obrigatorio=True)
    matricula_normalizada = normalizar_matricula(matricula)

    if await existe_usuario_por_email(conexao, esquema, email, ignorar_usuario=identificador_usuario):
        raise HTTPException(status_code=409, detail="Ja existe outro usuario com este e-mail.")

    if await existe_usuario_por_matricula(conexao, esquema, matricula_normalizada, ignorar_usuario=identificador_usuario):
        raise HTTPException(status_code=409, detail="Ja existe outro usuario com esta matricula.")

    usuario = await atualizar_usuario_manual_repositorio(
        conexao,
        esquema,
        identificador_usuario=identificador_usuario,
        matricula=matricula_normalizada,
        nome_completo=nome,
        correio_eletronico=email,
        indicador_ativo=bool(indicador_ativo),
    )

    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario nao encontrado.")

    return usuario
