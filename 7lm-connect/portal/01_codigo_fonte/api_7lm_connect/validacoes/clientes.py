"""
Validacoes e normalizacoes de arquivos do modulo de clientes.
"""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path
from typing import Optional

from fastapi import HTTPException


EXTENSOES_FOTO_CLIENTE = {".jpg", ".jpeg", ".png", ".webp"}
EXTENSOES_DOCUMENTO_CLIENTE = {".pdf", ".jpg", ".jpeg", ".png", ".webp", ".doc", ".docx"}

MIME_FOTO_CLIENTE = {"image/jpeg", "image/png", "image/webp"}
MIME_DOCUMENTO_CLIENTE = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/webp",
}


def classificar_arquivo_cliente(
    nome_arquivo: Optional[str],
    mime_type: Optional[str],
    *,
    tipo_arquivo: str,
) -> dict[str, str]:
    nome = Path(str(nome_arquivo or "")).name.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Todos os arquivos enviados devem possuir nome.")

    tipo_normalizado = str(tipo_arquivo or "").strip().lower()
    extensao = Path(nome).suffix.lower()
    mime = str(mime_type or "").strip().lower()

    if tipo_normalizado == "foto":
        if extensao not in EXTENSOES_FOTO_CLIENTE:
            raise HTTPException(
                status_code=400,
                detail=f"O arquivo {nome} possui uma extensao nao permitida para foto. Use jpg, jpeg, png ou webp.",
            )
        if mime and mime not in MIME_FOTO_CLIENTE:
            raise HTTPException(status_code=400, detail=f"O arquivo {nome} nao possui um tipo de imagem permitido.")
        return {"tipo_arquivo": "foto", "extensao": extensao, "mime_type": mime or "image/jpeg"}

    if tipo_normalizado == "documento":
        if extensao not in EXTENSOES_DOCUMENTO_CLIENTE:
            raise HTTPException(
                status_code=400,
                detail=f"O arquivo {nome} possui uma extensao nao permitida para documento. Use pdf, doc, docx, jpg, jpeg, png ou webp.",
            )
        if mime and mime not in MIME_DOCUMENTO_CLIENTE:
            raise HTTPException(status_code=400, detail=f"O arquivo {nome} nao possui um tipo de documento permitido.")
        mime_padrao = "application/pdf" if extensao == ".pdf" else "application/octet-stream"
        if extensao in EXTENSOES_FOTO_CLIENTE:
            mime_padrao = "image/jpeg"
        if extensao == ".docx":
            mime_padrao = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        if extensao == ".doc":
            mime_padrao = "application/msword"
        return {"tipo_arquivo": "documento", "extensao": extensao, "mime_type": mime or mime_padrao}

    raise HTTPException(status_code=400, detail="O tipo de arquivo informado para o cliente nao e suportado.")


def normalizar_nome_arquivo_cliente(valor: Optional[str]) -> str:
    texto = unicodedata.normalize("NFKD", str(valor or "").strip())
    texto = "".join(char for char in texto if not unicodedata.combining(char))
    texto = texto.lower()
    texto = re.sub(r"[^a-z0-9]+", "-", texto).strip("-")
    return texto[:72] or "arquivo"
