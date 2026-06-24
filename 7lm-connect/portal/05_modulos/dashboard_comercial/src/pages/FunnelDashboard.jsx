import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, CheckCircle2, Download, LayoutDashboard, Search, Target, TriangleAlert } from 'lucide-react';
import DashboardFilters from '../components/DashboardFilters';
import { useCommercialFilters } from '../hooks/useCommercialFilters';
import './FunnelDashboard.css';

const numberFormatter = new Intl.NumberFormat('pt-BR');
const percentFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

const formatNumber = (value) => numberFormatter.format(Number(value) || 0);
const formatPercent = (value) => (value == null ? '-' : `${percentFormatter.format(Number(value) || 0)}%`);
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
        <button type="button" className={activeTab === 'goals' ? 'active' : ''} onClick={() => setActiveTab('goals')}>Consolidado de Metas</button>
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
        <section className="funnel-grid">
          <div className="funnel-visual" aria-busy={loading}>
            {stages.map((stage, index) => {
              const width = Math.max(12, (Number(stage.value) / maxValue) * 100);
              return (
                <button
                  type="button"
                  key={stage.key}
                  className={`funnel-stage ${selectedStage === stage.key ? 'selected' : ''} ${stage.sourceAvailable ? '' : 'unavailable'}`}
                  onClick={() => handleSelectStage(stage)}
                >
                  <span className="funnel-stage-order">{stage.order}</span>
                  <span className="funnel-stage-main">
                    <span className="funnel-stage-label">{stage.label}</span>
                    <span className="funnel-stage-rule">{stage.rule}</span>
                  </span>
                  <span className="funnel-stage-bar" style={{ width: `${width}%` }} />
                  <span className="funnel-stage-metrics">
                    <strong>{formatNumber(stage.value)}</strong>
                    <small>{index === 0 ? 'base' : `${formatPercent(stage.conversionFromPrevious)} da anterior`}</small>
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
              Meta REPASSE
              <input type="number" min="0" value={metaRepasse} onChange={(event) => setMetaRepasse(Number(event.target.value) || 0)} />
            </label>
            <button type="button" className="funnel-secondary-button" onClick={() => window.print()}>
              <Download size={16} />
              Exportar
            </button>
          </div>

          <div className="funnel-goals-grid">
            {(goalsData?.rows ?? []).map((row) => (
              <button type="button" className="funnel-goal-row" key={row.key} onClick={() => handleSelectStage(row)}>
                <span>
                  <strong>{row.label}</strong>
                  <small>Realizado {formatNumber(row.actual)}</small>
                </span>
                <span>
                  <Target size={16} />
                  Meta {row.dynamicGoal == null ? '-' : formatNumber(row.dynamicGoal)}
                </span>
                <span>{formatPercent(row.attainment)}</span>
                <span>Tend. {row.trend == null ? '-' : formatNumber(row.trend)}</span>
                <span>Gap {row.gap == null ? '-' : formatNumber(row.gap)}</span>
                <span>Nec. dia {row.dailyNeed == null ? '-' : formatNumber(row.dailyNeed)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default FunnelDashboard;
