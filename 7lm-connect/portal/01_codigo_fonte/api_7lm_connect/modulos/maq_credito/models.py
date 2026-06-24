from typing import Any

from pydantic import BaseModel, Field


class ContextoPayload(BaseModel):
    contexto: str


class ProcessoUpdate(BaseModel):
    caixa: str | None = None
    agehab: str | None = None
    cliente: str | None = None
    produto: str | None = None
    sinal: str | None = None
    fiador: str | None = None
    corretor: str | None = None
    empreendimento: str | None = None
    cca_vinculado: str | None = None
    observacao_analista: str | None = None
    encaminhado_analista: bool | None = None


class DocumentoUpdate(BaseModel):
    status: str
    updated_by: str | None = None
    updated_role: str | None = None


class RelacionamentoUpdate(BaseModel):
    status: str
    updated_by: str | None = None


class CredituDadosPayload(BaseModel):
    email_segundo_proponente: str | None = None
    telefone_segundo_proponente: str | None = None


class PerfilDocumentalPayload(BaseModel):
    estado_civil: str | None = None
    renda_conjuge: float | None = None
    conjuge: dict[str, Any] = Field(default_factory=dict)
    dependentes: list[dict[str, Any]] = Field(default_factory=list)
    updated_by: str | None = None
    updated_role: str | None = None


class PendenciaUpdate(BaseModel):
    descricao: str = ""
    prazo: str | None = None
    documento: str | None = None
    origem: str | None = None
    actor_role: str | None = None
    destinoCard: str | None = Field(default=None)


class UploadJsonPayload(BaseModel):
    grupo: str = "geral"
    key: str
    name: str
    data: str
    created_by: str | None = None


class KitDownloadPayload(BaseModel):
    nome: str | None = None
    formato: str = "pdf"
    documento_keys: list[str] = Field(default_factory=list)


class ChecklistMessageCreate(BaseModel):
    author_name: str
    author_role: str
    message: str
    documento_key: str | None = None
    targetRole: str | None = None
    target_role: str | None = None


class ChecklistMessageResponse(BaseModel):
    id: str
    reserva: str
    documento_key: str | None = None
    author_name: str
    author_role: str
    target_role: str = "todos"
    targetRole: str = "todos"
    targetLabel: str = "Todos"
    message: str
    created_at: str
    read_at: str | None = None


class SlaResponse(BaseModel):
    status: str = "nao_iniciado"
    started_at: str | None = None
    stopped_at: str | None = None
    elapsed_seconds: int = 0
    elapsed_label: str = "0h"
    stop_reason: str | None = None


class ProcessoResponse(BaseModel):
    reserva: str
    cliente: str | None = None
    cliente_id: str | None = None
    cliente_cpf: str | None = None
    cliente_email: str | None = None
    cliente_telefone: str | None = None
    cliente_cidade: str | None = None
    cliente_estado: str | None = None
    origem: str | None = None
    tem_processo: bool = True
    caixa: str = "reserva"
    agehab: str = "reserva"
    produto: str | None = None
    sinal: str | None = None
    fiador: str | None = None
    corretor: str | None = None
    empreendimento: str | None = None
    reserva_comercial_id: str | None = None
    reserva_comercial_status: str | None = None
    imovel_id: str | None = None
    imovel_titulo: str | None = None
    imovel_endereco: str | None = None
    imovel_cidade: str | None = None
    imovel_bairro: str | None = None
    imovel_estado: str | None = None
    imovel_status: str | None = None
    simulacao_id: str | None = None
    simulacao_status: str | None = None
    simulacao_valor_imovel: float | None = None
    simulacao_valor_total_operacao: float | None = None
    simulacao_financiamento_caixa: float | None = None
    simulacao_fgts: float | None = None
    simulacao_subsidio: float | None = None
    simulacao_entrada: float | None = None
    cca_vinculado: str | None = None
    observacao_analista: str | None = None
    encaminhado_analista: bool = False
    cliente_cadastro: dict[str, Any] = Field(default_factory=dict)
    reserva_comercial: dict[str, Any] = Field(default_factory=dict)
    imovel_detalhes: dict[str, Any] = Field(default_factory=dict)
    simulacao_detalhes: dict[str, Any] = Field(default_factory=dict)
    simulacao_fechada: dict[str, Any] = Field(default_factory=dict)
    composicao_familiar: list[dict[str, Any]] = Field(default_factory=list)
    perfil_documental: dict[str, Any] = Field(default_factory=dict)
    perfil_documental_config: dict[str, Any] = Field(default_factory=dict)
    checklist_documental: list[dict[str, Any]] = Field(default_factory=list)
    kits_documentais: dict[str, Any] = Field(default_factory=dict)
    documentos: dict[str, str] = Field(default_factory=dict)
    relacionamento: dict[str, str] = Field(default_factory=dict)
    creditu: dict[str, str] = Field(default_factory=dict)
    pendencias: dict[str, dict[str, Any]] = Field(default_factory=dict)
    pendenciasHistorico: list[dict[str, Any]] = Field(default_factory=list)
    uploadsCca: dict[str, dict[str, str]] = Field(default_factory=dict)
    uploadsEnviados: dict[str, bool] = Field(default_factory=dict)
    temDocumentoEnviado: bool = False
    sla: SlaResponse = Field(default_factory=SlaResponse)


class DiagnosticoProcessoResponse(BaseModel):
    id_cliente: str
    id_corretor: str | None = None
    Lead_Time_Total: float
    Qtd_Retrabalho: int
    Diagnostico: str
