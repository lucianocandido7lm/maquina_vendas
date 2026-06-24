import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpDown, BarChart3, ChevronDown, ChevronRight, LayoutDashboard, ListChecks, RefreshCcw, Save, Target, TriangleAlert } from 'lucide-react';
import {
  Bar,
  BarChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import DashboardFilters from '../components/DashboardFilters';
import { useCommercialFilters } from '../hooks/useCommercialFilters';
import './ReservasBI.css';

const fmtNumber = (value, digits = 0) => {
  const numeric = Number(value ?? 0);
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number.isFinite(numeric) ? numeric : 0);
};

const fmtPercent = (value) => (value == null ? '-' : `${fmtNumber(value, 0)}%`);

const compareValues = (aValue, bValue) => {
  const emptyA = aValue == null || aValue === '';
  const emptyB = bValue == null || bValue === '';
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;

  const dateA = Date.parse(aValue);
  const dateB = Date.parse(bValue);
  if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) return dateA - dateB;

  const numA = Number(aValue);
  const numB = Number(bValue);
  if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;

  return String(aValue).localeCompare(String(bValue), 'pt-BR', { numeric: true, sensitivity: 'base' });
};

const fmtDate = (value) => {
  if (!value) return '-';
  const [date] = String(value).split('T');
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const diffDays = (start, end) => {
  if (!start || !end) return null;
  const startDate = parseDateUtc(start);
  const endDate = parseDateUtc(end);
  if (!startDate || !endDate) return null;
  return Math.trunc((endDate.getTime() - startDate.getTime()) / 86400000);
};

const fmtDays = (value) => (value == null || Number.isNaN(Number(value)) ? '-' : `${fmtNumber(value)} dias`);
const DATE_DRILL_LEVELS = [
  { id: 'ano', label: 'Ano' },
  { id: 'trimestre', label: 'Trimestre' },
  { id: 'mes', label: 'Mês' },
  { id: 'semana', label: 'Semana' },
  { id: 'dia', label: 'Dia' },
];
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const parseDateUtc = (value) => {
  if (!value) return null;
  const [date] = String(value).split('T');
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
};

const toDateKey = (date) => date.toISOString().slice(0, 10);
const todayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const addUtcDays = (date, days) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const addUtcMonths = (date, months) => {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

const startOfUtcWeek = (date) => {
  const start = new Date(date);
  const offset = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - offset);
  return start;
};

const getDateBucket = (date, level) => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  if (level === 'ano') {
    const start = new Date(Date.UTC(year, 0, 1));
    return { key: `${year}`, label: `${year}`, start, end: new Date(Date.UTC(year, 11, 31)) };
  }
  if (level === 'trimestre') {
    const quarter = Math.floor(month / 3) + 1;
    const start = new Date(Date.UTC(year, (quarter - 1) * 3, 1));
    return { key: `${year}-Q${quarter}`, label: `T${quarter} ${year}`, start, end: addUtcDays(addUtcMonths(start, 3), -1) };
  }
  if (level === 'mes') {
    const start = new Date(Date.UTC(year, month, 1));
    return { key: `${year}-${String(month + 1).padStart(2, '0')}`, label: `${MONTH_SHORT[month]}/${String(year).slice(2)}`, start, end: addUtcDays(addUtcMonths(start, 1), -1) };
  }
  if (level === 'semana') {
    const start = startOfUtcWeek(date);
    return { key: toDateKey(start), label: `Sem ${fmtDate(toDateKey(start)).slice(0, 5)}`, start, end: addUtcDays(start, 6) };
  }
  return { key: toDateKey(date), label: fmtDate(toDateKey(date)).slice(0, 5), start: date, end: date };
};

const inDateRange = (date, range) => {
  if (!range) return true;
  const start = parseDateUtc(range.start);
  const end = parseDateUtc(range.end);
  if (!start || !end) return true;
  return date >= start && date <= end;
};

const minUtcDate = (a, b) => (a <= b ? a : b);
const maxUtcDate = (a, b) => (a >= b ? a : b);

const getDefaultDateDrillRange = (level) => {
  const today = todayUtc();
  if (level === 'dia' || level === 'semana') {
    return {
      start: toDateKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))),
      end: toDateKey(today),
    };
  }
  return {
    start: toDateKey(new Date(Date.UTC(today.getUTCFullYear(), 0, 1))),
    end: toDateKey(today),
  };
};

const getDateDrillRange = (level, path) => {
  const selected = path[path.length - 1];
  if (!selected) return getDefaultDateDrillRange(level);
  const today = todayUtc();
  const start = parseDateUtc(selected.start);
  const end = parseDateUtc(selected.end);
  if (!start || !end) return getDefaultDateDrillRange(level);
  return {
    start: toDateKey(start),
    end: toDateKey(minUtcDate(end, today)),
  };
};

const buildDateBuckets = (level, range) => {
  const start = parseDateUtc(range.start);
  const end = parseDateUtc(range.end);
  if (!start || !end || start > end) return [];
  const buckets = [];
  if (level === 'ano') {
    for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
      const bucketStart = new Date(Date.UTC(year, 0, 1));
      const bucketEnd = new Date(Date.UTC(year, 11, 31));
      const bucket = getDateBucket(bucketStart, 'ano');
      buckets.push({ ...bucket, start: maxUtcDate(bucketStart, start), end: minUtcDate(bucketEnd, end) });
    }
    return buckets;
  }
  if (level === 'trimestre') {
    let cursor = new Date(Date.UTC(start.getUTCFullYear(), Math.floor(start.getUTCMonth() / 3) * 3, 1));
    while (cursor <= end) {
      const bucket = getDateBucket(cursor, 'trimestre');
      buckets.push({ ...bucket, start: cursor < start ? start : bucket.start, end: minUtcDate(bucket.end, end) });
      cursor = addUtcMonths(cursor, 3);
    }
    return buckets;
  }
  if (level === 'mes') {
    let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor <= end) {
      const bucket = getDateBucket(cursor, 'mes');
      buckets.push({ ...bucket, start: cursor < start ? start : bucket.start, end: minUtcDate(bucket.end, end) });
      cursor = addUtcMonths(cursor, 1);
    }
    return buckets;
  }
  if (level === 'semana') {
    let cursor = startOfUtcWeek(start);
    while (cursor <= end) {
      const bucket = getDateBucket(cursor, 'semana');
      buckets.push({ ...bucket, start: bucket.start < start ? start : bucket.start, end: minUtcDate(bucket.end, end) });
      cursor = addUtcDays(cursor, 7);
    }
    return buckets;
  }
  let cursor = new Date(start);
  while (cursor <= end) {
    buckets.push(getDateBucket(cursor, 'dia'));
    cursor = addUtcDays(cursor, 1);
  }
  return buckets;
};

const RESERVAS_TABS = [
  { id: 'geral', label: 'Painel inicial', icon: BarChart3 },
  { id: 'detalhada', label: 'Detalhada por reserva', icon: ListChecks },
  { id: 'metas', label: 'Metas', icon: Target },
];

const DETAIL_TABLE_COLUMNS = [
  { key: 'idreserva', label: 'ID Reserva', getter: (row) => row.idreserva },
  { key: 'dt_cadastro_reserva', label: 'Data cadastro', getter: (row) => row.dt_cadastro_reserva },
  { key: 'corretor', label: 'Corretor', getter: (row) => row.corretor },
  { key: 'empreendimento_nome', label: 'Empreendimento', getter: (row) => row.empreendimento_nome },
  { key: 'imobiliaria', label: 'Imobiliária', getter: (row) => row.imobiliaria },
  { key: 'regiao_empreendimento', label: 'Região', getter: (row) => row.regiao_empreendimento },
  { key: 'reserva_situacao_nome', label: 'Situação', getter: (row) => row.reserva_situacao_nome },
  { key: 'sla_status', label: 'SLA', getter: (row) => getSlaClassification(row) },
  { key: 'reserva_repasse_no_mes', label: 'Repasse no mês', getter: (row) => row.reserva_repasse_no_mes },
  { key: 'risco_cair', label: 'Risco de cair', getter: (row) => (isRiskValue(getRiskFlag(row)) ? 1 : 0) },
];

const META_TABLE_COLUMNS = [
  { key: 'regiao', label: 'regiao_empreendimento', getter: (row) => row.regiao, help: 'Origem: comercial_base.regiao_empreendimento. Regra: agrupa as reservas pela região do empreendimento para totalizar metas por região.' },
  { key: 'imobiliaria', label: 'Imobiliária', getter: (row) => row.imobiliaria, help: 'Origem: comercial_base.imobiliaria_nome_canonica, com fallback para imobiliaria_nome. Regra: identifica a equipe/imobiliária que recebe a meta.' },
  { key: 'reservas_situacoes', label: 'Reservas Situações', getter: (row) => row.reservas_situacoes, help: 'Origem: count distinct comercial_base.idreserva. Regra: conta reservas no período por referencia_data_reserva, apenas em situações operacionais válidas, excluindo Cancelada, Distrato e Venda finalizada.' },
  { key: 'mes_seguinte', label: 'Mes Seguinte', getter: (row) => row.mes_seguinte, help: 'Origem: comercial_base.reserva_campos_adicionais_reserva_repasse_no_mes. Regra: conta idreserva quando Repasse no mês = Não; essas reservas ficam previstas para fora do mês atual.' },
  { key: 'prob_cair', label: 'Prob Cair', getter: (row) => row.prob_cair, help: 'Origem: comercial_base.reserva_campos_adicionais_reserva_repasse_no_mes. Regra: conta idreserva quando o campo está como Probabilidade de cair; essas reservas são retiradas da previsão do mês atual.' },
  { key: 'mes_atual', label: 'Mês Atual', getter: (row) => row.mes_atual, help: 'Cálculo: abs(Reservas Situações - Mes Seguinte - Prob Cair). Regra: representa a carteira de reservas que ainda deve virar repasse dentro do mês atual.' },
  { key: 'mp_reserva', label: 'MP Reserva', getter: (row) => row.mp_reserva, help: 'Origem: idrepasse, repasse_situacao_nome, repasse_campos_adicionais_repasse_probabilidade_de_assinatura, datas CEHOP e dt_assinatura_contrato. Regra: conta repasses em fluxo de repasse/garantia, com probabilidade Sim ou Talvez, ainda sem assinatura ou pendentes nas etapas CEHOP.' },
  { key: 'repasses_assinados', label: 'Assinados', getter: (row) => row.repasses_assinados, help: 'Origem: count distinct comercial_base.idrepasse. Regra: conta repasses com dt_assinatura_contrato dentro do período filtrado.' },
  { key: 'prev_repasse', label: 'Prev. Repasse', getter: (row) => row.prev_repasse, help: 'Cálculo: Mês Atual + MP Reserva + Assinados. Regra: é a previsão final de repasses da equipe/imobiliária para comparar contra a meta.' },
  { key: 'meta_ajustada', label: 'Meta ajustada', getter: (row) => row.meta_ajustada, help: 'Origem: dashboard_goals para kpi_id reservas_prev_repasse. Regra: usa a meta editada pelo usuário; se não houver meta salva, aplica a meta padrão da equipe.' },
  { key: 'alcancado_meta', label: 'Alcancado_meta', getter: (row) => row.alcancado_meta, help: 'Cálculo: Prev. Repasse / Meta ajustada * 100. Regra: mostra o percentual de atingimento da previsão contra a meta da equipe/imobiliária.' },
];

const normalizeText = (value) => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const RESERVAS_PIPELINE_STAGES = [
  'Em processo',
  'Secretaria de Vendas',
  'Envio SIENGE',
  'Crédito',
  'Fase CreditÚ',
  'Assinatura 7LM',
  'Aprovado Diretoria',
  'Venda finalizada',
];

const isNo = (value) => normalizeText(value) === 'nao';
const isFinalSituation = (row) => {
  const situation = normalizeText(row?.reserva_situacao_nome);
  return situation.includes('cancel') || situation.includes('distrato') || situation.includes('venda finalizada');
};
const SLA_LIMITS_BY_STAGE = {
  'Em processo': 7,
  'Secretaria de Vendas': 1,
  'Envio SIENGE': 1,
  'Crédito': 1,
  'Fase CreditÚ': 2,
  'Assinatura 7LM': 1,
  'Aprovado Diretoria': 1,
  'Venda finalizada': 10,
};
const getPipelineStage = (row) => {
  const status = normalizeText(`${row?.reserva_situacao_nome ?? ''} ${row?.repasse_situacao_nome ?? ''} ${row?.reserva_obs_finalizacao ?? ''}`);
  if (status.includes('venda finalizada')) return 'Venda finalizada';
  if (status.includes('aprovado diretoria') || status.includes('diretoria')) return 'Aprovado Diretoria';
  if (status.includes('assinatura 7lm') || status.includes('assinatura')) return 'Assinatura 7LM';
  if (status.includes('fase creditu') || status.includes('creditu')) return 'Fase CreditÚ';
  if (status.includes('credito') || status.includes('cef') || status.includes('caixa') || status.includes('financ')) return 'Crédito';
  if (status.includes('envio sienge') || status.includes('sienge') || status.includes('envio mega')) return 'Envio SIENGE';
  if (status.includes('secretaria')) return 'Secretaria de Vendas';
  return 'Em processo';
};
const getSlaLimitDays = (row) => {
  const explicit = Number(row?.sla_limite_dias);
  if (Number.isFinite(explicit) && explicit > 0) return explicit;
  return SLA_LIMITS_BY_STAGE[getPipelineStage(row)] ?? null;
};
const getSlaClassification = (row) => {
  const explicit = row?.sla_classificacao
    ?? row?.slaClassificacao
    ?? row?.sla_status
    ?? row?.sla
    ?? row?.['SLA Classificação'];

  if (explicit) return String(explicit);
  if (isFinalSituation(row) && !normalizeText(row?.reserva_situacao_nome).includes('venda finalizada')) return '-';

  const limit = getSlaLimitDays(row);
  if (limit == null) return '-';
  return Number(row?.criado_ha ?? 0) > limit ? 'SLA Expirado' : 'Dentro do SLA';
};
const isSlaExpired = (row) => normalizeText(getSlaClassification(row)).includes('expirado');
const isRepasseNoMesPendente = (row) => (
  isNo(row?.reserva_repasse_no_mes)
);
const repasseNoMesLabel = (row) => (isRepasseNoMesPendente(row) ? 'Não' : (row?.reserva_repasse_no_mes || '-'));
const isRiskValue = (value) => {
  const normalized = normalizeText(value);
  return normalized === 'probabilidade de cair';
};

const getRiskFlag = (row) => (
  row.reserva_repasse_no_mes
);

const getReservationRowClass = (row) => {
  if (isRiskValue(getRiskFlag(row))) return 'is-prob-cair';
  if (isRepasseNoMesPendente(row)) return 'is-repasse-nao';
  return '';
};

const detailFields = [
  ['Imobiliária', (row) => row.imobiliaria, 'Origem: comercial_base.imobiliaria_nome_canonica, com fallback para imobiliaria_nome. Uso: identifica a equipe/imobiliária responsável pela reserva.'],
  ['Cadastro', (row) => fmtDate(row.dt_cadastro_reserva), 'Origem: comercial_base.dt_cadastro_reserva. Uso: data em que a reserva foi cadastrada no sistema. É a data inicial do cálculo de SLA QR.'],
  ['Data última situação', (row) => fmtDate(row.data_ultima_alteracao_situacao), 'Origem: coalesce(dt_referencia_reserva, dt_referencia_reserva_data, dt_cadastro_reserva). Uso: data da última atualização de situação da reserva.'],
  ['Tempo na situação', (row) => fmtDays(row.criado_ha), 'Cálculo: diferença em dias entre hoje e Data última situação. Uso: mede há quantos dias a reserva está parada na situação atual.'],
  ['Limite SLA situação', (row) => fmtDays(getSlaLimitDays(row)), 'Regra: prazo máximo permitido por situação. Em processo = 7 dias; Secretaria, Envio SIENGE, Crédito, Assinatura e Diretoria = 1 dia; Fase CreditÚ = 2 dias; Venda finalizada = 10 dias.'],
  ['Data QR', (row) => fmtDate(row.reserva_data_qr), 'Origem: comercial_base.reserva_campos_adicionais_data_qr. Uso: data QR registrada nos campos adicionais da reserva.'],
  ['SLA QR', (row) => fmtDays(diffDays(row.dt_cadastro_reserva, row.reserva_data_qr)), 'Cálculo Power BI: DATEDIFF(reserva_data_cad, reserva_campos_adicionais_data_qr, DAY). No front: diferença entre as datas de calendário dt_cadastro_reserva e reserva_data_qr. Se as duas datas são o mesmo dia, retorna 0 dias.'],
  ['Kit Caixa', (row) => row.reserva_kit_cef, 'Origem: comercial_base.reserva_campos_adicionais_reserva_kit_cef. Uso: indica status/preenchimento do kit CEF/Caixa na reserva.'],
  ['Kit Agehab', (row) => row.reserva_kit_agehab, 'Origem: comercial_base.reserva_campos_adicionais_reserva_kit_agehab. Uso: indica status/preenchimento do kit Agehab na reserva.'],
  ['Obs. finalização', (row) => row.reserva_obs_finalizacao, 'Origem: comercial_base.reserva_campos_adicionais_reserva_obs_finalizacao. Uso: observação operacional de finalização da reserva.'],
  ['Empreendimento', (row) => row.empreendimento_nome, 'Origem: comercial_base.empreendimento_nome. Uso: empreendimento vinculado à reserva no grão da fato comercial.'],
  ['Região', (row) => row.regiao_empreendimento, 'Origem: comercial_base.regiao_empreendimento. Uso: região do empreendimento usada nos filtros, rankings e metas.'],
  ['Origem', (row) => row.lead_origem_nome, 'Origem: comercial_base.lead_origem_nome. Uso: canal/origem do lead que gerou a reserva.'],
  ['Repasse assinado', (row) => row.repasse_assinado, 'Cálculo: Sim quando dt_assinatura_contrato está preenchida; Não quando não há assinatura. Uso: indica se o repasse já foi assinado.'],
  ['ID Repasse', (row) => row.idrepasse, 'Origem: comercial_base.idrepasse. Uso: identificador do repasse associado à reserva, quando já existe repasse vinculado.'],
  ['Probabilidade assinatura', (row) => row.repasse_probabilidade_de_assinatura, 'Origem: comercial_base.repasse_campos_adicionais_repasse_probabilidade_de_assinatura. Uso: classifica chance operacional de assinatura do repasse, como Sim, Talvez ou Não.'],
  ['Envio CEHOP', (row) => fmtDate(row.repasse_data_envio_cehop), 'Origem: comercial_base.repasse_campos_adicionais_repasse_data_envio_cehop. Uso: data de envio do repasse para CEHOP.'],
  ['Conformidade CEHOP', (row) => fmtDate(row.repasse_data_conformidade_cehop), 'Origem: comercial_base.repasse_campos_adicionais_repasse_data_conformidade_cehop. Uso: data em que CEHOP marcou conformidade.'],
  ['Inconformidade CEHOP', (row) => fmtDate(row.repasse_data_inconformidade_cehop), 'Origem: comercial_base.repasse_campos_adicionais_repasse_data_da_inconformidade_cehop. Uso: data em que CEHOP registrou inconformidade.'],
  ['Reenvio CEHOP', (row) => fmtDate(row.repasse_data_reenvio_cehop), 'Origem: comercial_base.repasse_campos_adicionais_repasse_data_do_reenvio_cehop. Uso: data de reenvio após inconformidade.'],
  ['SLA finalização', (row) => fmtDays(row.sla_finalizacao_dias), 'Origem: comercial_base.sla_finalizacao_dias. Uso: SLA calculado no pipeline para o ciclo de finalização da reserva.'],
  ['SLA repasse', (row) => fmtDays(row.sla_repasse_dias), 'Origem: comercial_base.sla_repasse_dias. Uso: SLA calculado no pipeline para o ciclo de repasse.'],
];

const ReservasBI = () => {
  const { filters, buildFilterParams } = useCommercialFilters();
  const [activeTab, setActiveTab] = useState('geral');
  const [trends, setTrends] = useState([]);
  const [breakdowns, setBreakdowns] = useState({});
  const [tableData, setTableData] = useState({ items: [], pagination: { total: 0, page: 1, limit: 200 } });
  const [metas, setMetas] = useState({ items: [], totalsByRegion: [] });
  const [editingMeta, setEditingMeta] = useState({});
  const [expandedReservationKey, setExpandedReservationKey] = useState(null);
  const [slaFilter, setSlaFilter] = useState('todos');
  const [detailContext, setDetailContext] = useState(null);
  const [dateDrill, setDateDrill] = useState({ level: 'ano', path: [] });
  const [detailSort, setDetailSort] = useState({ key: 'dt_cadastro_reserva', order: 'desc' });
  const [metaSort, setMetaSort] = useState({ key: 'regiao', order: 'asc' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const queryParams = useMemo(() => {
    return buildFilterParams(filters.dataInicial, filters.dataFinal);
  }, [buildFilterParams, filters.dataFinal, filters.dataInicial]);

  const fetchJson = useCallback(async (url, options) => {
    const response = await fetch(url, options);
    if (!response.ok) {
      let message = `Falha HTTP ${response.status}`;
      try {
        const body = await response.json();
        message = body?.detail || body?.error || message;
      } catch {
        // noop
      }
      throw new Error(message);
    }
    return response.json();
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const qs = queryParams.toString();
    const pipelineParams = new URLSearchParams(queryParams);
    pipelineParams.delete('startDate');
    pipelineParams.delete('endDate');
    pipelineParams.delete('comparacao');
    const cadastroTrendParams = new URLSearchParams(queryParams);
    const cadastroRange = getDefaultDateDrillRange('ano');
    cadastroTrendParams.set('startDate', cadastroRange.start);
    cadastroTrendParams.set('endDate', cadastroRange.end);
    cadastroTrendParams.delete('comparacao');
    try {
      const [trendsPayload, breakdownPayload, pipelinePayload, tablePayload, metasPayload] = await Promise.all([
        fetchJson(`/api/v1/dashboard/reservas/trends?${cadastroTrendParams.toString()}`),
        fetchJson(`/api/v1/dashboard/reservas/breakdown?axis=all&${qs}`),
        fetchJson(`/api/v1/dashboard/reservas/breakdown?axis=situacao&${pipelineParams.toString()}`),
        fetchJson(`/api/v1/dashboard/reservas/table?limit=1000&${qs}`),
        fetchJson(`/api/v1/dashboard/reservas/metas?${qs}`),
      ]);
      setTrends(Array.isArray(trendsPayload) ? trendsPayload : []);
      setBreakdowns({
        ...(breakdownPayload?.byAxis ?? {}),
        situacao: Array.isArray(pipelinePayload?.items) ? pipelinePayload.items : [],
      });
      setTableData(tablePayload ?? { items: [], pagination: { total: 0, page: 1, limit: 200 } });
      setMetas(metasPayload ?? { items: [], totalsByRegion: [] });
      setDetailContext(null);
    } catch (err) {
      setError(err?.message || 'Erro inesperado ao carregar reservas.');
    } finally {
      setLoading(false);
    }
  }, [fetchJson, queryParams]);

  useEffect(() => {
    const timer = setTimeout(loadData, 200);
    return () => clearTimeout(timer);
  }, [loadData]);

  const tableItems = useMemo(() => tableData.items ?? [], [tableData.items]);

  const filteredTableItems = useMemo(() => {
    const filtered = slaFilter === 'expirado'
      ? tableItems.filter(isSlaExpired)
      : slaFilter === 'dentro'
        ? tableItems.filter((row) => !isSlaExpired(row))
        : tableItems;

    const column = DETAIL_TABLE_COLUMNS.find((item) => item.key === detailSort.key);
    if (column) {
      return filtered.slice().sort((a, b) => {
        const result = compareValues(column.getter(a), column.getter(b));
        return detailSort.order === 'asc' ? result : -result;
      });
    }

    return filtered.slice().sort((a, b) => {
      const dateA = new Date(a?.dt_cadastro_reserva || 0).getTime();
      const dateB = new Date(b?.dt_cadastro_reserva || 0).getTime();
      return (Number.isNaN(dateB) ? 0 : dateB) - (Number.isNaN(dateA) ? 0 : dateA);
    });
  }, [detailSort.key, detailSort.order, slaFilter, tableItems]);

  const pipelineCards = useMemo(() => {
    const cards = RESERVAS_PIPELINE_STAGES.map((label) => ({
      label,
      total: 0,
      atrasadas: 0,
    }));
    const byLabel = new Map(cards.map((card) => [card.label, card]));
    const situationRows = breakdowns?.situacao ?? [];

    if (situationRows.length > 0) {
      situationRows.forEach((item) => {
        const pseudoRow = { reserva_situacao_nome: item.label };
        const stage = getPipelineStage(pseudoRow);
        const card = byLabel.get(stage) ?? byLabel.get('Em processo');
        card.total += Number(item.reservas_situacoes ?? item.reservas ?? 0);
        card.atrasadas += Number(item.sla_expirado ?? 0);
      });
    } else {
      tableItems.forEach((row) => {
        const stage = getPipelineStage(row);
        const card = byLabel.get(stage) ?? byLabel.get('Em processo');
        card.total += 1;
      });

      tableItems.filter(isSlaExpired).forEach((row) => {
        const stage = getPipelineStage(row);
        const card = byLabel.get(stage) ?? byLabel.get('Em processo');
        card.atrasadas += 1;
      });
    }

    return cards;
  }, [breakdowns, tableItems]);

  const topBreakdown = useCallback((axis) => (
    (breakdowns?.[axis] ?? [])
      .map((item) => ({
        label: item.label || item.nome || item.regiao || item.imobiliaria || item.empreendimento || '-',
        value: Number(item.reservas ?? item.reservas_situacoes ?? item.total ?? 0),
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
  ), [breakdowns]);

  const cadastroDrillData = useMemo(() => {
    const groups = new Map();
    const activeRange = getDateDrillRange(dateDrill.level, dateDrill.path);
    buildDateBuckets(dateDrill.level, activeRange).forEach((bucket) => {
      groups.set(bucket.key, {
        key: bucket.key,
        label: bucket.label,
        start: toDateKey(bucket.start),
        end: toDateKey(bucket.end),
        value: 0,
      });
    });

    trends.forEach((item) => {
      if (!item?.data) return;
      const date = parseDateUtc(item.data);
      if (!date || !inDateRange(date, activeRange)) return;
      const bucket = getDateBucket(date, dateDrill.level);
      const current = groups.get(bucket.key) ?? {
        key: bucket.key,
        label: bucket.label,
        start: toDateKey(maxUtcDate(bucket.start, parseDateUtc(activeRange.start) ?? bucket.start)),
        end: toDateKey(minUtcDate(bucket.end, parseDateUtc(activeRange.end) ?? bucket.end)),
        value: 0,
      };
      current.value += Number(item.reservas ?? 0);
      groups.set(bucket.key, current);
    });

    return Array.from(groups.values()).sort((a, b) => a.start.localeCompare(b.start));
  }, [dateDrill.level, dateDrill.path, trends]);

  const currentDateLevelIndex = DATE_DRILL_LEVELS.findIndex((item) => item.id === dateDrill.level);
  const currentDateLevel = DATE_DRILL_LEVELS[currentDateLevelIndex] ?? DATE_DRILL_LEVELS[0];
  const canDateDrillUp = currentDateLevelIndex > 0;
  const canDateDrillDown = currentDateLevelIndex >= 0 && currentDateLevelIndex < DATE_DRILL_LEVELS.length - 1;

  const changeDateDrillLevel = (level) => {
    setDateDrill({ level, path: [] });
  };

  const drillDateDown = (entry) => {
    if (!entry) return;
    if (!canDateDrillDown) {
      loadReservationDetail({
        metric: 'reservas',
        title: `Reservas cadastradas em ${fmtDate(entry.start)}`,
        subtitle: 'Detalhamento por data de cadastro',
        startDate: entry.start,
        endDate: entry.end,
      });
      return;
    }
    const nextLevel = DATE_DRILL_LEVELS[currentDateLevelIndex + 1]?.id;
    if (!nextLevel) return;
    setDateDrill((current) => ({
      level: nextLevel,
      path: [...current.path, { start: entry.start, end: entry.end, label: entry.label }],
    }));
  };

  const drillDateUp = () => {
    if (!canDateDrillUp) return;
    const previousLevel = DATE_DRILL_LEVELS[currentDateLevelIndex - 1]?.id ?? 'ano';
    setDateDrill((current) => ({
      level: previousLevel,
      path: current.path.slice(0, -1),
    }));
  };

  const rankingPanels = useMemo(() => ([
    { title: 'Ranking por Imobiliária', caption: 'Todos os eixos filtrados', data: topBreakdown('imobiliaria'), axis: 'imobiliaria' },
    { title: 'Ranking por Região', caption: 'Distribuição territorial', data: topBreakdown('regiao'), axis: 'regiao' },
    { title: 'Ranking por Empreendimento', caption: 'Concentração operacional', data: topBreakdown('empreendimento'), axis: 'empreendimento' },
  ]), [topBreakdown]);

  const metaRows = useMemo(() => {
    const items = metas.items ?? [];
    const totals = metas.totalsByRegion ?? [];
    if (!totals.length) return items;

    return totals.flatMap((total) => [
      { ...total, is_total: true },
      ...items.filter((item) => item.regiao === total.regiao),
    ]);
  }, [metas.items, metas.totalsByRegion]);

  const sortedMetaRows = useMemo(() => {
    const column = META_TABLE_COLUMNS.find((item) => item.key === metaSort.key);
    if (!column) return metaRows;
    return metaRows.slice().sort((a, b) => {
      const result = compareValues(column.getter(a), column.getter(b));
      return metaSort.order === 'asc' ? result : -result;
    });
  }, [metaRows, metaSort.key, metaSort.order]);

  const toggleDetailSort = (key) => {
    setDetailSort((current) => (
      current.key === key
        ? { key, order: current.order === 'asc' ? 'desc' : 'asc' }
        : { key, order: key === 'dt_cadastro_reserva' || key === 'idreserva' ? 'desc' : 'asc' }
    ));
  };

  const toggleMetaSort = (key) => {
    setMetaSort((current) => (
      current.key === key
        ? { key, order: current.order === 'asc' ? 'desc' : 'asc' }
        : { key, order: ['regiao', 'imobiliaria'].includes(key) ? 'asc' : 'desc' }
    ));
  };

  const renderSortHeader = (column, activeSort, onSort) => (
    <th key={column.key}>
      <button
        type="button"
        className={`reservas-sort-header ${activeSort.key === column.key ? 'is-active' : ''}`}
        title={column.help || column.label}
        onClick={() => onSort(column.key)}
        aria-sort={activeSort.key === column.key ? (activeSort.order === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <span>{column.label}</span>
        <ArrowUpDown size={12} />
      </button>
    </th>
  );

  const loadReservationDetail = useCallback(async ({ axis = '', value = '', metric = 'reservas', title = '', subtitle = '', startDate = '', endDate = '' }) => {
    setLoading(true);
    setError(null);
    setExpandedReservationKey(null);
    const params = new URLSearchParams(queryParams);
    if (axis === 'pipeline' && (metric === 'reservas_situacoes' || metric === 'sla_expirado')) {
      params.delete('startDate');
      params.delete('endDate');
      params.delete('comparacao');
    }
    if (startDate && endDate) {
      params.set('startDate', startDate);
      params.set('endDate', endDate);
    }
    params.set('limit', '1000');
    params.set('detailMetric', metric);
    if (axis) params.set('detailAxis', axis);
    if (value) params.set('detailValue', value);
    try {
      const payload = await fetchJson(`/api/v1/dashboard/reservas/table?${params.toString()}`);
      setTableData(payload ?? { items: [], pagination: { total: 0, page: 1, limit: 200 } });
      setDetailContext({ axis, value, metric, title, subtitle });
      setSlaFilter(metric === 'sla_expirado' ? 'expirado' : 'todos');
      setActiveTab('detalhada');
    } catch (err) {
      setError(err?.message || 'Erro ao carregar detalhamento de reservas.');
    } finally {
      setLoading(false);
    }
  }, [fetchJson, queryParams]);

  const clearReservationDetail = useCallback(async () => {
    setDetailContext(null);
    setSlaFilter('todos');
    setExpandedReservationKey(null);
    const params = new URLSearchParams(queryParams);
    params.set('limit', '1000');
    try {
      const payload = await fetchJson(`/api/v1/dashboard/reservas/table?${params.toString()}`);
      setTableData(payload ?? { items: [], pagination: { total: 0, page: 1, limit: 200 } });
    } catch (err) {
      setError(err?.message || 'Erro ao limpar detalhamento de reservas.');
    }
  }, [fetchJson, queryParams]);

  const openExpiredReservations = (stage = '') => {
    loadReservationDetail({
      axis: stage ? 'pipeline' : '',
      value: stage,
      metric: 'sla_expirado',
      title: stage ? `SLA expirado em ${stage}` : 'Reservas com SLA expirado',
      subtitle: 'Detalhamento operacional por reserva',
    });
  };

  const openRankingDetail = ({ axis, value, title }) => {
    loadReservationDetail({
      axis,
      value,
      metric: 'reservas',
      title: `${title}: ${value}`,
      subtitle: 'Reservas que compõem o gráfico selecionado',
    });
  };

  const openPipelineDetail = (stage) => {
    loadReservationDetail({
      axis: 'pipeline',
      value: stage,
      metric: 'reservas_situacoes',
      title: `Pipeline: ${stage}`,
      subtitle: 'Reservas operacionais neste estágio',
    });
  };

  const rankingAxisWidth = (data) => {
    const maxLength = Math.max(...data.map((item) => String(item.label || '').length), 0);
    return Math.max(150, Math.min(240, maxLength * 4.8));
  };

  const renderHorizontalBars = ({ title, caption, data, axis }) => (
    <article key={title} className={`reservas-panel reservas-ranking-panel reservas-ranking-panel-${axis || 'default'}`}>
      <div className="reservas-panel-heading">
        <h3>{title}</h3>
        <span>{caption}</span>
      </div>
      <div
        className="reservas-ranking-chart"
        style={{ '--reservas-ranking-height': `${Math.max(15, data.length * 1.95 + 3)}rem` }}
      >
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" barCategoryGap={8} margin={{ top: 8, right: 48, bottom: 8, left: 6 }}>
              <XAxis type="number" hide allowDecimals={false} />
              <YAxis
                dataKey="label"
                type="category"
                width={rankingAxisWidth(data)}
                interval={0}
                tick={{ fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip formatter={(value) => fmtNumber(value)} />
              <Bar
                dataKey="value"
                name="Reservas"
                fill="var(--primary)"
                radius={[0, 4, 4, 0]}
                className={axis ? 'reservas-clickable-bar' : ''}
                onClick={(entry) => {
                  if (axis && entry?.label) {
                    openRankingDetail({ axis, value: entry.label, title });
                  }
                }}
              >
                <LabelList dataKey="value" position="right" formatter={(value) => fmtNumber(value)} className="reservas-bar-label" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="reservas-empty-state">Sem dados no período</div>
        )}
      </div>
    </article>
  );

  const renderCadastroVolume = () => (
    <article className="reservas-panel reservas-cadastro-panel">
      <div className="reservas-panel-heading">
        <div>
          <h3>Volume por Cadastro</h3>
          <span>{currentDateLevel.label}{dateDrill.path.length ? ` · ${dateDrill.path.map((item) => item.label).join(' / ')}` : ''}</span>
        </div>
        <div className="reservas-date-drill-controls" aria-label="Drill-down de datas">
          <button type="button" onClick={drillDateUp} disabled={!canDateDrillUp}>Subir</button>
          {DATE_DRILL_LEVELS.map((level) => (
            <button
              key={level.id}
              type="button"
              className={dateDrill.level === level.id ? 'is-active' : ''}
              onClick={() => changeDateDrillLevel(level.id)}
            >
              {level.label}
            </button>
          ))}
          <button type="button" onClick={() => setDateDrill({ level: 'ano', path: [] })}>Limpar</button>
        </div>
      </div>
      <div className="reservas-cadastro-chart">
        {cadastroDrillData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={cadastroDrillData} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} width={32} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value) => fmtNumber(value)}
                labelFormatter={(_, payload) => {
                  const item = payload?.[0]?.payload;
                  return item ? `${item.label} (${fmtDate(item.start)} até ${fmtDate(item.end)})` : '';
                }}
              />
              <Bar
                dataKey="value"
                name="Reservas"
                fill="var(--primary)"
                radius={[4, 4, 0, 0]}
                className="reservas-clickable-bar"
                onClick={drillDateDown}
              >
                <LabelList dataKey="value" position="top" formatter={(value) => fmtNumber(value)} className="reservas-bar-label" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="reservas-empty-state">Sem dados no período</div>
        )}
      </div>
    </article>
  );

  const saveMeta = async (row) => {
    const key = `${row.regiao}|||${row.imobiliaria}`;
    const meta = editingMeta[key] ?? row.meta_ajustada ?? 0;
    await fetchJson('/api/v1/dashboard/reservas/metas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regiao: row.regiao, imobiliaria: row.imobiliaria, meta }),
    });
    await loadData();
  };

  const toggleReservation = (row) => {
    const key = `${row.idreserva}-${row.idrepasse ?? 'sem-repasse'}`;
    setExpandedReservationKey((current) => (current === key ? null : key));
  };

  return (
    <div className="reservas-bi">
      <header className="reservas-header">
        <div className="reservas-header-title">
          <Link to="/" className="reservas-back" aria-label="Painel inicial">
            <LayoutDashboard size={15} />
            Painel inicial
          </Link>
          <div>
            <h2 className="headline-sm">BI de Reservas</h2>
            <p className="body-sm text-variant">Reservas, repasses, situação operacional e metas por imobiliária/região.</p>
          </div>
        </div>
        <button type="button" className="btn-secondary reservas-refresh" onClick={loadData} disabled={loading}>
          <RefreshCcw size={14} />
          Atualizar
        </button>
      </header>

      <DashboardFilters showReservationFilters />

      {error && (
        <div className="reservas-alert reservas-alert-error">
          <TriangleAlert size={15} />
          {error}
        </div>
      )}

      <nav className="reservas-tabs" aria-label="Abas do BI de Reservas">
        {RESERVAS_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`reservas-tab ${activeTab === tab.id ? 'is-active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === 'geral' && (
        <>
      <section className="reservas-pipeline" aria-label="Pipeline de reservas">
        {pipelineCards.map((card) => (
          <article key={card.label} className={`reservas-stage-card ${card.atrasadas > 0 ? 'has-alert' : ''}`}>
            <div>
              <span className="label-md">{card.label}</span>
              <button
                type="button"
                className="reservas-stage-total"
                onClick={() => openPipelineDetail(card.label)}
                disabled={card.total === 0}
                title={`Detalhar reservas em ${card.label}`}
              >
                {fmtNumber(card.total)}
              </button>
            </div>
            <button
              type="button"
              className="reservas-stage-alert"
              onClick={() => openExpiredReservations(card.label)}
              disabled={card.atrasadas === 0}
              title={`Filtrar reservas com SLA Expirado em ${card.label}`}
            >
              <TriangleAlert size={14} />
              <span>{fmtNumber(card.atrasadas)} em atraso</span>
            </button>
          </article>
        ))}
      </section>

      <section className="reservas-ranking-grid">
        {rankingPanels.map(renderHorizontalBars)}
      </section>
      {renderCadastroVolume()}
        </>
      )}

      {activeTab === 'metas' && (
      <section className="reservas-panel">
        <div className="reservas-panel-heading">
          <h3>Meta por imobiliária e região</h3>
          <span><Target size={13} /> Prev. repasse x meta</span>
        </div>
        <div className="reservas-table-wrap">
          <table className="reservas-table reservas-goals-table">
            <thead>
              <tr>
                {META_TABLE_COLUMNS.map((column) => renderSortHeader(column, metaSort, toggleMetaSort))}
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {sortedMetaRows.map((row) => {
                const key = `${row.regiao}|||${row.imobiliaria}`;
                return (
                  <tr key={`${key}-${row.is_total ? 'total' : 'item'}`} className={row.is_total ? 'reservas-goal-total-row' : ''}>
                    <td>{row.regiao}</td>
                    <td>{row.is_total ? '' : row.imobiliaria}</td>
                    <td>{fmtNumber(row.reservas_situacoes)}</td>
                    <td>{fmtNumber(row.mes_seguinte)}</td>
                    <td>{fmtNumber(row.prob_cair)}</td>
                    <td>{fmtNumber(row.mes_atual)}</td>
                    <td>{fmtNumber(row.mp_reserva)}</td>
                    <td>{fmtNumber(row.repasses_assinados)}</td>
                    <td>{fmtNumber(row.prev_repasse)}</td>
                    <td>
                      {row.is_total ? fmtNumber(row.meta_ajustada) : (
                        <input
                          className="reservas-meta-input"
                          type="number"
                          min="0"
                          value={editingMeta[key] ?? row.meta_ajustada ?? 0}
                          onChange={(event) => setEditingMeta((current) => ({ ...current, [key]: event.target.value }))}
                        />
                      )}
                    </td>
                    <td className={Number(row.alcancado_meta ?? 0) >= 100 ? 'reservas-good' : 'reservas-attention'}>
                      {fmtPercent(row.alcancado_meta)}
                    </td>
                    <td>
                      {!row.is_total && (
                        <button type="button" className="reservas-icon-button" title="Salvar meta" onClick={() => saveMeta(row)}>
                          <Save size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      )}

      {activeTab === 'detalhada' && (
      <section className="reservas-panel">
        <div className="reservas-panel-heading">
          <div>
            <h3>{detailContext?.title || 'Detalhada por reserva'}</h3>
            {detailContext?.subtitle && <p className="reservas-detail-context">{detailContext.subtitle}</p>}
          </div>
          <span>{fmtNumber(filteredTableItems.length)} de {fmtNumber(tableData.pagination?.total)} reservas</span>
        </div>
        <div className="reservas-sla-toolbar" aria-label="Filtro de SLA">
          {[
            ['todos', 'Todos'],
            ['expirado', 'SLA Expirado'],
            ['dentro', 'Dentro do SLA'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={slaFilter === value ? 'is-active' : ''}
              onClick={() => setSlaFilter(value)}
            >
              {label}
            </button>
          ))}
          {detailContext && (
            <button type="button" onClick={clearReservationDetail}>
              Limpar drill-down
            </button>
          )}
        </div>
        <div className="reservas-table-wrap">
          <table className="reservas-table reservas-detail-table">
            <thead>
              <tr>
                {DETAIL_TABLE_COLUMNS.map((column) => renderSortHeader(column, detailSort, toggleDetailSort))}
              </tr>
            </thead>
            <tbody>
              {filteredTableItems.map((row) => {
                const key = `${row.idreserva}-${row.idrepasse ?? 'sem-repasse'}`;
                const isExpanded = expandedReservationKey === key;
                const risk = isRiskValue(getRiskFlag(row));
                const slaExpired = isSlaExpired(row);
                const slaStatus = getSlaClassification(row);
                return (
                  <Fragment key={key}>
                    <tr
                      className={`reservas-detail-row ${getReservationRowClass(row)} ${slaExpired ? 'is-sla-expired' : ''} ${isExpanded ? 'is-expanded' : ''}`}
                      onClick={() => toggleReservation(row)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          toggleReservation(row);
                        }
                      }}
                      tabIndex={0}
                      aria-expanded={isExpanded}
                    >
                      <td>
                        <button
                          type="button"
                          className="reservas-expand-button"
                          aria-label={isExpanded ? 'Recolher detalhamento' : 'Expandir detalhamento'}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleReservation(row);
                          }}
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        <strong>{row.idreserva}</strong>
                      </td>
                      <td>{fmtDate(row.dt_cadastro_reserva)}</td>
                      <td>{row.corretor || '-'}</td>
                      <td>{row.empreendimento_nome || '-'}</td>
                      <td>{row.imobiliaria || '-'}</td>
                      <td>{row.regiao_empreendimento || '-'}</td>
                      <td>{row.reserva_situacao_nome || '-'}</td>
                      <td>
                        <span className={`reservas-sla-chip ${slaExpired ? 'is-expired' : 'is-ok'}`}>
                          {slaStatus}
                        </span>
                      </td>
                      <td><span className={`reservas-flag ${isRepasseNoMesPendente(row) ? 'is-warning' : 'is-neutral'}`}>{repasseNoMesLabel(row)}</span></td>
                      <td><span className={`reservas-flag ${risk ? 'is-danger' : 'is-neutral'}`}>{risk ? 'Sim' : 'Não'}</span></td>
                    </tr>
                    {isExpanded && (
                      <tr className={`reservas-audit-row ${getReservationRowClass(row)} ${slaExpired ? 'is-sla-expired' : ''}`}>
                        <td colSpan={10}>
                          <div className="reservas-row-audit">
                            {detailFields.map(([label, getter, help]) => (
                              <div key={label} title={help}>
                                <span>{label}</span>
                                <strong>{getter(row) || '-'}</strong>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      )}

    </div>
  );
};

export default ReservasBI;
