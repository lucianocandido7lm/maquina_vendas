"""
Autor: Willian Elias Franca
Projeto: 7LM Connect - Plataforma Integrada
Arquivo: utilitarios/cripto.py

Criptografia opcional via Fernet (cryptography).
Se não houver chave ou lib, funciona sem cripto (menos seguro).
"""

import os

def _get_fernet():
    chave = os.getenv("SEVENLM_CONNECT_MFA_CHAVE_FERNET", "").strip()
    if not chave:
        return None
    try:
        from cryptography.fernet import Fernet
        return Fernet(chave.encode("utf-8"))
    except Exception:
        return None

def criptografar_texto(texto_plano: str) -> str:
    if texto_plano is None:
        return None
    f = _get_fernet()
    if not f:
        # fallback (sem cripto)
        return texto_plano
    token = f.encrypt(texto_plano.encode("utf-8"))
    return token.decode("utf-8")

def descriptografar_texto(texto_cript: str) -> str:
    if texto_cript is None:
        return None
    f = _get_fernet()
    if not f:
        return texto_cript
    plano = f.decrypt(texto_cript.encode("utf-8"))
    return plano.decode("utf-8")

