import { createContext, useCallback, useContext, useMemo, useState, useEffect, useRef } from 'react';
import { logger } from '../utils/logger';

const FILTER_OPTIONS = {
  perfilVisualizacao: [
    { value: 'corretor', label: 'Corretor' },
    { value: 'gestor', label: 'Gestor' },
    { value: 'diretoria', label: 'Diretoria' },
  ],
  periodo: [
    { value: 'dia', label: 'Dia Atual' },
    { value: 'ontem', label: 'Ontem' },
    { value: 'semana', label: 'Semana Atual' },
    { value: 'semana_anterior', label: 'Semana Anterior' },
    { value: 'mes', label: 'M\u00EAs Atual' },
    { value: 'mes_anterior', label: 'M\u00EAs Anterior' },
    { value: 'trimestre', label: 'Trimestre Atual' },
    { value: 'trimestre_anterior', label: 'Trimestre Anterior' },
    { value: 'ano', label: 'Ano Atual' },
    { value: 'ano_anterior', label: 'Ano Anterior' },
  ],
  cidade: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  coordenacao: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  gerencia: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  corretor: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  sdr: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  origem: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  empreendimento: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  unidade: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  empreendimentoReduzido: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  imobiliaria: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  regiaoOperacao: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  imobiliariaOperacao: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  corretorOperacao: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  sdrOperacao: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  corretorAtivo: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  gestorCorretor: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  coordenadorCorretor: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  regiaoCorretor: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  imobiliariaCorretor: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  sdrAtivo: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  gestorSdr: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  coordenadorSdr: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  regiaoSdr: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  imobiliariaSdr: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  situacaoAtual: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  idReserva: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  repasseNoMes: [{ value: '__blank__', label: 'Em branco / Nulo' }],
  agente: [{ value: '__blank__', label: 'Em branco / Nulo' }],
};


const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayStr = () => toDateInputValue(new Date());
const getWeekBounds = () => {
  const current = new Date();
  const weekday = current.getDay();
  const start = new Date(current);
  start.setDate(current.getDate() - weekday + (weekday === 0 ? -6 : 1));
  return {
    start: toDateInputValue(start),
    end: toDateInputValue(current),
  };
};
const getStartOfWeekStr = () => getWeekBounds().start;
const getEndOfWeekStr = () => getWeekBounds().end;
const getStartOfMonthStr = () => {
  const d = new Date();
  return toDateInputValue(new Date(d.getFullYear(), d.getMonth(), 1));
};
const getEndOfMonthStr = () => {
  const d = new Date();
  return toDateInputValue(new Date(d.getFullYear(), d.getMonth() + 1, 0));
};
const getQuarterBounds = () => {
  const d = new Date();
  const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3;
  const start = new Date(d.getFullYear(), quarterStartMonth, 1);
  const end = new Date(d.getFullYear(), quarterStartMonth + 3, 0);
  return {
    start: toDateInputValue(start),
    end: toDateInputValue(end),
  };
};
const getYearBounds = () => {
  const year = new Date().getFullYear();
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
};

const PERIOD_PRESETS = {
  get dia() { return { dataInicial: getTodayStr(), dataFinal: getTodayStr() }; },
  get semana() { return { dataInicial: getStartOfWeekStr(), dataFinal: getEndOfWeekStr() }; },
  get mes() { return { dataInicial: getStartOfMonthStr(), dataFinal: getEndOfMonthStr() }; },
  get trimestre() {
    const bounds = getQuarterBounds();
    return { dataInicial: bounds.start, dataFinal: bounds.end };
  },
  get ano() {
    const bounds = getYearBounds();
    return { dataInicial: bounds.start, dataFinal: bounds.end };
  },
  get ontem() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const ontemStr = toDateInputValue(d);
    return { dataInicial: ontemStr, dataFinal: ontemStr };
  },
  get semana_anterior() {
    const current = new Date();
    const weekday = current.getDay();
    const offset = weekday === 0 ? 13 : weekday + 6;
    const start = new Date(current);
    start.setDate(current.getDate() - offset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { dataInicial: toDateInputValue(start), dataFinal: toDateInputValue(end) };
  },
  get mes_anterior() {
    const d = new Date();
    const start = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const end = new Date(d.getFullYear(), d.getMonth(), 0);
    return { dataInicial: toDateInputValue(start), dataFinal: toDateInputValue(end) };
  },
  get trimestre_anterior() {
    const d = new Date();
    const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3;
    const start = new Date(d.getFullYear(), quarterStartMonth - 3, 1);
    const end = new Date(d.getFullYear(), quarterStartMonth, 0);
    return { dataInicial: toDateInputValue(start), dataFinal: toDateInputValue(end) };
  },
  get ano_anterior() {
    const year = new Date().getFullYear() - 1;
    return { dataInicial: `${year}-01-01`, dataFinal: `${year}-12-31` };
  }
};

const INITIAL_FILTERS = {
  perfilVisualizacao: 'gestor',
  periodo: 'mes',
  dataInicial: PERIOD_PRESETS.mes.dataInicial,
  dataFinal: PERIOD_PRESETS.mes.dataFinal,
  cidade: [],
  coordenacao: [],
  gerencia: [],
  corretor: [],
  sdr: [],
  origem: [],
  empreendimento: [],
  unidade: [],
  empreendimentoReduzido: [],
  imobiliaria: [],
  regiaoOperacao: [],
  imobiliariaOperacao: [],
  corretorOperacao: [],
  sdrOperacao: [],
  corretorAtivo: [],
  gestorCorretor: [],
  coordenadorCorretor: [],
  regiaoCorretor: [],
  imobiliariaCorretor: [],
  sdrAtivo: [],
  gestorSdr: [],
  coordenadorSdr: [],
  regiaoSdr: [],
  imobiliariaSdr: [],
  situacaoAtual: [],
  idReserva: [],
  repasseNoMes: [],
  agente: [],
  comparacao: 'anterior',
};

const FiltersContext = createContext(undefined);

const getSelectedLabel = (options, value) => {
  if (!Array.isArray(options)) return value;
  return options.find((option) => option.value === value)?.label ?? value;
};

const normalizeOptionLabel = (key, label) => {
  const raw = String(label ?? '').trim().replace(/\s+/g, ' ');
  if (!raw) return raw;

  if ((key === 'gerencia' || key === 'coordenacao') && raw.toLowerCase() === 'sem gestor') {
    return 'Sem Gestor';
  }

  return raw;
};

const sanitizeBackendOptions = (key, options) => {
  if (!Array.isArray(options)) return [];

  const seen = new Set();
  const cleaned = [];

  options.forEach((opt) => {
    const rawValue = String(opt?.value ?? '').trim();
    const rawLabel = String(opt?.label ?? '').trim();
    const label = normalizeOptionLabel(key, rawLabel || rawValue);
    const value = rawValue || label;
    if (!value || !label) return;

    // O componente ja oferece a opcao geral "Todos"; removemos sentinelas do backend.
    if (value === 'todos' || value === 'todas') return;

    const dedupeKey = `${value.toLowerCase()}::${label.toLowerCase()}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    cleaned.push({ value, label });
  });

  return cleaned;
};

const BLANK_OPTION = { value: '__blank__', label: 'Em branco / Nulo' };

const ensureBlankOption = (options) => {
  if (!Array.isArray(options)) return [BLANK_OPTION];
  if (options.some((opt) => opt?.value === BLANK_OPTION.value)) return options;
  return [BLANK_OPTION, ...options];
};

const SEGMENTED_FILTER_GROUP_BY_FIELD = {
  regiaoOperacao: ['operation', 'regiaoOperacao'],
  imobiliariaOperacao: ['operation', 'imobiliariaOperacao'],
  corretorOperacao: ['operation', 'corretorOperacao'],
  sdrOperacao: ['operation', 'sdrOperacao'],
  origem: ['operation', 'origem'],
  empreendimento: ['operation', 'empreendimento'],
  unidade: ['operation', 'unidade'],
  corretorAtivo: ['corretorAtivo', 'corretorAtivo'],
  gestorCorretor: ['corretorAtivo', 'gestorCorretor'],
  coordenadorCorretor: ['corretorAtivo', 'coordenadorCorretor'],
  regiaoCorretor: ['corretorAtivo', 'regiaoCorretor'],
  imobiliariaCorretor: ['corretorAtivo', 'imobiliariaCorretor'],
  sdrAtivo: ['sdrAtivo', 'sdrAtivo'],
  gestorSdr: ['sdrAtivo', 'gestorSdr'],
  coordenadorSdr: ['sdrAtivo', 'coordenadorSdr'],
  regiaoSdr: ['sdrAtivo', 'regiaoSdr'],
  imobiliariaSdr: ['sdrAtivo', 'imobiliariaSdr'],
};

const RESERVA_FILTER_FIELDS = new Set(['situacaoAtual', 'idReserva', 'repasseNoMes', 'agente']);
const LEGACY_REMOTE_FILTER_KEYS = [
  'cidade',
  'coordenacao',
  'gerencia',
  'corretor',
  'sdr',
  'origem',
  'empreendimento',
  'unidade',
  'empreendimentoReduzido',
  'imobiliaria',
];
const SEGMENTED_REMOTE_FILTER_KEYS = Object.keys(SEGMENTED_FILTER_GROUP_BY_FIELD);
const RESERVA_REMOTE_FILTER_KEYS = Array.from(RESERVA_FILTER_FIELDS);
const SEGMENTED_REMOTE_FILTER_KEYS_SET = new Set(SEGMENTED_REMOTE_FILTER_KEYS);
const LEGACY_REMOTE_FILTER_KEYS_SET = new Set(LEGACY_REMOTE_FILTER_KEYS);
const ESSENTIAL_LEGACY_FILTER_KEYS = ['cidade'];
const ESSENTIAL_SEGMENTED_FILTER_KEYS = ['regiaoOperacao', 'imobiliariaOperacao', 'empreendimento'];
const ESSENTIAL_RESERVA_FILTER_KEYS = ['situacaoAtual', 'idReserva', 'repasseNoMes'];
const ESSENTIAL_FILTER_KEYS_SET = new Set([
  ...ESSENTIAL_LEGACY_FILTER_KEYS,
  ...ESSENTIAL_SEGMENTED_FILTER_KEYS,
  ...ESSENTIAL_RESERVA_FILTER_KEYS,
]);

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
      params.set(key, normalized.join(','));
    }
  }
};

const inFlightOptionsRequests = new Map();
const inFlightSearchRequests = new Map();
const activeSearchControllers = new Map();

const setMapEntryWithLimit = (mapRef, key, value, maxEntries) => {
  const map = mapRef.current;
  if (map.has(key)) {
    map.delete(key);
  }
  map.set(key, value);
  if (map.size > maxEntries) {
    const oldest = map.keys().next().value;
    if (oldest != null) {
      map.delete(oldest);
    }
  }
};

const appendFilterKeyList = (params, keyList, filters) => {
  keyList.forEach((key) => appendMultiParam(params, key, filters[key]));
};

const areOptionListsEqual = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    const a = left[i];
    const b = right[i];
    if (a?.value !== b?.value || a?.label !== b?.label) return false;
  }
  return true;
};

const hasOptionsPayloadDiff = (currentOptions, nextPayload) => (
  Object.entries(nextPayload || {}).some(([key, nextList]) => {
    const currentList = currentOptions?.[key];
    return !areOptionListsEqual(currentList, nextList);
  })
);

const areFilterValuesEqual = (left, right) => {
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) return false;
    return left.every((item, index) => item === right[index]);
  }
  return left === right;
};

export const FiltersProvider = ({ children }) => {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [dynamicOptions, setDynamicOptions] = useState(FILTER_OPTIONS);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(false);
  const [reservationOptionsDemand, setReservationOptionsDemand] = useState(0);
  const reservationOptionsEnabled = reservationOptionsDemand > 0;
  const [extendedFilterOptionsDemand, setExtendedFilterOptionsDemand] = useState(0);
  const extendedFilterOptionsEnabled = extendedFilterOptionsDemand > 0;
  const filterOptionsCacheRef = useRef(new Map());
  const essentialOptionsCacheRef = useRef(new Map());
  const filterSearchCacheRef = useRef(new Map());
  const dynamicOptionsRef = useRef(dynamicOptions);
  const reservationOptionsRef = useRef({
    situacaoAtual: FILTER_OPTIONS.situacaoAtual,
    idReserva: FILTER_OPTIONS.idReserva,
    repasseNoMes: FILTER_OPTIONS.repasseNoMes,
    agente: FILTER_OPTIONS.agente,
  });
  const optionScopeFilters = useMemo(() => ({
    dataInicial: filters.dataInicial,
    dataFinal: filters.dataFinal,
    cidade: filters.cidade,
    coordenacao: filters.coordenacao,
    gerencia: filters.gerencia,
    corretor: filters.corretor,
    sdr: filters.sdr,
    origem: filters.origem,
    empreendimento: filters.empreendimento,
    unidade: filters.unidade,
    empreendimentoReduzido: filters.empreendimentoReduzido,
    imobiliaria: filters.imobiliaria,
    regiaoOperacao: filters.regiaoOperacao,
    imobiliariaOperacao: filters.imobiliariaOperacao,
    corretorOperacao: filters.corretorOperacao,
    sdrOperacao: filters.sdrOperacao,
    corretorAtivo: filters.corretorAtivo,
    gestorCorretor: filters.gestorCorretor,
    coordenadorCorretor: filters.coordenadorCorretor,
    regiaoCorretor: filters.regiaoCorretor,
    imobiliariaCorretor: filters.imobiliariaCorretor,
    sdrAtivo: filters.sdrAtivo,
    gestorSdr: filters.gestorSdr,
    coordenadorSdr: filters.coordenadorSdr,
    regiaoSdr: filters.regiaoSdr,
    imobiliariaSdr: filters.imobiliariaSdr,
    situacaoAtual: filters.situacaoAtual,
    idReserva: filters.idReserva,
    repasseNoMes: filters.repasseNoMes,
    agente: filters.agente,
  }), [
    filters.dataInicial,
    filters.dataFinal,
    filters.cidade,
    filters.coordenacao,
    filters.gerencia,
    filters.corretor,
    filters.sdr,
    filters.origem,
    filters.empreendimento,
    filters.unidade,
    filters.empreendimentoReduzido,
    filters.imobiliaria,
    filters.regiaoOperacao,
    filters.imobiliariaOperacao,
    filters.corretorOperacao,
    filters.sdrOperacao,
    filters.corretorAtivo,
    filters.gestorCorretor,
    filters.coordenadorCorretor,
    filters.regiaoCorretor,
    filters.imobiliariaCorretor,
    filters.sdrAtivo,
    filters.gestorSdr,
    filters.coordenadorSdr,
    filters.regiaoSdr,
    filters.imobiliariaSdr,
    filters.situacaoAtual,
    filters.idReserva,
    filters.repasseNoMes,
    filters.agente,
  ]);
  const essentialOptionScopeFilters = useMemo(() => ({
    dataInicial: filters.dataInicial,
    dataFinal: filters.dataFinal,
    cidade: filters.cidade,
    empreendimento: filters.empreendimento,
    regiaoOperacao: filters.regiaoOperacao,
    imobiliariaOperacao: filters.imobiliariaOperacao,
    situacaoAtual: filters.situacaoAtual,
    idReserva: filters.idReserva,
    repasseNoMes: filters.repasseNoMes,
  }), [
    filters.dataInicial,
    filters.dataFinal,
    filters.cidade,
    filters.empreendimento,
    filters.regiaoOperacao,
    filters.imobiliariaOperacao,
    filters.situacaoAtual,
    filters.idReserva,
    filters.repasseNoMes,
  ]);
  const legacyOptionsQueryString = useMemo(() => {
    const params = new URLSearchParams({
      startDate: optionScopeFilters.dataInicial,
      endDate: optionScopeFilters.dataFinal,
    });

    const setIfEmpty = (targetKey, sourceValues) => {
      const current = optionScopeFilters[targetKey];
      if (Array.isArray(current) && current.length > 0) return;
      if (!Array.isArray(sourceValues) || sourceValues.length === 0) return;
      const normalized = Array.from(
        new Set(
          sourceValues
            .map((item) => String(item ?? '').trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      if (normalized.length > 0) {
        params.set(targetKey, normalized.join(','));
      }
    };

    LEGACY_REMOTE_FILTER_KEYS.forEach((key) => appendMultiParam(params, key, optionScopeFilters[key]));
    setIfEmpty('empreendimentoReduzido', optionScopeFilters.regiaoOperacao);
    setIfEmpty('imobiliaria', optionScopeFilters.imobiliariaOperacao);
    setIfEmpty('corretor', optionScopeFilters.corretorOperacao);
    setIfEmpty('sdr', optionScopeFilters.sdrOperacao);
    setIfEmpty('corretor', optionScopeFilters.corretorAtivo);
    setIfEmpty('gerencia', optionScopeFilters.gestorCorretor);
    setIfEmpty('coordenacao', optionScopeFilters.coordenadorCorretor);
    setIfEmpty('imobiliaria', optionScopeFilters.imobiliariaCorretor);
    setIfEmpty('empreendimentoReduzido', optionScopeFilters.regiaoCorretor);
    setIfEmpty('sdr', optionScopeFilters.sdrAtivo);
    setIfEmpty('gerencia', optionScopeFilters.gestorSdr);
    setIfEmpty('coordenacao', optionScopeFilters.coordenadorSdr);
    setIfEmpty('imobiliaria', optionScopeFilters.imobiliariaSdr);
    setIfEmpty('empreendimentoReduzido', optionScopeFilters.regiaoSdr);
    return params.toString();
  }, [optionScopeFilters]);

  const segmentedOptionsQueryString = useMemo(() => {
    const params = new URLSearchParams({
      startDate: optionScopeFilters.dataInicial,
      endDate: optionScopeFilters.dataFinal,
    });
    SEGMENTED_REMOTE_FILTER_KEYS.forEach((key) => appendMultiParam(params, key, optionScopeFilters[key]));
    return params.toString();
  }, [optionScopeFilters]);

  const reservaOptionsQueryString = useMemo(() => {
    const params = new URLSearchParams({
      startDate: optionScopeFilters.dataInicial,
      endDate: optionScopeFilters.dataFinal,
    });
    RESERVA_REMOTE_FILTER_KEYS.forEach((key) => appendMultiParam(params, key, optionScopeFilters[key]));
    return params.toString();
  }, [optionScopeFilters]);

  const essentialLegacyOptionsQueryString = useMemo(() => {
    const params = new URLSearchParams({
      startDate: essentialOptionScopeFilters.dataInicial,
      endDate: essentialOptionScopeFilters.dataFinal,
    });
    ESSENTIAL_LEGACY_FILTER_KEYS.forEach((key) => appendMultiParam(params, key, essentialOptionScopeFilters[key]));
    appendMultiParam(params, 'empreendimento', essentialOptionScopeFilters.empreendimento);
    if (!Array.isArray(filters.empreendimentoReduzido) || filters.empreendimentoReduzido.length === 0) {
      appendMultiParam(params, 'empreendimentoReduzido', essentialOptionScopeFilters.regiaoOperacao);
    }
    if (!Array.isArray(filters.imobiliaria) || filters.imobiliaria.length === 0) {
      appendMultiParam(params, 'imobiliaria', essentialOptionScopeFilters.imobiliariaOperacao);
    }
    return params.toString();
  }, [essentialOptionScopeFilters, filters.empreendimentoReduzido, filters.imobiliaria]);

  const essentialSegmentedOptionsQueryString = useMemo(() => {
    const params = new URLSearchParams({
      startDate: essentialOptionScopeFilters.dataInicial,
      endDate: essentialOptionScopeFilters.dataFinal,
    });
    ESSENTIAL_SEGMENTED_FILTER_KEYS.forEach((key) => appendMultiParam(params, key, essentialOptionScopeFilters[key]));
    return params.toString();
  }, [essentialOptionScopeFilters]);

  const essentialReservaOptionsQueryString = useMemo(() => {
    const params = new URLSearchParams({
      startDate: essentialOptionScopeFilters.dataInicial,
      endDate: essentialOptionScopeFilters.dataFinal,
    });
    ESSENTIAL_RESERVA_FILTER_KEYS.forEach((key) => appendMultiParam(params, key, essentialOptionScopeFilters[key]));
    return params.toString();
  }, [essentialOptionScopeFilters]);

  const activeLegacyOptionsQueryString = useMemo(
    () => (extendedFilterOptionsEnabled ? legacyOptionsQueryString : essentialLegacyOptionsQueryString),
    [extendedFilterOptionsEnabled, legacyOptionsQueryString, essentialLegacyOptionsQueryString],
  );

  const activeSegmentedOptionsQueryString = useMemo(
    () => (extendedFilterOptionsEnabled ? segmentedOptionsQueryString : essentialSegmentedOptionsQueryString),
    [extendedFilterOptionsEnabled, segmentedOptionsQueryString, essentialSegmentedOptionsQueryString],
  );

  const activeReservaOptionsQueryString = useMemo(
    () => (extendedFilterOptionsEnabled ? reservaOptionsQueryString : essentialReservaOptionsQueryString),
    [extendedFilterOptionsEnabled, reservaOptionsQueryString, essentialReservaOptionsQueryString],
  );

  const hasActiveReservaSelections = useMemo(
    () => RESERVA_REMOTE_FILTER_KEYS.some((key) => Array.isArray(optionScopeFilters[key]) && optionScopeFilters[key].length > 0),
    [optionScopeFilters],
  );

  const shouldLoadReservaOptions = reservationOptionsEnabled || hasActiveReservaSelections;

  useEffect(() => {
    dynamicOptionsRef.current = dynamicOptions;
  }, [dynamicOptions]);

  useEffect(() => {
    reservationOptionsRef.current = {
      situacaoAtual: dynamicOptions.situacaoAtual,
      idReserva: dynamicOptions.idReserva,
      repasseNoMes: dynamicOptions.repasseNoMes,
      agente: dynamicOptions.agente,
    };
  }, [dynamicOptions.agente, dynamicOptions.idReserva, dynamicOptions.repasseNoMes, dynamicOptions.situacaoAtual]);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const loadFilters = async () => {
      try {
        const optionsModeToken = extendedFilterOptionsEnabled ? 'mode:full' : 'mode:essential';
        const essentialCacheKey = !extendedFilterOptionsEnabled
          ? `${optionsModeToken}||${optionScopeFilters.dataInicial}||${optionScopeFilters.dataFinal}||${shouldLoadReservaOptions ? 'reserva:on' : 'reserva:off'}`
          : null;
        if (essentialCacheKey) {
          const essentialCached = essentialOptionsCacheRef.current.get(essentialCacheKey);
          if (essentialCached) {
            if (!hasOptionsPayloadDiff(dynamicOptionsRef.current, essentialCached)) {
              return;
            }
            setDynamicOptions((prev) => ({ ...prev, ...essentialCached }));
            return;
          }
        }

        const queryString = `${optionsModeToken}||${activeLegacyOptionsQueryString}||${activeSegmentedOptionsQueryString}||${shouldLoadReservaOptions ? activeReservaOptionsQueryString : 'reserva:disabled'}`;
        const cached = filterOptionsCacheRef.current.get(queryString);
        if (cached) {
          if (!hasOptionsPayloadDiff(dynamicOptionsRef.current, cached)) {
            return;
          }
          setDynamicOptions(prev => ({ ...prev, ...cached }));
          return;
        }

        setFilterOptionsLoading(true);
        const loadRemoteOptions = async () => {
          const fetchWithTimeout = async (url, timeoutMs) => {
            const timeoutController = new AbortController();
            const forwardAbort = () => timeoutController.abort();
            const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
            controller.signal.addEventListener('abort', forwardAbort, { once: true });
            try {
              return await fetch(url, { signal: timeoutController.signal });
            } catch {
              return null;
            } finally {
              clearTimeout(timeoutId);
              controller.signal.removeEventListener('abort', forwardAbort);
            }
          };
          const optionsLimit = extendedFilterOptionsEnabled ? '120' : '80';
          const legacyParams = new URLSearchParams(activeLegacyOptionsQueryString);
          legacyParams.set('lite', 'true');
          legacyParams.set('limit', optionsLimit);
          if (!extendedFilterOptionsEnabled) {
            legacyParams.set('fields', ESSENTIAL_LEGACY_FILTER_KEYS.join(','));
          }
          const segmentedParams = new URLSearchParams(activeSegmentedOptionsQueryString);
          segmentedParams.set('lite', 'true');
          segmentedParams.set('limit', optionsLimit);
          if (!extendedFilterOptionsEnabled) {
            segmentedParams.set('fields', ESSENTIAL_SEGMENTED_FILTER_KEYS.join(','));
          }
          const reservasParams = new URLSearchParams(activeReservaOptionsQueryString);
          reservasParams.set('lite', 'true');
          reservasParams.set('limit', optionsLimit);
          if (!extendedFilterOptionsEnabled) {
            reservasParams.set('fields', ESSENTIAL_RESERVA_FILTER_KEYS.join(','));
          }

          const [legacyResponse, segmentedResponse, reservasResponse] = await Promise.all([
            fetchWithTimeout(
              `/api/v1/dashboard/filters?${legacyParams.toString()}`,
              5000,
            ),
            fetchWithTimeout(
              `/api/v1/dashboard/segmented/filters?${segmentedParams.toString()}`,
              5000,
            ),
            shouldLoadReservaOptions
              ? fetchWithTimeout(
                `/api/v1/dashboard/reservas/filters?${reservasParams.toString()}`,
                5000,
              )
              : Promise.resolve(null),
          ]);

          const legacyData = legacyResponse?.ok ? await legacyResponse.json() : {};
          const data = segmentedResponse?.ok ? await segmentedResponse.json() : {};
          const reservasData = reservasResponse?.ok ? await reservasResponse.json() : {};
          return {
            hasAny: Boolean(legacyResponse?.ok) || Boolean(segmentedResponse?.ok) || Boolean(reservasResponse?.ok),
            legacyData,
            data,
            reservasData,
          };
        };

        let inFlight = inFlightOptionsRequests.get(queryString);
        if (!inFlight) {
          inFlight = loadRemoteOptions().finally(() => {
            inFlightOptionsRequests.delete(queryString);
          });
          inFlightOptionsRequests.set(queryString, inFlight);
        }

        const { hasAny, legacyData, data, reservasData } = await inFlight;
        if (!active || controller.signal.aborted) return;
        if (hasAny) {
          // Safe Guard: Only update if we received valid fields
          if ((data && typeof data === 'object' && !Array.isArray(data))
            || (legacyData && typeof legacyData === 'object' && !Array.isArray(legacyData))
            || (reservasData && typeof reservasData === 'object' && !Array.isArray(reservasData))) {
            const loadedKeys = new Set();
            Object.keys(FILTER_OPTIONS).forEach((key) => {
              if (key === 'perfilVisualizacao' || key === 'periodo') return;
              if (RESERVA_FILTER_FIELDS.has(key) && !shouldLoadReservaOptions) return;
              if (extendedFilterOptionsEnabled || ESSENTIAL_FILTER_KEYS_SET.has(key)) {
                loadedKeys.add(key);
              }
            });
            if (shouldLoadReservaOptions) {
              (extendedFilterOptionsEnabled ? RESERVA_REMOTE_FILTER_KEYS : ESSENTIAL_RESERVA_FILTER_KEYS)
                .forEach((key) => loadedKeys.add(key));
            }

            const optionBuilders = {
              cidade: () => ensureBlankOption(sanitizeBackendOptions('cidade', legacyData.cidade)),
              coordenacao: () => ensureBlankOption(sanitizeBackendOptions('coordenacao', legacyData.coordenacao)),
              gerencia: () => ensureBlankOption(sanitizeBackendOptions('gerencia', legacyData.gerencia)),
              corretor: () => ensureBlankOption(sanitizeBackendOptions('corretor', legacyData.corretor)),
              sdr: () => ensureBlankOption(sanitizeBackendOptions('sdr', legacyData.sdr)),
              origem: () => ensureBlankOption(sanitizeBackendOptions('origem', legacyData.origem || data.operation?.origem)),
              empreendimento: () => ensureBlankOption(sanitizeBackendOptions('empreendimento', data.operation?.empreendimento || legacyData.empreendimento)),
              unidade: () => ensureBlankOption(sanitizeBackendOptions('unidade', data.operation?.unidade || legacyData.unidade)),
              empreendimentoReduzido: () => ensureBlankOption(sanitizeBackendOptions('empreendimentoReduzido', legacyData.empreendimentoReduzido)),
              imobiliaria: () => ensureBlankOption(sanitizeBackendOptions('imobiliaria', legacyData.imobiliaria)),
              regiaoOperacao: () => ensureBlankOption(sanitizeBackendOptions('regiaoOperacao', data.operation?.regiaoOperacao || legacyData.empreendimentoReduzido)),
              imobiliariaOperacao: () => ensureBlankOption(sanitizeBackendOptions('imobiliariaOperacao', data.operation?.imobiliariaOperacao || legacyData.imobiliaria)),
              corretorOperacao: () => ensureBlankOption(sanitizeBackendOptions('corretorOperacao', data.operation?.corretorOperacao || legacyData.corretor)),
              sdrOperacao: () => ensureBlankOption(sanitizeBackendOptions('sdrOperacao', data.operation?.sdrOperacao || legacyData.sdr)),
              corretorAtivo: () => ensureBlankOption(sanitizeBackendOptions('corretorAtivo', data.corretorAtivo?.corretorAtivo || legacyData.corretor)),
              gestorCorretor: () => ensureBlankOption(sanitizeBackendOptions('gestorCorretor', data.corretorAtivo?.gestorCorretor || legacyData.gerencia)),
              coordenadorCorretor: () => ensureBlankOption(sanitizeBackendOptions('coordenadorCorretor', data.corretorAtivo?.coordenadorCorretor || legacyData.coordenacao)),
              regiaoCorretor: () => ensureBlankOption(sanitizeBackendOptions('regiaoCorretor', data.corretorAtivo?.regiaoCorretor || legacyData.empreendimentoReduzido)),
              imobiliariaCorretor: () => ensureBlankOption(sanitizeBackendOptions('imobiliariaCorretor', data.corretorAtivo?.imobiliariaCorretor || legacyData.imobiliaria)),
              sdrAtivo: () => ensureBlankOption(sanitizeBackendOptions('sdrAtivo', data.sdrAtivo?.sdrAtivo || legacyData.sdr)),
              gestorSdr: () => ensureBlankOption(sanitizeBackendOptions('gestorSdr', data.sdrAtivo?.gestorSdr || legacyData.gerencia)),
              coordenadorSdr: () => ensureBlankOption(sanitizeBackendOptions('coordenadorSdr', data.sdrAtivo?.coordenadorSdr || legacyData.coordenacao)),
              regiaoSdr: () => ensureBlankOption(sanitizeBackendOptions('regiaoSdr', data.sdrAtivo?.regiaoSdr || legacyData.empreendimentoReduzido)),
              imobiliariaSdr: () => ensureBlankOption(sanitizeBackendOptions('imobiliariaSdr', data.sdrAtivo?.imobiliariaSdr || legacyData.imobiliaria)),
              situacaoAtual: () => ensureBlankOption(sanitizeBackendOptions('situacaoAtual', reservasData.situacaoAtual)),
              idReserva: () => ensureBlankOption(sanitizeBackendOptions('idReserva', reservasData.idReserva)),
              repasseNoMes: () => ensureBlankOption(sanitizeBackendOptions('repasseNoMes', reservasData.repasseNoMes)),
              agente: () => ensureBlankOption(sanitizeBackendOptions('agente', reservasData.agente)),
            };

            const normalizedData = Object.fromEntries(
              Array.from(loadedKeys)
                .map((key) => [key, optionBuilders[key]?.()])
                .filter(([, value]) => Array.isArray(value)),
            );


            setMapEntryWithLimit(filterOptionsCacheRef, queryString, normalizedData, 80);
            if (essentialCacheKey) {
              setMapEntryWithLimit(essentialOptionsCacheRef, essentialCacheKey, normalizedData, 12);
            }

            if (!hasOptionsPayloadDiff(dynamicOptionsRef.current, normalizedData)) {
              return;
            }

            setDynamicOptions((prev) => ({
              ...prev,
              ...normalizedData,
            }));

            setFilters((current) => {
              const next = { ...current };
              let hasChanges = false;
              const defaults = {
                cidade: [],
                coordenacao: [],
                corretor: [],
                gerencia: [],
                sdr: [],
                origem: [],
                empreendimento: [],
                empreendimentoReduzido: [],
                imobiliaria: [],
                regiaoOperacao: [],
                imobiliariaOperacao: [],
                corretorOperacao: [],
                unidade: [],
                sdrOperacao: [],
                corretorAtivo: [],
                gestorCorretor: [],
                coordenadorCorretor: [],
                regiaoCorretor: [],
                imobiliariaCorretor: [],
                sdrAtivo: [],
                gestorSdr: [],
                coordenadorSdr: [],
                regiaoSdr: [],
                imobiliariaSdr: [],
                situacaoAtual: [],
                idReserva: [],
                repasseNoMes: [],
                agente: [],
              };

              Object.entries(defaults).forEach(([key, defaultValue]) => {
                if (!loadedKeys.has(key)) return;
                const options = normalizedData[key] ?? [];
                const selected = current[key];
                
                if (Array.isArray(selected)) {
                  // For arrays, we just ensure the selected values still exist in the new options
                  const validSelected = selected.filter(val => 
                    options.some(opt => opt.value === val)
                  );
                  if (validSelected.length !== selected.length) {
                    next[key] = validSelected;
                    hasChanges = true;
                  }
                  return;
                }

                const hasSelected = options.some((option) => option.value === selected);
                if (!hasSelected) {
                  next[key] = defaultValue;
                  if (defaultValue !== selected) {
                    hasChanges = true;
                  }
                }
              });

              return hasChanges ? next : current;
            });
          }
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
        logger.warn('filters', 'Falha ao buscar filtros remotos, usando fallback', { error: err?.message });
      } finally {
        if (active) {
          setFilterOptionsLoading(false);
        }
      }
    };
    const fetchDebounceMs = extendedFilterOptionsEnabled ? 220 : 140;
    const timer = setTimeout(() => {
      loadFilters();
    }, fetchDebounceMs);

    return () => {
      active = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [
    extendedFilterOptionsEnabled,
    activeLegacyOptionsQueryString,
    activeSegmentedOptionsQueryString,
    activeReservaOptionsQueryString,
    shouldLoadReservaOptions,
    optionScopeFilters.dataInicial,
    optionScopeFilters.dataFinal,
  ]);

  const setFilterValue = (key, value) => {
    setFilters((current) => {
      if (areFilterValuesEqual(current[key], value)) {
        return current;
      }
      return {
        ...current,
        [key]: value,
      };
    });
  };

  const setPeriodo = (periodo) => {
    const preset = PERIOD_PRESETS[periodo];

    if (!preset) {
      return;
    }

    setFilters((current) => {
      if (
        current.periodo === periodo
        && current.dataInicial === preset.dataInicial
        && current.dataFinal === preset.dataFinal
      ) {
        return current;
      }
      return {
        ...current,
        periodo,
        dataInicial: preset.dataInicial,
        dataFinal: preset.dataFinal,
      };
    });
  };

  const setDateRange = ({ dataInicial, dataFinal, periodo }) => {
    setFilters((current) => {
      const nextDataInicial = dataInicial ?? current.dataInicial;
      const nextDataFinal = dataFinal ?? current.dataFinal;
      const nextPeriodo = periodo ?? current.periodo;
      if (
        current.dataInicial === nextDataInicial
        && current.dataFinal === nextDataFinal
        && current.periodo === nextPeriodo
      ) {
        return current;
      }
      return {
        ...current,
        dataInicial: nextDataInicial,
        dataFinal: nextDataFinal,
        periodo: nextPeriodo,
      };
    });
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const enableReservationOptions = useCallback(() => {
    setReservationOptionsDemand((current) => current + 1);
  }, []);

  const disableReservationOptions = useCallback(() => {
    setReservationOptionsDemand((current) => (current > 0 ? current - 1 : 0));
  }, []);

  const enableExtendedFilterOptions = useCallback(() => {
    setExtendedFilterOptionsDemand((current) => current + 1);
  }, []);

  const disableExtendedFilterOptions = useCallback(() => {
    setExtendedFilterOptionsDemand((current) => (current > 0 ? current - 1 : 0));
  }, []);

  const searchFilterOptions = useCallback(async (field, term) => {
    const q = String(term || '').trim();
    if (q.length < 2) return [];
    const normalizedQ = q.toLowerCase();

    const params = new URLSearchParams({
      field,
      q: normalizedQ,
      limit: '40',
      startDate: optionScopeFilters.dataInicial,
      endDate: optionScopeFilters.dataFinal,
    });

    const isSegmentedField = SEGMENTED_REMOTE_FILTER_KEYS_SET.has(field);
    const isReservaField = RESERVA_FILTER_FIELDS.has(field);
    const isLegacyField = LEGACY_REMOTE_FILTER_KEYS_SET.has(field);

    if (isSegmentedField) {
      appendFilterKeyList(params, SEGMENTED_REMOTE_FILTER_KEYS, optionScopeFilters);
    } else if (isReservaField) {
      appendFilterKeyList(params, LEGACY_REMOTE_FILTER_KEYS, optionScopeFilters);
      appendFilterKeyList(params, RESERVA_REMOTE_FILTER_KEYS, optionScopeFilters);
      // Keep segmented constraints on reserva search to preserve cross-panel narrowing.
      appendFilterKeyList(params, SEGMENTED_REMOTE_FILTER_KEYS, optionScopeFilters);
    } else if (isLegacyField) {
      appendFilterKeyList(params, LEGACY_REMOTE_FILTER_KEYS, optionScopeFilters);
      // Legacy endpoints project segmented fields to legacy in backend fallback;
      // include segmented state so search respects current UI context.
      appendFilterKeyList(params, SEGMENTED_REMOTE_FILTER_KEYS, optionScopeFilters);
    } else {
      appendFilterKeyList(params, LEGACY_REMOTE_FILTER_KEYS, optionScopeFilters);
      appendFilterKeyList(params, SEGMENTED_REMOTE_FILTER_KEYS, optionScopeFilters);
      appendFilterKeyList(params, RESERVA_REMOTE_FILTER_KEYS, optionScopeFilters);
    }

    const key = `${field}::${params.toString()}`;
    const cached = filterSearchCacheRef.current.get(key);
    if (cached) return cached;

    try {
      let inFlight = inFlightSearchRequests.get(key);
      if (!inFlight) {
        const fieldSearchKey = `${field}::${optionScopeFilters.dataInicial}::${optionScopeFilters.dataFinal}`;
        const previousController = activeSearchControllers.get(fieldSearchKey);
        if (previousController) {
          previousController.abort();
        }
        const controller = new AbortController();
        activeSearchControllers.set(fieldSearchKey, controller);

        inFlight = fetch(`/api/v1/dashboard/filters/search?${params.toString()}`, { signal: controller.signal })
          .then(async (response) => {
            if (!response.ok) return [];
            const payload = await response.json();
            return sanitizeBackendOptions(field, Array.isArray(payload?.options) ? payload.options : []);
          })
          .catch((err) => {
            if (err?.name === 'AbortError') return [];
            return [];
          })
          .finally(() => {
            inFlightSearchRequests.delete(key);
            if (activeSearchControllers.get(fieldSearchKey) === controller) {
              activeSearchControllers.delete(fieldSearchKey);
            }
          });
        inFlightSearchRequests.set(key, inFlight);
      }
      const options = await inFlight;
      setMapEntryWithLimit(filterSearchCacheRef, key, options, 400);
      return options;
    } catch {
      return [];
    }
  }, [optionScopeFilters]);

  const activeFilterLabels = useMemo(
    () => ({
      perfilVisualizacao: getSelectedLabel(dynamicOptions.perfilVisualizacao, filters.perfilVisualizacao),
      periodo: getSelectedLabel(dynamicOptions.periodo, filters.periodo),
      cidade: getSelectedLabel(dynamicOptions.cidade, filters.cidade),
      coordenacao: getSelectedLabel(dynamicOptions.coordenacao, filters.coordenacao),
      gerencia: getSelectedLabel(dynamicOptions.gerencia, filters.gerencia),
      corretor: getSelectedLabel(dynamicOptions.corretor, filters.corretor),
      sdr: getSelectedLabel(dynamicOptions.sdr, filters.sdr),
      origem: getSelectedLabel(dynamicOptions.origem, filters.origem),
      empreendimento: getSelectedLabel(dynamicOptions.empreendimento, filters.empreendimento),
      unidade: getSelectedLabel(dynamicOptions.unidade, filters.unidade),
      imobiliaria: getSelectedLabel(dynamicOptions.imobiliaria, filters.imobiliaria),
      regiaoOperacao: getSelectedLabel(dynamicOptions.regiaoOperacao, filters.regiaoOperacao),
      imobiliariaOperacao: getSelectedLabel(dynamicOptions.imobiliariaOperacao, filters.imobiliariaOperacao),
      corretorOperacao: getSelectedLabel(dynamicOptions.corretorOperacao, filters.corretorOperacao),
      sdrOperacao: getSelectedLabel(dynamicOptions.sdrOperacao, filters.sdrOperacao),
      corretorAtivo: getSelectedLabel(dynamicOptions.corretorAtivo, filters.corretorAtivo),
      gestorCorretor: getSelectedLabel(dynamicOptions.gestorCorretor, filters.gestorCorretor),
      coordenadorCorretor: getSelectedLabel(dynamicOptions.coordenadorCorretor, filters.coordenadorCorretor),
      regiaoCorretor: getSelectedLabel(dynamicOptions.regiaoCorretor, filters.regiaoCorretor),
      imobiliariaCorretor: getSelectedLabel(dynamicOptions.imobiliariaCorretor, filters.imobiliariaCorretor),
      sdrAtivo: getSelectedLabel(dynamicOptions.sdrAtivo, filters.sdrAtivo),
      gestorSdr: getSelectedLabel(dynamicOptions.gestorSdr, filters.gestorSdr),
      coordenadorSdr: getSelectedLabel(dynamicOptions.coordenadorSdr, filters.coordenadorSdr),
      regiaoSdr: getSelectedLabel(dynamicOptions.regiaoSdr, filters.regiaoSdr),
      imobiliariaSdr: getSelectedLabel(dynamicOptions.imobiliariaSdr, filters.imobiliariaSdr),
      situacaoAtual: getSelectedLabel(dynamicOptions.situacaoAtual, filters.situacaoAtual),
      idReserva: getSelectedLabel(dynamicOptions.idReserva, filters.idReserva),
      repasseNoMes: getSelectedLabel(dynamicOptions.repasseNoMes, filters.repasseNoMes),
      agente: getSelectedLabel(dynamicOptions.agente, filters.agente),
      empreendimentoReduzido: Array.isArray(filters.empreendimentoReduzido) && filters.empreendimentoReduzido.length > 0
        ? filters.empreendimentoReduzido
            .map(val => getSelectedLabel(dynamicOptions.empreendimentoReduzido, val))
            .join(', ')
        : 'Todas as regiões',
    }),
    [filters, dynamicOptions],
  );

  return (
    <FiltersContext.Provider
      value={{
        filters,
        filterOptions: dynamicOptions,
        filterOptionsLoading,
        periodPresets: PERIOD_PRESETS,
        activeFilterLabels,
        setFilters,
        setFilterValue,
        setPeriodo,
        setDateRange,
        resetFilters,
        searchFilterOptions,
        enableReservationOptions,
        disableReservationOptions,
        enableExtendedFilterOptions,
        disableExtendedFilterOptions,
      }}
    >
      {children}
    </FiltersContext.Provider>
  );
};

// react-refresh complains about exporting hooks from provider files; intentional here to bundle context utilities.
// eslint-disable-next-line react-refresh/only-export-components
export const useFilters = () => {
  const context = useContext(FiltersContext);

  if (!context) {
    throw new Error('useFilters must be used within FiltersProvider');
  }

  return context;
};
