/**
 * useCommercialFilters
 *
 * Thin wrapper over FiltersContext that:
 *  - Exposes a stable `filterQueryString` for use as React Query / fetch cache keys
 *  - Exposes `buildFilterParams()` returning URLSearchParams ready for API calls
 *  - Keeps a single source-of-truth import for all dashboard consumers
 */
import { useCallback, useMemo, useRef } from 'react';
import { useFilters } from '../contexts/FiltersContext';

/**
 * Append a multi-value filter to URLSearchParams.
 * Sends empty string when the array is empty (backend ignores it).
 */
const appendMultiParam = (params, key, value) => {
  if (Array.isArray(value) && value.length > 0) {
    const normalized = Array.from(
      new Set(
        value
          .map((item) => String(item ?? '').trim())
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    if (normalized.length > 0) {
      params.append(key, normalized.join(','));
    }
  }
};

const SEGMENTED_FILTER_KEYS = [
  'regiaoOperacao',
  'imobiliariaOperacao',
  'corretorOperacao',
  'sdrOperacao',
  'corretorAtivo',
  'gestorCorretor',
  'coordenadorCorretor',
  'regiaoCorretor',
  'imobiliariaCorretor',
  'sdrAtivo',
  'gestorSdr',
  'coordenadorSdr',
  'regiaoSdr',
  'imobiliariaSdr',
  'unidade',
];

const RESERVA_FILTER_KEYS = [
  'situacaoAtual',
  'idReserva',
  'repasseNoMes',
  'agente',
];

const appendLegacyFilters = (params, currentFilters) => {
  appendMultiParam(params, 'cidade', currentFilters.cidade);
  appendMultiParam(params, 'coordenacao', currentFilters.coordenacao);
  appendMultiParam(params, 'gerencia', currentFilters.gerencia);
  appendMultiParam(params, 'corretor', currentFilters.corretor);
  appendMultiParam(params, 'sdr', currentFilters.sdr);
  appendMultiParam(params, 'origem', currentFilters.origem);
  appendMultiParam(params, 'empreendimento', currentFilters.empreendimento);
  appendMultiParam(params, 'empreendimentoReduzido', currentFilters.empreendimentoReduzido);
  appendMultiParam(params, 'imobiliaria', currentFilters.imobiliaria);
};

const appendSegmentedFilters = (params, currentFilters) => {
  SEGMENTED_FILTER_KEYS.forEach((key) => appendMultiParam(params, key, currentFilters[key]));
};

export const useCommercialFilters = () => {
  const context = useFilters();
  const { filters } = context;
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  /**
   * Stable serialised string of **all** active filter values.
   * Safe to use as a dependency array item or React Query cache key.
   */
  const filterQueryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('startDate', filters.dataInicial ?? '');
    params.set('endDate', filters.dataFinal ?? '');
    params.set('comparacao', filters.comparacao ?? 'anterior');
    appendMultiParam(params, 'cidade', filters.cidade);
    appendMultiParam(params, 'coordenacao', filters.coordenacao);
    appendMultiParam(params, 'gerencia', filters.gerencia);
    appendMultiParam(params, 'corretor', filters.corretor);
    appendMultiParam(params, 'sdr', filters.sdr);
    appendMultiParam(params, 'origem', filters.origem);
    appendMultiParam(params, 'empreendimento', filters.empreendimento);
    appendMultiParam(params, 'empreendimentoReduzido', filters.empreendimentoReduzido);
    appendMultiParam(params, 'imobiliaria', filters.imobiliaria);
    SEGMENTED_FILTER_KEYS.forEach((key) => appendMultiParam(params, key, filters[key]));
    // Default signature intentionally excludes reserva filters to avoid unnecessary
    // refetches on non-reserva dashboards.
    return params.toString();
  }, [filters]);

  /**
   * Build URLSearchParams for a given date range using all active hierarchy filters.
   * Accepts an optional `extraParams` object to merge additional keys (e.g. { kpi: 'ipc' }).
   */
  const buildFilterParams = useCallback((
    startDate = filtersRef.current.dataInicial,
    endDate = filtersRef.current.dataFinal,
    extraParams = {},
  ) => {
    const currentFilters = filtersRef.current;
    const scope = String(extraParams.__scope || 'default').toLowerCase();
    const mergedParams = { ...extraParams };
    delete mergedParams.__scope;
    const params = new URLSearchParams({ startDate, endDate, ...mergedParams });
    if (scope === 'legacy') {
      appendLegacyFilters(params, currentFilters);
    } else if (scope === 'segmented') {
      appendSegmentedFilters(params, currentFilters);
    } else {
      appendLegacyFilters(params, currentFilters);
      appendSegmentedFilters(params, currentFilters);
    }
    if (scope === 'all' || scope === 'reservas') {
      RESERVA_FILTER_KEYS.forEach((key) => appendMultiParam(params, key, currentFilters[key]));
    }
    return params;
  }, []);

  /**
   * Human-readable labels for active hierarchy filters.
   * Used by AnalysisPanel to show contextual filter badges.
   */
  const activeFilterLabels = useMemo(() => {
    const FILTER_LABELS = {
      cidade: 'Cidade',
      gerencia: 'Gerência',
      coordenacao: 'Coordenação',
      corretor: 'Corretor',
      imobiliaria: 'Imobiliária',
      origem: 'Origem',
      empreendimentoReduzido: 'Região',
      empreendimento: 'Empreendimento',
      regiaoOperacao: 'Região da operação',
      imobiliariaOperacao: 'Imobiliária da operação',
      corretorOperacao: 'Corretor da operação',
      sdrOperacao: 'SDR da operação',
      corretorAtivo: 'Corretor',
      gestorCorretor: 'Gerência do corretor',
      coordenadorCorretor: 'Coordenação do corretor',
      regiaoCorretor: 'Região do corretor',
      imobiliariaCorretor: 'Imobiliária do corretor',
      sdrAtivo: 'SDR',
      gestorSdr: 'Gerência do SDR',
      coordenadorSdr: 'Coordenação do SDR',
      regiaoSdr: 'Região do SDR',
      imobiliariaSdr: 'Imobiliária do SDR',
      unidade: 'Unidade',
      situacaoAtual: 'Situação atual',
      idReserva: 'ID reserva',
      repasseNoMes: 'Repasse no mês',
      agente: 'Agente',
    };
    const result = [];
    for (const [key, label] of Object.entries(FILTER_LABELS)) {
      const val = filters[key];
      if (Array.isArray(val) && val.length > 0) {
        result.push({
          key,
          label,
          values: val,
          display: val.length > 2 ? `${val.length} seleções` : val.join(', '),
        });
      }
    }
    return result;
  }, [filters]);

  return {
    ...context,
    filterQueryString,
    buildFilterParams,
    activeFilterLabels,
  };
};
