"""
Esquemas Pydantic do modulo de imoveis.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class RequisicaoImovelBase(BaseModel):
    titulo: str = Field(..., min_length=3, max_length=160)
    descricao: Optional[str] = Field(None, max_length=4000)
    tipo_imovel: Optional[str] = Field(None, max_length=80)
    endereco: Optional[str] = Field(None, max_length=255)
    cidade: str = Field(..., min_length=2, max_length=120)
    bairro: str = Field(..., min_length=2, max_length=120)
    estado: Optional[str] = Field(None, max_length=40)
    cep: Optional[str] = Field(None, max_length=20)
    valor: Optional[Decimal] = None
    quartos: Optional[int] = Field(None, ge=0, le=100)
    banheiros: Optional[int] = Field(None, ge=0, le=100)
    vagas_garagem: Optional[int] = Field(None, ge=0, le=100)
    tipo_garagem: Optional[str] = Field("carro", max_length=20)
    area_m2: Optional[Decimal] = None
    data_entrega: Optional[date] = None
    meses_pre_entrega: Optional[int] = Field(36, ge=1, le=240)
    meses_pos_entrega: Optional[int] = Field(24, ge=0, le=360)
    percentual_conclusao_obra: Optional[Decimal] = Field(0, ge=0, le=100)
    percentual_fechamento_minimo: Optional[Decimal] = Field(70, ge=1, le=100)
    valor_garantido: Optional[Decimal] = Field(None, ge=0)
    valor_garantido_pre_obra_planejado: Optional[Decimal] = Field(None, ge=0)
    percentual_captacao_ate_entrega: Optional[Decimal] = Field(None, ge=0, le=100)
    valor_parcela_minima_pre_obra: Optional[Decimal] = Field(0, ge=0)
    status: str = Field(..., min_length=2, max_length=60)


class RequisicaoCriarImovel(RequisicaoImovelBase):
    pass


class RequisicaoAtualizarImovel(RequisicaoImovelBase):
    pass


class RequisicaoRegistrarEvolucaoObra(BaseModel):
    percentual_conclusao_obra: Decimal = Field(..., ge=0, le=100)
    data_referencia: Optional[date] = None
    observacoes: Optional[str] = Field(None, max_length=500)
