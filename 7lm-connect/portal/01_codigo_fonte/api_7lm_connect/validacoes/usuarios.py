"""
Validacoes e normalizacoes relacionadas a usuarios.
"""

from __future__ import annotations

import re
from typing import Optional

from fastapi import HTTPException


_REGEX_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def normalizar_texto(valor: Optional[str]) -> str:
    return str(valor or "").strip()


def normalizar_email(valor: Optional[str], obrigatorio: bool = False) -> Optional[str]:
    texto = normalizar_texto(valor).lower()
    if not texto:
        if obrigatorio:
            raise HTTPException(status_code=400, detail="Informe um e-mail valido.")
        return None

    if not _REGEX_EMAIL.match(texto):
        raise HTTPException(status_code=400, detail="Informe um e-mail valido.")

    return texto


def normalizar_nome_completo(valor: Optional[str]) -> str:
    texto = normalizar_texto(valor)
    if len(texto) < 3:
        raise HTTPException(status_code=400, detail="Informe o nome completo do usuario.")
    return texto


def normalizar_senha(valor: Optional[str], minimo: int = 6) -> str:
    texto = str(valor or "")
    if len(texto) < minimo:
        raise HTTPException(status_code=400, detail=f"A senha deve ter no minimo {minimo} caracteres.")
    return texto


def normalizar_matricula(valor: Optional[str]) -> Optional[str]:
    texto = normalizar_texto(valor)
    return texto or None

