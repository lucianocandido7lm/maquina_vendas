import { makeIdempotencyKey } from '../portalFetch.js';

const safeJson = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
};

export class ApiError extends Error {
  constructor(message, status, payload = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export const apiRequest = async (url, options = {}) => {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(url, {
    cache: 'no-store',
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await safeJson(response);
  if (!response.ok) {
    throw new ApiError(payload.detail || payload.mensagem || `API ${response.status}`, response.status, payload);
  }
  return payload;
};

export const fetchMe = () => apiRequest('/api/me');
export const fetchConfig = () => apiRequest('/api/comissionamento/config');
export const fetchCiclos = () => apiRequest('/api/comissionamento/ciclos');
export const getCurrentCycleId = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
export const DEFAULT_CYCLE_ID = getCurrentCycleId();
export const fetchPreview = (cicloId = DEFAULT_CYCLE_ID) => apiRequest(`/api/comissionamento/ciclos/${encodeURIComponent(cicloId)}/resultados`);
export const fetchResultados = (cicloId = DEFAULT_CYCLE_ID) => apiRequest(`/api/comissionamento/ciclos/${cicloId}/resultados`);
export const fetchResultado = (resultadoId) => apiRequest(`/api/comissionamento/resultados/${resultadoId}`);
export const fetchEventos = (resultadoId) => apiRequest(`/api/comissionamento/resultados/${resultadoId}/eventos`);
export const fetchEventosCiclo = (cicloId = DEFAULT_CYCLE_ID) => apiRequest(`/api/comissionamento/ciclos/${encodeURIComponent(cicloId)}/eventos`);
export const fetchMinhaComissao = (cicloId = DEFAULT_CYCLE_ID) => apiRequest(`/api/comissionamento/minha-comissao?ciclo_id=${encodeURIComponent(cicloId)}`);
export const fetchRegras = (vigencia = DEFAULT_CYCLE_ID) => apiRequest(`/api/comissionamento/regras?vigencia=${encodeURIComponent(vigencia)}`);
export const fetchConfiguracaoCiclo = (cicloId = DEFAULT_CYCLE_ID) => apiRequest(`/api/comissionamento/ciclos/${encodeURIComponent(cicloId)}/configuracao`);
export const salvarConfiguracaoCiclo = (cicloId = DEFAULT_CYCLE_ID, body = {}) => apiRequest(`/api/comissionamento/ciclos/${encodeURIComponent(cicloId)}/configuracao`, {
  method: 'PUT',
  headers: { 'Idempotency-Key': makeIdempotencyKey() },
  body: JSON.stringify(body),
});
export const fetchNotificacoes = (cicloId = DEFAULT_CYCLE_ID) => apiRequest(`/api/comissionamento/notificacoes?ciclo_id=${encodeURIComponent(cicloId)}`);
export const fetchHistoricoNotificacoes = (cicloId = DEFAULT_CYCLE_ID) => apiRequest(`/api/comissionamento/notificacoes/historico?ciclo_id=${encodeURIComponent(cicloId)}`);
export const fetchTemplatesNotificacoes = () => apiRequest('/api/comissionamento/notificacoes/templates');
export const fetchRegrasNotificacoes = () => apiRequest('/api/comissionamento/notificacoes/regras');
export const previewNotificacao = (body = {}) => apiRequest('/api/comissionamento/notificacoes/preview', {
  method: 'POST',
  headers: { 'Idempotency-Key': makeIdempotencyKey() },
  body: JSON.stringify(body),
});
export const processarFilaNotificacoes = (limite = 25) => apiRequest('/api/comissionamento/notificacoes/processar-fila', {
  method: 'POST',
  headers: { 'Idempotency-Key': makeIdempotencyKey() },
  body: JSON.stringify({ limite }),
});
export const testarProviderNotificacoes = () => apiRequest('/api/comissionamento/notificacoes/testar-provider', {
  method: 'POST',
  headers: { 'Idempotency-Key': makeIdempotencyKey() },
  body: JSON.stringify({}),
});
export const reenviarNotificacao = (envioId) => apiRequest(`/api/comissionamento/notificacoes/${envioId}/reenviar`, {
  method: 'POST',
  headers: { 'Idempotency-Key': makeIdempotencyKey() },
  body: JSON.stringify({}),
});

export const postAction = (url, body = {}) => apiRequest(url, {
  method: 'POST',
  headers: { 'Idempotency-Key': makeIdempotencyKey() },
  body: JSON.stringify(body),
});

export const uploadNotaFiscal = (resultadoId, formData) => apiRequest(`/api/comissionamento/resultados/${resultadoId}/nf`, {
  method: 'POST',
  headers: { 'Idempotency-Key': makeIdempotencyKey() },
  body: formData,
});

export const actionUrls = {
  enviar_head: (id) => `/api/comissionamento/resultados/${id}/enviar-head`,
  aprovar_secretaria: (id) => `/api/comissionamento/resultados/${id}/aprovar-secretaria`,
  aprovar_head: (id) => `/api/comissionamento/resultados/${id}/aprovar-head`,
  rejeitar: (id) => `/api/comissionamento/resultados/${id}/rejeitar`,
  solicitar_ajuste: (id) => `/api/comissionamento/resultados/${id}/solicitar-ajuste`,
  solicitar_nf: (id) => `/api/comissionamento/resultados/${id}/solicitar-nf`,
  reenviar_lembrete_nf: (id) => `/api/comissionamento/resultados/${id}/reenviar-lembrete-nf`,
  registrar_nf_recebida: (id) => `/api/comissionamento/resultados/${id}/registrar-nf-recebida`,
  validar_nf: (id) => `/api/comissionamento/resultados/${id}/validar-nf`,
  solicitar_correcao_nf: (id) => `/api/comissionamento/resultados/${id}/solicitar-correcao-nf`,
  enviar_pacote_pagamento: (cicloId) => `/api/comissionamento/ciclos/${cicloId}/enviar-pacote-pagamento`,
  registrar_pagamento: (id) => `/api/comissionamento/resultados/${id}/registrar-pagamento`,
};
