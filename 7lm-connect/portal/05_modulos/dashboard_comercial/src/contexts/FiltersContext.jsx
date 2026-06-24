import { createContext, useContext, useMemo, useState, useEffect, useRef } from 'react';
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

const getSegmentedOptionsFromPayload = (payload, field) => {
  const path = SEGMENTED_FILTER_GROUP_BY_FIELD[field];
  if (!path) return [];
  const [group, key] = path;
  return payload?.[group]?.[key] ?? [];
};

export const FiltersProvider = ({ children }) => {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [dynamicOptions, setDynamicOptions] = useState(FILTER_OPTIONS);
  const filterOptionsCacheRef = useRef(new Map());
  const filterSearchCacheRef = useRef(new Map());

  useEffect(() => {
    const controller = new AbortController();
    const loadFilters = async () => {
      try {
        const params = new URLSearchParams({
          startDate: filters.dataInicial,
          endDate: filters.dataFinal,
        });

        const appendMulti = (key, value) => {
          if (Array.isArray(value) && value.length > 0) {
            params.append(key, value.join(','));
          }
        };

        appendMulti('cidade', filters.cidade);
        appendMulti('coordenacao', filters.coordenacao);
        appendMulti('gerencia', filters.gerencia);
        appendMulti('corretor', filters.corretor);
        appendMulti('sdr', filters.sdr);
        appendMulti('origem', filters.origem);
        appendMulti('empreendimento', filters.empreendimento);
        appendMulti('empreendimentoReduzido', filters.empreendimentoReduzido);
        appendMulti('imobiliaria', filters.imobiliaria);
        appendMulti('regiaoOperacao', filters.regiaoOperacao);
        appendMulti('imobiliariaOperacao', filters.imobiliariaOperacao);
        appendMulti('corretorOperacao', filters.corretorOperacao);
        appendMulti('sdrOperacao', filters.sdrOperacao);
        appendMulti('corretorAtivo', filters.corretorAtivo);
        appendMulti('gestorCorretor', filters.gestorCorretor);
        appendMulti('coordenadorCorretor', filters.coordenadorCorretor);
        appendMulti('regiaoCorretor', filters.regiaoCorretor);
        appendMulti('imobiliariaCorretor', filters.imobiliariaCorretor);
        appendMulti('sdrAtivo', filters.sdrAtivo);
        appendMulti('gestorSdr', filters.gestorSdr);
        appendMulti('coordenadorSdr', filters.coordenadorSdr);
        appendMulti('regiaoSdr', filters.regiaoSdr);
        appendMulti('imobiliariaSdr', filters.imobiliariaSdr);
        appendMulti('situacaoAtual', filters.situacaoAtual);
        appendMulti('idReserva', filters.idReserva);
        appendMulti('repasseNoMes', filters.repasseNoMes);
        appendMulti('agente', filters.agente);

        const queryString = params.toString();
        const cached = filterOptionsCacheRef.current.get(queryString);
        if (cached) {
          setDynamicOptions(prev => ({ ...prev, ...cached }));
          return;
        }

        const fastParams = new URLSearchParams(queryString);
        fastParams.set('lite', 'true');
        fastParams.set('limit', '120');
        const [segmentedResponse, reservasResponse] = await Promise.all([
          fetch(`/api/v1/dashboard/segmented/filters?${fastParams.toString()}`, { signal: controller.signal }),
          fetch(`/api/v1/dashboard/reservas/filters?${fastParams.toString()}`, { signal: controller.signal }),
        ]);
        if (segmentedResponse.ok) {
          const data = await segmentedResponse.json();
          const reservasData = reservasResponse.ok ? await reservasResponse.json() : {};
          // Safe Guard: Only update if we received valid fields
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            const normalizedData = {
              regiaoOperacao: ensureBlankOption(sanitizeBackendOptions('regiaoOperacao', data.operation?.regiaoOperacao)),
              imobiliariaOperacao: ensureBlankOption(sanitizeBackendOptions('imobiliariaOperacao', data.operation?.imobiliariaOperacao)),
              corretorOperacao: ensureBlankOption(sanitizeBackendOptions('corretorOperacao', data.operation?.corretorOperacao)),
              empreendimento: ensureBlankOption(sanitizeBackendOptions('empreendimento', data.operation?.empreendimento)),
              unidade: ensureBlankOption(sanitizeBackendOptions('unidade', data.operation?.unidade)),
              origem: ensureBlankOption(sanitizeBackendOptions('origem', data.operation?.origem)),
              sdrOperacao: ensureBlankOption(sanitizeBackendOptions('sdrOperacao', data.operation?.sdrOperacao)),
              corretorAtivo: ensureBlankOption(sanitizeBackendOptions('corretorAtivo', data.corretorAtivo?.corretorAtivo)),
              gestorCorretor: ensureBlankOption(sanitizeBackendOptions('gestorCorretor', data.corretorAtivo?.gestorCorretor)),
              coordenadorCorretor: ensureBlankOption(sanitizeBackendOptions('coordenadorCorretor', data.corretorAtivo?.coordenadorCorretor)),
              regiaoCorretor: ensureBlankOption(sanitizeBackendOptions('regiaoCorretor', data.corretorAtivo?.regiaoCorretor)),
              imobiliariaCorretor: ensureBlankOption(sanitizeBackendOptions('imobiliariaCorretor', data.corretorAtivo?.imobiliariaCorretor)),
              sdrAtivo: ensureBlankOption(sanitizeBackendOptions('sdrAtivo', data.sdrAtivo?.sdrAtivo)),
              gestorSdr: ensureBlankOption(sanitizeBackendOptions('gestorSdr', data.sdrAtivo?.gestorSdr)),
              coordenadorSdr: ensureBlankOption(sanitizeBackendOptions('coordenadorSdr', data.sdrAtivo?.coordenadorSdr)),
              regiaoSdr: ensureBlankOption(sanitizeBackendOptions('regiaoSdr', data.sdrAtivo?.regiaoSdr)),
              imobiliariaSdr: ensureBlankOption(sanitizeBackendOptions('imobiliariaSdr', data.sdrAtivo?.imobiliariaSdr)),
              situacaoAtual: ensureBlankOption(sanitizeBackendOptions('situacaoAtual', reservasData.situacaoAtual)),
              idReserva: ensureBlankOption(sanitizeBackendOptions('idReserva', reservasData.idReserva)),
              repasseNoMes: ensureBlankOption(sanitizeBackendOptions('repasseNoMes', reservasData.repasseNoMes)),
              agente: ensureBlankOption(sanitizeBackendOptions('agente', reservasData.agente)),
            };


            filterOptionsCacheRef.current.set(queryString, normalizedData);

            setDynamicOptions(prev => ({
              ...prev,
              ...normalizedData
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

            logger.info('filters', 'Filtros do backend sincronizados', normalizedData);
          }
        }
      } catch (err) {
        if (err?.name === 'AbortError') return;
        logger.warn('filters', 'Falha ao buscar filtros remotos, usando fallback', { error: err?.message });
      }
    };
    const timer = setTimeout(() => {
      loadFilters();
    }, 200);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [filters.dataInicial, filters.dataFinal, filters.cidade, filters.coordenacao, filters.gerencia, filters.corretor, filters.sdr, filters.empreendimentoReduzido, filters.imobiliaria, filters.regiaoOperacao, filters.imobiliariaOperacao, filters.corretorOperacao, filters.sdrOperacao, filters.origem, filters.empreendimento, filters.unidade, filters.corretorAtivo, filters.gestorCorretor, filters.coordenadorCorretor, filters.regiaoCorretor, filters.imobiliariaCorretor, filters.sdrAtivo, filters.gestorSdr, filters.coordenadorSdr, filters.regiaoSdr, filters.imobiliariaSdr, filters.situacaoAtual, filters.idReserva, filters.repasseNoMes, filters.agente]);

  const setFilterValue = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const setPeriodo = (periodo) => {
    const preset = PERIOD_PRESETS[periodo];

    if (!preset) {
      return;
    }

    setFilters((current) => ({
      ...current,
      periodo,
      dataInicial: preset.dataInicial,
      dataFinal: preset.dataFinal,
    }));
  };

  const setDateRange = ({ dataInicial, dataFinal, periodo }) => {
    setFilters((current) => ({
      ...current,
      dataInicial: dataInicial ?? current.dataInicial,
      dataFinal: dataFinal ?? current.dataFinal,
      periodo: periodo ?? current.periodo,
    }));
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const searchFilterOptions = async (field, term) => {
    const q = String(term || '').trim();
    if (q.length < 2) return [];

    const key = `${field}::${q.toLowerCase()}::${filters.dataInicial}::${filters.dataFinal}`;
    const cached = filterSearchCacheRef.current.get(key);
    if (cached) return cached;

    const params = new URLSearchParams({
      field,
      q,
      limit: '40',
      startDate: filters.dataInicial,
      endDate: filters.dataFinal,
    });

    const appendMulti = (name, value) => {
      if (Array.isArray(value) && value.length > 0) {
        params.set(name, value.join(','));
      }
    };

    appendMulti('cidade', filters.cidade);
    appendMulti('coordenacao', filters.coordenacao);
    appendMulti('gerencia', filters.gerencia);
    appendMulti('corretor', filters.corretor);
    appendMulti('sdr', filters.sdr);
    appendMulti('origem', filters.origem);
    appendMulti('empreendimento', filters.empreendimento);
    appendMulti('empreendimentoReduzido', filters.empreendimentoReduzido);
    appendMulti('imobiliaria', filters.imobiliaria);
    Object.keys(SEGMENTED_FILTER_GROUP_BY_FIELD).forEach((name) => {
      appendMulti(name, filters[name]);
    });
    RESERVA_FILTER_FIELDS.forEach((name) => {
      appendMulti(name, filters[name]);
    });

    try {
      if (SEGMENTED_FILTER_GROUP_BY_FIELD[field]) {
        const segmentedParams = new URLSearchParams(params);
        segmentedParams.delete('field');
        segmentedParams.delete('q');
        segmentedParams.set('lite', 'false');
        segmentedParams.set('limit', '1000');
        const response = await fetch(`/api/v1/dashboard/segmented/filters?${segmentedParams.toString()}`);
        if (!response.ok) return [];
        const payload = await response.json();
        const options = sanitizeBackendOptions(field, getSegmentedOptionsFromPayload(payload, field))
          .filter((option) => option.label.toLowerCase().includes(q.toLowerCase()));
        filterSearchCacheRef.current.set(key, options);
        return options;
      }

      if (RESERVA_FILTER_FIELDS.has(field)) {
        const reservaParams = new URLSearchParams(params);
        reservaParams.delete('field');
        reservaParams.delete('q');
        reservaParams.set('limit', '500');
        const response = await fetch(`/api/v1/dashboard/reservas/filters?${reservaParams.toString()}`);
        if (!response.ok) return [];
        const payload = await response.json();
        const options = sanitizeBackendOptions(field, payload?.[field])
          .filter((option) => option.label.toLowerCase().includes(q.toLowerCase()));
        filterSearchCacheRef.current.set(key, options);
        return options;
      }

      const response = await fetch(`/api/v1/dashboard/filters/search?${params.toString()}`);
      if (!response.ok) return [];
      const payload = await response.json();
      const options = Array.isArray(payload?.options) ? payload.options : [];
      filterSearchCacheRef.current.set(key, options);
      return options;
    } catch {
      return [];
    }
  };

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
        periodPresets: PERIOD_PRESETS,
        activeFilterLabels,
        setFilters,
        setFilterValue,
        setPeriodo,
        setDateRange,
        resetFilters,
        searchFilterOptions,
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
