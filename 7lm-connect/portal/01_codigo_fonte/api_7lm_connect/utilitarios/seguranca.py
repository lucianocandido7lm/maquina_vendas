"""
Utilitarios de seguranca da API.
"""

import hashlib
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from configuracoes import ALGORITMO_TOKEN, CHAVE_TOKEN_ACESSO, MINUTOS_TOKEN_ACESSO

contexto_senha = CryptContext(schemes=["argon2"], deprecated="auto")


def _pepper() -> str:
    pepper = (os.getenv("SEVENLM_CONNECT_SENHA_PEPPER", "") or os.getenv("SEVENLM_CONNECT_SENHA_PEPPER", "")).strip()
    if not pepper:
        raise RuntimeError("SEVENLM_CONNECT_SENHA_PEPPER/SEVENLM_CONNECT_SENHA_PEPPER nao definido no .env.")
    return pepper


def agora_utc() -> datetime:
    return datetime.now(timezone.utc)


def gerar_hash_senha(senha_plana: str) -> str:
    return contexto_senha.hash((senha_plana or "") + _pepper())


def validar_senha(senha_plana: str, senha_hash: str) -> bool:
    try:
        if contexto_senha.verify((senha_plana or "") + _pepper(), senha_hash):
            return True
    except Exception:
        pass

    try:
        return contexto_senha.verify((senha_plana or ""), senha_hash)
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
        return jwt.decode(token, CHAVE_TOKEN_ACESSO, algorithms=[ALGORITMO_TOKEN], options=opcoes)
    except JWTError:
        return None


def gerar_token_de_renovacao() -> str:
    return secrets.token_urlsafe(64)


def gerar_hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
