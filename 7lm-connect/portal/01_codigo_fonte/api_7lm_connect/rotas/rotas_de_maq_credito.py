"""
Rotas do modulo MaqCredito.
"""

from fastapi import APIRouter

from modulos.maq_credito.contexto import router as rotas_de_contexto_maq_credito
from modulos.maq_credito.processos import router as rotas_de_processos_maq_credito


rotas_de_maq_credito = APIRouter()
rotas_de_maq_credito.include_router(rotas_de_processos_maq_credito)
rotas_de_maq_credito.include_router(rotas_de_contexto_maq_credito)
