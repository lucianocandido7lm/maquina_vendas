import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, Download, FilterX, LayoutDashboard, LoaderCircle, Target, TriangleAlert } from 'lucide-react';
import DashboardFilters from '../components/DashboardFilters';
import { useCommercialFilters } from '../hooks/useCommercialFilters';
import './FunnelDashboard.css';

const numberFormatter = new Intl.NumberFormat('pt-BR');
const percentFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

const formatNumber = (value) => numberFormatter.format(Number(value) || 0);
const formatPercent = (value) => (value == null ? '-' : `${percentFormatter.format(Number(value) || 0)}%`);
const formatSignedNumber = (value) => {
  if (value == null) return '-';
  const numeric = Number(value) || 0;
  return `${numeric > 0 ? '+' : ''}${formatNumber(numeric)}`;
};
const formatNeed = (row, businessDays) => {
  if (row?.dailyNeedLabel || Number(businessDays?.remaining ?? 0) <= 0) return 'Mês finalizado';
  return row?.dailyNeed == null ? '-' : formatSignedNumber(row.dailyNeed);
};
const formatDate = (value) => {
  if (!value) return '-';
  const [date] = String(value).split('T');
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
};
const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return formatDate(value);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

const DETAIL_COLUMNS = [
  { key: 'data_evento', label: 'Data' },
  { key: 'idlead', label: 'Lead' },
  { key: 'idprecadastro', label: 'Pré' },
  { key: 'idreserva', label: 'Reserva' },
  { key: 'idrepasse', label: 'Repasse' },
  { key: 'situacao', label: 'Situação' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'empreendimento', label: 'Empreendimento' },
  { key: 'corretor', label: 'Corretor' },
  { key: 'sdr', label: 'SDR' },
  { key: 'sla_classificacao', label: 'SLA' },
  { key: 'restricao_classificacao', label: 'Restrição' },
];

const HISTORY_GROUPS = [
  { key: 'lead', title: 'Histórico Lead' },
  { key: 'proposta', title: 'Histórico Proposta' },
  { key: 'reserva', title: 'Contexto Reserva' },
];

const FUNNEL_STAGE_RULES = [
  {
    stage: 'LEAD',
    source: 'comercial_base',
    dateField: 'dt_ultima_conversao_lead',
    countField: 'distinct idlead',
    rule: 'conta leads que voltaram ao sistema dentro do período selecionado.',
  },
  {
    stage: 'ATENDIMENTO',
    source: 'comercial_leads_historico',
    dateField: 'dt_referencia',
    countField: 'eventos',
    rule: 'conta eventos em Atendimento - IA ou Atendimento - SDR.',
  },
  {
    stage: 'AGENDAMENTO',
    source: 'comercial_leads_historico',
    dateField: 'dt_referencia',
    countField: 'distinct idlead',
    rule: 'conta cada lead uma vez, usando a última entrada no período nos grupos AGENDAMENTO, AGENDAMENTO_IA ou AGENDADO_IA.',
  },
  {
    stage: 'VISITA',
    source: 'comercial_base',
    dateField: 'dt_visita_realizada',
    countField: 'distinct idlead',
    rule: 'conta visitas efetivamente realizadas dentro do período.',
  },
  {
    stage: 'PROPOSTA',
    source: 'comercial_leads_historico',
    dateField: 'dt_referencia',
    countField: 'eventos',
    rule: 'conta eventos em Proposta no workflow.',
  },
  {
    stage: 'PROP. APROVADA / CONDICIONADA',
    source: 'comercial_kpi_daily',
    dateField: 'data',
    countField: 'sum(propostas_aprovadas + propostas_condicionadas)',
    rule: 'usa o mesmo indicador geral Prop. Aprovada / Condicionada, somando apenas aprovadas e condicionadas.',
  },
  {
    stage: 'RESERVA',
    source: 'comercial_base',
    dateField: 'dt_cadastro_reserva',
    countField: 'uma reserva por cliente no mês',
    rule: 'conta a reserva mais recente do cliente no período pela dt_cadastro_reserva; chave do cliente usa idcliente, documento normalizado ou idreserva como fallback.',
  },
  {
    stage: 'VENDAS FINALIZADAS',
    source: 'comercial_base',
    dateField: 'dt_cadastro_repasse',
    countField: 'distinct idrepasse',
    rule: 'conta tudo que entrou em repasse pela data de cadastro do repasse; não usa dt_referencia_repasse.',
  },
  {
    stage: 'REPASSE',
    source: 'comercial_base',
    dateField: 'dt_assinatura_contrato',
    countField: 'distinct idrepasse',
    rule: 'conta contratos assinados no período com fl_repasse_assinado = true.',
  },
  {
    stage: 'CANCELADO',
    source: 'comercial_kpi_daily',
    dateField: 'data',
    countField: 'sum(cancelamentos)',
    rule: 'indicador lateral do painel; não participa da conversão entre etapas do funil.',
  },
  {
    stage: 'DISTRATO',
    source: 'comercial_kpi_daily',
    dateField: 'data',
    countField: 'sum(distratos)',
    rule: 'indicador lateral do painel; não participa da conversão entre etapas do funil.',
  },
];

const FunnelDashboard = () => {
  const { filters, buildFilterParams, filterQueryString, filterOptionsLoading } = useCommercialFilters();
  const [activeTab, setActiveTab] = useState('funnel');
  const [selectedStage, setSelectedStage] = useState(null);
  const [funnelData, setFunnelData] = useState(null);
  const [detailData, setDetailData] = useState({ rows: [], total: 0, page: 1 });
  const [selectedDetailRow, setSelectedDetailRow] = useState(null);
  const [historyData, setHistoryData] = useState({ lead: [], proposta: [], reserva: [], total: 0 });
  const [goalsData, setGoalsData] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [metaRepasse, setMetaRepasse] = useState(45);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState({ key: 'data_evento', dir: 'desc' });
  const [detailReloadToken, setDetailReloadToken] = useState(0);
  const [selectedDetailScope, setSelectedDetailScope] = useState({
    source: 'funnel',
    label: 'Período filtrado',
    startDate: null,
    endDate: null,
    visualTotal: null,
  });
  const detailControllerRef = useRef(null);
  const historyControllerRef = useRef(null);
  const auditControllerRef = useRef(null);

  const queryParams = useMemo(
    () => buildFilterParams(filters.dataInicial, filters.dataFinal),
    [buildFilterParams, filters.dataFinal, filters.dataInicial, filterQueryString],
  );

  const stages = useMemo(() => funnelData?.stages ?? [], [funnelData]);
  const externalMetrics = useMemo(() => funnelData?.externalMetrics ?? [], [funnelData]);
  const maxValue = useMemo(() => Math.max(...stages.map((stage) => Number(stage.value) || 0), 1), [stages]);
  const leadValue = Number(stages[0]?.value) || 0;
  const goalRows = useMemo(() => goalsData?.rows ?? [], [goalsData]);
  const quarterRows = useMemo(() => goalsData?.quarterRows ?? [], [goalsData]);
  const goalRowsByKey = useMemo(
    () => new Map(goalRows.map((row) => [row.key, row])),
    [goalRows],
  );
  const quarterRowsByKey = useMemo(
    () => new Map(quarterRows.map((row) => [row.key, row])),
    [quarterRows],
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadFunnel = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/v1/dashboard/funnel?${queryParams.toString()}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.details || payload?.error || 'Falha ao buscar funil');
        if (!active) return;
        setFunnelData(payload);
        setSelectedStage((current) => current ?? payload?.stages?.[0]?.key ?? null);
      } catch (err) {
        if (err?.name === 'AbortError' || !active) return;
        setError(err?.message || 'Erro ao carregar funil.');
        setFunnelData(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadFunnel();
    return () => {
      active = false;
      controller.abort();
    };
  }, [queryParams, filterQueryString]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadGoals = async () => {
      const params = new URLSearchParams(queryParams);
      params.set('metaRepasse', String(metaRepasse));
      setGoalsLoading(true);
      try {
        const response = await fetch(`/api/v1/dashboard/funnel/goals?${params.toString()}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.details || payload?.error || 'Falha ao buscar metas');
        if (active) setGoalsData(payload);
      } catch {
        if (active) setGoalsData(null);
      } finally {
        if (active) setGoalsLoading(false);
      }
    };

    loadGoals();
    return () => {
      active = false;
      controller.abort();
    };
  }, [metaRepasse, queryParams, filterQueryString]);

  const loadDetail = useCallback(async (stageKey, page = 1, nextSort = sort) => {
    if (!stageKey) return;
    detailControllerRef.current?.abort();
    const controller = new AbortController();
    detailControllerRef.current = controller;
    setDetailLoading(true);
    const params = buildFilterParams(
      selectedDetailScope.startDate ?? filters.dataInicial,
      selectedDetailScope.endDate ?? filters.dataFinal,
    );
    params.set('stage', stageKey);
    params.set('page', String(page));
    params.set('limit', '50');
    params.set('sortBy', nextSort.key);
    params.set('sortDir', nextSort.dir);

    try {
      const response = await fetch(`/api/v1/dashboard/funnel/detail?${params.toString()}`, { signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.details || payload?.error || 'Falha ao buscar detalhe');
      setDetailData({ ...payload, page });
      setSelectedDetailRow(payload?.rows?.[0] ?? null);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setDetailData({ rows: [], total: 0, page, warning: err?.message || 'Erro ao carregar detalhe.' });
      setSelectedDetailRow(null);
    } finally {
      if (detailControllerRef.current === controller) {
        detailControllerRef.current = null;
        setDetailLoading(false);
      }
    }
  }, [buildFilterParams, filters.dataFinal, filters.dataInicial, selectedDetailScope, sort]);

  const loadHistory = useCallback(async (row) => {
    if (!row) {
      setHistoryData({ lead: [], proposta: [], reserva: [], total: 0 });
      return;
    }

    historyControllerRef.current?.abort();
    const controller = new AbortController();
    historyControllerRef.current = controller;
    setHistoryLoading(true);
    const params = new URLSearchParams(queryParams);
    ['idlead', 'idprecadastro', 'idreserva', 'idrepasse'].forEach((key) => {
      if (row[key]) params.set(key, String(row[key]));
    });

    try {
      const response = await fetch(`/api/v1/dashboard/funnel/history?${params.toString()}`, { signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.details || payload?.error || 'Falha ao buscar histórico');
      setHistoryData(payload);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setHistoryData({ lead: [], proposta: [], reserva: [], total: 0, warning: err?.message || 'Erro ao carregar histórico.' });
    } finally {
      if (historyControllerRef.current === controller) {
        historyControllerRef.current = null;
        setHistoryLoading(false);
      }
    }
  }, [queryParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadDetail(selectedStage, 1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedStage, selectedDetailScope, detailReloadToken, loadDetail]);

  useEffect(() => {
    setSelectedDetailScope({
      source: 'funnel',
      label: 'Período filtrado',
      startDate: null,
      endDate: null,
      visualTotal: null,
    });
  }, [filterQueryString]);

  useEffect(() => {
    loadHistory(selectedDetailRow);
  }, [selectedDetailRow, loadHistory]);

  const selectedStageData = stages.find((stage) => stage.key === selectedStage) ?? stages[0] ?? null;
  const detailVisualTotal = Number(detailData.visualTotal ?? selectedDetailScope.visualTotal ?? selectedStageData?.value ?? detailData.total) || 0;
  const detailTotal = Number(detailData.total) || 0;
  const detailMatchesFunnel = detailVisualTotal === detailTotal;
  const detailStartDate = selectedDetailScope.startDate ?? filters.dataInicial;
  const detailEndDate = selectedDetailScope.endDate ?? filters.dataFinal;
  const hasActiveDetailDrillDown = selectedDetailScope.source !== 'funnel'
    || selectedDetailScope.startDate != null
    || selectedDetailScope.endDate != null;

  const handleSelectStage = (stage, scope = {}) => {
    const visualTotal = Number(scope.visualTotal ?? stage.value ?? stage.actual ?? stage.quarterActual ?? 0) || 0;
    const nextScope = {
      source: scope.source ?? 'funnel',
      label: scope.label ?? 'Período filtrado',
      startDate: scope.startDate ?? null,
      endDate: scope.endDate ?? null,
      visualTotal,
    };
    setDetailLoading(true);
    setSelectedDetailScope(nextScope);
    setDetailData({
      rows: [],
      total: 0,
      visualTotal,
      page: 1,
      stage: stage.label,
    });
    setSelectedDetailRow(null);
    setHistoryData({ lead: [], proposta: [], reserva: [], total: 0 });
    setSelectedStage(stage.key);
    setActiveTab('detail');
    setDetailReloadToken((current) => current + 1);
  };

  const handleClearDetailDrillDown = () => {
    if (!hasActiveDetailDrillDown) return;
    const visualTotal = Number(selectedStageData?.value ?? 0) || 0;
    setDetailLoading(true);
    setSelectedDetailScope({
      source: 'funnel',
      label: 'Período filtrado',
      startDate: null,
      endDate: null,
      visualTotal,
    });
    setDetailData({
      rows: [],
      total: 0,
      visualTotal,
      page: 1,
      stage: selectedStageData?.label ?? detailData.stage,
    });
    setSelectedDetailRow(null);
    setHistoryData({ lead: [], proposta: [], reserva: [], total: 0 });
    setDetailReloadToken((current) => current + 1);
  };

  const handleAudit = async () => {
    auditControllerRef.current?.abort();
    const controller = new AbortController();
    auditControllerRef.current = controller;
    setAuditData(null);
    try {
      const response = await fetch(`/api/v1/dashboard/funnel/audit?${queryParams.toString()}`, { signal: controller.signal });
      const payload = await response.json();
      setAuditData(response.ok ? payload : { ok: false, checks: [], error: payload?.details || payload?.error });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      setAuditData({ ok: false, checks: [], error: err?.message || 'Erro ao auditar funil' });
    } finally {
      if (auditControllerRef.current === controller) {
        auditControllerRef.current = null;
      }
    }
  };

  useEffect(() => () => {
    detailControllerRef.current?.abort();
    historyControllerRef.current?.abort();
    auditControllerRef.current?.abort();
  }, []);

  const handleSort = (key) => {
    const nextSort = {
      key,
      dir: sort.key === key && sort.dir === 'desc' ? 'asc' : 'desc',
    };
    setSort(nextSort);
    loadDetail(selectedStage, 1, nextSort);
  };

  return (
    <div className="funnel-dashboard">
      <header className="funnel-header">
        <div>
          <h2 className="headline-sm">Funil Comercial</h2>
          <p className="body-sm text-variant">{formatDate(filters.dataInicial)} a {formatDate(filters.dataFinal)}</p>
        </div>
        <Link to="/" className="dashboard-corretor-link label-md">
          <LayoutDashboard size={15} />
          Painel inicial
        </Link>
      </header>

      <DashboardFilters hiddenKeys={['cidade']} />

      {(filterOptionsLoading || loading) && (
        <div className="funnel-loading-banner" role="status" aria-live="polite">
          <LoaderCircle size={16} />
          {filterOptionsLoading ? 'Carregando filtros disponíveis...' : 'Carregando dados do funil de acordo com os filtros selecionados...'}
        </div>
      )}

      <nav className="funnel-tabs" aria-label="Abas do funil">
        <button type="button" className={activeTab === 'funnel' ? 'active' : ''} onClick={() => setActiveTab('funnel')}>Funil Comercial</button>
        <button type="button" className={activeTab === 'detail' ? 'active' : ''} onClick={() => setActiveTab('detail')}>Detalhamento Operacional</button>
        <button type="button" className={activeTab === 'goals' ? 'active' : ''} onClick={() => setActiveTab('goals')}>Consolidado De Metas</button>
      </nav>

      {error && (
        <div className="funnel-alert error">
          <TriangleAlert size={16} />
          {error}
        </div>
      )}

      {(funnelData?.warnings ?? []).length > 0 && (
        <div className="funnel-alert warning">
          <TriangleAlert size={16} />
          Fonte de workflow pendente para {funnelData.warnings.map((item) => item.stage).join(', ')}.
        </div>
      )}

      {activeTab === 'funnel' && (
        <section className="funnel-board" aria-busy={loading}>
          <div className="funnel-board-head">
            <div>
              <span className="funnel-filter-label">Data</span>
              <strong>{formatDate(filters.dataInicial)} - {formatDate(filters.dataFinal)}</strong>
            </div>
            <div className="funnel-lead-total">
              <strong>{formatNumber(leadValue)}</strong>
              <span>Leads Cadastrados</span>
            </div>
          </div>

          <div className="funnel-board-title">
            <h3>Funil de Movimentação Comercial - Leads, Propostas, Reserva e Repasse</h3>
            <p>Este funil mostra quantas oportunidades avançaram no período selecionado</p>
          </div>

          {externalMetrics.length > 0 && (
            <div className="funnel-side-metrics" aria-label="Indicadores fora da conversão do funil">
              {externalMetrics.map((metric) => (
                <article key={metric.key} className="funnel-side-metric">
                  <span>{metric.label}</span>
                  <strong>{formatNumber(metric.value)}</strong>
                  <small>Fora da conversão</small>
                </article>
              ))}
            </div>
          )}

          <section className="funnel-rules-panel" aria-label="Como cada etapa do funil é calculada">
            <div>
              <h4>Como cada etapa é calculada</h4>
              <p>Os valores seguem a mesma regra em todas as abas do dashboard.</p>
            </div>
            <div className="funnel-rules-list">
              {FUNNEL_STAGE_RULES.map((item) => (
                <article key={item.stage} className="funnel-rule-card">
                  <strong>{item.stage}</strong>
                  <dl>
                    <div>
                      <dt>Tabela</dt>
                      <dd>{item.source}</dd>
                    </div>
                    <div>
                      <dt>Data</dt>
                      <dd>{item.dateField}</dd>
                    </div>
                    <div>
                      <dt>Conta</dt>
                      <dd>{item.countField}</dd>
                    </div>
                    <div>
                      <dt>Regra</dt>
                      <dd>{item.rule}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>

          <div className="funnel-shape">
            <div className="funnel-shape-header" aria-hidden="true">
              <span />
              <strong>Média de conversão do último tri.</strong>
              <strong>% Conversão</strong>
              <strong>SLA</strong>
              <strong>Funil para {formatNumber(metaRepasse)} repasses</strong>
            </div>
            {stages.map((stage, index) => {
              const value = Number(stage.value) || 0;
              const rawPercent = (value / maxValue) * 100;
              const visualPercent = value > 0 ? Math.sqrt(value / maxValue) * 100 : 0;
              const width = value > 0 ? Math.max(9, visualPercent) : 3;
              const barTone = Math.max(0.1, Math.min(1, rawPercent / 100));
              const goalRow = goalRowsByKey.get(stage.key);
              const quarterRow = quarterRowsByKey.get(stage.key);
              const previousPercent = stage.conversionFromPrevious;
              const quarterPercent = quarterRow?.conversionFromPrevious;
              const slaAverage = goalRow?.slaAverage ?? quarterRow?.slaAverage;
              const densityClass = value <= 0 ? 'empty' : visualPercent < 18 ? 'tiny' : visualPercent < 34 ? 'compact' : '';
              return (
                <button
                  type="button"
                  key={stage.key}
                  className={`funnel-shape-row ${densityClass} ${selectedStage === stage.key ? 'selected' : ''} ${stage.sourceAvailable ? '' : 'unavailable'}`}
                  onClick={() => handleSelectStage(stage)}
                  style={{ '--stage-width': `${width}%`, '--stage-tone': barTone }}
                >
                  <span className="funnel-shape-label">
                    <strong>{stage.label}</strong>
                    <small>{formatNumber(value)}</small>
                  </span>
                  <span className="funnel-shape-bar" aria-hidden="true" />
                  <span className="funnel-shape-callout">
                    <span>{formatNumber(value)}</span>
                    <strong>{stage.label}</strong>
                  </span>
                  <span className="funnel-shape-meta">
                    <strong>{index > 0 ? formatPercent(quarterPercent) : '-'}</strong>
                    <strong className={Number(previousPercent) < Number(quarterPercent) ? 'is-risk' : ''}>
                      {index > 0 ? formatPercent(previousPercent) : '-'}
                    </strong>
                    <strong>{slaAverage == null ? '-' : formatNumber(slaAverage)}</strong>
                    <strong>{goalRow?.dynamicGoal == null ? '-' : formatNumber(goalRow.dynamicGoal)}</strong>
                  </span>
                </button>
              );
            })}
            <div className="funnel-shape-footer">
              <span />
              <span />
              <span />
              <strong>SLA Total</strong>
              <strong>{formatNumber(goalsData?.businessDays?.total)}</strong>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'detail' && (
        <section className="funnel-detail">
          <div className="funnel-detail-header">
            <div>
              <h3>{selectedStageData?.label ?? 'Detalhamento'}</h3>
              <p>
                Funil: {formatNumber(detailVisualTotal)} | Detalhe: {formatNumber(detailTotal)}
                <span className={detailMatchesFunnel ? 'funnel-inline-status ok' : 'funnel-inline-status risk'}>
                  {detailMatchesFunnel ? 'Conciliado' : 'Divergente'}
                </span>
              </p>
              <small className="funnel-detail-period">
                {selectedDetailScope.label}: {formatDate(detailStartDate)} - {formatDate(detailEndDate)}
              </small>
            </div>
            <div className="funnel-detail-actions">
              <button
                type="button"
                className="funnel-secondary-button"
                onClick={handleClearDetailDrillDown}
                disabled={!hasActiveDetailDrillDown || detailLoading}
                title="Limpar drill-down e voltar ao período filtrado"
              >
                <FilterX size={15} />
                Limpar drill-down
              </button>
              {detailLoading && (
                <span className="funnel-detail-loading" role="status">
                  <LoaderCircle size={15} />
                  Carregando etapa...
                </span>
              )}
            </div>
          </div>

          {detailData.warning && (
            <div className="funnel-alert warning">
              <TriangleAlert size={16} />
              {detailData.warning}
            </div>
          )}

          <div className="funnel-detail-layout">
            <div className="funnel-table-wrap" aria-busy={detailLoading}>
              {detailLoading && (
                <div className="funnel-table-loading" role="status">
                  <LoaderCircle size={16} />
                  Buscando registros da etapa selecionada...
                </div>
              )}
              <table className="funnel-table">
                <thead>
                  <tr>
                    {DETAIL_COLUMNS.map((column) => (
                      <th key={column.key}>
                        <button type="button" onClick={() => handleSort(column.key)}>
                          {column.label}
                          {sort.key === column.key ? <ArrowDown size={13} className={sort.dir === 'asc' ? 'asc' : ''} /> : null}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(detailData.rows ?? []).map((row, index) => {
                    const rowKey = `${row.chave}-${row.idlead}-${row.idprecadastro}-${row.idreserva}-${row.idrepasse}-${row.data_evento}-${index}`;
                    return (
                      <tr
                        key={rowKey}
                        className={selectedDetailRow === row ? 'selected' : ''}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedDetailRow(row)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') setSelectedDetailRow(row);
                        }}
                      >
                        <td>{formatDate(row.data_evento)}</td>
                        <td>{row.idlead ?? '-'}</td>
                        <td>{row.idprecadastro ?? '-'}</td>
                        <td>{row.idreserva ?? '-'}</td>
                        <td>{row.idrepasse ?? '-'}</td>
                        <td>{row.situacao ?? '-'}</td>
                        <td>{row.cidade ?? '-'}</td>
                        <td>{row.empreendimento ?? '-'}</td>
                        <td>{row.corretor ?? '-'}</td>
                        <td>{row.sdr ?? '-'}</td>
                        <td><span className={`funnel-tag ${row.sla_classificacao === 'SLA Expirado' ? 'risk' : ''}`}>{row.sla_classificacao ?? '-'}</span></td>
                        <td><span className="funnel-tag">{row.restricao_classificacao ?? '-'}</span></td>
                      </tr>
                    );
                  })}
                  {!detailLoading && (detailData.rows ?? []).length === 0 && (
                    <tr>
                      <td colSpan={DETAIL_COLUMNS.length}>Sem linhas para os filtros selecionados.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <aside className="funnel-history-panel" aria-busy={historyLoading}>
              <div className="funnel-history-header">
                <h3>Histórico</h3>
                <span>{historyLoading ? 'Carregando...' : `${formatNumber(historyData.total)} eventos`}</span>
              </div>
              {historyData.warning && (
                <div className="funnel-alert warning">
                  <TriangleAlert size={16} />
                  {historyData.warning}
                </div>
              )}
              {!selectedDetailRow && <p className="funnel-history-empty">Selecione uma linha do detalhe.</p>}
              {selectedDetailRow && HISTORY_GROUPS.map((group) => {
                const rows = historyData[group.key] ?? [];
                return (
                  <div className="funnel-history-group" key={group.key}>
                    <h4>{group.title}</h4>
                    <div className="funnel-history-table-wrap">
                      <table className="funnel-history-table">
                        <thead>
                          <tr>
                            <th>ID</th>
                            <th>Data</th>
                            <th>Situação</th>
                            <th>Anterior</th>
                            <th>Próxima</th>
                            <th>Horas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, index) => (
                            <tr key={`${group.key}-${row.entidade_id}-${row.referencia_data}-${index}`}>
                              <td>{row.entidade_id ?? row.idreserva ?? '-'}</td>
                              <td>{formatDateTime(row.referencia_data)}</td>
                              <td>{row.situacao ?? '-'}</td>
                              <td>{row.situacao_anterior ?? '-'}</td>
                              <td>{row.situacao_proxima ?? '-'}</td>
                              <td>{row.tempo_horas == null ? '-' : formatNumber(row.tempo_horas)}</td>
                            </tr>
                          ))}
                          {!historyLoading && rows.length === 0 && (
                            <tr>
                              <td colSpan="6">Sem histórico disponível.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </aside>
          </div>

          <div className="funnel-pagination">
            <button type="button" disabled={detailData.page <= 1} onClick={() => loadDetail(selectedStage, detailData.page - 1)}>Anterior</button>
            <span>Página {detailData.page}</span>
            <button type="button" disabled={detailData.page * 50 >= detailData.total} onClick={() => loadDetail(selectedStage, detailData.page + 1)}>Próxima</button>
          </div>
        </section>
      )}

      {activeTab === 'goals' && (
        <section className="funnel-goals" aria-busy={goalsLoading}>
          {goalsLoading && (
            <div className="funnel-loading-banner" role="status" aria-live="polite">
              <LoaderCircle size={16} />
              Carregando consolidado de metas de acordo com os filtros selecionados...
            </div>
          )}
          <div className="funnel-goals-toolbar">
            <label>
              Meta
              <input type="number" min="0" value={metaRepasse} onChange={(event) => setMetaRepasse(Number(event.target.value) || 0)} />
            </label>
            <div className="funnel-goals-days">
              <span>
                <strong>{formatNumber(goalsData?.businessDays?.total)}</strong>
                Dias Úteis Mês
              </span>
              <span>
                <strong>{formatNumber(goalsData?.businessDays?.elapsed)}</strong>
                Dias Úteis Decorridos
              </span>
            </div>
            <button type="button" className="funnel-secondary-button" onClick={() => window.print()}>
              <Download size={16} />
              Exportar
            </button>
          </div>

          <div className="funnel-goals-layout">
            <div className="funnel-goals-panel">
              <div className="funnel-goals-title">
                <h3>Realizado e Meta Dinâmica</h3>
                <span>{formatDate(goalsData?.quarterPeriod?.startDate)} - {formatDate(goalsData?.quarterPeriod?.endDate)}</span>
              </div>
              <div className="funnel-goals-table-wrap">
                <table className="funnel-goals-table">
                  <thead>
                    <tr>
                      <th>Etapa</th>
                      <th>Qtd Funil</th>
                      <th>SLA - Médio</th>
                      <th>% Anterior</th>
                      <th>Meta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quarterRows.map((row) => (
                      <tr
                        key={row.key}
                        onClick={() => handleSelectStage(row, {
                          source: 'goals-quarter',
                          label: 'Trimestre consolidado',
                          startDate: goalsData?.quarterPeriod?.startDate,
                          endDate: goalsData?.quarterPeriod?.endDate,
                          visualTotal: row.quarterActual ?? row.actual,
                        })}
                      >
                        <td>{row.label}</td>
                        <td>{formatNumber(row.quarterActual ?? row.actual)}</td>
                        <td>{row.slaAverage == null ? '-' : formatNumber(row.slaAverage)}</td>
                        <td>{formatPercent(row.conversionFromPrevious)}</td>
                        <td>{row.dynamicGoal == null ? '-' : formatNumber(row.dynamicGoal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="funnel-goals-panel">
              <div className="funnel-goals-title">
                <h3>Acompanhamento Atual</h3>
                <span>{formatDate(goalsData?.period?.startDate)} - {formatDate(goalsData?.period?.endDate)}</span>
              </div>
              <div className="funnel-goals-table-wrap">
                <table className="funnel-goals-table current">
                  <thead>
                    <tr>
                      <th>Etapa</th>
                      <th>Qtd Atual</th>
                      <th>% Conversão</th>
                      <th>Gap Meta</th>
                      <th>% Realizado Meta</th>
                      <th>Tendência</th>
                      <th>% Tend. da Meta</th>
                      <th>Necessidade Diária</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goalRows.map((row) => {
                      const gapOk = row.gap != null && Number(row.gap) <= 0;
                      const attainmentOk = row.attainment != null && Number(row.attainment) >= 100;
                      const trendOk = row.trendAttainment != null && Number(row.trendAttainment) >= 100;
                      const needOk = row.dailyNeed == null || Number(row.dailyNeed) <= 0 || gapOk;
                      return (
                        <tr
                          key={row.key}
                          onClick={() => handleSelectStage(row, {
                            source: 'goals-current',
                            label: 'Período atual',
                            startDate: goalsData?.period?.startDate,
                            endDate: goalsData?.period?.endDate,
                            visualTotal: row.actual,
                          })}
                        >
                          <td>{row.label}</td>
                          <td>{formatNumber(row.actual)}</td>
                          <td>{formatPercent(row.conversionFromPrevious)}</td>
                          <td className={gapOk ? 'ok' : 'risk'}>{row.gap == null ? '-' : formatSignedNumber(row.gap)}</td>
                          <td className={attainmentOk ? 'ok' : 'risk'}>{formatPercent(row.attainment)}</td>
                          <td>{row.trend == null ? '-' : formatNumber(row.trend)}</td>
                          <td className={trendOk ? 'ok' : 'risk'}>{formatPercent(row.trendAttainment)}</td>
                          <td className={needOk ? 'ok' : 'risk'}>
                            <Target size={14} />
                            {formatNeed(row, goalsData?.businessDays)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default FunnelDashboard;
