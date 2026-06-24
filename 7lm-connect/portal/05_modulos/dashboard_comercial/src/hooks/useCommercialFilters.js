/**
 * useCommercialFilters
 *
 * Thin wrapper over FiltersContext that:
 *  - Exposes a stable `filterQueryString` for use as React Query / fetch cache keys
 *  - Exposes `buildFilterParams()` returning URLSearchParams ready for API calls
 *  - Keeps a single source-of-truth import for all dashboard consumers
 */
import { useMemo } from 'react';
import { useFilters } from '../contexts/FiltersContext';

/**
 * Append a multi-value filter to URLSearchParams.
 * Sends empty string when the array is empty (backend ignores it).
 */
const appendMultiParam = (params, key, value) => {
  if (Array.isArray(value) && value.length > 0) {
    params.append(key, value.join(','));
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

export const useCommercialFilters = () => {
  const context = useFilters();
  const { filters } = context;

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
    appendMultiParam(params, 'origem', filters.origem);
    appendMultiParam(params, 'empreendimento', filters.empreendimento);
    appendMultiParam(params, 'empreendimentoReduzido', filters.empreendimentoReduzido);
    appendMultiParam(params, 'imobiliaria', filters.imobiliaria);
    SEGMENTED_FILTER_KEYS.forEach((key) => appendMultiParam(params, key, filters[key]));
    RESERVA_FILTER_KEYS.forEach((key) => appendMultiParam(params, key, filters[key]));
    return params.toString();
  }, [filters]);

  /**
   * Build URLSearchParams for a given date range using all active hierarchy filters.
   * Accepts an optional `extraParams` object to merge additional keys (e.g. { kpi: 'ipc' }).
   */
  const buildFilterParams = useMemo(
    () =>
      (
        startDate = filters.dataInicial,
        endDate = filters.dataFinal,
        extraParams = {},
      ) => {
        const params = new URLSearchParams({ startDate, endDate, ...extraParams });
        appendMultiParam(params, 'cidade', filters.cidade);
        appendMultiParam(params, 'coordenacao', filters.coordenacao);
        appendMultiParam(params, 'gerencia', filters.gerencia);
        appendMultiParam(params, 'corretor', filters.corretor);
        appendMultiParam(params, 'origem', filters.origem);
        appendMultiParam(params, 'empreendimento', filters.empreendimento);
        appendMultiParam(params, 'empreendimentoReduzido', filters.empreendimentoReduzido);
        appendMultiParam(params, 'imobiliaria', filters.imobiliaria);
        SEGMENTED_FILTER_KEYS.forEach((key) => appendMultiParam(params, key, filters[key]));
        RESERVA_FILTER_KEYS.forEach((key) => appendMultiParam(params, key, filters[key]));
        return params;
      },
    [filters],
  );

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
