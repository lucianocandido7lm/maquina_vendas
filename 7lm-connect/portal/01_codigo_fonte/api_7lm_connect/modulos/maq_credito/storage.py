from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.request import urlopen

from fastapi import HTTPException

from configuracoes import MAQ_CREDITO_UPLOADS_DIRETORIO


LOCAL_UPLOAD_ROOT = Path(MAQ_CREDITO_UPLOADS_DIRETORIO).resolve()
MERGED_UPLOAD_ROOT = LOCAL_UPLOAD_ROOT / "_merged"


def safe_segment(value: str) -> str:
    import re

    return re.sub(r"[^a-zA-Z0-9._-]+", "-", value).strip("-") or "arquivo"


def encode_storage_path(storage_path: str) -> str:
    return "/".join(quote(segment, safe="") for segment in storage_path.split("/"))


def fallback_upload_url(reserva: str, storage_path: str) -> str:
    encoded_reserva = quote(reserva, safe="")
    return f"/api/processos/{encoded_reserva}/uploads/{encode_storage_path(storage_path)}"


def local_upload_path(storage_path: str) -> Path:
    return LOCAL_UPLOAD_ROOT / safe_segment(storage_path)


def save_local_upload(storage_path: str, content: bytes) -> None:
    path = local_upload_path(storage_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def remove_from_storage(paths: list[str]) -> None:
    for storage_path in paths or []:
        path = local_upload_path(storage_path)
        try:
            if path.exists() and path.is_file():
                path.unlink()
        except OSError:
            pass


def upload_bytes(row: dict[str, Any]) -> bytes:
    storage_path = row.get("storage_path") or ""
    local_path = local_upload_path(storage_path)
    if local_path.exists():
        return local_path.read_bytes()

    url = row.get("url") or ""
    if url.startswith("/api/processos/"):
        raise HTTPException(status_code=404, detail=f"Arquivo local nao encontrado: {row.get('file_name')}")
    if url.startswith("http://") or url.startswith("https://"):
        with urlopen(url, timeout=30) as response:
            return response.read()
    raise HTTPException(status_code=404, detail=f"Arquivo nao encontrado: {row.get('file_name')}")
