import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, Download, LayoutDashboard, Target, TriangleAlert } from 'lucide-react';
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

const DETAIL_COLUMNS = [
  { key: 'data_evento', label: 'Data' },
  { key: 'chave', label: 'Chave' },
  { key: 'situacao', label: 'Situação' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'empreendimento', label: 'Empreendimento' },
  { key: 'corretor', label: 'Corretor' },
  { key: 'sdr', label: 'SDR' },
  { key: 'sla_classificacao', label: 'SLA' },
  { key: 'restricao_classificacao', label: 'Restrição' },
];

const FunnelDashboard = () => {
  const { filters, buildFilterParams, filterQueryString } = useCommercialFilters();
  const [activeTab, setActiveTab] = useState('funnel');
  const [selectedStage, setSelectedStage] = useState(null);
  const [funnelData, setFunnelData] = useState(null);
  const [detailData, setDetailData] = useState({ rows: [], total: 0, page: 1 });
  const [goalsData, setGoalsData] = useState(null);
  const [auditData, setAuditData] = useState(null);
  const [metaRepasse, setMetaRepasse] = useState(45);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState({ key: 'data_evento', dir: 'desc' });

  const queryParams = useMemo(
    () => buildFilterParams(filters.dataInicial, filters.dataFinal),
    [buildFilterParams, filters.dataFinal, filters.dataInicial],
  );

  const stages = useMemo(() => funnelData?.stages ?? [], [funnelData]);
  const maxValue = useMemo(() => Math.max(...stages.map((stage) => Number(stage.value) || 0), 1), [stages]);
  const leadValue = Number(stages[0]?.value) || 0;
  const goalRows = useMemo(() => goalsData?.rows ?? [], [goalsData]);
  const quarterRows = useMemo(() => goalsData?.quarterRows ?? [], [goalsData]);

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
      try {
        const response = await fetch(`/api/v1/dashboard/funnel/goals?${params.toString()}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.details || payload?.error || 'Falha ao buscar metas');
        if (active) setGoalsData(payload);
      } catch {
        if (active) setGoalsData(null);
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
    setDetailLoading(true);
    const params = new URLSearchParams(queryParams);
    params.set('stage', stageKey);
    params.set('page', String(page));
    params.set('limit', '50');
    params.set('sortBy', nextSort.key);
    params.set('sortDir', nextSort.dir);

    try {
      const response = await fetch(`/api/v1/dashboard/funnel/detail?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.details || payload?.error || 'Falha ao buscar detalhe');
      setDetailData({ ...payload, page });
    } catch (err) {
      setDetailData({ rows: [], total: 0, page, warning: err?.message || 'Erro ao carregar detalhe.' });
    } finally {
      setDetailLoading(false);
    }
  }, [queryParams, sort]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadDetail(selectedStage, 1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [selectedStage, loadDetail]);

  const selectedStageData = stages.find((stage) => stage.key === selectedStage) ?? stages[0] ?? null;

  const handleSelectStage = (stage) => {
    setSelectedStage(stage.key);
    setActiveTab('detail');
  };

  const handleAudit = async () => {
    setAuditData(null);
    const response = await fetch(`/api/v1/dashboard/funnel/audit?${queryParams.toString()}`);
    const payload = await response.json();
    setAuditData(response.ok ? payload : { ok: false, checks: [], error: payload?.details || payload?.error });
  };

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
          <h2 className="headline-sm">Funil de Vendas</h2>
          <p className="body-sm text-variant">{formatDate(filters.dataInicial)} a {formatDate(filters.dataFinal)}</p>
        </div>
        <Link to="/" className="dashboard-corretor-link label-md">
          <LayoutDashboard size={15} />
          Painel inicial
        </Link>
      </header>

      <DashboardFilters />

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
            <h3>Funil de Movimentação Comercial - Leads, Propostas, Vendas e Repasse</h3>
            <p>Este funil mostra quantas oportunidades avançaram no período selecionado</p>
          </div>

          <div className="funnel-shape">
            {stages.map((stage, index) => {
              const value = Number(stage.value) || 0;
              const widthPercent = (value / maxValue) * 100;
              const width = Math.max(4, widthPercent);
              const barTone = Math.max(0.1, Math.min(1, widthPercent / 100));
              const previousPercent = stage.conversionFromPrevious;
              const leadPercent = stage.conversionFromLead;
              const densityClass = widthPercent < 8 ? 'tiny' : widthPercent < 18 ? 'compact' : '';
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
                  <span className="funnel-shape-bar">
                    <span className="funnel-shape-bar-label">
                      <span>{formatNumber(value)}</span>
                      <strong>{stage.label}</strong>
                    </span>
                  </span>
                  <span className="funnel-shape-callout">
                    <span>{formatNumber(value)}</span>
                    <strong>{stage.label}</strong>
                  </span>
                  <span className="funnel-shape-meta">
                    {index > 0 && <small>Perc. do Anterior: {formatPercent(previousPercent)}</small>}
                    <small>{index === stages.length - 1 ? 'Taxa Conversão' : 'Perc. da Prospecção'}: {formatPercent(leadPercent)}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === 'detail' && (
        <section className="funnel-detail">
          <div className="funnel-detail-header">
            <div>
              <h3>{selectedStageData?.label ?? 'Detalhamento'}</h3>
              <p>{formatNumber(detailData.total)} linhas conciliadas no detalhe</p>
            </div>
          </div>

          {detailData.warning && (
            <div className="funnel-alert warning">
              <TriangleAlert size={16} />
              {detailData.warning}
            </div>
          )}

          <div className="funnel-table-wrap" aria-busy={detailLoading}>
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
                {(detailData.rows ?? []).map((row) => (
                  <tr key={`${row.chave}-${row.data_evento}`}>
                    <td>{formatDate(row.data_evento)}</td>
                    <td>{row.chave ?? '-'}</td>
                    <td>{row.situacao ?? '-'}</td>
                    <td>{row.cidade ?? '-'}</td>
                    <td>{row.empreendimento ?? '-'}</td>
                    <td>{row.corretor ?? '-'}</td>
                    <td>{row.sdr ?? '-'}</td>
                    <td><span className={`funnel-tag ${row.sla_classificacao === 'SLA Expirado' ? 'risk' : ''}`}>{row.sla_classificacao ?? '-'}</span></td>
                    <td><span className="funnel-tag">{row.restricao_classificacao ?? '-'}</span></td>
                  </tr>
                ))}
                {!detailLoading && (detailData.rows ?? []).length === 0 && (
                  <tr>
                    <td colSpan={DETAIL_COLUMNS.length}>Sem linhas para os filtros selecionados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="funnel-pagination">
            <button type="button" disabled={detailData.page <= 1} onClick={() => loadDetail(selectedStage, detailData.page - 1)}>Anterior</button>
            <span>Página {detailData.page}</span>
            <button type="button" disabled={detailData.page * 50 >= detailData.total} onClick={() => loadDetail(selectedStage, detailData.page + 1)}>Próxima</button>
          </div>
        </section>
      )}

      {activeTab === 'goals' && (
        <section className="funnel-goals">
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
                      <tr key={row.key} onClick={() => handleSelectStage(row)}>
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
                        <tr key={row.key} onClick={() => handleSelectStage(row)}>
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
