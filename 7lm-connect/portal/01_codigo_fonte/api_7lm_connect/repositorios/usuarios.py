"""
Operacoes de persistencia relacionadas a usuarios.
"""

from __future__ import annotations

from typing import Any, Optional
from uuid import UUID


def _uuid_ou_none(valor: Optional[str]) -> Optional[UUID]:
    if not valor:
        return None
    try:
        return UUID(str(valor))
    except Exception:
        return None


async def obter_usuario_para_autenticacao_por_email(conexao, esquema: str, correio_eletronico: str):
    return await conexao.fetchrow(
        f"""
        SELECT identificador_usuario::text AS identificador_usuario,
               matricula,
               nome_completo,
               correio_eletronico::text AS correio_eletronico,
               senha_hash,
               indicador_ativo,
               indicador_precisa_trocar_senha,
               data_hora_bloqueado_ate,
               quantidade_falhas_consecutivas,
               indicador_mfa_habilitado,
               mfa_totp_segredo_enc,
               mfa_totp_confirmado_em
          FROM {esquema}.usuario
         WHERE lower(coalesce(correio_eletronico::text, '')) = lower($1)
         LIMIT 1
        """,
        correio_eletronico,
    )


async def buscar_usuario_por_chave(conexao, esquema: str, chave: str):
    uuid_valido = _uuid_ou_none(chave)

    if uuid_valido:
        usuario = await conexao.fetchrow(
            f"""
            SELECT identificador_usuario,
                   matricula,
                   nome_completo,
                   correio_eletronico::text AS correio_eletronico,
                   indicador_ativo,
                   indicador_precisa_trocar_senha,
                   indicador_mfa_habilitado,
                   quantidade_falhas_consecutivas,
                   data_hora_bloqueado_ate,
                   data_hora_ultimo_login
              FROM {esquema}.usuario
             WHERE identificador_usuario = $1::uuid
             LIMIT 1
            """,
            str(uuid_valido),
        )
        if usuario:
            return usuario

    return await conexao.fetchrow(
        f"""
        SELECT identificador_usuario,
               matricula,
               nome_completo,
               correio_eletronico::text AS correio_eletronico,
               indicador_ativo,
               indicador_precisa_trocar_senha,
               indicador_mfa_habilitado,
               quantidade_falhas_consecutivas,
               data_hora_bloqueado_ate,
               data_hora_ultimo_login
          FROM {esquema}.usuario
         WHERE lower(coalesce(correio_eletronico::text, '')) = lower($1)
            OR coalesce(matricula, '') = $1
         ORDER BY
            CASE
                WHEN lower(coalesce(correio_eletronico::text, '')) = lower($1) THEN 1
                WHEN coalesce(matricula, '') = $1 THEN 2
                ELSE 3
            END
         LIMIT 1
        """,
        chave,
    )


async def listar_usuarios(conexao, esquema: str, termo: str, limite: int):
    return await conexao.fetch(
        f"""
        SELECT u.identificador_usuario::text AS identificador_usuario,
               u.identificador_usuario::text AS identificador_usuario_real,
               u.matricula,
               u.nome_completo,
               u.correio_eletronico::text AS correio_eletronico,
               u.indicador_ativo,
               FALSE AS requer_provisionamento,
               'MANUAL' AS origem_cadastro,
               setor.codigo_setor,
               setor.nome_setor AS setor_principal
          FROM {esquema}.usuario u
          LEFT JOIN LATERAL (
                SELECT us.codigo_setor,
                       coalesce(s.nome_setor, us.codigo_setor) AS nome_setor
                  FROM {esquema}.usuario_setor us
                  LEFT JOIN {esquema}.setor s
                    ON s.codigo_setor = us.codigo_setor
                 WHERE us.identificador_usuario = u.identificador_usuario
                 ORDER BY us.data_hora_concedido_em DESC, us.codigo_setor
                 LIMIT 1
          ) setor ON TRUE
         WHERE (
                $1 = '%%'
                OR u.nome_completo ILIKE $1
                OR coalesce(u.correio_eletronico::text, '') ILIKE $1
                OR coalesce(u.matricula, '') ILIKE $1
              )
         ORDER BY u.nome_completo, u.correio_eletronico NULLS LAST, u.identificador_usuario
         LIMIT $2
        """,
        termo,
        limite,
    )


async def existe_usuario_por_email(conexao, esquema: str, correio_eletronico: str, ignorar_usuario: Optional[str] = None) -> bool:
    return bool(
        await conexao.fetchval(
            f"""
            SELECT 1
              FROM {esquema}.usuario
             WHERE lower(coalesce(correio_eletronico::text, '')) = lower($1)
               AND ($2::uuid IS NULL OR identificador_usuario <> $2::uuid)
             LIMIT 1
            """,
            correio_eletronico,
            ignorar_usuario,
        )
    )


async def existe_usuario_por_matricula(conexao, esquema: str, matricula: Optional[str], ignorar_usuario: Optional[str] = None) -> bool:
    if not matricula:
        return False

    return bool(
        await conexao.fetchval(
            f"""
            SELECT 1
              FROM {esquema}.usuario
             WHERE coalesce(matricula, '') = $1
               AND ($2::uuid IS NULL OR identificador_usuario <> $2::uuid)
             LIMIT 1
            """,
            matricula,
            ignorar_usuario,
        )
    )


async def inserir_usuario_manual(
    conexao,
    esquema: str,
    *,
    matricula: Optional[str],
    nome_completo: str,
    correio_eletronico: str,
    senha_hash: str,
    indicador_ativo: bool,
    indicador_precisa_trocar_senha: bool,
):
    return await conexao.fetchrow(
        f"""
        INSERT INTO {esquema}.usuario (
            matricula,
            nome_completo,
            correio_eletronico,
            senha_hash,
            algoritmo_senha,
            indicador_ativo,
            indicador_precisa_trocar_senha
        )
        VALUES ($1, $2, $3, $4, 'argon2', $5, $6)
        RETURNING identificador_usuario,
                  matricula,
                  nome_completo,
                  correio_eletronico::text AS correio_eletronico,
                  indicador_ativo,
                  indicador_precisa_trocar_senha
        """,
        matricula,
        nome_completo,
        correio_eletronico,
        senha_hash,
        indicador_ativo,
        indicador_precisa_trocar_senha,
    )


async def atualizar_usuario_manual(
    conexao,
    esquema: str,
    *,
    identificador_usuario: str,
    matricula: Optional[str],
    nome_completo: str,
    correio_eletronico: str,
    indicador_ativo: bool,
):
    return await conexao.fetchrow(
        f"""
        UPDATE {esquema}.usuario
           SET matricula = $2,
               nome_completo = $3,
               correio_eletronico = $4,
               indicador_ativo = $5
         WHERE identificador_usuario = $1::uuid
         RETURNING identificador_usuario,
                   matricula,
                   nome_completo,
                   correio_eletronico::text AS correio_eletronico,
                   indicador_ativo,
                   indicador_precisa_trocar_senha,
                   indicador_mfa_habilitado,
                   quantidade_falhas_consecutivas,
                   data_hora_bloqueado_ate,
                   data_hora_ultimo_login
        """,
        identificador_usuario,
        matricula,
        nome_completo,
        correio_eletronico,
        indicador_ativo,
    )
