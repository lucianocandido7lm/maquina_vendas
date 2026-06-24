from fastapi import APIRouter

from modulos.maq_credito.db import execute
from modulos.maq_credito.models import ContextoPayload

router = APIRouter(tags=["contexto"])


@router.post("/contexto")
def registrar_contexto(payload: ContextoPayload) -> dict[str, bool]:
    execute("insert into maq_credito.contextos (contexto) values (%s)", [payload.contexto])
    return {"ok": True}
