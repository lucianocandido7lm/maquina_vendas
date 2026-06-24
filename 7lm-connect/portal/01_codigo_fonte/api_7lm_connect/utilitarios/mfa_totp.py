"""
Utilitarios de MFA/TOTP.
"""

import base64
import io
import os

import pyotp
import qrcode
from cryptography.fernet import Fernet

try:
    from dotenv import find_dotenv, load_dotenv  # type: ignore

    _dotenv_path = find_dotenv(usecwd=True)
    if _dotenv_path:
        load_dotenv(_dotenv_path, override=False)
except Exception:
    pass


_FERNET_CACHE: Fernet | None = None


def _normalizar_key(valor: str) -> str:
    valor = (valor or "").strip()
    if (valor.startswith('"') and valor.endswith('"')) or (valor.startswith("'") and valor.endswith("'")):
        valor = valor[1:-1].strip()
    return valor


def _fernet() -> Fernet:
    global _FERNET_CACHE
    if _FERNET_CACHE is not None:
        return _FERNET_CACHE

    key = _normalizar_key(
        os.getenv("SEVENLM_CONNECT_MFA_KEY", "") or os.getenv("SEVENLM_CONNECT_MFA_KEY", "")
    )

    if not key:
        raise RuntimeError(
            "SEVENLM_CONNECT_MFA_KEY/SEVENLM_CONNECT_MFA_KEY nao definido (Fernet key). "
            "Inclua a chave no .env e garanta que o processo carregou o ambiente."
        )

    _FERNET_CACHE = Fernet(key.encode("utf-8"))
    return _FERNET_CACHE


def criptografar(texto: str) -> str:
    return _fernet().encrypt(texto.encode("utf-8")).decode("utf-8")


def descriptografar(token: str) -> str:
    return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")


def gerar_secret_base32() -> str:
    return pyotp.random_base32()


def gerar_otpauth_uri(secret: str, issuer: str, identificador: str) -> str:
    name = f"{issuer}:{identificador}"
    return pyotp.totp.TOTP(secret).provisioning_uri(name=name, issuer_name=issuer)


def gerar_qr_png_base64(otpauth_uri: str) -> str:
    img = qrcode.make(otpauth_uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def verificar_totp(secret: str, codigo: str) -> bool:
    return pyotp.TOTP(secret).verify(codigo, valid_window=1)
