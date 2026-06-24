"""
Esquemas Pydantic do modulo de clientes (comercial).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Optional

from pydantic import AliasChoices, BaseModel, Field


class RequisicaoClienteBase(BaseModel):
    nome_completo: str = Field(..., min_length=3, max_length=180)
    data_nascimento: Optional[date] = None
    sexo: Optional[str] = Field(None, max_length=30)
    cpf: Optional[str] = Field(None, max_length=20)
    rg: Optional[str] = Field(None, max_length=30)
    estado_civil: Optional[str] = Field(None, max_length=40)
    regime_casamento: Optional[str] = Field(None, max_length=60)
    nacionalidade: Optional[str] = Field(None, max_length=60)
    nome_mae: Optional[str] = Field(None, max_length=180)
    nome_pai: Optional[str] = Field(None, max_length=180)
    email: Optional[str] = Field(None, max_length=120)
    telefone: Optional[str] = Field(None, max_length=30)
    celular: Optional[str] = Field(None, max_length=30)
    cep: Optional[str] = Field(None, max_length=20)
    logradouro: Optional[str] = Field(None, max_length=180)
    numero: Optional[str] = Field(None, max_length=30)
    complemento: Optional[str] = Field(None, max_length=60)
    bairro: Optional[str] = Field(None, max_length=120)
    cidade: Optional[str] = Field(None, max_length=120)
    estado: Optional[str] = Field(None, max_length=40)
    tempo_residencia_anos: Optional[int] = Field(None, ge=0, le=99)
    renda_principal: Optional[Decimal] = None
    renda_conjuge: Optional[Decimal] = None
    outras_rendas: Optional[Decimal] = None
    renda_total: Optional[Decimal] = None
    moradores: Optional[int] = Field(None, ge=0, le=100)
    dependentes: Optional[int] = Field(None, ge=0, le=100)
    filhos: Optional[int] = Field(None, ge=0, le=100)
    profissao: Optional[str] = Field(None, max_length=120)
    empresa: Optional[str] = Field(None, max_length=160)
    cargo: Optional[str] = Field(None, max_length=120)
    tempo_emprego_anos: Optional[int] = Field(None, ge=0, le=99)
    tipo_contrato: Optional[str] = Field(None, max_length=40)
    escolaridade: Optional[str] = Field(None, max_length=80)
    situacao_moradia: Optional[str] = Field(None, max_length=40)
    imovel_proprio: Optional[bool] = Field(
        None,
        validation_alias=AliasChoices("imovel_proprio", "imovel_próprio"),
    )
    veiculo: Optional[bool] = Field(
        None,
        validation_alias=AliasChoices("veiculo", "veículo"),
    )
    financiamentos: Optional[str] = Field(None, max_length=600)
    renda_formal: Optional[Decimal] = None
    renda_informal: Optional[Decimal] = None
    cartao_credito: Optional[Decimal] = None
    aluguel_financiamento: Optional[Decimal] = None
    despesas_fixas: Optional[Decimal] = None
    despesas_variaveis: Optional[Decimal] = None
    documentacao_pendente: Optional[str] = Field(None, max_length=2000)
    status_documental: Optional[str] = Field(None, max_length=60)
    observacoes: Optional[str] = Field(None, max_length=4000)
    parametros_simulacao: Optional[dict[str, Any]] = None


class RequisicaoCriarCliente(RequisicaoClienteBase):
    pass


class RequisicaoAtualizarCliente(RequisicaoClienteBase):
    pass


class RequisicaoMembroComposicaoBase(BaseModel):
    nome_completo: str = Field(..., min_length=3, max_length=180)
    cpf: str = Field(..., min_length=11, max_length=20)
    rg: Optional[str] = Field(None, max_length=30)
    data_nascimento: Optional[date] = None
    sexo: Optional[str] = Field(None, max_length=30)
    estado_civil: Optional[str] = Field(None, max_length=40)
    regime_casamento: Optional[str] = Field(None, max_length=60)
    nacionalidade: Optional[str] = Field(None, max_length=60)
    nome_mae: Optional[str] = Field(None, max_length=180)
    nome_pai: Optional[str] = Field(None, max_length=180)
    parentesco: str = Field(..., min_length=2, max_length=80)
    telefone: Optional[str] = Field(None, max_length=30)
    celular: Optional[str] = Field(None, max_length=30)
    email: Optional[str] = Field(None, max_length=120)
    cep: Optional[str] = Field(None, max_length=20)
    logradouro: Optional[str] = Field(None, max_length=180)
    numero: Optional[str] = Field(None, max_length=30)
    complemento: Optional[str] = Field(None, max_length=60)
    bairro: Optional[str] = Field(None, max_length=120)
    cidade: Optional[str] = Field(None, max_length=120)
    estado: Optional[str] = Field(None, max_length=40)
    mora_com_cliente_principal: Optional[bool] = False
    usar_endereco_cliente_principal: Optional[bool] = False
    renda_mensal: Optional[Decimal] = Field(None, ge=0)
    outras_rendas: Optional[Decimal] = Field(None, ge=0)
    renda_total: Optional[Decimal] = Field(None, ge=0)
    renda_formal: Optional[Decimal] = Field(None, ge=0)
    renda_informal: Optional[Decimal] = Field(None, ge=0)
    despesas_fixas: Optional[Decimal] = Field(None, ge=0)
    despesas_variaveis: Optional[Decimal] = Field(None, ge=0)
    financiamentos: Optional[str] = Field(None, max_length=600)
    profissao: Optional[str] = Field(None, max_length=120)
    ocupacao: Optional[str] = Field(None, max_length=120)
    empresa_atual: Optional[str] = Field(None, max_length=160)
    cargo: Optional[str] = Field(None, max_length=120)
    tempo_emprego_anos: Optional[int] = Field(None, ge=0, le=99)
    tipo_contrato: Optional[str] = Field(None, max_length=60)
    escolaridade: Optional[str] = Field(None, max_length=80)
    situacao_moradia: Optional[str] = Field(None, max_length=40)
    compoe_renda: Optional[bool] = True
    incluir_na_analise: Optional[bool] = True
    incluir_na_composicao_financeira: Optional[bool] = True
    incluir_na_confissao_divida: Optional[bool] = False
    responsavel_documentacao: Optional[bool] = False
    principal_comprador: Optional[bool] = False
    documentacao_pendente: Optional[str] = Field(None, max_length=2000)
    status_documental: Optional[str] = Field(None, max_length=60)
    observacoes: Optional[str] = Field(None, max_length=4000)
    ativo: Optional[bool] = True


class RequisicaoCriarMembroComposicao(RequisicaoMembroComposicaoBase):
    pass


class RequisicaoAtualizarMembroComposicao(RequisicaoMembroComposicaoBase):
    pass


class RequisicaoAtualizarFlagsMembroComposicao(BaseModel):
    compoe_renda: Optional[bool] = None
    incluir_na_analise: Optional[bool] = None
    incluir_na_composicao_financeira: Optional[bool] = None
    incluir_na_confissao_divida: Optional[bool] = None
    responsavel_documentacao: Optional[bool] = None
    principal_comprador: Optional[bool] = None


class RequisicaoAtualizarStatusMembroComposicao(BaseModel):
    ativo: bool = Field(...)
