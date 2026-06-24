import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  GitBranch,
  Maximize2,
  Minimize2,
  PencilLine,
  Search,
  Send,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import {
  actionUrls,
  DEFAULT_CYCLE_ID,
  fetchCiclos,
  fetchConfiguracaoCiclo,
  fetchConfig,
  fetchEventos,
  fetchEventosCiclo,
  fetchHistoricoNotificacoes,
  fetchMe,
  fetchMinhaComissao,
  fetchNotificacoes,
  fetchPreview,
  fetchRegras,
  fetchRegrasNotificacoes,
  fetchTemplatesNotificacoes,
  postAction,
  previewNotificacao,
  processarFilaNotificacoes,
  reenviarNotificacao,
  salvarConfiguracaoCiclo,
  testarProviderNotificacoes,
  uploadNotaFiscal,
} from './api/comissionamentoApi.js';
import {
  DEFAULT_COMMISSION_CONFIG,
  normalizeCommissionAction,
  normalizeCommissionStatus,
} from './config/comissionamentoConfig.js';

const CYCLE_ID = DEFAULT_CYCLE_ID;
const CYCLE_START_DATE = `${CYCLE_ID}-01`;
const CYCLE_CUTOFF_DATE = `${CYCLE_ID}-20`;

const statusLabel = {
  ...Object.fromEntries(Object.entries(DEFAULT_COMMISSION_CONFIG.status).map(([key, item]) => [key, item.label])),
  ...Object.fromEntries(Object.entries(DEFAULT_COMMISSION_CONFIG.actions).map(([key, item]) => [key, item.description || item.label])),
};
const actionLabels = Object.fromEntries(Object.entries(DEFAULT_COMMISSION_CONFIG.actions).map(([key, item]) => [key, item.label]));
const stageLabels = Object.fromEntries(Object.entries(DEFAULT_COMMISSION_CONFIG.stages).map(([key, item]) => [key, item.label]));
const statusTone = Object.fromEntries(Object.entries(DEFAULT_COMMISSION_CONFIG.status).map(([key, item]) => [key, item.tone || 'neutral']));

function flowLabel(value) {
  const normalized = normalizeCommissionStatus(value);
  return statusLabel[normalized] || statusLabel[value] || value || '-';
}

function flowOrStageLabel(value) {
  return stageLabels[value] || flowLabel(value);
}

function flowTone(value) {
  return statusTone[normalizeCommissionStatus(value)] || statusTone[value] || 'neutral';
}

function stageFromStatus(value) {
  const status = normalizeCommissionStatus(value);
  if (['em_revisao_secretaria', 'calculada', 'revisao_necessaria'].includes(status)) return 'secretaria';
  if (status === 'aguardando_head_comercial') return 'head';
  if (['aprovada_head_comercial', 'aguardando_nf', 'nf_em_validacao', 'solicitada', 'recebida'].includes(status)) return 'nf';
  if (status === 'pronta_para_envio_pagamento') return 'pagamento';
  if (['enviada_pagamento', 'aguardando_pagamento', 'paga'].includes(status)) return 'pagamento';
  return '';
}

const HISTORY_CATEGORIES = {
  todos: { label: 'Todos', tone: 'neutral' },
  regra: { label: 'Edição de regra', tone: 'warning', Icon: PencilLine },
  fluxo: { label: 'Passagem de etapa', tone: 'info', Icon: GitBranch },
  aprovacao: { label: 'Aprovação', tone: 'info', Icon: ShieldCheck },
  nf: { label: 'Nota Fiscal', tone: 'ok', Icon: FileText },
  pagamento: { label: 'Pagamento', tone: 'info', Icon: CreditCard },
  documento: { label: 'Documento', tone: 'neutral', Icon: FileText },
  atencao: { label: 'Atenção', tone: 'danger', Icon: AlertCircle },
};

function historyCategory(item = {}) {
  const type = String(item.tipo || '').toLowerCase();
  if (type.includes('rejeitada') || type.includes('recalculo') || type.includes('ajuste') || type.includes('correcao')) return 'atencao';
  if (type.startsWith('regra_')) return 'regra';
  if (type.includes('aprovada') || type.includes('aprovar')) return 'aprovacao';
  if (type.includes('nf')) return 'nf';
  if (type.includes('pagamento') || type.includes('pacote')) return 'pagamento';
  if (item.documentoId) return 'documento';
  return 'fluxo';
}

function historyCategoryConfig(item = {}) {
  return HISTORY_CATEGORIES[historyCategory(item)] || HISTORY_CATEGORIES.fluxo;
}

function shortJson(value, limit = 240) {
  if (!value) return '';
  const text = JSON.stringify(value);
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function auditStatusChange(label, before, after, formatter = (value) => value || '-') {
  const beforeText = formatter(before);
  const afterText = formatter(after);
  const changed = beforeText !== afterText;
  return { label, before: beforeText, after: afterText, changed };
}

function auditDetailsForEvent(item = {}) {
  return [
    ...ruleAuditDetails(item),
    auditStatusChange('Etapa/status', item.etapaAnterior, item.etapaNova, flowOrStageLabel),
    auditStatusChange('Status NF', item.nfAnterior, item.nf, flowLabel),
    auditStatusChange('Financeiro', item.financeiroAnterior, item.financeiro, flowLabel),
    auditStatusChange('Pagamento', item.pagamentoAnterior, item.pagamento, flowLabel),
    auditStatusChange('Valor líquido', item.valorAnterior, item.valorNovo, (value) => (value === undefined || value === null ? '-' : money(value))),
    auditStatusChange('Regra/campo', '', [item.regra, item.campo].filter(Boolean).join(' · ') || '-'),
    auditStatusChange('Documento', '', item.documentoId || item.nfNomeArquivo || '-'),
  ].filter((detail) => detail.changed || detail.after !== '-');
}

function valueAtPath(source, path) {
  return path.reduce((current, key) => (current && current[key] !== undefined ? current[key] : undefined), source);
}

function auditValue(value) {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'number') return number(value);
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return String(value);
}

function ruleAuditDetails(item = {}) {
  const antes = item.antes || {};
  const depois = item.depois || {};
  if (item.tipo === 'regra_01_publicada') {
    const beforeRule = Array.isArray(antes.regra_01) ? (antes.regra_01[0] || {}) : (antes.regra_01 || {});
    const afterRule = depois.regra_01 || depois || {};
    const details = [
      ['Indicador Regra 01', ['indicador']],
      ['Objetivo Regra 01', ['objetivo']],
      ['Realizado Regra 01', ['realizado']],
      ['Percentual Regra 01', ['percentual_atingimento']],
      ['Faixa aplicada Regra 01', ['faixa_aplicada']],
    ].map(([label, path]) => auditStatusChange(label, valueAtPath(beforeRule, path), valueAtPath(afterRule, path), auditValue));
    const beforeSteps = getRule01Steps(beforeRule);
    const afterSteps = getRule01Steps(afterRule);
    afterSteps.forEach((step, index) => {
      const beforeStep = beforeSteps.find((itemStep) => itemStep.label === step.label) || beforeSteps[index] || {};
      details.push(auditStatusChange(`Regra 01 ${step.label}`, beforeStep.bonus, step.bonus, (value) => money(value)));
    });
    return details.filter((detail) => detail.changed);
  }
  if (item.tipo === 'regra_02_publicada') {
    const beforeIps = antes.regra_02_ips || [];
    const afterIps = depois.regra_02_ips || [];
    const details = [];
    afterIps.forEach((ip, index) => {
      const beforeIp = beforeIps.find((itemIp) => itemIp.ip_id === ip.ip_id) || beforeIps[index] || {};
      [
        ['Nome IP', 'nome', auditValue],
        ['Indicador IP', 'indicador', auditValue],
        ['Operador IP', 'operador', auditValue],
        ['Alvo IP', 'alvo', auditValue],
        ['Realizado IP', 'realizado', auditValue],
        ['Bônus IP', 'valor_bonus', (value) => money(value)],
        ['Atingiu IP', 'atingiu', auditValue],
      ].forEach(([label, key, formatter]) => {
        const detail = auditStatusChange(`${label}: ${ip.nome || ip.ip_id || index + 1}`, beforeIp[key], ip[key], formatter);
        if (detail.changed) details.push(detail);
      });
    });
    (depois.regra_02_ips_removidos || []).forEach((ipId) => {
      details.push(auditStatusChange(`IP removido`, ipId, 'Removido', auditValue));
    });
    return details;
  }
  return [];
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
}

function number(value) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number(value) || 0);
}

function date(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(parsed);
}

function dateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(parsed);
}

function cycleIdOf(item = {}) {
  return item.ciclo_id || item.cicloId || item.ciclo?.ciclo_id || CYCLE_ID;
}

function cycleLabelOf(item = {}) {
  return item.rotulo || item.label || item.nome || cycleIdOf(item);
}

function readStoredUser() {
  try {
    return window.SevenLMConnectPortalState?.getStoredUser?.()
      || JSON.parse(window.sessionStorage.getItem('sevenlm_connect_usuario') || 'null');
  } catch {
    return null;
  }
}

function accessMap(user) {
  return user?.acessos_portal || user?.permissoes || {};
}

function has(user, permission) {
  const map = accessMap(user);
  if (map?.[permission]) return true;
  return Boolean(
    map?.ACESSO_TOTAL ||
    map?.GERENCIAR_ACESSO ||
    (permission.endsWith('.view') && map?.['administracao.view']) ||
    (permission.endsWith('.manage') && map?.['administracao.manage']),
  );
}

function userText(user) {
  const values = [
    user?.nome,
    user?.nome_completo,
    user?.nome_usuario,
    user?.email,
    user?.correio_eletronico,
    user?.cargo,
    user?.funcao,
    user?.perfil,
    user?.perfil_nome,
    user?.perfil_acesso_padrao,
    user?.setor,
    ...(Array.isArray(user?.perfis) ? user.perfis : []),
    ...(Array.isArray(user?.perfis_portal) ? user.perfis_portal : []),
  ];
  return values.filter(Boolean).join(' ').toLowerCase();
}

function buildPermissions(user) {
  const canManage = has(user, 'comissionamento.manage') || has(user, 'administracao.manage');
  const text = userText(user);
  const isSecretariaCargo = text.includes('secretaria de vendas') || text.includes('secretária de vendas');
  const isAprovacaoComercialCargo = text.includes('diretor comercial') || text.includes('diretoria comercial');
  const isAprovacaoComercialPessoa = text.includes('marcelo paiva')
    || text.includes('marco narciso')
    || text.includes('gestaocomercial@7lm.com.br');
  const canSecretaria = has(user, 'comissionamento.secretaria') || isSecretariaCargo || canManage;
  const canRules = has(user, 'comissionamento.regras.manage') || canSecretaria;
  const canHead = has(user, 'comissionamento.aprovar.head') || isAprovacaoComercialCargo || isAprovacaoComercialPessoa || canSecretaria || canManage;
  const canFinanceiro = has(user, 'comissionamento.financeiro.view') || canSecretaria;
  const canViewAll = has(user, 'comissionamento.view.all') || canSecretaria || canHead || canManage;
  const canHistory = has(user, 'comissionamento.historico.view') || canSecretaria || canManage;
  const canPreviewComissionadoAll = canSecretaria || canManage;
  const canViewOwn = has(user, 'comissionamento.view.own')
    || has(user, 'maquina.vendas.dashboard.view')
    || has(user, 'maquina.vendas.dashboard.manage')
    || canPreviewComissionadoAll;
  return {
    canViewOwn,
    canViewAll,
    canSecretaria,
    canRules,
    canHead,
    canFinanceiro,
    canHistory,
    canPreviewComissionadoAll,
  };
}

function personOfficialLocation(row = {}) {
  const person = row.comissionado || {};
  return person.localidade || person.regiao || person.cidade || row.localidade || row.regiao || row.cidade || '-';
}

function personOfficialRole(row = {}) {
  const person = row.comissionado || {};
  return person.cargo || person.funcao || row.cargo || row.funcao || '-';
}

function personOfficialLabel(row = {}) {
  const name = row.nome || row.comissionado?.nome || '-';
  const role = personOfficialRole(row);
  const location = personOfficialLocation(row);
  return [name, role, location].filter((item) => item && item !== '-').join(' - ') || name;
}

function normalizeRow(item = {}) {
  const person = item.comissionado || {};
  const values = item.valores || {};
  const fluxo = item.fluxo || {};
  const tipo = person.tipo || item.tipo_comissionado || 'PJ_AUTONOMO';
  const funcao = personOfficialRole(item);
  const cidade = personOfficialLocation(item);
  const perfilFluxo = person.perfil_fluxo || item.perfil_fluxo || fluxo.perfil_fluxo || null;
  const typeConfig = DEFAULT_COMMISSION_CONFIG.types[tipo] || {};
  const rawActions = Array.isArray(fluxo.acoes_permitidas) ? fluxo.acoes_permitidas : [];
  const normalizedActions = [...new Set(rawActions.map(normalizeCommissionAction).filter(Boolean))];
  const statusAprovacao = normalizeCommissionStatus(
    fluxo.status_fluxo || fluxo.status_aprovacao || item.status_fluxo || item.status || 'calculada',
  );
  const defaultStatusNf = ['calculado', 'calculada', 'revisao_necessaria', 'rejeitada'].includes(statusAprovacao)
    ? 'pendente_nf'
    : 'solicitada';
  const statusNf = normalizeCommissionStatus(
    fluxo.status_nf || item.status_nf || (typeConfig.exige_nf === false ? 'nao_aplicavel' : defaultStatusNf),
  );
  const statusFinanceiro = normalizeCommissionStatus(
    fluxo.status_financeiro || item.status_financeiro || 'nao_enviado',
  );
  const statusPagamento = normalizeCommissionStatus(
    fluxo.status_pagamento || item.status_pagamento || 'nao_enviado',
  );
  return {
    ...item,
    id: item.id || item.resultado_id,
    codigoComissao: item.codigo_comissao || item.codigoComissao || item.id || item.resultado_id,
    cicloId: item.ciclo_id || item.ciclo?.ciclo_id || CYCLE_ID,
    nome: person.nome || item.nome || '-',
    funcao,
    cargo: person.cargo || item.cargo || funcao,
    cidade,
    localidade: person.localidade || item.localidade || cidade,
    regiao: person.regiao || item.regiao || cidade,
    tipo,
    perfilFluxo,
    bruto: Number(values.bruto ?? item.valor_bruto) || 0,
    distrato: Number(values.distratos ?? item.desconto_distrato) || 0,
    bonusIps: Number(values.bonus_ips) || 0,
    liquido: Number(values.liquido ?? item.valor_liquido) || 0,
    regra01: item.regra_01 || [],
    ips: item.regra_02_ips || [],
    fluxo: {
      status_aprovacao: statusAprovacao,
      status_nf: statusNf,
      status_financeiro: statusFinanceiro,
      status_pagamento: statusPagamento,
      etapa_ui: fluxo.etapa_ui || null,
      proxima_acao: normalizeCommissionAction(item.proxima_acao || fluxo.proxima_acao || 'enviar_head'),
      acoes_permitidas: normalizedActions,
      etapas: fluxo.etapas || [],
    },
  };
}

function normalizePreviewPayload(payload = {}, cicloId = CYCLE_ID) {
  const registros = payload.registros || payload.items || payload.resultados || [];
  return {
    ...payload,
    ciclo: payload.ciclo || { ciclo_id: cicloId, rotulo: cicloId },
    registros,
  };
}

function getStage(row) {
  const status = normalizeCommissionStatus(row.fluxo.status_aprovacao);
  const nf = normalizeCommissionStatus(row.fluxo.status_nf);
  const financeiro = normalizeCommissionStatus(row.fluxo.status_financeiro);
  const pagamento = normalizeCommissionStatus(row.fluxo.status_pagamento);
  if (
    [
      'calculada',
      'em_revisao_secretaria',
      'revisao_necessaria',
      'rejeitada',
      'cancelada',
    ].includes(status)
  ) return 'secretaria';
  if (['paga'].includes(status) || ['paga'].includes(pagamento)) return 'pagamento';
  if (
    ['enviada_pagamento', 'aguardando_pagamento'].includes(status)
    || ['enviada_pagamento', 'pronta_para_envio_pagamento', 'pacote_enviado'].includes(financeiro)
    || ['pacote_enviado', 'aguardando_pagamento'].includes(pagamento)
  ) return 'pagamento';
  if (
    ['pronta_para_envio_pagamento'].includes(status)
    || ['pronta_para_envio_pagamento'].includes(financeiro)
    || (requiresNf(row) && nf === 'validada')
  ) return 'pagamento';
  if (!requiresNf(row) && status === 'aprovada_head_comercial') return 'pagamento';
  if (status === 'aguardando_head_comercial') return 'head';
  if (
    requiresNf(row)
    && (
      ['aprovada_head_comercial', 'aguardando_nf', 'nf_em_validacao'].includes(status)
      || ['solicitada', 'recebida'].includes(nf)
    )
  ) return 'nf';
  return 'secretaria';
}

const RULE_EDITABLE_STATUSES = [
  'calculado_seed',
  'calculado',
  'calculada',
  'pendente_secretaria',
  'em_revisao_secretaria',
  'revisao_necessaria',
  'rejeitada',
];

function isRuleEditingAllowed(row = {}) {
  if (!row?.fluxo) return false;
  const status = normalizeCommissionStatus(row.fluxo.status_aprovacao);
  return RULE_EDITABLE_STATUSES.includes(status);
}

function isRuleEditingBlocked(row = {}) {
  return !isRuleEditingAllowed(row);
}

function allowedActions(row, scope = 'default') {
  const stage = getStage(row);
  const status = normalizeCommissionStatus(row.fluxo.status_aprovacao);
  const pagamento = normalizeCommissionStatus(row.fluxo.status_pagamento);
  if (scope === 'secretaria' && stage === 'head') return [];
  if (scope === 'head' && stage !== 'head') return [];
  if (status === 'rejeitada') return ['head', 'secretaria'].includes(scope) ? [] : ['solicitar_ajuste'];
  if (stage === 'pagamento' || ['paga', 'cancelada'].includes(status) || ['paga', 'aguardando_pagamento'].includes(pagamento)) {
    return [];
  }

  let stageActions = [];
  if (stage === 'secretaria') stageActions = ['enviar_head'];
  if (stage === 'head') stageActions = ['aprovar_head', 'rejeitar'];
  if (stage === 'nf') {
    stageActions = ['reenviar_lembrete_nf'];
  }
  const explicit = (row.fluxo.acoes_permitidas || []).map(normalizeCommissionAction).filter(Boolean);
  let actions = stageActions;
  if (explicit.length) {
    const explicitSet = new Set(explicit);
    actions = stageActions.filter((action) => explicitSet.has(action));
  }
  if (scope === 'secretaria') return actions.filter((action) => !['aprovar_head', 'rejeitar', 'solicitar_ajuste'].includes(action));
  if (scope === 'head') return actions.filter((action) => ['aprovar_head', 'rejeitar'].includes(action));
  return actions;
}

function flowStatus(row) {
  const stage = getStage(row);
  const status = normalizeCommissionStatus(row.fluxo.status_aprovacao);
  const nf = normalizeCommissionStatus(row.fluxo.status_nf);
  const pagamento = normalizeCommissionStatus(row.fluxo.status_pagamento);
  if (stage === 'pagamento') {
    return { label: flowLabel(pagamento === 'paga' ? 'paga' : 'aguardando_pagamento'), tone: flowTone(pagamento === 'paga' ? 'paga' : 'aguardando_pagamento') };
  }
  if (stage === 'nf') return { label: flowLabel(nf || status), tone: flowTone(nf || status) };
  return { label: flowLabel(status), tone: flowTone(status) };
}

function nextActionText(row) {
  const actions = allowedActions(row);
  if (!actions.length) return 'Sem ação pendente';
  if (actions[0] === 'solicitar_ajuste' && normalizeCommissionStatus(row.fluxo.status_aprovacao) === 'rejeitada') return 'Reabrir revisão';
  return actionLabels[actions[0]] || statusLabel[actions[0]] || actions[0];
}

function getCommissionProfileKey(row) {
  if (row?.perfilFluxo && DEFAULT_COMMISSION_CONFIG.flowProfiles[row.perfilFluxo]) return row.perfilFluxo;
  const raw = `${row?.tipo || ''} ${row?.funcao || ''}`.toUpperCase();
  if (/\bCLT\b/.test(raw)) return 'corretor_clt';
  if (/GEST|GER|COORD|HEAD|DIRETOR|SUPERV/.test(raw)) return 'gestor_coordenador_autonomo';
  return DEFAULT_COMMISSION_CONFIG.types[row?.tipo]?.perfil_fluxo || 'corretor_autonomo';
}

function getCommissionProfile(row) {
  return DEFAULT_COMMISSION_CONFIG.flowProfiles[getCommissionProfileKey(row)]
    || DEFAULT_COMMISSION_CONFIG.flowProfiles.corretor_autonomo;
}

function isClt(row) {
  return getCommissionProfileKey(row) === 'corretor_clt';
}

function requiresNf(row) {
  return Boolean(getCommissionProfile(row).exige_nf);
}

function isLeadership(row) {
  return Boolean(getCommissionProfile(row).mostra_equipe);
}

function paymentDestination(row) {
  return getCommissionProfile(row).destino;
}

function expectedDocument(row) {
  return getCommissionProfile(row).documento;
}

function getRule01(row) {
  return row?.regra01?.[0] || {};
}

function getRule01Steps(rule = {}) {
  const source = rule.escada || rule.faixas || rule.etapas || [];
  const normalized = Array.isArray(source) ? source.map((item, index) => ({
    id: item.id || item.faixa_id || `faixa_${index + 1}`,
    label: item.rotulo || item.label || item.faixa || item.nome || `${number(item.percentual_minimo ?? item.min ?? 0)}%`,
    min: Number(item.percentual_minimo ?? item.minimo ?? item.min ?? item.de ?? 0),
    max: Number(item.percentual_maximo ?? item.maximo ?? item.max ?? item.ate ?? 999),
    bonus: Number(item.valor_bonus ?? item.valor_faixa ?? item.bonus ?? item.valor ?? 0),
    objetivo: Number(item.objetivo_base ?? item.objetivo ?? rule.objetivo ?? 0),
    realizado: Number(item.realizado_atual ?? item.realizado ?? rule.realizado ?? 0),
    necessarioMinimo: Number(item.necessario_minimo ?? 0),
    necessarioMaximo: item.necessario_maximo === null || item.necessario_maximo === undefined ? null : Number(item.necessario_maximo),
    faltamParaMinimo: Number(item.faltam_para_minimo ?? 0),
  })) : [];

  if (normalized.length) return normalized;

  return [
    { id: 'faixa_01', label: '0% a 39,99%', min: 0, max: 39.99, bonus: 0 },
    { id: 'faixa_02', label: '40% a 69,99%', min: 40, max: 69.99, bonus: 0 },
    { id: 'faixa_03', label: '70% a 89,99%', min: 70, max: 89.99, bonus: 0 },
    { id: 'faixa_04', label: '90% a 99,99%', min: 90, max: 99.99, bonus: 0 },
    { id: 'faixa_05', label: '100% ou mais', min: 100, max: 999, bonus: Number(rule.valor_calculado || 0) },
  ];
}

function getAppliedRule01Step(rule = {}) {
  const steps = getRule01Steps(rule);
  const percent = Number(rule.percentual_atingimento) || 0;
  const byPercent = steps.find((step) => percent >= step.min && percent <= step.max);
  if (byPercent) return byPercent;
  return steps.find((step) => step.label === rule.faixa_aplicada) || steps[0];
}

function extractEventItems(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  return payload.items || payload.eventos || payload.registros || [];
}

function normalizeHistoryEvent(event = {}, rows = []) {
  const resultadoId = event.resultado_id || event.resultadoId || event.comissionamento_resultado_id || event.row_id;
  const row = rows.find((item) => item.id === resultadoId || item.nome === event.comissionado_nome);
  const payload = event.payload || {};
  const antes = payload.antes || event.antes || null;
  const depois = payload.depois || event.depois || null;
  const type = event.tipo_evento || event.tipo || event.evento || 'evento';
  const motivo = event.motivo || event.comentario || payload.motivo || payload.comentario || depois?.motivo || antes?.motivo || '';
  const usuario = event.responsavel || event.usuario_nome || event.usuario || event.criado_por || 'Sistema';
  const usuarioEmail = event.usuario_email || payload.usuario_email || payload.acao_executada_por_email || '';
  const usuarioPerfil = event.usuario_perfil || payload.usuario_perfil || payload.acao_executada_por_perfil || '';
  return {
    id: event.id || `${resultadoId || row?.id || 'ciclo'}-${type}-${event.criado_em || event.quando || Math.random()}`,
    official: Boolean(event.id && event.criado_em),
    resultadoId: resultadoId || row?.id || '',
    cicloId: event.ciclo_id || event.cicloId || row?.cicloId || CYCLE_ID,
    codigoComissao: event.codigo_comissao || payload.codigo_comissao || depois?.codigo_comissao || antes?.codigo_comissao || row?.codigoComissao || resultadoId || '',
    nome: event.comissionado_nome || event.nome || row?.nome || 'Ciclo',
    tipo: type,
    label: DEFAULT_COMMISSION_CONFIG.eventTypes[type] || statusLabel[type] || type,
    etapaAnterior: event.etapa_anterior || event.status_anterior || payload.etapa_anterior || antes?.status || antes?.etapa || '',
    etapaNova: event.etapa_nova || event.status_novo || payload.etapa_nova || depois?.status || depois?.etapa || '',
    valorAnterior: event.valor_anterior ?? payload.valor_anterior ?? antes?.valor,
    valorNovo: event.valor_novo ?? payload.valor_novo ?? depois?.valor ?? row?.liquido,
    regra: event.regra || payload.regra || payload.campo_regra || '',
    campo: event.campo || payload.campo || '',
    nfAnterior: event.status_nf_anterior || payload.status_nf_anterior || antes?.status_nf || '',
    nf: event.status_nf || payload.status_nf || depois?.status_nf || row?.fluxo?.status_nf || '',
    financeiroAnterior: event.status_financeiro_anterior || payload.status_financeiro_anterior || antes?.status_financeiro || '',
    financeiro: event.status_financeiro || payload.status_financeiro || depois?.status_financeiro || row?.fluxo?.status_financeiro || '',
    pagamentoAnterior: event.status_pagamento_anterior || payload.status_pagamento_anterior || antes?.status_pagamento || '',
    pagamento: event.status_pagamento || payload.status_pagamento || depois?.status_pagamento || row?.fluxo?.status_pagamento || '',
    usuario,
    usuarioEmail,
    usuarioPerfil,
    quando: event.criado_em || event.quando || event.data_hora || event.created_at || '',
    comentario: motivo,
    documentoId: event.documento_id || payload.documento_id || '',
    nfNumero: event.nf_numero || payload.nf_numero || '',
    nfDataEmissao: event.nf_data_emissao || payload.nf_data_emissao || '',
    nfNomeArquivo: event.nf_nome_arquivo || payload.nf_nome_arquivo || '',
    nfObservacao: event.nf_observacao || payload.nf_observacao || '',
    correlationId: event.correlation_id || payload.correlation_id || '',
    templatesEmail: event.templates_email || payload.templates_email || '',
    destinatariosEmail: event.destinatarios_email || payload.destinatarios_email || '',
    statusEnvioEmail: event.status_envio_email || payload.status_envio_email || '',
    antes,
    depois,
  };
}

function historyActionSummary(item = {}) {
  const actor = item.usuarioEmail ? `${item.usuario} (${item.usuarioEmail})` : item.usuario;
  const motivo = item.comentario ? ` Motivo/observação: ${item.comentario}` : '';
  if (item.tipo === 'comissao_aprovada_head') return `Aprovada por ${actor}.`;
  if (item.tipo === 'comissao_rejeitada_head') return `Rejeitada/devolvida por ${actor}.${motivo}`;
  if (item.tipo === 'recalculo_solicitado') return `Revisão/recalculo solicitado por ${actor}.${motivo}`;
  if (item.tipo === 'comissao_enviada_head') return `Enviada para Aprovação Comercial por ${actor}.`;
  if (item.tipo === 'nf_recebida') return `Nota Fiscal enviada por ${actor}.${motivo}`;
  if (item.tipo === 'notificacao_manual_disparada') return `Notificação reenviada por ${actor}.${motivo}`;
  return item.comentario || `Evento registrado por ${actor}.`;
}

function buildSyntheticEvents(rows = [], selectedEvents = []) {
  const official = selectedEvents.map((item) => normalizeHistoryEvent(item, rows));
  const synthetic = rows.flatMap((row) => {
    const rule = getRule01(row);
    const currentStage = getStage(row);
    return [
      normalizeHistoryEvent({
        id: `${row.id}-calculado`,
        resultado_id: row.id,
        tipo_evento: 'calculo_realizado',
        etapa_nova: 'secretaria',
        valor_novo: row.liquido,
        usuario_nome: 'Sistema',
        comentario: 'Cálculo carregado pelo preview operacional do ciclo.',
      }, rows),
      normalizeHistoryEvent({
        id: `${row.id}-regra01`,
        resultado_id: row.id,
        tipo_evento: 'regra_01_publicada',
        regra: 'Regra 01',
        campo: rule.indicador || 'indicador',
        valor_novo: rule.valor_calculado,
        usuario_nome: 'Secretaria de Vendas',
        payload: {
          depois: {
            faixa: rule.faixa_aplicada,
            percentual: rule.percentual_atingimento,
          },
        },
      }, rows),
      ...row.ips.map((ip) => normalizeHistoryEvent({
        id: `${row.id}-${ip.ip_id}`,
        resultado_id: row.id,
        tipo_evento: 'regra_02_publicada',
        regra: 'Regra 02',
        campo: ip.nome,
        valor_novo: ip.valor_bonus,
        usuario_nome: 'Secretaria de Vendas',
        payload: {
          depois: {
            indicador: ip.indicador,
            alvo: ip.alvo,
            realizado: ip.realizado,
            atingiu: ip.atingiu,
          },
        },
      }, rows)),
      normalizeHistoryEvent({
        id: `${row.id}-stage`,
        resultado_id: row.id,
        tipo_evento: getStage(row) === 'nf' ? 'nf_solicitada' : 'comissao_enviada_head',
        etapa_anterior: 'secretaria',
        etapa_nova: currentStage,
        valor_novo: row.liquido,
        usuario_nome: 'Fluxo de Comissionamento',
        comentario: statusLabel[row.fluxo.proxima_acao] || row.fluxo.proxima_acao,
      }, rows),
    ];
  });
  const unique = new Map([...official, ...synthetic].map((item) => [item.id, item]));
  return [...unique.values()];
}

function Rule01Ladder({ row, editable = false }) {
  const rule = getRule01(row);
  const steps = getRule01Steps(rule);
  const applied = getAppliedRule01Step(rule);
  const percent = Number(rule.percentual_atingimento) || 0;

  return (
    <section className="cm-detail-section">
      <div className="cm-section-title">
        <h3>Regra 01 - Escada de atingimento</h3>
        <Badge value="calculado">{number(percent)}%</Badge>
      </div>
      <div className="cm-progress"><span style={{ width: `${Math.min(percent, 140) / 140 * 100}%` }} /></div>
      <div className="cm-mini-grid">
        <span>Indicador <strong>{rule.indicador || '-'}</strong></span>
        <span>Objetivo x Realizado <strong>{number(rule.objetivo)} x {number(rule.realizado)}</strong></span>
        <span>Faixa atingida <strong>{applied?.label || rule.faixa_aplicada || '-'}</strong></span>
        <span>Valor da faixa <strong>{money(rule.valor_calculado || applied?.bonus)}</strong></span>
        <span>Fonte realizado <strong>{rule.fonte_realizado || '-'}</strong></span>
      </div>
      <div className="cm-ladder">
        {steps.map((step) => {
          const isApplied = applied?.id === step.id;
          return (
            <article className={isApplied ? 'is-applied' : ''} key={step.id}>
              <div>
                <strong>{step.label}</strong>
                <span>{number(step.min)}% até {step.max >= 999 ? 'acima' : `${number(step.max)}%`}</span>
                <span className="cm-ladder-context">
                  Realizado: {number(step.realizado)} de {number(step.objetivo)}. Para esta faixa: {number(step.necessarioMinimo)}
                  {step.necessarioMaximo === null ? ' ou mais' : ` até ${number(step.necessarioMaximo)}`}.
                  {step.faltamParaMinimo > 0 ? ` Faltam ${number(step.faltamParaMinimo)}.` : ' Faixa já alcançada.'}
                </span>
              </div>
              {editable ? (
                <label>
                  Bônus
                  <input
                    data-rule01-step
                    data-step-id={step.id}
                    data-step-label={step.label}
                    data-step-min={step.min}
                    data-step-max={step.max}
                    type="number"
                    min="0"
                    step="50"
                    defaultValue={step.bonus}
                  />
                </label>
              ) : (
                <b>{money(isApplied ? (rule.valor_calculado || step.bonus) : step.bonus)}</b>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Rule02List({ row }) {
  return (
    <section className="cm-detail-section">
      <h3>Regra 02 - IPs</h3>
      <div className="cm-ip-list">
        {row.ips.map((ip) => (
          <article className={ip.atingiu ? 'is-ok' : ''} key={ip.ip_id}>
            <strong>{ip.nome}</strong>
            <span>{ip.indicador} {ip.operador} {number(ip.alvo)} · realizado {number(ip.realizado)}</span>
            <b>{ip.atingiu ? 'Atingiu' : 'Não atingiu'} · {money(ip.valor_bonus)}</b>
          </article>
        ))}
        {!row.ips.length && <p className="cm-muted">Nenhum IP vinculado para este ciclo.</p>}
      </div>
    </section>
  );
}

function Badge({ value, children }) {
  const tone = statusTone[value] || 'neutral';
  return <span className={`cm-badge cm-badge--${tone}`}>{children || statusLabel[value] || value || '-'}</span>;
}

function Feedback({ feedback, onDismiss }) {
  if (!feedback?.message) return null;
  return (
    <div className={`cm-feedback cm-feedback--${feedback.type || 'info'}`}>
      <AlertCircle size={18} />
      <span>{feedback.message}</span>
      {onDismiss && <button type="button" onClick={onDismiss} aria-label="Fechar aviso"><X size={16} /></button>}
    </div>
  );
}

function ActionButton({ action, row, cicloId, onRun, pendingAction }) {
  const status = normalizeCommissionStatus(row?.fluxo?.status_aprovacao);
  let label = actionLabels[action] || statusLabel[action] || action;
  if (action === 'solicitar_ajuste' && status === 'rejeitada') label = 'Reabrir revisão';
  const pending = pendingAction === `${row?.id || cicloId}:${action}`;
  const sendActions = ['enviar_pacote_pagamento', 'solicitar_nf', 'reenviar_lembrete_nf'];
  return (
    <button
      className={`cm-button ${action === 'rejeitar' ? 'cm-button--danger' : ''}`}
      type="button"
      disabled={pending}
      onClick={() => onRun(action, row)}
    >
      {pending ? <Clock size={16} /> : sendActions.includes(action) ? <Send size={16} /> : <Check size={16} />}
      {pending ? 'Processando' : label}
    </button>
  );
}

function EmptyState({ title, text }) {
  return (
    <div className="cm-empty">
      <Wallet size={26} />
      <strong>{title}</strong>
      <span>{text}</span>
    </div>
  );
}

function WorkflowStepper({ row }) {
  const current = getStage(row);
  const order = getCommissionProfile(row).etapas;
  const index = order.indexOf(current);
  return (
    <div className="cm-stepper">
      {order.map((key, stepIndex) => (
        <div
          className={`cm-stepper__item ${key === current ? 'is-active' : ''} ${stepIndex < index ? 'is-done' : ''}`}
          key={key}
        >
          <strong>{stageLabels[key]}</strong>
          <span>{key === current ? (statusLabel[row.fluxo.proxima_acao] || row.fluxo.etapa_ui || 'Em andamento') : stepIndex < index ? 'Concluída' : 'Aguardando'}</span>
        </div>
      ))}
    </div>
  );
}

function FlowProfileCard({ row, compact = false }) {
  const profile = getCommissionProfile(row);
  return (
    <section className={compact ? 'cm-flow-card cm-flow-card--compact' : 'cm-flow-card'}>
      <div>
        <span>Fluxo aplicado</span>
        <strong>{profile.label}</strong>
        {!compact && <p>{profile.resumo}</p>}
      </div>
      <div className="cm-flow-card__meta">
        <span>{profile.exige_nf ? 'NF obrigatória' : 'Sem NF'}</span>
        <span>{profile.destino}</span>
        <span>{profile.documento}</span>
      </div>
    </section>
  );
}

function SummaryCards({ rows, ciclo }) {
  const total = rows.reduce((sum, item) => sum + item.liquido, 0);
  const nf = rows.filter((item) => requiresNf(item) && getStage(item) === 'nf').length;
  const payment = rows.filter((item) => getStage(item) === 'pagamento').length;
  const head = rows.filter((item) => getStage(item) === 'head').length;
  return (
    <section className="cm-summary" aria-label="Resumo do ciclo">
      <article><span>Total líquido</span><strong>{money(total)}</strong><small>Ciclo {ciclo?.rotulo || CYCLE_ID}</small></article>
      <article><span>Comissionados</span><strong>{rows.length}</strong><small>Base operacional</small></article>
      <article><span>Aguardando NF</span><strong>{nf}</strong><small>Pendência prática</small></article>
      <article><span>Pagamento</span><strong>{payment}</strong><small>Fluxo operacional enviado</small></article>
      <article><span>Aprovação Comercial</span><strong>{head}</strong><small>Fila da Diretoria Comercial</small></article>
      <article><span>Prazo de envio</span><strong>{date(ciclo?.prazo_envio_financeiro)}</strong><small>Pacote para pagamento</small></article>
    </section>
  );
}

function Tabs({ activeView, setActiveView, permissions }) {
  const tabs = [
    { id: 'secretaria', label: 'Secretaria', visible: permissions.canSecretaria },
    { id: 'head', label: 'Aprovação Comercial', visible: permissions.canHead },
    { id: 'comissionado', label: 'Comissionado', visible: permissions.canViewOwn || permissions.canPreviewComissionadoAll },
    { id: 'regras', label: 'Regras', visible: permissions.canRules },
    { id: 'historico', label: 'Histórico', visible: permissions.canHistory },
  ].filter((item) => item.visible);
  return (
    <nav className="cm-tabs" aria-label="Visões do comissionamento">
      {tabs.map((tab) => (
        <button
          className={tab.id === activeView ? 'is-active' : ''}
          key={tab.id}
          type="button"
          onClick={() => setActiveView(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function SecretariaView({ rows, selectedId, setSelectedId, onOpenDetail }) {
  const [mode, setMode] = useState('kanban');
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('todos');
  const [role, setRole] = useState('todos');
  const [status, setStatus] = useState('todos');
  const [flowProfile, setFlowProfile] = useState('todos');
  const [nf, setNf] = useState('todos');
  const [payment, setPayment] = useState('todos');
  const [rule01, setRule01] = useState('todos');
  const [rule02, setRule02] = useState('todos');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [quick, setQuick] = useState('todos');
  const cities = [...new Set(rows.map((item) => item.cidade))].filter(Boolean);
  const roles = [...new Set(rows.map((item) => item.funcao))].filter(Boolean);
  const flowProfiles = [...new Set(rows.map((item) => getCommissionProfileKey(item)))].filter(Boolean);
  const rule01Ranges = [...new Set(rows.map((item) => getRule01(item).faixa_aplicada).filter(Boolean))];
  const filtered = rows.filter((item) => {
    const text = `${item.nome} ${item.funcao} ${item.cidade}`.toLowerCase();
    const stage = getStage(item);
    const rule = getRule01(item);
    const hasIpOk = item.ips.some((ip) => ip.atingiu);
    const hasIpMiss = item.ips.some((ip) => !ip.atingiu);
    const min = minValue === '' ? null : Number(minValue);
    const max = maxValue === '' ? null : Number(maxValue);
    return (!query || text.includes(query.toLowerCase()))
      && (city === 'todos' || item.cidade === city)
      && (role === 'todos' || item.funcao === role)
      && (status === 'todos' || stage === status || item.fluxo.status_nf === status || item.fluxo.status_financeiro === status)
      && (quick === 'todos' || stage === quick || (quick === 'pagamento' && ['pagamento'].includes(stage)))
      && (flowProfile === 'todos' || getCommissionProfileKey(item) === flowProfile)
      && (nf === 'todos' || item.fluxo.status_nf === nf)
      && (payment === 'todos' || item.fluxo.status_pagamento === payment)
      && (rule01 === 'todos' || rule.faixa_aplicada === rule01)
      && (rule02 === 'todos' || (rule02 === 'atingiu' && hasIpOk) || (rule02 === 'nao_atingiu' && hasIpMiss))
      && (min === null || item.liquido >= min)
      && (max === null || item.liquido <= max);
  });

  const columns = [
    ['secretaria', 'Calculada/Revisão'],
    ['head', 'Aprovação Comercial'],
    ['nf', 'Aguardando NF'],
    ['pagamento', 'Pagamento'],
  ];

  return (
    <div className="cm-panel">
      <div className="cm-panel__head">
        <div>
          <h2>Visão da Secretaria</h2>
          <p>Controle por etapa, próxima ação e detalhe do cálculo.</p>
        </div>
          <div className="cm-tools">
          <div className="cm-segmented">
            <button className={mode === 'kanban' ? 'is-active' : ''} type="button" onClick={() => setMode('kanban')}>Kanban</button>
            <button className={mode === 'table' ? 'is-active' : ''} type="button" onClick={() => setMode('table')}>Tabela</button>
          </div>
          <select value={quick} onChange={(event) => setQuick(event.target.value)} aria-label="Pendências rápidas">
            {DEFAULT_COMMISSION_CONFIG.filters.quick.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <label className="cm-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, função ou cidade" /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar etapa">
            <option value="todos">Todas etapas</option>
            {columns.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            <option value="solicitada">NF solicitada</option>
          </select>
          <select value={city} onChange={(event) => setCity(event.target.value)} aria-label="Filtrar cidade">
            <option value="todos">Todas cidades</option>
            {cities.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={role} onChange={(event) => setRole(event.target.value)} aria-label="Filtrar função">
            <option value="todos">Todas funções</option>
            {roles.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={flowProfile} onChange={(event) => setFlowProfile(event.target.value)} aria-label="Filtrar fluxo">
            <option value="todos">Todos fluxos</option>
            {flowProfiles.map((item) => <option key={item} value={item}>{DEFAULT_COMMISSION_CONFIG.flowProfiles[item]?.label || item}</option>)}
          </select>
          <select value={nf} onChange={(event) => setNf(event.target.value)} aria-label="Filtrar NF">
            {DEFAULT_COMMISSION_CONFIG.filters.nf.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={payment} onChange={(event) => setPayment(event.target.value)} aria-label="Filtrar pagamento">
            {DEFAULT_COMMISSION_CONFIG.filters.pagamento.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={rule01} onChange={(event) => setRule01(event.target.value)} aria-label="Filtrar Regra 01">
            <option value="todos">Todas faixas Regra 01</option>
            {rule01Ranges.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={rule02} onChange={(event) => setRule02(event.target.value)} aria-label="Filtrar Regra 02">
            <option value="todos">Todos IPs</option>
            <option value="atingiu">Algum IP atingido</option>
            <option value="nao_atingiu">Algum IP não atingido</option>
          </select>
          <input type="number" min="0" value={minValue} onChange={(event) => setMinValue(event.target.value)} placeholder="Valor mín." aria-label="Valor mínimo" />
          <input type="number" min="0" value={maxValue} onChange={(event) => setMaxValue(event.target.value)} placeholder="Valor máx." aria-label="Valor máximo" />
        </div>
      </div>
      {mode === 'kanban' ? (
        <div className="cm-kanban">
          {columns.map(([stage, label]) => {
            const items = filtered.filter((item) => getStage(item) === stage);
            return (
              <section className="cm-kanban__column" key={stage}>
                <header><span>{label}</span><strong>{items.length}</strong></header>
                <div className="cm-kanban__cards">
                  {items.map((item) => {
                    const current = flowStatus(item);
                    return (
	                      <button
	                        className={`cm-kanban-card ${selectedId === item.id ? 'is-selected' : ''}`}
	                        type="button"
	                        key={item.id}
	                        onClick={() => {
	                          setSelectedId(item.id);
	                          onOpenDetail?.(item.id);
	                        }}
	                      >
	                        <strong>{item.nome}</strong>
	                        <small>{item.codigoComissao}</small>
	                        <span>{item.funcao} · {item.cidade}</span>
                        <b>{money(item.liquido)}</b>
                        <span className={`cm-kanban-status cm-kanban-status--${current.tone}`}>{current.label}</span>
                        <small>Próxima ação: {nextActionText(item)}</small>
                      </button>
                    );
                  })}
                  {!items.length && <p className="cm-muted">Nenhuma comissão nesta etapa.</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="cm-table-wrap">
          <table className="cm-table">
            <thead>
              <tr>
	                <th>Comissão</th>
	                <th>Nome</th>
                <th>Função</th>
                <th>Cidade</th>
                <th>Fluxo</th>
                <th>Líquido</th>
                <th>Etapa</th>
                <th>NF</th>
                <th>Destino</th>
                <th>Próxima ação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr className={selectedId === item.id ? 'is-selected' : ''} key={item.id}>
	                  <td>{item.codigoComissao}</td>
	                  <td><button className="cm-row-link" type="button" onClick={() => { setSelectedId(item.id); onOpenDetail?.(item.id); }}>{item.nome}<span>Abrir detalhe</span></button></td>
                  <td>{item.funcao}</td>
                  <td>{item.cidade}</td>
                  <td>{getCommissionProfile(item).label}</td>
                  <td>{money(item.liquido)}</td>
                  <td>{stageLabels[getStage(item)]}</td>
                  <td><Badge value={item.fluxo.status_nf} /></td>
                  <td>{paymentDestination(item)}</td>
                  <td>{nextActionText(item)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DetailDrawer({ row, eventos, onClose, onRunAction, pendingAction, expanded = false, onToggleExpanded, modal = false, actionScope = 'default' }) {
  if (!row) return null;
  const actions = allowedActions(row, actionScope);
  const actionArea = actions.length ? actions.map((action) => (
    <ActionButton key={action} action={action} row={row} onRun={onRunAction} pendingAction={pendingAction} />
  )) : <span className="cm-muted">Nenhuma ação liberada pela API para esta etapa.</span>;
  return (
    <aside className={`cm-drawer ${expanded ? 'is-expanded' : ''} ${modal ? 'cm-drawer--modal' : ''}`} aria-label="Detalhe da comissão">
      <div className="cm-drawer__head">
        <div>
	          <span>{row.funcao}</span>
	          <h2>{row.nome}</h2>
	          <p>{row.codigoComissao} · {row.cidade} · {row.tipo}</p>
        </div>
        <div className="cm-drawer__tools">
          {!modal && (
            <button type="button" onClick={onToggleExpanded} aria-label={expanded ? 'Reduzir detalhe' : 'Expandir detalhe'}>
              {expanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Fechar detalhe"><X size={20} /></button>
        </div>
      </div>
      <div className="cm-drawer__top-actions">
        <div>
          <span>Etapa atual</span>
          <strong>{stageLabels[getStage(row)] || flowStatus(row).label}</strong>
          <small>Próxima ação: {nextActionText(row)}</small>
        </div>
        <div className="cm-drawer__actions">{actionArea}</div>
      </div>
      <div className="cm-value-grid">
        <div><span>Bruto</span><strong>{money(row.bruto)}</strong></div>
        <div><span>Distrato</span><strong>{money(row.distrato)}</strong></div>
        <div><span>Bônus IPs</span><strong>{money(row.bonusIps)}</strong></div>
        <div><span>Líquido</span><strong>{money(row.liquido)}</strong></div>
        <div><span>Destino pagamento</span><strong>{paymentDestination(row)}</strong></div>
        <div><span>Documento</span><strong>{expectedDocument(row)}</strong></div>
      </div>
      <FlowProfileCard row={row} compact />
      <WorkflowStepper row={row} />
      <Rule01Ladder row={row} />
      <Rule02List row={row} />
      <section className="cm-detail-section">
        <h3>Histórico</h3>
        <div className="cm-history">
          {eventos?.length ? eventos.map((item, index) => (
            <div key={item.id || index}>
              <strong>{item.tipo_evento || item.etapa || 'Evento'}</strong>
              <span>{date(item.criado_em || item.quando)} · {item.responsavel || item.usuario_nome || 'Sistema'}</span>
            </div>
          )) : <p className="cm-muted">Histórico oficial será exibido quando o endpoint de eventos estiver disponível.</p>}
        </div>
      </section>
    </aside>
  );
}

function DetailModal({ row, eventos, onClose, onRunAction, pendingAction, actionScope = 'default' }) {
  if (!row) return null;
  return (
    <div className="cm-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="cm-detail-modal" role="dialog" aria-modal="true" aria-label="Detalhe da comissão" onMouseDown={(event) => event.stopPropagation()}>
        <DetailDrawer
          row={row}
          eventos={eventos}
          onClose={onClose}
          onRunAction={onRunAction}
          pendingAction={pendingAction}
          actionScope={actionScope}
          expanded
          modal
        />
      </div>
    </div>
  );
}

function HeadView({ rows, onRunAction, pendingAction, canAct = true }) {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('todos');
  const [role, setRole] = useState('todos');
  const [quick, setQuick] = useState('todos');
  const cities = [...new Set(rows.map((item) => item.cidade))].filter(Boolean);
  const roles = [...new Set(rows.map((item) => item.funcao))].filter(Boolean);
  const baseRows = rows.filter((item) => {
    const text = `${item.nome} ${item.funcao} ${item.cidade}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase()))
      && (city === 'todos' || item.cidade === city)
      && (role === 'todos' || item.funcao === role);
  });
  const pending = baseRows.filter((item) => {
    const actions = allowedActions(item, 'head');
    return getStage(item) === 'head' || actions.includes('aprovar_head');
  });
  const returned = baseRows.filter((item) => {
    const status = normalizeCommissionStatus(item.fluxo.status_aprovacao);
    return ['rejeitada', 'revisao_necessaria'].includes(status);
  });
  const approved = baseRows.filter((item) => {
    const stage = getStage(item);
    const status = normalizeCommissionStatus(item.fluxo.status_aprovacao);
    return !pending.includes(item)
      && !returned.includes(item)
      && (
        ['nf', 'pagamento'].includes(stage)
        || ['aprovada_head_comercial', 'pronta_para_envio_pagamento', 'enviada_pagamento', 'aguardando_pagamento', 'paga'].includes(status)
      );
  });
  const visiblePending = quick === 'aprovadas' ? [] : pending;
  const visibleApproved = ['pendentes', 'devolvidas'].includes(quick) ? [] : approved;
  const visibleReturned = ['pendentes', 'aprovadas'].includes(quick) ? [] : returned;
  const renderCard = (item, canAct) => (
    <article className="cm-head-card" key={item.id}>
      <div className="cm-head-card__main">
        <div>
	          <strong>{item.nome}</strong>
	          <span>{item.codigoComissao} · {item.funcao} · {item.cidade}</span>
        </div>
        <b>{money(item.liquido)}</b>
      </div>
      <details>
        <summary>Detalhar comissão</summary>
        <div className="cm-head-detail">
          <div className="cm-mini-grid">
            <span>Bruto <strong>{money(item.bruto)}</strong></span>
            <span>Distrato <strong>{money(item.distrato)}</strong></span>
            <span>Bônus IPs <strong>{money(item.bonusIps)}</strong></span>
            <span>Etapa <strong>{stageLabels[getStage(item)]}</strong></span>
          </div>
          <Rule01Ladder row={item} />
          <Rule02List row={item} />
        </div>
      </details>
      {canAct && (
        <div className="cm-card-actions">
          {['aprovar_head', 'rejeitar'].filter((action) => allowedActions(item, 'head').includes(action)).map((action) => (
            <ActionButton key={action} action={action} row={item} onRun={onRunAction} pendingAction={pendingAction} />
          ))}
        </div>
      )}
    </article>
  );
  return (
    <div className="cm-head-stack">
      <div className="cm-panel">
        <div className="cm-panel__head">
          <div>
            <h2>Aprovação Comercial</h2>
            <p>Fila de aprovação da Diretoria Comercial com cálculo, Regra 01 e IPs da Regra 02.</p>
          </div>
          <div className="cm-tools">
            <div className="cm-segmented">
              <button className={quick === 'todos' ? 'is-active' : ''} type="button" onClick={() => setQuick('todos')}>Todos</button>
              <button className={quick === 'pendentes' ? 'is-active' : ''} type="button" onClick={() => setQuick('pendentes')}>Pendentes</button>
              <button className={quick === 'aprovadas' ? 'is-active' : ''} type="button" onClick={() => setQuick('aprovadas')}>Aprovadas</button>
              <button className={quick === 'devolvidas' ? 'is-active' : ''} type="button" onClick={() => setQuick('devolvidas')}>Devolvidas</button>
            </div>
            <label className="cm-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, função ou cidade" /></label>
            <select value={city} onChange={(event) => setCity(event.target.value)} aria-label="Filtrar cidade na aprovação comercial">
              <option value="todos">Todas cidades</option>
              {cities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={role} onChange={(event) => setRole(event.target.value)} aria-label="Filtrar função na aprovação comercial">
              <option value="todos">Todas funções</option>
              {roles.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="cm-head-board">
        <section>
          <header><h2>Faltam aprovar</h2><strong>{pending.length}</strong></header>
          <div className="cm-head-list">{visiblePending.map((item) => renderCard(item, true)) || null}</div>
          {!visiblePending.length && <EmptyState title="Nada aguardando aprovação comercial" text="As comissões já seguiram para a próxima etapa." />}
        </section>
        <section>
          <header><h2>Já aprovadas ou etapa seguinte</h2><strong>{approved.length}</strong></header>
          <div className="cm-head-list">{visibleApproved.map((item) => renderCard(item, false))}</div>
          {!visibleApproved.length && <EmptyState title="Nenhuma comissão nesta lista" text="Ajuste os filtros rápidos para ver outros resultados." />}
        </section>
        <section>
          <header><h2>Devolvidas/Rejeitadas</h2><strong>{returned.length}</strong></header>
          <p className="cm-muted">Essas comissões voltam para Calculada/Revisão na visão da Secretaria.</p>
          <div className="cm-head-list">{visibleReturned.map((item) => renderCard(item, false))}</div>
          {!visibleReturned.length && <EmptyState title="Nenhuma devolução" text="Rejeições e ajustes solicitados aparecem aqui e na etapa Calculada/Revisão." />}
        </section>
      </div>
    </div>
  );
}

function NfUploadPanel({ row, onUpload, pendingAction }) {
  const [file, setFile] = useState(null);
  const [numero, setNumero] = useState('');
  const [dataEmissao, setDataEmissao] = useState('');
  const [valor, setValor] = useState(row?.liquido || '');
  const [observacao, setObservacao] = useState('');
  const pending = pendingAction === `${row?.id}:upload_nf`;
  const pdfOk = Boolean(file && (!file.type || file.type === 'application/pdf') && file.name?.toLowerCase().endsWith('.pdf'));
  const canSend = pdfOk && numero && dataEmissao && valor;

  const submit = (event) => {
    event.preventDefault();
    if (!canSend || pending) return;
    onUpload(row, {
      arquivo: file,
      numero_nf: numero,
      data_emissao: dataEmissao,
      valor_nf: valor,
      observacao,
    });
  };

  return (
    <section className="cm-nf-upload">
      <div>
        <h3>Enviar Nota Fiscal</h3>
        <p>Envie apenas PDF. O arquivo será anexado ao e-mail de pagamento e o portal guardará somente os metadados.</p>
      </div>
      <form onSubmit={submit}>
        <label>Número da NF<input value={numero} onChange={(event) => setNumero(event.target.value)} placeholder="Ex.: 1024" /></label>
        <label>Data de emissão<input type="date" value={dataEmissao} onChange={(event) => setDataEmissao(event.target.value)} /></label>
        <label>Valor da NF<input type="number" min="0" step="0.01" value={valor} onChange={(event) => setValor(event.target.value)} /></label>
        <label>Arquivo PDF<input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
        <label className="cm-form-wide">Observação<textarea value={observacao} onChange={(event) => setObservacao(event.target.value)} rows="3" placeholder="Opcional" /></label>
        {file && <p className="cm-file-summary">{file.name} · {number(file.size / 1024)} KB{file.type && file.type !== 'application/pdf' ? ' · selecione um PDF válido' : ''}</p>}
        <button className="cm-button" type="submit" disabled={!canSend || pending}>
          {pending ? <Clock size={16} /> : <Send size={16} />}
          {pending ? 'Enviando' : 'Enviar NF'}
        </button>
      </form>
    </section>
  );
}

function NoNfStatusPanel({ row }) {
  const stage = getStage(row);
  const profile = getCommissionProfile(row);
  const steps = profile.status_simples.map((label, index) => [`step-${index}`, label]);
  const activeIndex = row.fluxo.status_pagamento === 'paga' ? 3 : stage === 'pagamento' ? 2 : 0;
  return (
    <section className="cm-clt-status">
      <div>
        <h3>Status {profile.label}</h3>
        <p>{profile.resumo}</p>
      </div>
      <div className="cm-clt-status__steps">
        {steps.map(([key, label], index) => (
          <span className={index <= activeIndex ? 'is-active' : ''} key={key}>{label}</span>
        ))}
      </div>
    </section>
  );
}

function PeopleUnderPanel({ row, rows = [], canPreviewAll = false }) {
  const explicit = row.equipe || row.subordinados || row.pessoas_abaixo || row.corretores_vinculados || [];
  const people = explicit.map((item, index) => normalizeRow({ ...item, id: item.id || item.resultado_id || `vinculo-${index}` }));

  if (!isLeadership(row) && !people.length) return null;
  if (!people.length) return null;

  return (
    <section className="cm-detail-section">
      <div className="cm-section-title">
        <h3>Pessoas vinculadas</h3>
        <Badge value="calculado">{people.length}</Badge>
      </div>
      <div className="cm-people-list">
        {people.map((person) => (
          <article key={person.id}>
            <div>
              <strong>{person.nome}</strong>
              <span>{person.funcao} · {person.cidade}</span>
              {(person.email || person.vinculo_origem) && (
                <small>{[person.email, person.vinculo_origem].filter(Boolean).join(' · ')}</small>
              )}
            </div>
            <b>{person.ativo === false ? 'Inativo' : person.status || 'Vinculado'}</b>
          </article>
        ))}
      </div>
    </section>
  );
}

function ComissionadoView({ minhaComissao, minhaError, rows = [], selectedId, setSelectedId, canPreviewAll = false, onUploadNf, onRunAction, pendingAction }) {
  const previewRow = rows.find((item) => item.id === selectedId) || rows[0] || null;
  const selectedPayload = minhaComissao || (canPreviewAll ? previewRow : null);
  if (minhaError && !selectedPayload) {
    return <EmptyState title="Não encontramos sua comissão" text="A visão própria depende do vínculo do usuário ao comissionado no backend." />;
  }
  if (!selectedPayload) {
    return <EmptyState title="Carregando comissão" text="Buscando apenas as informações vinculadas ao seu usuário." />;
  }
  const row = normalizeRow(selectedPayload);
  const showNfUpload = requiresNf(row) && getStage(row) === 'nf';
  const stage = getStage(row);
  const statusPagamento = normalizeCommissionStatus(row.fluxo.status_pagamento);
  const statusAprovacao = normalizeCommissionStatus(row.fluxo.status_aprovacao);
  const canRequestReview = stage !== 'pagamento'
    && !['paga', 'cancelada', 'enviada_pagamento', 'pronta_para_envio_pagamento'].includes(statusAprovacao)
    && !['paga', 'aguardando_pagamento'].includes(statusPagamento);
  const reviewPending = pendingAction === `${row.id}:solicitar_ajuste`;
  return (
    <div className="cm-personal">
      {canPreviewAll && (
        <div className="cm-panel">
          <div className="cm-panel__head">
            <div>
              <h2>Validar visão do Comissionado</h2>
              <p>A tela abaixo replica a visão operacional do comissionado selecionado.</p>
            </div>
            <div className="cm-tools">
              <select value={row.id || ''} onChange={(event) => setSelectedId(event.target.value)} aria-label="Selecionar comissionado para validar visão">
                {rows.map((item) => <option key={item.id} value={item.id}>{personOfficialLabel(item)}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}
      <section className="cm-personal-hero">
        <div>
          <span>{row.codigoComissao} · {row.funcao}</span>
          <h2>Onde está minha comissão</h2>
          <p>{getCommissionProfile(row).label} · {stageLabels[getStage(row)]} · {statusLabel[row.fluxo.proxima_acao] || row.fluxo.proxima_acao}</p>
        </div>
        <strong>{money(row.liquido)}</strong>
      </section>
      {canRequestReview && (
        <section className="cm-detail-section cm-review-request">
          <div className="cm-section-title">
            <div>
              <h3>Pedir revisão/recalculo</h3>
              <p className="cm-muted">Use quando identificar divergência. A comissão volta para a Secretaria iniciar uma nova rodada da esteira.</p>
            </div>
          </div>
          <button
            className="cm-button cm-button--secondary"
            type="button"
            disabled={reviewPending}
            onClick={() => onRunAction?.('solicitar_ajuste', row)}
          >
            {reviewPending ? <Clock size={16} /> : <PencilLine size={16} />}
            {reviewPending ? 'Enviando pedido' : 'Pedir revisão/recalculo'}
          </button>
        </section>
      )}
      <FlowProfileCard row={row} />
      <WorkflowStepper row={row} />
      <div className="cm-value-grid">
        <div><span>Valor líquido</span><strong>{money(row.liquido)}</strong></div>
        {requiresNf(row) ? (
          <div><span>Nota fiscal</span><strong>{statusLabel[row.fluxo.status_nf] || row.fluxo.status_nf}</strong></div>
        ) : (
          <div><span>Tipo</span><strong>CLT sem NF</strong></div>
        )}
        <div><span>Destino</span><strong>{paymentDestination(row)}</strong></div>
        <div><span>Pagamento</span><strong>{statusLabel[row.fluxo.status_pagamento] || row.fluxo.status_pagamento}</strong></div>
      </div>
      {requiresNf(row) ? (
        showNfUpload
          ? <NfUploadPanel row={row} onUpload={onUploadNf} pendingAction={pendingAction} />
          : <section className="cm-clt-status"><h3>Nota Fiscal</h3><p>{statusLabel[row.fluxo.status_nf] || 'Aguardando próxima etapa do fluxo.'}</p></section>
      ) : <NoNfStatusPanel row={row} />}
      <PeopleUnderPanel row={row} rows={rows} canPreviewAll={canPreviewAll} />
      <Rule01Ladder row={row} />
      <Rule02List row={row} />
    </div>
  );
}

function HistoryView({ rows, eventos, selectedId, setSelectedId, ciclos, activeCycleId, setActiveCycleId, permissions }) {
  const [query, setQuery] = useState('');
  const [person, setPerson] = useState('todos');
  const [type, setType] = useState('todos');
  const [stage, setStage] = useState('todos');
  const [user, setUser] = useState('');
  const [rule, setRule] = useState('todos');
  const [nf, setNf] = useState('todos');
  const [payment, setPayment] = useState('todos');
  const [category, setCategory] = useState('todos');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const normalized = useMemo(() => buildSyntheticEvents(rows, eventos), [rows, eventos]);
  const visible = normalized.filter((item) => {
    const text = `${item.codigoComissao} ${item.nome} ${item.label} ${item.comentario} ${item.usuario} ${item.usuarioEmail} ${item.usuarioPerfil} ${item.regra} ${item.campo} ${item.nfNumero} ${item.nfNomeArquivo} ${item.destinatariosEmail}`.toLowerCase();
    const when = item.quando ? new Date(item.quando) : null;
    const eventStages = [stageFromStatus(item.etapaAnterior), stageFromStatus(item.etapaNova)].filter(Boolean);
    return (!query || text.includes(query.toLowerCase()))
      && (person === 'todos' || item.resultadoId === person)
      && (type === 'todos' || item.tipo === type)
      && (stage === 'todos' || item.etapaNova === stage || item.etapaAnterior === stage || eventStages.includes(stage))
      && (!user || `${item.usuario}`.toLowerCase().includes(user.toLowerCase()))
      && (rule === 'todos' || item.regra === rule)
      && (nf === 'todos' || item.nf === nf)
      && (payment === 'todos' || item.pagamento === payment)
      && (category === 'todos' || historyCategory(item) === category)
      && (!startDate || (when && when >= new Date(`${startDate}T00:00:00Z`)))
      && (!endDate || (when && when <= new Date(`${endDate}T23:59:59Z`)));
  });
  const types = [...new Set(normalized.map((item) => item.tipo))].filter(Boolean);
  const rules = [...new Set(normalized.map((item) => item.regra).filter(Boolean))];
  const stages = Object.keys(DEFAULT_COMMISSION_CONFIG.stages);
  const officialCount = visible.filter((item) => item.official).length;
  const ruleEvents = visible.filter((item) => String(item.tipo).startsWith('regra_')).length;
  const flowEvents = visible.filter((item) => !String(item.tipo).startsWith('regra_')).length;
  const documentEvents = visible.filter((item) => item.documentoId).length;
  const attentionEvents = visible.filter((item) => historyCategory(item) === 'atencao').length;

  return (
    <div className="cm-panel">
      <div className="cm-panel__head">
        <div>
          <h2>Histórico do ciclo</h2>
          <p>Timeline operacional para acompanhar valor, regras, passagem de etapa, NF, pagamento e edição.</p>
        </div>
        <div className="cm-tools">
          <select value={activeCycleId} onChange={(event) => setActiveCycleId(event.target.value)} aria-label="Histórico por ciclo">
            {ciclos.map((item) => <option key={cycleIdOf(item)} value={cycleIdOf(item)}>{cycleLabelOf(item)}</option>)}
          </select>
          <label className="cm-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar no histórico" /></label>
          <select value={person} onChange={(event) => { setPerson(event.target.value); if (event.target.value !== 'todos') setSelectedId(event.target.value); }} aria-label="Filtrar comissionado">
            <option value="todos">Todos comissionados</option>
            {rows.map((item) => <option key={item.id} value={item.id}>{personOfficialLabel(item)}</option>)}
          </select>
          <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Tipo de evento">
            <option value="todos">Todos eventos</option>
            {types.map((item) => <option key={item} value={item}>{DEFAULT_COMMISSION_CONFIG.eventTypes[item] || item}</option>)}
          </select>
          <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Categoria do histórico">
            {Object.entries(HISTORY_CATEGORIES).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}
          </select>
          <select value={stage} onChange={(event) => setStage(event.target.value)} aria-label="Etapa">
            <option value="todos">Todas etapas</option>
            {stages.map((item) => <option key={item} value={item}>{stageLabels[item]}</option>)}
          </select>
          <select value={rule} onChange={(event) => setRule(event.target.value)} aria-label="Regra">
            <option value="todos">Todas regras</option>
            {rules.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={nf} onChange={(event) => setNf(event.target.value)} aria-label="Status NF">
            {DEFAULT_COMMISSION_CONFIG.filters.nf.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={payment} onChange={(event) => setPayment(event.target.value)} aria-label="Status pagamento">
            {DEFAULT_COMMISSION_CONFIG.filters.pagamento.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <input value={user} onChange={(event) => setUser(event.target.value)} placeholder="Usuário" aria-label="Filtrar usuário" />
          <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-label="Data inicial" />
          <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-label="Data final" />
        </div>
      </div>
      <div className="cm-history-categories" aria-label="Filtros rápidos do histórico">
        {Object.entries(HISTORY_CATEGORIES).map(([key, item]) => {
          const Icon = item.Icon || ShieldCheck;
          const active = category === key;
          return (
            <button className={`cm-history-filter cm-history-filter--${item.tone} ${active ? 'is-active' : ''}`} key={key} type="button" onClick={() => setCategory(key)}>
              <Icon size={15} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
      <div className="cm-history-summary">
        <article><span>Eventos no filtro</span><strong>{visible.length}</strong><small>{officialCount} oficiais do backend</small></article>
        <article><span>Edições de regras</span><strong>{ruleEvents}</strong><small>Regra 01 e Regra 02</small></article>
        <article><span>Movimentos de fluxo</span><strong>{flowEvents}</strong><small>Etapas, NF e pagamento</small></article>
        <article><span>Pontos de atenção</span><strong>{attentionEvents}</strong><small>Rejeições, ajustes e correções</small></article>
        <article><span>Documentos</span><strong>{documentEvents}</strong><small>NFs ou anexos vinculados</small></article>
      </div>
      <div className="cm-history-layout">
        <section className="cm-timeline">
          {visible.map((item) => {
            const categoryConfig = historyCategoryConfig(item);
            const Icon = categoryConfig.Icon || ShieldCheck;
            const auditDetails = auditDetailsForEvent(item);
            return (
              <article className={selectedId === item.resultadoId ? 'is-selected' : ''} key={item.id}>
              <div className={`cm-timeline__marker cm-timeline__marker--${categoryConfig.tone}`} />
              <div className={`cm-timeline__body cm-timeline__body--${categoryConfig.tone}`}>
                <header>
                  <div className="cm-event-title">
                    <span className={`cm-event-icon cm-event-icon--${categoryConfig.tone}`}><Icon size={16} /></span>
                    <div>
                      <strong>{item.label}</strong>
                      <span>{item.codigoComissao || item.resultadoId} · {item.nome} · {dateTime(item.quando)}</span>
                    </div>
                  </div>
                  <div className="cm-event-tags">
                    <span className={`cm-event-chip cm-event-chip--${categoryConfig.tone}`}>{categoryConfig.label}</span>
                    <span className={`cm-event-chip ${item.official ? 'cm-event-chip--ok' : 'cm-event-chip--neutral'}`}>{item.official ? 'Oficial' : 'Prévia'}</span>
                  </div>
                </header>
                <p className="cm-event-summary">{historyActionSummary(item)}</p>
                <div className="cm-audit-block">
                  <strong>Detalhamento da auditoria</strong>
                  <div className="cm-audit-list">
                    {auditDetails.map((detail) => (
                      <span className={detail.changed ? 'is-changed' : ''} key={detail.label}>
                        {detail.label}
                        <b>{detail.before} → {detail.after}</b>
                      </span>
                    ))}
                    <span>
                      Origem
                      <b>{item.official ? 'Evento oficial persistido no backend' : 'Prévia calculada para conferência da tela'}</b>
                    </span>
                  </div>
                </div>
                <div className="cm-event-grid">
                  <span>Responsável <strong>{item.usuario}</strong></span>
                  <span>E-mail/perfil <strong>{item.usuarioEmail || '-'} {item.usuarioPerfil ? `· ${item.usuarioPerfil}` : ''}</strong></span>
                  <span>Etapa <strong>{flowOrStageLabel(item.etapaAnterior)} → {flowOrStageLabel(item.etapaNova)}</strong></span>
                  <span>NF <strong>{flowLabel(item.nfAnterior)} → {flowLabel(item.nf)}</strong></span>
                  <span>Financeiro <strong>{flowLabel(item.financeiroAnterior)} → {flowLabel(item.financeiro)}</strong></span>
                  <span>Pagamento <strong>{flowLabel(item.pagamentoAnterior)} → {flowLabel(item.pagamento)}</strong></span>
                  <span>Valor <strong>{item.valorAnterior !== undefined ? `${money(item.valorAnterior)} → ` : ''}{item.valorNovo !== undefined ? money(item.valorNovo) : '-'}</strong></span>
                  <span>Regra/campo <strong>{item.regra || '-'} {item.campo ? `· ${item.campo}` : ''}</strong></span>
                  {item.correlationId && <span>Correlação <strong>{item.correlationId}</strong></span>}
                </div>
                {(item.nfNumero || item.nfNomeArquivo || item.nfDataEmissao) && (
                  <div className="cm-event-callout">
                    <strong>Nota Fiscal</strong>
                    <span>Número: {item.nfNumero || '-'} · Emissão: {date(item.nfDataEmissao)} · Arquivo: {item.nfNomeArquivo || '-'}</span>
                    {item.nfObservacao && <span>Observação: {item.nfObservacao}</span>}
                  </div>
                )}
                {(item.templatesEmail || item.destinatariosEmail || item.statusEnvioEmail) && (
                  <div className="cm-event-callout">
                    <strong>E-mail/notificação</strong>
                    <span>Template: {item.templatesEmail || '-'}</span>
                    <span>Status: {item.statusEnvioEmail || '-'}</span>
                    <span>Destinatários: {item.destinatariosEmail || '-'}</span>
                  </div>
                )}
                {(item.antes || item.depois || item.documentoId) && (
                  <div className="cm-event-diff">
                    {item.antes && <div><span>Antes</span><code>{shortJson(item.antes)}</code></div>}
                    {item.depois && <div><span>Depois</span><code>{shortJson(item.depois)}</code></div>}
                    {item.documentoId && <div><span>Documento</span><code>{item.documentoId}</code></div>}
                  </div>
                )}
              </div>
            </article>
            );
          })}
          {!visible.length && <EmptyState title="Nenhum evento encontrado" text="Ajuste os filtros ou aguarde o backend persistir eventos oficiais do ciclo." />}
        </section>
        {permissions.canHistory && (
          <aside className="cm-history-side">
            <h3>Leitura da auditoria</h3>
            <p>Eventos oficiais mostram quem fez, quando fez, de qual status saiu, para qual status foi, valor, regra alterada e documento relacionado.</p>
            <strong>{officialCount}</strong>
            <span>eventos oficiais no filtro atual</span>
          </aside>
        )}
      </div>
    </div>
  );
}

function RegrasView({
  rows,
  regras,
  configuracaoCiclo,
  onSaveCycleConfig,
  onPublishRule,
  actionFeedback,
  onPublished,
  onTrackCommission,
}) {
  const [personId, setPersonId] = useState(rows[0]?.id || '');
  const [ruleType, setRuleType] = useState('regra_01');
  const [objectiveDraft, setObjectiveDraft] = useState(Number(configuracaoCiclo?.objetivo_repasse_geral || 0));
  const person = rows.find((item) => item.id === personId) || rows[0];
  const regra = getRule01(person);
  const [rule2Items, setRule2Items] = useState([]);
  const [deletedRule2Ids, setDeletedRule2Ids] = useState([]);
  const [ipId, setIpId] = useState('');
  const [publishState, setPublishState] = useState({ status: 'idle', message: '' });
  const ip = rule2Items.find((item) => item.ip_id === ipId) || rule2Items[0] || {};
  const indicadores = regras?.indicadores || ['vendas', 'repasses', 'ipc', 'sobrepreco_medio'];
  const rulesLocked = isRuleEditingBlocked(person);
  const rulesLockMessage = 'A edição só fica liberada quando a comissão está na etapa Calculada/Revisão.';

  useEffect(() => {
    if (!rows.some((item) => item.id === personId)) setPersonId(rows[0]?.id || '');
  }, [rows, personId]);

  useEffect(() => {
    setObjectiveDraft(Number(configuracaoCiclo?.objetivo_repasse_geral || 0));
  }, [configuracaoCiclo?.objetivo_repasse_geral]);

  useEffect(() => {
    const nextItems = (person?.ips || []).map((item, index) => ({
      ip_id: item.ip_id || `ip_${index + 1}`,
      nome: item.nome || '',
      indicador: item.indicador || 'ipc',
      tipo_comissao: item.tipo_comissao || 'numero',
      operador: item.operador || '>=',
      alvo: Number(item.alvo || 0),
      realizado: Number(item.realizado || 0),
      valor_bonus: Number(item.valor_bonus || 0),
      data_inicial: item.data_inicial || CYCLE_START_DATE,
      data_fim: item.data_fim || CYCLE_CUTOFF_DATE,
      fonte_realizado: item.fonte_realizado || '',
      atingiu: Boolean(item.atingiu),
      _status: 'existente',
    }));
    setRule2Items(nextItems);
    setDeletedRule2Ids([]);
    setIpId(nextItems[0]?.ip_id || '');
  }, [person?.id]);

  const updateRule2Field = (field, value) => {
    if (!ip.ip_id || rulesLocked) return;
    setRule2Items((items) => items.map((item) => (
      item.ip_id === ip.ip_id
        ? { ...item, [field]: value, _status: item._status === 'novo' ? 'novo' : 'editado' }
        : item
    )));
  };

  const addRule2Ip = () => {
    if (rulesLocked) return;
    const newId = `novo_ip_${Date.now()}`;
    const newItem = {
      ip_id: newId,
      nome: 'Novo IP',
      indicador: indicadores[0] || 'vendas',
      tipo_comissao: 'numero',
      operador: '>=',
      alvo: 0,
      realizado: 0,
      valor_bonus: 0,
      data_inicial: CYCLE_START_DATE,
      data_fim: CYCLE_CUTOFF_DATE,
      fonte_realizado: 'manual',
      atingiu: false,
      _status: 'novo',
    };
    setRule2Items((items) => [...items, newItem]);
    setIpId(newId);
  };

  const deleteRule2Ip = () => {
    if (!ip.ip_id || rulesLocked) return;
    setRule2Items((items) => {
      const nextItems = items.filter((item) => item.ip_id !== ip.ip_id);
      const nextSelected = nextItems[0]?.ip_id || '';
      setIpId(nextSelected);
      return nextItems;
    });
    if (ip._status !== 'novo') {
      setDeletedRule2Ids((ids) => [...new Set([...ids, ip.ip_id])]);
    }
  };

  const collectPublishedRule = () => ({
    comissionado_id: person?.id,
    regra_01: {
      comissionado_id: person?.id,
      indicador: regra.indicador || 'vendas',
      objetivo: Number(regra.objetivo || 0),
      realizado: Number(regra.realizado || 0),
      percentual_atingimento: Number(regra.percentual_atingimento || 0),
      faixa_aplicada: regra.faixa_aplicada || '',
      faixas: [...document.querySelectorAll('[data-rule01-step]')].map((input) => ({
        id: input.dataset.stepId,
        rotulo: input.dataset.stepLabel,
        percentual_minimo: Number(input.dataset.stepMin || 0),
        percentual_maximo: Number(input.dataset.stepMax || 0),
        valor_bonus: Number(input.value || 0),
      })),
    },
    regra_02: {
      comissionado_id: person?.id,
      ip_id: ip.ip_id,
      acao: ip._status === 'novo' ? 'criar' : 'editar',
      nome: ip.nome || '',
      indicador: ip.indicador || 'ipc',
      tipo_comissao: ip.tipo_comissao || 'numero',
      operador: ip.operador || '>=',
      alvo: Number(ip.alvo || 0),
      valor_bonus: Number(ip.valor_bonus || 0),
      data_inicial: ip.data_inicial || '',
      data_fim: ip.data_fim || '',
    },
    regra_02_ips: rule2Items.map((item) => ({
      ip_id: item.ip_id,
      acao: item._status === 'novo' ? 'criar' : item._status === 'editado' ? 'editar' : 'manter',
      nome: item.nome || '',
      indicador: item.indicador || 'ipc',
      tipo_comissao: item.tipo_comissao || 'numero',
      operador: item.operador || '>=',
      alvo: Number(item.alvo || 0),
      realizado: Number(item.realizado || 0),
      valor_bonus: Number(item.valor_bonus || 0),
      data_inicial: item.data_inicial || '',
      data_fim: item.data_fim || '',
      fonte_realizado: item.fonte_realizado || '',
    })),
    regra_02_ips_removidos: deletedRule2Ids,
  });

  async function handlePublish() {
    if (rulesLocked) {
      onTrackCommission?.(person?.id);
      return;
    }
    const draft = collectPublishedRule();
    setPublishState({ status: 'pending', message: 'Publicando alteração e recalculando pela API...' });
    try {
      await onPublishRule(ruleType, draft);
      setPublishState({
        status: 'success',
        message: 'Alteração publicada. Abrindo o Histórico para conferir a auditoria.',
      });
      window.setTimeout(() => onPublished?.(draft.comissionado_id), 650);
    } catch {
      setPublishState({ status: 'idle', message: '' });
    }
  }

  async function handleSaveCycleConfig() {
    if (rulesLocked) return;
    setPublishState({ status: 'pending', message: 'Salvando objetivo geral do ciclo...' });
    try {
      await onSaveCycleConfig?.({
        objetivo_repasse_geral: Number(objectiveDraft || 0),
        payload: { origem: 'aba_regras', indicador_regra_01: 'repasses' },
      });
      setPublishState({ status: 'success', message: 'Objetivo geral de repasse atualizado.' });
    } catch {
      setPublishState({ status: 'idle', message: '' });
    }
  }

  return (
    <div className="cm-panel">
      <div className="cm-panel__head">
        <div>
          <h2>Regras publicadas por comissionado</h2>
          <p>Ao publicar, a regra passa a impactar o fluxo de comissão dessa pessoa.</p>
        </div>
        <div className="cm-tools">
          <select value={person?.id || ''} onChange={(event) => setPersonId(event.target.value)} aria-label="Selecionar comissionado">
            {rows.map((item) => <option key={item.id} value={item.id}>{personOfficialLabel(item)}</option>)}
          </select>
          <select value={ruleType} onChange={(event) => setRuleType(event.target.value)} aria-label="Selecionar regra">
            <option value="regra_01">Regra 01</option>
            <option value="regra_02">Regra 02</option>
          </select>
        </div>
      </div>
      <section className="cm-editor cm-cycle-config">
        <div>
          <h3>Objetivo geral de repasse</h3>
          <p>Base para calcular a Regra 01 de Junho/2026. O realizado vem do Dashboard Comercial.</p>
        </div>
        <label>
          Objetivo
          <input
            type="number"
            min="0"
            step="1"
            value={objectiveDraft}
            onChange={(event) => setObjectiveDraft(Number(event.target.value || 0))}
            disabled={rulesLocked}
          />
        </label>
        <button className="cm-button cm-button--secondary" type="button" onClick={handleSaveCycleConfig} disabled={rulesLocked || publishState.status === 'pending'}>
          Salvar objetivo
        </button>
      </section>
      <div className="cm-rules-layout">
        {ruleType === 'regra_01' ? (
          <div className="cm-editor cm-editor--flat" key={`rule01-${person?.id}`}>
            <Rule01Ladder row={person} editable={!rulesLocked} />
          </div>
        ) : (
          <section className="cm-editor" key={`rule02-${person?.id}-${ip.ip_id || 'none'}`}>
            <div className="cm-rule-editor-head">
              <div>
                <h3>Regra 02</h3>
                <p>Adicione, edite ou remova IPs vinculados ao comissionado.</p>
              </div>
              <div className="cm-card-actions">
                <button className="cm-button cm-button--secondary" type="button" onClick={addRule2Ip} disabled={rulesLocked}>Adicionar IP</button>
                <button className="cm-button cm-button--danger" type="button" onClick={deleteRule2Ip} disabled={!ip.ip_id || rulesLocked}>Apagar IP</button>
              </div>
            </div>
            <div className="cm-rule02-linked">
              {rule2Items.map((item) => (
                <button
                  className={item.ip_id === ip.ip_id ? 'is-selected' : ''}
                  key={item.ip_id}
                  type="button"
                  onClick={() => setIpId(item.ip_id)}
                >
                  <strong>{item.nome}</strong>
                  <span>{item.indicador} {item.operador} {number(item.alvo)} · realizado {number(item.realizado)}</span>
                  <b>{item._status === 'novo' ? 'Novo' : item._status === 'editado' ? 'Editado' : item.atingiu ? 'Atingiu' : 'Não atingiu'} · {money(item.valor_bonus)}</b>
                  {item.fonte_realizado && <small>{item.fonte_realizado}</small>}
                </button>
              ))}
              {!rule2Items.length && <p className="cm-muted">Nenhum IP vinculado a este comissionado.</p>}
            </div>
            <label>IP selecionado<select value={ip.ip_id || ''} onChange={(event) => setIpId(event.target.value)}>{rule2Items.map((item) => <option key={item.ip_id} value={item.ip_id}>{item.nome}</option>)}</select></label>
            <label>Nome<input type="text" value={ip.nome || ''} onChange={(event) => updateRule2Field('nome', event.target.value)} disabled={!ip.ip_id || rulesLocked} /></label>
            <label>Indicador<select value={ip.indicador || 'ipc'} onChange={(event) => updateRule2Field('indicador', event.target.value)} disabled={!ip.ip_id || rulesLocked}>{indicadores.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
            <label>Tipo<select value={ip.tipo_comissao || 'numero'} onChange={(event) => updateRule2Field('tipo_comissao', event.target.value)} disabled={!ip.ip_id || rulesLocked}><option value="numero">Número</option><option value="percentual">Percentual</option><option value="decimal">Decimal</option><option value="moeda">Moeda</option></select></label>
            <label>Operador<select value={ip.operador || '>='} onChange={(event) => updateRule2Field('operador', event.target.value)} disabled={!ip.ip_id || rulesLocked}><option value=">=">&gt;=</option><option value="<=">&lt;=</option><option value="=">=</option></select></label>
            <label>Alvo<input type="number" min="0" step="0.01" value={ip.alvo ?? 0} onChange={(event) => updateRule2Field('alvo', Number(event.target.value || 0))} disabled={!ip.ip_id || rulesLocked} /></label>
            <label>Bônus<input type="number" min="0" step="50" value={ip.valor_bonus ?? 0} onChange={(event) => updateRule2Field('valor_bonus', Number(event.target.value || 0))} disabled={!ip.ip_id || rulesLocked} /></label>
            <label>Data inicial<input type="date" value={ip.data_inicial || CYCLE_START_DATE} onChange={(event) => updateRule2Field('data_inicial', event.target.value)} disabled={!ip.ip_id || rulesLocked} /></label>
            <label>Data fim<input type="date" value={ip.data_fim || CYCLE_CUTOFF_DATE} onChange={(event) => updateRule2Field('data_fim', event.target.value)} disabled={!ip.ip_id || rulesLocked} /></label>
          </section>
        )}
        <section className="cm-rule-side">
          <h3>Publicação imediata</h3>
          <ol>
            <li>Escolher comissionado</li>
            <li>Editar regra selecionada</li>
            <li>Publicar alteração</li>
            <li>Recalcular fluxo pela API</li>
          </ol>
          {rulesLocked && <p className="cm-muted">{rulesLockMessage}</p>}
          <button className="cm-button" type="button" onClick={handlePublish} disabled={publishState.status === 'pending'}>
            {publishState.status === 'pending' ? <Clock size={16} /> : rulesLocked ? <Search size={16} /> : <Check size={16} />}
            {publishState.status === 'pending' ? 'Publicando' : rulesLocked ? 'Acompanhar comissão' : 'Publicar agora'}
          </button>
          {publishState.status === 'success' && (
            <div className="cm-publish-success">
              <CheckCircle2 size={18} />
              <span>{publishState.message}</span>
            </div>
          )}
          {actionFeedback && <p className="cm-muted">{actionFeedback}</p>}
        </section>
      </div>
    </div>
  );
}

function NotificationsView({
  cicloId,
  notificacoes,
  historico,
  templates,
  regras,
  providerStatus,
  preview,
  onRefresh,
  onPreview,
  onProcessQueue,
  onTestProvider,
  onRetry,
  pendingAction,
}) {
  const [templateCodigo, setTemplateCodigo] = useState('head_aprovacao_pendente');
  const [previewPayload, setPreviewPayload] = useState(JSON.stringify({
    ciclo: cicloId,
    nome_destinatario: 'Equipe 7LM',
    prazo: '2 dias úteis',
    status_atual: 'Aguardando ação',
    proxima_acao: 'Acessar o portal',
    motivo: 'Validação operacional',
    quantidade_itens: 3,
    destino_pacote: 'Financeiro',
  }, null, 2));

  function runPreview() {
    let payload = {};
    try {
      payload = JSON.parse(previewPayload || '{}');
    } catch {
      payload = {};
    }
    onPreview({ template_codigo: templateCodigo, payload: { ciclo: cicloId, ...payload } });
  }

  return (
    <div className="cm-notifications">
      <section className="cm-panel">
        <div className="cm-panel__head">
          <div>
            <h2>Notificações e e-mails</h2>
            <p>Fila, preview, templates e provider em modo seguro.</p>
          </div>
          <div className="cm-tools">
            <button className="cm-button" type="button" onClick={onRefresh}>Atualizar</button>
            <button className="cm-button" type="button" onClick={onTestProvider} disabled={pendingAction === 'test-provider'}>Testar provider</button>
            <button className="cm-button" type="button" onClick={onProcessQueue} disabled={pendingAction === 'process-queue'}>Processar dry-run</button>
          </div>
        </div>
        <div className="cm-notification-grid">
          <article>
            <span>Provider</span>
            <strong>{providerStatus?.provider || 'fake'}</strong>
            <small>{providerStatus?.modo || 'dry_run'} · envio real desligado</small>
          </article>
          <article>
            <span>Allowlist</span>
            <strong>{providerStatus?.allowlist?.length || 3}</strong>
            <small>Somente destinatários de teste</small>
          </article>
          <article>
            <span>Notificações</span>
            <strong>{notificacoes.length}</strong>
            <small>Visíveis para o perfil atual</small>
          </article>
          <article>
            <span>Fila</span>
            <strong>{historico.length}</strong>
            <small>Eventos de envio do ciclo</small>
          </article>
        </div>
      </section>

      <section className="cm-panel">
        <div className="cm-panel__head">
          <div>
            <h2>Preview de template</h2>
            <p>Renderização corporativa antes de qualquer envio real.</p>
          </div>
        </div>
        <div className="cm-preview-layout">
          <div className="cm-preview-controls">
            <label>
              Template
              <select value={templateCodigo} onChange={(event) => setTemplateCodigo(event.target.value)}>
                {templates.map((item) => <option key={`${item.codigo}-${item.versao}`} value={item.codigo}>{item.codigo}</option>)}
              </select>
            </label>
            <label>
              Payload
              <textarea value={previewPayload} onChange={(event) => setPreviewPayload(event.target.value)} />
            </label>
            <button className="cm-button" type="button" onClick={runPreview}>Gerar preview</button>
          </div>
          <div className="cm-email-preview">
            {preview?.assunto && <strong>{preview.assunto}</strong>}
            {preview?.corpo_html ? (
              <iframe title="Preview de e-mail" srcDoc={preview.corpo_html} />
            ) : (
              <p className="cm-muted">Selecione um template e gere o preview.</p>
            )}
          </div>
        </div>
      </section>

      <section className="cm-panel">
        <div className="cm-panel__head">
          <div>
            <h2>Histórico de envios</h2>
            <p>Status da fila e reenvio auditado.</p>
          </div>
        </div>
        <div className="cm-table-wrap">
          <table className="cm-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>Destinatário</th>
                <th>Status</th>
                <th>Provider</th>
                <th>Quando</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((item) => (
                <tr key={item.id}>
                  <td>{item.template_codigo}</td>
                  <td>{item.destinatario_email}</td>
                  <td><Badge value={item.status}>{item.status}</Badge></td>
                  <td>{item.provider_codigo}</td>
                  <td>{dateTime(item.processado_em || item.criado_em)}</td>
                  <td>
                    <button className="cm-row-link" type="button" onClick={() => onRetry(item.id)}>
                      Reenviar
                    </button>
                  </td>
                </tr>
              ))}
              {!historico.length && (
                <tr><td colSpan="6">Nenhum envio registrado para o ciclo.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="cm-panel">
        <div className="cm-panel__head">
          <div>
            <h2>Templates e prazos</h2>
            <p>Versões publicadas e regras SLA configuradas no backend.</p>
          </div>
        </div>
        <div className="cm-template-list">
          {templates.map((item) => (
            <article key={`${item.codigo}-${item.versao}`}>
              <div>
                <strong>{item.codigo}</strong>
                <span>v{item.versao} · {item.assunto}</span>
              </div>
              <Badge value={item.ativo ? 'ativa' : 'cancelada'}>{item.ativo ? 'Ativo' : 'Inativo'}</Badge>
            </article>
          ))}
        </div>
        <div className="cm-template-list">
          {regras.map((item) => (
            <article key={item.id}>
              <div>
                <strong>{item.tipo_evento_origem}</strong>
                <span>{item.prazo_quantidade} {item.prazo_unidade} · escalona após {item.escalonar_apos_quantidade} {item.escalonar_apos_unidade}</span>
              </div>
              <Badge value={item.ativo ? 'ativa' : 'cancelada'}>{item.ativo ? 'Ativa' : 'Inativa'}</Badge>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(readStoredUser());
  const [preview, setPreview] = useState(null);
  const [ciclos, setCiclos] = useState([{ ciclo_id: CYCLE_ID, rotulo: CYCLE_ID }]);
  const [activeCycleId, setActiveCycleId] = useState(CYCLE_ID);
  const [minhaComissao, setMinhaComissao] = useState(null);
  const [minhaError, setMinhaError] = useState(null);
  const [regras, setRegras] = useState(null);
  const [configuracaoCiclo, setConfiguracaoCiclo] = useState(null);
  const [activeView, setActiveView] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [eventos, setEventos] = useState([]);
  const [cycleEventos, setCycleEventos] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState('');
  const [notificacoes, setNotificacoes] = useState([]);
  const [historicoNotificacoes, setHistoricoNotificacoes] = useState([]);
  const [templatesNotificacoes, setTemplatesNotificacoes] = useState([]);
  const [regrasNotificacoes, setRegrasNotificacoes] = useState([]);
  const [providerStatus, setProviderStatus] = useState(null);
  const [previewEmail, setPreviewEmail] = useState(null);

  const permissions = useMemo(() => buildPermissions(user), [user]);
  const rows = useMemo(() => (preview?.registros || []).map(normalizeRow), [preview]);
  const selected = rows.find((item) => item.id === selectedId) || rows[0] || null;
  const ownRows = useMemo(() => (minhaComissao ? [normalizeRow(minhaComissao)] : []), [minhaComissao]);
  const historyRows = permissions.canHistory ? rows : ownRows;

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const [mePayload] = await Promise.allSettled([fetchMe()]);
        const currentUser = mePayload.status === 'fulfilled'
          ? (mePayload.value.usuario || mePayload.value.user || mePayload.value)
          : readStoredUser();
        if (!alive) return;
        setUser(currentUser);
        const currentPermissions = buildPermissions(currentUser);
        const shouldLoadAll = currentPermissions.canViewAll
          || currentPermissions.canSecretaria
          || currentPermissions.canHead
          || currentPermissions.canRules
          || currentPermissions.canHistory;
        const requests = [];
        requests.push(fetchConfig().catch(() => DEFAULT_COMMISSION_CONFIG));
        requests.push(fetchCiclos().then((payload) => {
          const items = payload.items || payload.ciclos || payload.registros || [];
          if (items.length) setCiclos(items);
        }).catch(() => null));
        if (shouldLoadAll) requests.push(fetchPreview(activeCycleId).then((payload) => {
          const normalized = normalizePreviewPayload(payload, activeCycleId);
          setPreview(normalized);
          if (normalized?.ciclo) {
            setCiclos((items) => (
              items.some((item) => cycleIdOf(item) === cycleIdOf(normalized.ciclo))
                ? items
                : [...items, normalized.ciclo]
            ));
          }
        }));
        if (currentPermissions.canViewOwn) {
          requests.push(fetchMinhaComissao(activeCycleId).then((payload) => {
            const resultado = payload?.resultado || payload?.item || payload?.registro || payload;
            if (payload && payload.encontrado === false) {
              setMinhaComissao(null);
              setMinhaError(new Error(payload.mensagem || 'Nenhuma comissão vinculada ao usuário autenticado neste ciclo.'));
              return;
            }
            setMinhaComissao(resultado);
            setMinhaError(null);
          }).catch((error) => setMinhaError(error)));
        }
        if (currentPermissions.canRules) {
          requests.push(fetchRegras(activeCycleId).then(setRegras).catch(() => setRegras(null)));
          requests.push(fetchConfiguracaoCiclo(activeCycleId).then((payload) => {
            setConfiguracaoCiclo(payload.configuracao || payload);
          }).catch(() => setConfiguracaoCiclo(null)));
        }
        await Promise.allSettled(requests);
        if (!shouldLoadAll && !currentPermissions.canViewOwn) {
          setFeedback({ type: 'warning', message: 'Seu perfil não possui visão liberada para o Comissionamento.' });
        }
      } catch (error) {
        setFeedback({ type: 'warning', message: error.message || 'Não foi possível carregar o Comissionamento.' });
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [activeCycleId]);

  useEffect(() => {
    const allowed = {
      secretaria: permissions.canSecretaria,
      head: permissions.canHead,
      comissionado: permissions.canViewOwn || permissions.canPreviewComissionadoAll,
      regras: permissions.canRules,
      historico: permissions.canHistory,
    };
    if (!activeView || activeView === 'notificacoes' || !allowed[activeView]) {
      if (permissions.canSecretaria) setActiveView('secretaria');
      else if (permissions.canHead) setActiveView('head');
      else if (permissions.canViewOwn) setActiveView('comissionado');
      else if (permissions.canRules) setActiveView('regras');
      else if (permissions.canHistory) setActiveView('historico');
    }
  }, [activeView, permissions]);

  useEffect(() => {
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
  }, [rows, selectedId]);

  useEffect(() => {
    let alive = true;
    if (!selected?.id) {
      setEventos([]);
      return undefined;
    }
    fetchEventos(selected.id)
      .then((payload) => {
        if (alive) setEventos(payload.items || payload.eventos || []);
      })
      .catch(() => {
        if (alive) setEventos([]);
      });
    return () => {
      alive = false;
    };
  }, [selected?.id]);

  useEffect(() => {
    if (!permissions.canHistory) {
      setCycleEventos([]);
      return undefined;
    }
    let alive = true;
    fetchEventosCiclo(activeCycleId)
      .then((payload) => {
        if (alive) setCycleEventos(extractEventItems(payload));
      })
      .catch(() => {
        if (alive) setCycleEventos([]);
      });
    return () => {
      alive = false;
    };
  }, [activeCycleId, permissions.canHistory]);

  useEffect(() => {
    if (!permissions.canSecretaria) return undefined;
    let alive = true;
    async function loadNotifications() {
      const requests = await Promise.allSettled([
        fetchNotificacoes(activeCycleId),
        fetchHistoricoNotificacoes(activeCycleId),
        fetchTemplatesNotificacoes(),
        fetchRegrasNotificacoes(),
        testarProviderNotificacoes(),
      ]);
      if (!alive) return;
      if (requests[0].status === 'fulfilled') setNotificacoes(requests[0].value.notificacoes || []);
      if (requests[1].status === 'fulfilled') setHistoricoNotificacoes(requests[1].value.envios || []);
      if (requests[2].status === 'fulfilled') setTemplatesNotificacoes(requests[2].value.templates || []);
      if (requests[3].status === 'fulfilled') setRegrasNotificacoes(requests[3].value.regras || []);
      if (requests[4].status === 'fulfilled') setProviderStatus(requests[4].value);
    }
    loadNotifications();
    return () => {
      alive = false;
    };
  }, [activeCycleId, permissions.canSecretaria]);

  async function refreshPreview() {
    try {
      const payload = await fetchPreview(activeCycleId);
      setPreview(normalizePreviewPayload(payload, activeCycleId));
    } catch {}
  }

  async function refreshConfiguracaoCiclo() {
    try {
      const payload = await fetchConfiguracaoCiclo(activeCycleId);
      setConfiguracaoCiclo(payload.configuracao || payload);
    } catch {}
  }

  function applyResultadoAtualizado(resultado) {
    if (!resultado?.id && !resultado?.resultado_id) return;
    const updated = normalizeRow(resultado);
    setPreview((current) => {
      if (!current?.registros?.length) return current;
      return {
        ...current,
        registros: current.registros.map((item) => {
          const itemId = item.id || item.resultado_id;
          return itemId === updated.id ? { ...item, ...resultado, ...updated } : item;
        }),
      };
    });
    setMinhaComissao((current) => {
      if (!current) return current;
      const currentId = current.id || current.resultado_id;
      return currentId === updated.id ? { ...current, ...resultado, ...updated } : current;
    });
  }

  async function refreshMinhaComissaoAtual() {
    if (!permissions.canViewOwn) return;
    try {
      const payload = await fetchMinhaComissao(activeCycleId);
      if (payload && payload.encontrado === false) {
        setMinhaComissao(null);
        setMinhaError(new Error(payload.mensagem || 'Nenhuma comissão vinculada ao usuário autenticado neste ciclo.'));
        return;
      }
      setMinhaComissao(payload?.resultado || payload?.item || payload?.registro || payload);
      setMinhaError(null);
    } catch (error) {
      setMinhaError(error);
    }
  }

  async function refreshCycleEvents() {
    if (!permissions.canHistory) return;
    try {
      const payload = await fetchEventosCiclo(activeCycleId);
      setCycleEventos(extractEventItems(payload));
    } catch {}
  }

  async function refreshSelectedEvents(resultadoId) {
    if (!resultadoId) return;
    try {
      const payload = await fetchEventos(resultadoId);
      setEventos(extractEventItems(payload));
    } catch {}
  }

  async function refreshNotifications() {
    if (!permissions.canSecretaria) return;
    try {
      const [notifs, history, templates, regras, provider] = await Promise.all([
        fetchNotificacoes(activeCycleId),
        fetchHistoricoNotificacoes(activeCycleId),
        fetchTemplatesNotificacoes(),
        fetchRegrasNotificacoes(),
        testarProviderNotificacoes(),
      ]);
      setNotificacoes(notifs.notificacoes || []);
      setHistoricoNotificacoes(history.envios || []);
      setTemplatesNotificacoes(templates.templates || []);
      setRegrasNotificacoes(regras.regras || []);
      setProviderStatus(provider);
    } catch (error) {
      setFeedback({ type: 'warning', message: error.message || 'Não foi possível atualizar notificações.' });
    }
  }

  async function runNotificationPreview(body) {
    try {
      const payload = await previewNotificacao(body);
      setPreviewEmail(payload.preview || payload);
      setFeedback({ type: 'success', message: 'Preview de e-mail gerado.' });
    } catch (error) {
      setFeedback({ type: 'warning', message: error.message || 'Não foi possível gerar preview.' });
    }
  }

  async function runProcessQueue() {
    setPendingAction('process-queue');
    try {
      const payload = await processarFilaNotificacoes(25);
      setFeedback({ type: 'success', message: `${payload.quantidade || 0} envio(s) processados em dry-run.` });
      await refreshNotifications();
    } catch (error) {
      setFeedback({ type: 'warning', message: error.message || 'Não foi possível processar a fila.' });
    } finally {
      setPendingAction('');
    }
  }

  async function runTestProvider() {
    setPendingAction('test-provider');
    try {
      const payload = await testarProviderNotificacoes();
      setProviderStatus(payload);
      setFeedback({ type: 'success', message: 'Provider testado em modo seguro, sem envio real.' });
    } catch (error) {
      setFeedback({ type: 'warning', message: error.message || 'Não foi possível testar provider.' });
    } finally {
      setPendingAction('');
    }
  }

  async function retryNotification(envioId) {
    try {
      await reenviarNotificacao(envioId);
      setFeedback({ type: 'success', message: 'Reenvio manual registrado e devolvido para a fila.' });
      await refreshNotifications();
    } catch (error) {
      setFeedback({ type: 'warning', message: error.message || 'Não foi possível reenviar.' });
    }
  }

  async function runAction(action, row) {
    const cicloId = row?.cicloId || preview?.ciclo?.ciclo_id || CYCLE_ID;
    const resolver = actionUrls[action];
    if (!resolver) {
      setFeedback({ type: 'warning', message: 'Ação ainda não possui endpoint definido.' });
      return;
    }
    const body = { comentario: 'Ação executada pelo painel React de Comissionamento.' };
    if (action === 'solicitar_ajuste' || action === 'rejeitar') {
      const motivo = window.prompt(
        action === 'rejeitar'
          ? 'Informe o motivo da reprovação/devolução para revisão:'
          : 'Informe o motivo da revisão/recalculo para a Secretaria:',
      );
      if (!motivo || !motivo.trim()) {
        setFeedback({
          type: 'warning',
          message: action === 'rejeitar'
            ? 'Informe o motivo para reprovar/devolver para revisão.'
            : 'Informe o motivo para pedir revisão/recalculo.',
        });
        return;
      }
      body.motivo = motivo.trim();
      body.comentario = motivo.trim();
    }
    const url = action === 'enviar_pacote_pagamento' ? resolver(cicloId) : resolver(row.id);
    setPendingAction(`${row?.id || cicloId}:${action}`);
    try {
      const payload = await postAction(url, body);
      applyResultadoAtualizado(payload?.resultado);
      setFeedback({ type: 'success', message: `${actionLabels[action] || 'Ação'} executada com sucesso.` });
	      await refreshPreview();
	      await refreshCycleEvents();
	      await refreshSelectedEvents(row?.id);
	      await refreshMinhaComissaoAtual();
	      await refreshNotifications();
    } catch (error) {
      setFeedback({ type: error.status && error.status < 500 ? 'warning' : 'danger', message: error.message || 'Não foi possível executar a ação.' });
    } finally {
      setPendingAction('');
    }
  }

  async function publishRule(ruleType, draft) {
    const ruleId = ruleType === 'regra_02' ? 'regra-02-ips-mvp' : 'regra-01-escada-mvp';
    const person = rows.find((item) => item.id === draft.comissionado_id);
    if (isRuleEditingBlocked(person)) {
      const message = 'A regra só pode ser editada quando a comissão estiver na etapa Calculada/Revisão.';
      setFeedback({ type: 'warning', message });
      throw new Error(message);
    }
    try {
      const payload = await postAction(`/api/comissionamento/regras/${ruleId}/publicar`, {
        motivo: `Publicação imediata para ${draft.comissionado_id}`,
        comentario: 'Publicação imediata feita pela tela de Regras.',
        ciclo_id: activeCycleId,
        comissionado_id: draft.comissionado_id,
        comissionado_nome: person?.nome || '',
        regra_tipo: ruleType,
        regra_01: draft.regra_01,
        regra_02: draft.regra_02,
        regra_02_ips: draft.regra_02_ips,
        regra_02_ips_removidos: draft.regra_02_ips_removidos,
        payload: {
          antes: person ? {
            regra_01: person.regra01,
            regra_02_ips: person.ips,
          } : {},
          depois: draft,
        },
      });
      applyResultadoAtualizado(payload?.resultado);
      setFeedback({ type: 'success', message: 'Alteração publicada para o comissionado selecionado.' });
      await refreshPreview();
      await refreshCycleEvents();
      await refreshSelectedEvents(draft.comissionado_id);
      return payload;
    } catch (error) {
      setFeedback({ type: 'warning', message: error.message || 'Não foi possível publicar a alteração.' });
      throw error;
    }
  }

  async function saveCycleConfig(body) {
    try {
      const payload = await salvarConfiguracaoCiclo(activeCycleId, body);
      setConfiguracaoCiclo(payload.configuracao || null);
      setFeedback({ type: 'success', message: payload.mensagem || 'Configuração do ciclo atualizada.' });
      await refreshConfiguracaoCiclo();
      await refreshPreview();
      if (permissions.canRules) {
        await fetchRegras(activeCycleId).then(setRegras).catch(() => {});
      }
      return payload;
    } catch (error) {
      setFeedback({ type: 'warning', message: error.message || 'Não foi possível salvar configuração do ciclo.' });
      throw error;
    }
  }

  async function uploadNf(row, payload) {
    const formData = new FormData();
    formData.append('arquivo', payload.arquivo);
    formData.append('numero_nf', payload.numero_nf);
    formData.append('data_emissao', payload.data_emissao);
    formData.append('valor_nf', String(payload.valor_nf));
    formData.append('observacao', payload.observacao || '');
    setPendingAction(`${row.id}:upload_nf`);
    try {
      const payload = await uploadNotaFiscal(row.id, formData);
      applyResultadoAtualizado(payload?.resultado);
      setFeedback({ type: 'success', message: 'Nota Fiscal enviada com sucesso ao Financeiro.' });
	      await refreshPreview();
	      await refreshCycleEvents();
	      await refreshSelectedEvents(row.id);
	      await refreshMinhaComissaoAtual();
	      await refreshNotifications();
    } catch (error) {
      setFeedback({
        type: error.status && error.status < 500 ? 'warning' : 'danger',
        message: error.message || 'Não foi possível enviar a Nota Fiscal.',
      });
    } finally {
      setPendingAction('');
    }
  }

  return (
    <section className="cm-app">
      <header className="cm-hero">
        <div>
          <span className="tl-imoveis-eyebrow mono-font">COMISSIONAMENTO</span>
          <h1>Comissionamento de Gestores e Coordenadores</h1>
          <p>Fluxo operacional por perfil, com dados via API e ações auditáveis quando liberadas pelo backend.</p>
        </div>
        <div className="cm-hero__meta">
          <label htmlFor="cm-ciclo-global">Ciclo</label>
          <select id="cm-ciclo-global" value={activeCycleId} onChange={(event) => setActiveCycleId(event.target.value)}>
            {ciclos.map((item) => <option key={cycleIdOf(item)} value={cycleIdOf(item)}>{cycleLabelOf(item)}</option>)}
          </select>
          <strong>{preview?.ciclo?.rotulo || cycleLabelOf(ciclos.find((item) => cycleIdOf(item) === activeCycleId) || {}) || activeCycleId}</strong>
        </div>
      </header>
      <Tabs activeView={activeView} setActiveView={setActiveView} permissions={permissions} />
      <Feedback feedback={feedback} onDismiss={() => setFeedback(null)} />

      {loading && <div className="cm-loading">Carregando comissionamento...</div>}

      {!loading && permissions.canSecretaria && activeView === 'secretaria' && (
        <>
          <SummaryCards rows={rows} ciclo={preview?.ciclo} />
          <SecretariaView
            rows={rows}
            selectedId={selected?.id}
            setSelectedId={setSelectedId}
            onOpenDetail={() => setDetailOpen(true)}
          />
          {detailOpen && (
            <DetailModal
              row={selected}
              eventos={eventos}
              onClose={() => setDetailOpen(false)}
              onRunAction={runAction}
              pendingAction={pendingAction}
              actionScope="secretaria"
            />
          )}
        </>
      )}

      {!loading && permissions.canHead && activeView === 'head' && (
        <HeadView rows={rows} onRunAction={runAction} pendingAction={pendingAction} canAct={permissions.canHead} />
      )}

      {!loading && (permissions.canViewOwn || permissions.canPreviewComissionadoAll) && activeView === 'comissionado' && (
        <ComissionadoView
          minhaComissao={minhaComissao}
          minhaError={minhaError}
          rows={rows}
          selectedId={selected?.id}
          setSelectedId={setSelectedId}
          canPreviewAll={permissions.canPreviewComissionadoAll}
          onUploadNf={uploadNf}
          onRunAction={runAction}
          pendingAction={pendingAction}
        />
      )}

      {!loading && permissions.canRules && activeView === 'regras' && (
        <RegrasView
          rows={rows}
          regras={regras}
          configuracaoCiclo={configuracaoCiclo || preview?.configuracao}
          onSaveCycleConfig={saveCycleConfig}
          onPublishRule={publishRule}
          actionFeedback={feedback?.message}
          onPublished={(resultadoId) => {
            setSelectedId(resultadoId);
            setActiveView('historico');
          }}
          onTrackCommission={(resultadoId) => {
            if (resultadoId) setSelectedId(resultadoId);
            setActiveView('secretaria');
          }}
        />
      )}

      {!loading && activeView === 'historico' && (
        <HistoryView
          rows={historyRows}
          eventos={cycleEventos}
          selectedId={selected?.id || ownRows[0]?.id}
          setSelectedId={setSelectedId}
          ciclos={ciclos}
          activeCycleId={activeCycleId}
          setActiveCycleId={setActiveCycleId}
          permissions={permissions}
        />
      )}
    </section>
  );
}
