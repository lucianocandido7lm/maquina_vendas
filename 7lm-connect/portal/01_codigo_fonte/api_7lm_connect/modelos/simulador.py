"""
Esquemas Pydantic do modulo de simulador comercial.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class RequisicaoFiltroImoveis(BaseModel):
    empreendimento: Optional[str] = Field(None, max_length=160)
    cidade: Optional[str] = Field(None, max_length=120)
    bairro: Optional[str] = Field(None, max_length=120)
    tipologia: Optional[str] = Field(None, max_length=80)
    dormitorios: Optional[int] = Field(None, ge=0, le=10)
    faixa_preco_min: Optional[Decimal] = Field(None, ge=0)
    faixa_preco_max: Optional[Decimal] = Field(None, ge=0)
    area_min_m2: Optional[Decimal] = Field(None, ge=0)
    area_max_m2: Optional[Decimal] = Field(None, ge=0)
    status: Optional[str] = Field("Disponivel", max_length=40)


class RequisicaoBaseSimulacao(BaseModel):
    cliente_id: str = Field(..., min_length=36, max_length=64)
    valor_imovel: Optional[Decimal] = Field(None, ge=0)
    financiamento_caixa: Optional[Decimal] = Field(None, ge=0)
    parcela_cliente_maxima: Optional[Decimal] = Field(None, ge=0)
    parcela_financiamento_banco: Optional[Decimal] = Field(None, ge=0)
    fgts: Optional[Decimal] = Field(None, ge=0)
    subsidio: Optional[Decimal] = Field(None, ge=0)
    cheque_moradia: Optional[Decimal] = Field(None, ge=0)
    entrada: Optional[Decimal] = Field(None, ge=0)
    usar_entrada_padrao: bool = False
    sobrepreco: Optional[Decimal] = Field(None, ge=0)
    desconto_imovel: Optional[Decimal] = Field(None, ge=0)
    incentivo_7lm: Optional[Decimal] = Field(None, ge=0)
    parceiro_simulacao: Optional[str] = Field("creditur", max_length=40)
    meses_pre_entrega: int = Field(36, ge=1, le=240)
    meses_pos_entrega: int = Field(24, ge=0, le=80)
    parcela_pre_obra_valor: Optional[Decimal] = Field(None, ge=0)
    parcela_pos_obra_valor: Optional[Decimal] = Field(None, ge=0)
    parcelas_7lm_personalizadas: Optional[list[dict]] = None
    parcelas_creditur_intervalos: Optional[list[dict]] = None
    creditu_geral: Optional[dict] = None
    parcelas_creditur_semestrais: Optional[list[dict]] = None
    parcela_intermediaria_valor: Optional[Decimal] = Field(None, ge=0)
    parcelas_intermediarias_quantidade: int = Field(0, ge=0, le=24)
    parcelas_intermediarias_datas: Optional[list[str]] = None
    parcelas_intermediarias_personalizadas: Optional[list[dict]] = None
    parcela_anual_valor: Optional[Decimal] = Field(None, ge=0)
    parcelas_anuais_quantidade: int = Field(0, ge=0, le=24)
    parcela_anual_primeira_data: Optional[str] = Field(None, max_length=10)
    parcela_semestral_valor: Optional[Decimal] = Field(None, ge=0)
    parcelas_semestrais_quantidade: int = Field(0, ge=0, le=24)
    parcela_semestral_primeira_data: Optional[str] = Field(None, max_length=10)
    parcela_reforco_valor: Optional[Decimal] = Field(None, ge=0)
    parcelas_reforco_quantidade: int = Field(0, ge=0, le=24)
    observacoes_comerciais: Optional[str] = Field(None, max_length=4000)
    filtros: RequisicaoFiltroImoveis = Field(default_factory=RequisicaoFiltroImoveis)
    incluir_indisponiveis: bool = False


class RequisicaoSugerirImoveis(RequisicaoBaseSimulacao):
    model_config = ConfigDict(populate_by_name=True)

    limite_sugestoes: int = Field(500, ge=1, le=500, alias="limite_sugestões")


class RequisicaoCalcularSimulacao(RequisicaoBaseSimulacao):
    imovel_id: str = Field(..., min_length=36, max_length=64)


class RequisicaoSalvarSimulacao(RequisicaoCalcularSimulacao):
    simulacao_id: Optional[str] = Field(None, min_length=36, max_length=64)
    payload_snapshot_extra: Optional[dict] = None


class RequisicaoCriarComplementoRenda(BaseModel):
    nome: str = Field(..., min_length=3, max_length=180)
    cpf: str = Field(..., min_length=11, max_length=20)
    parentesco: Optional[str] = Field(None, max_length=80)
    renda: Decimal = Field(..., ge=0)
    incluir_na_analise: bool = True
    compoe_renda: bool = True
    incluir_na_composicao_financeira: bool = True
    ativo: bool = True


class RequisicaoAtualizarComplementoRenda(RequisicaoCriarComplementoRenda):
    pass


class RequisicaoOperacaoImovel(BaseModel):
    cliente_id: Optional[str] = Field(None, min_length=36, max_length=64)
    simulacao_id: Optional[str] = Field(None, min_length=36, max_length=64)
    observacoes: Optional[str] = Field(None, max_length=2000)
    expiracao_em: Optional[datetime] = None


class RequisicaoDecisaoAprovacaoExcecao(BaseModel):
    acao: str = Field(..., pattern="^(aprovar|reprovar)$")
    observacoes: Optional[str] = Field(None, max_length=2000)
