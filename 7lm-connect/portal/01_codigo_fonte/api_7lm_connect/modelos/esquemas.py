"""
Autor: Willian Elias Franca
Projeto: 7LM Connect - Plataforma Integrada
Observação: arquivos em português, com nomes descritivos.
"""


from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

class RequisicaoEntrada(BaseModel):
    correio_eletronico: str = Field(..., min_length=3, max_length=255)
    senha: str = Field(..., min_length=1, max_length=200)
    fuso_horario_informado: Optional[str] = Field(None, max_length=80)

class RequisicaoEntradaEntraId(BaseModel):
    oid: Optional[str] = Field(None, max_length=100)
    tenant_id: Optional[str] = Field(None, max_length=100)
    preferred_username: Optional[str] = Field(None, max_length=255)
    email: Optional[str] = Field(None, max_length=255)
    nome_completo: Optional[str] = Field(None, max_length=255)
    identificadores: List[str] = Field(default_factory=list)
    roles: List[str] = Field(default_factory=list)

class RespostaEntrada(BaseModel):
    token_de_acesso: str
    token_de_renovacao: str
    expira_em_segundos: int
    usuario: Dict[str, Any]

class RequisicaoAtualizarCredencial(BaseModel):
    token_de_renovacao: str = Field(..., min_length=10)
    nova_senha: Optional[str] = Field(None, min_length=6, max_length=200)

class RequisicaoSaida(BaseModel):
    token_de_renovacao: Optional[str] = None

