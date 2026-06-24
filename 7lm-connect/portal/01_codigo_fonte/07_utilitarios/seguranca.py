"""
Autor: Willian Elias Franca
Projeto: 7LM Connect - Plataforma Integrada
ObservaÃ§Ã£o:
- Argon2id + Pepper (compatÃ­vel com o bootstrap do admin)
"""

import os
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional

from passlib.context import CryptContext
from jose import jwt, JWTError

from configuracoes import (
    CHAVE_TOKEN_ACESSO, ALGORITMO_TOKEN, MINUTOS_TOKEN_ACESSO
)

contexto_senha = CryptContext(schemes=["argon2"], deprecated="auto")


def agora_utc() -> datetime:
    return datetime.now(timezone.utc)


def _pepper() -> str:
    valor = (os.getenv("SEVENLM_CONNECT_SENHA_PEPPER") or "").strip()
    if not valor:
        raise RuntimeError("SEVENLM_CONNECT_SENHA_PEPPER nÃ£o definido no .env (ou variÃ¡veis de ambiente).")
    return valor


def gerar_hash_senha(senha_plana: str) -> str:
    # hash de (senha + pepper)
    return contexto_senha.hash((senha_plana or "") + _pepper())


def validar_senha(senha_plana: str, senha_hash: str) -> bool:
    # verifica (senha + pepper) contra o hash armazenado
    try:
        return contexto_senha.verify((senha_plana or "") + _pepper(), senha_hash)
    except Exception:
        return False


def gerar_token_de_acesso(identificador_usuario: str, identificador_sessao: str) -> Dict[str, Any]:
    expira_em = agora_utc() + timedelta(minutes=MINUTOS_TOKEN_ACESSO)
    payload = {
        "sub": identificador_usuario,
        "sid": identificador_sessao,
        "exp": int(expira_em.timestamp()),
        "iat": int(agora_utc().timestamp()),
        "ver": 1,
    }
    token = jwt.encode(payload, CHAVE_TOKEN_ACESSO, algorithm=ALGORITMO_TOKEN)
    return {"token": token, "expira_em_segundos": MINUTOS_TOKEN_ACESSO * 60}


def ler_token_de_acesso(token: str, validar_expiracao: bool = True) -> Optional[Dict[str, Any]]:
    try:
        opcoes = {"verify_exp": validar_expiracao}
        payload = jwt.decode(token, CHAVE_TOKEN_ACESSO, algorithms=[ALGORITMO_TOKEN], options=opcoes)
        return payload
    except JWTError:
        return None


def gerar_token_de_renovacao() -> str:
    return secrets.token_urlsafe(64)


def gerar_hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

