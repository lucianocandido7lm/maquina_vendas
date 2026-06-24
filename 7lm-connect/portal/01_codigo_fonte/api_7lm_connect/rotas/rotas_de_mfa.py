"""
Autor: Willian Elias Franca
Projeto: 7LM Connect - MFA
Arquivo: rotas/rotas_de_mfa.py
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from configuracoes import ESQUEMA_BANCO, MFA_ISSUER
from utilitarios.identificacao_do_cliente import (
    obter_endereco_ip, obter_agente_do_usuario, obter_idioma, obter_cabecalhos
)

from utilitarios.mfa_totp import (
    gerar_secret_base32, gerar_otpauth_uri, gerar_qr_png_base64,
    criptografar, descriptografar, verificar_totp
)

# 🔌 Reusa a emissão real de sessão/tokens do rotas_de_entrada
from rotas.rotas_de_entrada import concluir_login_e_emitir_tokens

rotas_de_mfa = APIRouter(prefix="/mfa")


# =========================
# Ajustes operacionais
# =========================
MAX_TENTATIVAS_DESAFIO = 6  # após isso, fecha como BLOQUEADO


# =========================
# Models
# =========================
class IniciarIn(BaseModel):
    mfa_desafio: str


class ConfirmarIn(BaseModel):
    mfa_desafio: str
    codigo: str


# =========================
# Helpers
# =========================
def _agora_utc() -> datetime:
    return datetime.now(timezone.utc)


def _uuid_or_none(v: str):
    try:
        return uuid.UUID(str(v))
    except Exception:
        return None


def _erro_codigo_invalido():
    raise HTTPException(status_code=400, detail="Código inválido (6 dígitos).")


def _validar_codigo(codigo: str) -> str:
    c = (codigo or "").strip()
    if not (c.isdigit() and len(c) == 6):
        _erro_codigo_invalido()
    return c


async def _buscar_desafio(conn, desafio: str):
    d = _uuid_or_none(desafio)
    if not d:
        return None

    row = await conn.fetchrow(
        f"""
        SELECT
            identificador_desafio::text AS mfa_desafio,
            identificador_usuario::text AS identificador_usuario,
            tipo_desafio,
            situacao,
            tentativas,
            data_hora_expiracao,
            mfa_segredo_temporario_enc
        FROM {ESQUEMA_BANCO}.mfa_desafio
        WHERE identificador_desafio = $1
        """,
        d
    )
    return dict(row) if row else None


async def _fechar_desafio(conn, desafio: str, situacao_final: str = "CONSUMIDO") -> bool:
    """
    Fecha de forma atômica (só fecha se ainda estiver ABERTO).
    Retorna True se fechou, False se não fechou (já estava fechado etc).
    """
    d = _uuid_or_none(desafio)
    if not d:
        return False

    res = await conn.execute(
        f"""
        UPDATE {ESQUEMA_BANCO}.mfa_desafio
           SET situacao = $2
         WHERE identificador_desafio = $1
           AND situacao = 'ABERTO'
        """,
        d,
        situacao_final
    )
    # asyncpg retorna "UPDATE <n>"
    try:
        n = int(str(res).split()[-1])
        return n > 0
    except Exception:
        return False


async def _inc_tentativas(conn, desafio: str) -> int:
    """
    Incrementa tentativas e retorna o novo valor.
    """
    d = _uuid_or_none(desafio)
    if not d:
        return 0

    row = await conn.fetchrow(
        f"""
        UPDATE {ESQUEMA_BANCO}.mfa_desafio
           SET tentativas = tentativas + 1
         WHERE identificador_desafio = $1
         RETURNING tentativas
        """,
        d
    )
    if not row:
        return 0
    return int(row["tentativas"])


async def _set_secret_temporario(conn, desafio: str, secret_enc: str):
    d = _uuid_or_none(desafio)
    if not d:
        return
    await conn.execute(
        f"""
        UPDATE {ESQUEMA_BANCO}.mfa_desafio
           SET mfa_segredo_temporario_enc = $2
         WHERE identificador_desafio = $1
        """,
        d,
        secret_enc
    )


async def _buscar_usuario(conn, identificador_usuario: str):
    u = _uuid_or_none(identificador_usuario)
    if not u:
        return None

    row = await conn.fetchrow(
        f"""
        SELECT
            identificador_usuario::text AS identificador_usuario,
            matricula,
            correio_eletronico::text AS correio_eletronico,
            indicador_mfa_habilitado,
            mfa_totp_segredo_enc,
            mfa_totp_confirmado_em
        FROM {ESQUEMA_BANCO}.usuario
        WHERE identificador_usuario = $1
        """,
        u
    )
    return dict(row) if row else None


async def _ativar_mfa_usuario(conn, identificador_usuario: str, secret_definitivo_enc: str):
    u = _uuid_or_none(identificador_usuario)
    if not u:
        raise HTTPException(status_code=400, detail="Usuário inválido.")

    await conn.execute(
        f"""
        UPDATE {ESQUEMA_BANCO}.usuario
           SET indicador_mfa_habilitado = TRUE,
               mfa_totp_segredo_enc = $2,
               mfa_totp_confirmado_em = NOW()
         WHERE identificador_usuario = $1
        """,
        u,
        secret_definitivo_enc
    )


def _validar_desafio_ou_erro(desafio: dict):
    """
    Valida status/expiração/tentativas comuns.
    Pode lançar HTTPException.
    """
    if desafio["situacao"] != "ABERTO":
        raise HTTPException(status_code=401, detail="Desafio não está aberto.")

    if desafio["data_hora_expiracao"] < _agora_utc():
        # quem chamou deve fechar como EXPIRADO
        raise HTTPException(status_code=401, detail="Desafio expirado.")

    tentativas = int(desafio.get("tentativas") or 0)
    if tentativas >= MAX_TENTATIVAS_DESAFIO:
        raise HTTPException(status_code=401, detail="Muitas tentativas. Inicie novamente.")


# =========================
# Endpoints
# =========================
@rotas_de_mfa.post("/iniciar")
async def iniciar(request: Request, body: IniciarIn):
    pool = request.app.state.pool
    if not pool:
        raise HTTPException(status_code=503, detail="Pool indisponivel.")

    async with pool.acquire() as conn:
        desafio = await _buscar_desafio(conn, body.mfa_desafio)
        if not desafio:
            raise HTTPException(status_code=401, detail="Desafio inválido.")

        # válida estado/expiração/tentativas
        try:
            _validar_desafio_ou_erro(desafio)
        except HTTPException as e:
            if "expirado" in str(e.detail).lower():
                await _fechar_desafio(conn, body.mfa_desafio, situacao_final="EXPIRADO")
            if "muitas tentativas" in str(e.detail).lower():
                await _fechar_desafio(conn, body.mfa_desafio, situacao_final="BLOQUEADO")
            raise

        if desafio["tipo_desafio"] != "SETUP":
            raise HTTPException(status_code=400, detail="Desafio não é de setup.")

        usuario = await _buscar_usuario(conn, desafio["identificador_usuario"])
        if not usuario:
            raise HTTPException(status_code=401, detail="Usuário do desafio não encontrado.")

        # gera secret temporário e guarda no desafio
        secret = gerar_secret_base32()
        secret_enc = criptografar(secret)
        await _set_secret_temporario(conn, body.mfa_desafio, secret_enc)

        identificador_mfa = (
            usuario.get("correio_eletronico")
            or usuario.get("matricula")
            or usuario.get("matrícula")
            or usuario["identificador_usuario"]
        )
        uri = gerar_otpauth_uri(secret, issuer=MFA_ISSUER, identificador=identificador_mfa)
        qr_b64 = gerar_qr_png_base64(uri)

        return {
            "qr_png_base64": qr_b64,
            "chave_manual": secret,
            "otpauth_uri": uri,
        }


@rotas_de_mfa.post("/confirmar")
async def confirmar(request: Request, body: ConfirmarIn):
    pool = request.app.state.pool
    if not pool:
        raise HTTPException(status_code=503, detail="Pool indisponivel.")

    codigo = _validar_codigo(body.codigo)

    endereco_ip = obter_endereco_ip(request)
    agente = obter_agente_do_usuario(request)
    idioma = obter_idioma(request)
    cabecalhos = obter_cabecalhos(request)

    async with pool.acquire() as conn:
        desafio = await _buscar_desafio(conn, body.mfa_desafio)
        if not desafio:
            raise HTTPException(status_code=401, detail="Desafio inválido.")

        # válida estado/expiração/tentativas
        try:
            _validar_desafio_ou_erro(desafio)
        except HTTPException as e:
            if "expirado" in str(e.detail).lower():
                await _fechar_desafio(conn, body.mfa_desafio, situacao_final="EXPIRADO")
            if "muitas tentativas" in str(e.detail).lower():
                await _fechar_desafio(conn, body.mfa_desafio, situacao_final="BLOQUEADO")
            raise

        if desafio["tipo_desafio"] != "SETUP":
            raise HTTPException(status_code=400, detail="Desafio não é de setup.")

        enc_tmp = desafio.get("mfa_segredo_temporario_enc")
        if not enc_tmp:
            raise HTTPException(status_code=400, detail="Setup não iniciado. Chame /mfa/iniciar.")

        # válida o TOTP usando o secret temporário descriptografado
        secret_tmp = descriptografar(enc_tmp)

        ok = verificar_totp(secret_tmp, codigo)
        if not ok:
            tent = await _inc_tentativas(conn, body.mfa_desafio)
            if tent >= MAX_TENTATIVAS_DESAFIO:
                await _fechar_desafio(conn, body.mfa_desafio, situacao_final="BLOQUEADO")
                raise HTTPException(status_code=401, detail="Muitas tentativas. Inicie novamente.")
            raise HTTPException(status_code=401, detail="Código inválido.")

        # grava secret definitivo no usuário (um ciphertext definitivo, ok)
        secret_def_enc = criptografar(secret_tmp)
        await _ativar_mfa_usuario(conn, desafio["identificador_usuario"], secret_def_enc)

        # fecha desafio (atômico)
        closed = await _fechar_desafio(conn, body.mfa_desafio, situacao_final="CONSUMIDO")
        if not closed:
            # alguém consumiu no meio (raro), mas tratamos
            raise HTTPException(status_code=401, detail="Desafio não está aberto.")

        # ✅ emite sessão/tokens reais
        return await concluir_login_e_emitir_tokens(
            conexao=conn,
            identificador_usuario=desafio["identificador_usuario"],
            endereco_ip=endereco_ip,
            agente_do_usuario=agente,
            idioma=idioma,
            fuso_horario_informado=None,
            cabecalhos_http=cabecalhos,
        )


@rotas_de_mfa.post("/verificar")
async def verificar(request: Request, body: ConfirmarIn):
    pool = request.app.state.pool
    if not pool:
        raise HTTPException(status_code=503, detail="Pool indisponivel.")

    codigo = _validar_codigo(body.codigo)

    endereco_ip = obter_endereco_ip(request)
    agente = obter_agente_do_usuario(request)
    idioma = obter_idioma(request)
    cabecalhos = obter_cabecalhos(request)

    async with pool.acquire() as conn:
        desafio = await _buscar_desafio(conn, body.mfa_desafio)
        if not desafio:
            raise HTTPException(status_code=401, detail="Desafio inválido.")

        # válida estado/expiração/tentativas
        try:
            _validar_desafio_ou_erro(desafio)
        except HTTPException as e:
            if "expirado" in str(e.detail).lower():
                await _fechar_desafio(conn, body.mfa_desafio, situacao_final="EXPIRADO")
            if "muitas tentativas" in str(e.detail).lower():
                await _fechar_desafio(conn, body.mfa_desafio, situacao_final="BLOQUEADO")
            raise

        if desafio["tipo_desafio"] != "LOGIN":
            raise HTTPException(status_code=400, detail="Desafio não é de login MFA.")

        usuario = await _buscar_usuario(conn, desafio["identificador_usuario"])
        if not usuario:
            raise HTTPException(status_code=401, detail="Usuário do desafio não encontrado.")

        if not usuario.get("indicador_mfa_habilitado") or not usuario.get("mfa_totp_segredo_enc"):
            raise HTTPException(status_code=400, detail="Usuário sem MFA configurado.")

        secret = descriptografar(usuario["mfa_totp_segredo_enc"])

        ok = verificar_totp(secret, codigo)
        if not ok:
            tent = await _inc_tentativas(conn, body.mfa_desafio)
            if tent >= MAX_TENTATIVAS_DESAFIO:
                await _fechar_desafio(conn, body.mfa_desafio, situacao_final="BLOQUEADO")
                raise HTTPException(status_code=401, detail="Muitas tentativas. Inicie novamente.")
            raise HTTPException(status_code=401, detail="Código inválido.")

        closed = await _fechar_desafio(conn, body.mfa_desafio, situacao_final="CONSUMIDO")
        if not closed:
            raise HTTPException(status_code=401, detail="Desafio não está aberto.")

        return await concluir_login_e_emitir_tokens(
            conexao=conn,
            identificador_usuario=desafio["identificador_usuario"],
            endereco_ip=endereco_ip,
            agente_do_usuario=agente,
            idioma=idioma,
            fuso_horario_informado=None,
            cabecalhos_http=cabecalhos,
        )
