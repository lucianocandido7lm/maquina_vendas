export const COMMISSION_STATUS = {
  calculada: { label: 'Calculada', tone: 'warning' },
  em_revisao_secretaria: { label: 'Em revisão pela Secretaria', tone: 'warning' },
  aguardando_head_comercial: { label: 'Aguardando aprovação comercial', tone: 'info' },
  aprovada_head_comercial: { label: 'Aprovada pela Diretoria Comercial', tone: 'ok' },
  revisao_necessaria: { label: 'Revisão necessária', tone: 'warning' },
  rejeitada: { label: 'Rejeitada', tone: 'danger' },
  aguardando_nf: { label: 'Aguardando NF', tone: 'warning' },
  nf_em_validacao: { label: 'NF recebida', tone: 'ok' },
  pronta_para_envio_pagamento: { label: 'Pagamento', tone: 'info' },
  enviada_pagamento: { label: 'Enviada para pagamento', tone: 'info' },
  aguardando_pagamento: { label: 'Aguardando pagamento', tone: 'neutral' },
  paga: { label: 'Paga', tone: 'ok' },
  cancelada: { label: 'Cancelada', tone: 'danger' },
  nao_solicitada: { label: 'NF solicitada', tone: 'warning' },
  solicitada: { label: 'NF solicitada', tone: 'warning' },
  recebida: { label: 'NF enviada ao Financeiro', tone: 'ok' },
  validada: { label: 'NF validada', tone: 'ok' },
  bloqueada: { label: 'NF solicitada', tone: 'warning' },
  pacote_enviado: { label: 'Pacote enviado', tone: 'info' },
  calculado_seed: { label: 'Calculada', tone: 'warning' },
  calculado: { label: 'Calculada', tone: 'warning' },
  pendente_secretaria: { label: 'Em revisão pela Secretaria', tone: 'warning' },
  aprovado_secretaria: { label: 'Aguardando aprovação comercial', tone: 'info' },
  pendente_marcelo: { label: 'Aguardando aprovação comercial', tone: 'info' },
  aprovado_marcelo: { label: 'Aprovada pela Diretoria Comercial', tone: 'ok' },
  aprovado_head: { label: 'Aprovada pela Diretoria Comercial', tone: 'ok' },
  pendente_nf: { label: 'Aguardando NF', tone: 'warning' },
  nf_solicitada: { label: 'NF solicitada', tone: 'warning' },
  nf_recebida: { label: 'NF recebida', tone: 'ok' },
  nf_validada: { label: 'NF validada', tone: 'ok' },
  nf_correcao_solicitada: { label: 'Correção de NF solicitada', tone: 'warning' },
  nao_aplicavel: { label: 'Não se aplica', tone: 'neutral' },
  bloqueado_nf: { label: 'Aguardando NF', tone: 'warning' },
  pronto_financeiro: { label: 'Pagamento', tone: 'info' },
  enviado_financeiro: { label: 'Enviada para pagamento', tone: 'info' },
  nao_enviado: { label: 'Não enviada', tone: 'neutral' },
  nao_pago: { label: 'Aguardando pagamento', tone: 'neutral' },
  pago: { label: 'Paga', tone: 'ok' },
  rejeitado: { label: 'Rejeitada', tone: 'danger' },
  ciencia_comissao: { label: 'Comissão informada', tone: 'info' },
  rh_financeiro: { label: 'Pagamento', tone: 'info' },
};

export const COMMISSION_STATUS_ALIASES = {
  calculado_seed: 'calculada',
  calculado: 'calculada',
  pendente_secretaria: 'em_revisao_secretaria',
  aprovado_secretaria: 'aguardando_head_comercial',
  pendente_marcelo: 'aguardando_head_comercial',
  aprovado_marcelo: 'aprovada_head_comercial',
  aprovado_head: 'aprovada_head_comercial',
  rejeitado: 'rejeitada',
  pendente_nf: 'solicitada',
  nf_solicitada: 'solicitada',
  nf_recebida: 'recebida',
  nf_validada: 'validada',
  nao_solicitada: 'solicitada',
  nf_correcao_solicitada: 'solicitada',
  bloqueado_nf: 'solicitada',
  bloqueada: 'solicitada',
  pronto_financeiro: 'pronta_para_envio_pagamento',
  enviado_financeiro: 'enviada_pagamento',
  nao_pago: 'aguardando_pagamento',
  pago: 'paga',
};

export const COMMISSION_ACTION_ALIASES = {
  aprovar_secretaria: 'enviar_head',
  aguardar_pagamento: 'enviar_pacote_pagamento',
};

export const COMMISSION_ACTIONS = {
  enviar_head: { label: 'Enviar para aprovação comercial', description: 'Enviar para aprovação da Diretoria Comercial' },
  aprovar_secretaria: { label: 'Enviar para aprovação comercial', description: 'Enviar para aprovação da Diretoria Comercial' },
  aprovar_head: { label: 'Aprovar', description: 'Aprovar pela Diretoria Comercial' },
  rejeitar: { label: 'Reprovar/devolver para revisão' },
  solicitar_nf: { label: 'Solicitar NF', description: 'Solicitar NF manualmente' },
  reenviar_lembrete_nf: { label: 'Reenviar aviso NF', description: 'Reenviar notificação e e-mail de NF' },
  registrar_nf_recebida: { label: 'Marcar NF recebida' },
  validar_nf: { label: 'Validar NF' },
  solicitar_ajuste: { label: 'Pedir revisão/recalculo' },
  solicitar_correcao_nf: { label: 'Solicitar correção da NF' },
  enviar_pacote_pagamento: { label: 'Enviar para pagamento', description: 'Enviar para pagamento' },
  registrar_pagamento: { label: 'Registrar pagamento' },
  aguardar_pagamento: { label: 'Enviar pacote', description: 'Enviar pacote para pagamento' },
};

export const COMMISSION_STAGES = {
  calculado: { label: 'Calculada/Revisão' },
  secretaria: { label: 'Calculada/Revisão' },
  head: { label: 'Aprovação Comercial' },
  nf: { label: 'Aguardando NF' },
  pagamento: { label: 'Pagamento' },
};

export const COMMISSION_TYPES = {
  PJ_AUTONOMO: { label: 'PJ/autônomo', exige_nf: true, destino: 'Financeiro', perfil_fluxo: 'corretor_autonomo' },
  AUTONOMO: { label: 'Autônomo', exige_nf: true, destino: 'Financeiro', perfil_fluxo: 'corretor_autonomo' },
  PJ: { label: 'PJ', exige_nf: true, destino: 'Financeiro', perfil_fluxo: 'corretor_autonomo' },
  CLT: { label: 'CLT', exige_nf: false, destino: 'RH e Financeiro', perfil_fluxo: 'corretor_clt' },
  GESTOR_COORDENADOR_AUTONOMO: { label: 'Gestor/Coordenador autônomo', exige_nf: true, destino: 'Financeiro', perfil_fluxo: 'gestor_coordenador_autonomo' },
};

export const COMMISSION_FLOW_PROFILES = {
  corretor_autonomo: {
    label: 'Corretor Autônomo',
    exige_nf: true,
    destino: 'Financeiro',
    documento: 'Nota Fiscal',
    mostra_equipe: false,
    resumo: 'Fluxo com aprovação, solicitação de NF e envio para Pagamento.',
    etapas: ['secretaria', 'head', 'nf', 'pagamento'],
    status_simples: ['Comissão calculada', 'Aprovada pela Diretoria Comercial', 'Aguardando NF', 'Pagamento', 'Paga'],
  },
  corretor_clt: {
    label: 'Corretor CLT',
    exige_nf: false,
    destino: 'RH e Financeiro',
    documento: 'Resumo para RH/Financeiro',
    mostra_equipe: false,
    resumo: 'Fluxo sem NF, com ciência da comissão e envio para Pagamento.',
    etapas: ['secretaria', 'head', 'pagamento'],
    status_simples: ['Comissão informada', 'Pagamento', 'Aguardando pagamento', 'Paga'],
  },
  gestor_coordenador_autonomo: {
    label: 'Gestor/Coordenador Autônomo',
    exige_nf: true,
    destino: 'Financeiro',
    documento: 'Nota Fiscal',
    mostra_equipe: true,
    resumo: 'Fluxo com aprovação, NF, envio para Pagamento e visualização da equipe vinculada.',
    etapas: ['secretaria', 'head', 'nf', 'pagamento'],
    status_simples: ['Comissão calculada', 'Aprovada pela Diretoria Comercial', 'Aguardando NF', 'Pagamento', 'Paga'],
  },
};

export const COMMISSION_FIELDS = {
  ciclo: 'Ciclo',
  cidade: 'Cidade/região',
  funcao: 'Cargo/função',
  tipo: 'Tipo',
  bruto: 'Valor bruto',
  distrato: 'Distrato',
  bonusIps: 'Bônus IPs',
  liquido: 'Valor líquido',
  regra01: 'Regra 01',
  regra02: 'Regra 02',
  nf: 'Nota fiscal',
  pagamento: 'Pagamento',
};

export const COMMISSION_FILTERS = {
  quick: [
    { value: 'todos', label: 'Todas' },
    { value: 'head', label: 'Aguardando aprovação comercial' },
    { value: 'nf', label: 'Aguardando NF' },
    { value: 'pagamento', label: 'Pagamento' },
  ],
  nf: [
    { value: 'todos', label: 'Todas NF' },
    { value: 'solicitada', label: 'NF solicitada' },
    { value: 'recebida', label: 'NF enviada ao Financeiro' },
    { value: 'validada', label: 'NF validada' },
    { value: 'nao_aplicavel', label: 'Não se aplica' },
  ],
  pagamento: [
    { value: 'todos', label: 'Todos pagamentos' },
    { value: 'nao_enviado', label: 'Não enviado' },
    { value: 'pacote_enviado', label: 'Pacote enviado' },
    { value: 'aguardando_pagamento', label: 'Aguardando pagamento' },
    { value: 'pago', label: 'Pago' },
  ],
};

export const COMMISSION_INDICATORS = [
  'leads',
  'visitas',
  'propostas_aprovadas',
  'propostas_total',
  'vendas',
  'repasses',
  'cancelamentos',
  'distratos',
  'ipc',
  'sobrepreco_medio',
];

export const COMMISSION_EVENT_TYPES = {
  calculo_realizado: 'Cálculo realizado',
  comissao_enviada_head: 'Enviada para aprovação comercial',
  comissao_aprovada_head: 'Aprovada pela Diretoria Comercial',
  comissao_rejeitada_head: 'Devolvida pela Diretoria Comercial',
  comissao_ajuste_solicitado: 'Revisão solicitada',
  recalculo_solicitado: 'Revisão/recalculo solicitado',
  nf_solicitada: 'NF solicitada',
  nf_recebida: 'NF enviada ao Financeiro',
  nf_validada: 'NF validada',
  nf_rejeitada: 'NF rejeitada',
  pacote_enviado: 'Pacote enviado',
  pagamento_registrado: 'Pagamento registrado',
  regra_01_publicada: 'Regra 01 publicada',
  regra_02_publicada: 'Regra 02 publicada',
  notificacao_automatica_disparada: 'Notificação automática',
  notificacao_manual_disparada: 'Notificação manual',
};

export const COMMISSION_DOCUMENT_TYPES = {
  nota_fiscal: 'Nota fiscal',
  resumo_rh: 'Resumo para RH',
  pacote_pagamento: 'Pacote de pagamento',
  memoria_calculo: 'Memória de cálculo',
};

export const COMMISSION_NOTIFICATION_TYPES = {
  etapa: 'Automação por etapa',
  manual: 'Disparo manual',
  lembrete: 'Lembrete',
};

export const DEFAULT_COMMISSION_CONFIG = {
  status: COMMISSION_STATUS,
  stages: COMMISSION_STAGES,
  actions: COMMISSION_ACTIONS,
  types: COMMISSION_TYPES,
  flowProfiles: COMMISSION_FLOW_PROFILES,
  fields: COMMISSION_FIELDS,
  filters: COMMISSION_FILTERS,
  indicators: COMMISSION_INDICATORS,
  eventTypes: COMMISSION_EVENT_TYPES,
  documentTypes: COMMISSION_DOCUMENT_TYPES,
  notificationTypes: COMMISSION_NOTIFICATION_TYPES,
  statusAliases: COMMISSION_STATUS_ALIASES,
  actionAliases: COMMISSION_ACTION_ALIASES,
};

export function normalizeCommissionStatus(status) {
  if (!status) return status;
  return COMMISSION_STATUS_ALIASES[status] || status;
}

export function normalizeCommissionAction(action) {
  if (!action) return action;
  return COMMISSION_ACTION_ALIASES[action] || action;
}
