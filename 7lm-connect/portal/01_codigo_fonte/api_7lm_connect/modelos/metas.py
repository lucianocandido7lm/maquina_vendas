"""
Modelos Pydantic do modulo de Metas e Resultados.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Optional

from pydantic import BaseModel, Field


class RequisicaoIndicadorMeta(BaseModel):
    codigo: str = Field(..., min_length=2, max_length=80)
    nome: str = Field(..., min_length=2, max_length=140)
    descricao: Optional[str] = Field(None, max_length=500)
    ativo: bool = True


class RequisicaoAtualizarIndicadorMeta(BaseModel):
    codigo: Optional[str] = Field(None, min_length=2, max_length=80)
    nome: Optional[str] = Field(None, min_length=2, max_length=140)
    descricao: Optional[str] = Field(None, max_length=500)
    ativo: Optional[bool] = None


class RequisicaoMetaColaborador(BaseModel):
    usuario_id: str = Field(..., min_length=10, max_length=80)
    indicador_id: int
    mes_referencia: int = Field(..., ge=1, le=12)
    ano_referencia: int = Field(..., ge=2000, le=2100)
    meta_potencial: Optional[Decimal] = Field(None, ge=0)
    meta_valor: Decimal = Field(..., ge=0)
    origem_meta: str = Field("MANUAL", max_length=20)
    data_inicio: date
    data_fim: date
    motivo_alteracao: Optional[str] = Field(None, max_length=800)


class RequisicaoMetaGerencial(BaseModel):
    pessoa_id: Optional[str] = Field(None, max_length=80)
    visao_meta: Optional[str] = Field(None, max_length=80)
    tipo_meta: str = Field(..., max_length=40)
    regiao_id: Optional[str] = Field(None, max_length=120)
    empreendimento_id: Optional[str] = Field(None, max_length=160)
    indicador_id: int
    meta_regra: Optional[str] = Field(None, max_length=80)
    meta_valor: Optional[Decimal] = Field(None, ge=0)
    fato_1: Optional[Decimal] = Field(None, ge=0)
    fato_2: Optional[Decimal] = Field(None, ge=0)
    fato_consolidado: Optional[Decimal] = Field(None, ge=0)
    peso: Optional[Decimal] = Field(None, ge=0)
    observacao: Optional[str] = Field(None, max_length=1000)
    mes_referencia: int = Field(..., ge=1, le=12)
    ano_referencia: int = Field(..., ge=2000, le=2100)
    origem_meta: str = Field("MANUAL", max_length=20)
    data_inicio: date
    data_fim: date


class RequisicaoResultadoMeta(BaseModel):
    usuario_id: str = Field(..., min_length=10, max_length=80)
    indicador_id: int
    mes_referencia: int = Field(..., ge=1, le=12)
    ano_referencia: int = Field(..., ge=2000, le=2100)
    valor_realizado: Decimal = Field(..., ge=0)
    origem_resultado: str = Field("MANUAL", max_length=20)
    data_resultado: date


class RequisicaoImportacaoMetas(BaseModel):
    modelo: str = Field(..., max_length=40)
    confirmar: bool = False
    linhas: list[dict[str, Any]] = Field(default_factory=list)

