import { useEffect, useMemo, useState } from 'react';
import Card from '../components/Card';
import SelectFilter from '../components/SelectFilter';
import { useFilters } from '../contexts/FiltersContext';
import { fetchLeads } from '../api';
import './Analytics.css';

const handleExportCSV = async (rows) => {
  const { exportToCSV } = await import('../utils/exportUtils');
  exportToCSV(rows, 'exportacao_sdr');
};

const handleExportExcel = async (rows) => {
  const { exportToExcel } = await import('../utils/exportUtils');
  await exportToExcel(rows, 'exportacao_sdr', 'DadosSDR');
};

const SECTION_OPTIONS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'detalhamento', label: 'Detalhamento' },
];

const VIEW_OPTIONS = [
  { value: 'operacional', label: 'Operacional' },
  { value: 'gerencial', label: 'Gerencial' },
];

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todas as situacoes' },
  { value: 'novo', label: 'Novo' },
  { value: 'em-contato', label: 'Em contato' },
  { value: 'proposta-emitida', label: 'Proposta emitida' },
  { value: 'venda-finalizada', label: 'Venda finalizada' },
  { value: 'cancelado', label: 'Cancelado' },
  { value: 'distratado', label: 'Distratado' },
  { value: 'repasse-concluido', label: 'Repasse concluído' },
];

const DETAIL_COLUMNS = [
  { key: 'id_lead', label: 'Id Lead' },
  { key: 'situacao', label: 'Situação' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'sdr', label: 'SDR' },
  { key: 'corretor', label: 'Corretor' },
  { key: 'origem', label: 'Origem' },
  { key: 'empreendimento_reduzido', label: 'Região' },
  { key: 'sla_finalizacao_dias', label: 'SLA Finalização' },
  { key: 'sla_repasse_dias', label: 'SLA Repasse' },
];

const compareValues = (aValue, bValue) => {
  const emptyA = aValue == null || aValue === '';
  const emptyB = bValue == null || bValue === '';
  if (emptyA && emptyB) return 0;
  if (emptyA) return 1;
  if (emptyB) return -1;
  const numA = Number(aValue);
  const numB = Number(bValue);
  if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
  return String(aValue).localeCompare(String(bValue), 'pt-BR', { numeric: true, sensitivity: 'base' });
};

const DetailTable = ({ rows }) => {
  const [sort, setSort] = useState({ key: 'id_lead', order: 'asc' });
  const sortedRows = useMemo(() => {
    const column = DETAIL_COLUMNS.find((item) => item.key === sort.key);
    if (!column) return rows;
    return rows.slice().sort((a, b) => {
      const result = compareValues(a?.[column.key], b?.[column.key]);
      return sort.order === 'asc' ? result : -result;
    });
  }, [rows, sort.key, sort.order]);

  const toggleSort = (key) => {
    setSort((current) => (
      current.key === key
        ? { key, order: current.order === 'asc' ? 'desc' : 'asc' }
        : { key, order: key.startsWith('sla_') ? 'desc' : 'asc' }
    ));
  };

  return (
    <div className="analytics-detail-table-wrapper">
      <table className="analytics-detail-table">
        <thead>
          <tr>
            {DETAIL_COLUMNS.map((column) => (
              <th key={column.key}>
                <button type="button" onClick={() => toggleSort(column.key)}>
                  {column.label} {sort.key === column.key ? (sort.order === 'asc' ? '↑' : '↓') : '↕'}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.length ? (
            sortedRows.map((row) => (
              <tr key={row.id_lead}>
                {DETAIL_COLUMNS.map((column) => (
                  <td key={`${row.id_lead}-${column.key}`}>
                    {column.key === 'situacao' ? <span className="analytics-status-pill">{row[column.key] || '-'}</span> : (row[column.key] ?? '-')}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={DETAIL_COLUMNS.length} className="text-variant">
                Nenhum registro encontrado para os filtros atuais.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const Analytics = () => {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [viewMode, setViewMode] = useState('gerencial');
  const [summary, setSummary] = useState(null);
  const [detailRows, setDetailRows] = useState([]);
  const { activeFilterLabels, filters } = useFilters();

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({
      startDate: filters.dataInicial,
      endDate: filters.dataFinal,
      cidade: filters.cidade,
      corretor: filters.corretor,
      sdr: filters.sdr,
      gerencia: filters.gerencia,
      coordenacao: filters.coordenacao,
      empreendimento: filters.empreendimento,
      empreendimentoReduzido: filters.empreendimentoReduzido,
      origem: filters.origem,
    });

    const load = async () => {
      try {
        const [summaryResp, leadsData] = await Promise.all([
          fetch(`/api/v1/dashboard/summary?${query.toString()}`),
          fetchLeads({ filters, status: statusFilter, page: 1, limit: 300 }),
        ]);

        const summaryJson = summaryResp.ok ? await summaryResp.json() : null;
        if (!active) return;
        setSummary(summaryJson);
        setDetailRows(leadsData?.rows ?? []);
      } catch {
        if (!active) return;
        setSummary(null);
        setDetailRows([]);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [filters, statusFilter]);

  const selectedStatusLabel = STATUS_OPTIONS.find((option) => option.value === statusFilter)?.label;
  const detailSummary = useMemo(
    () => (viewMode === 'gerencial'
      ? 'Leitura tabular para gestão com dados reais do banco.'
      : 'Base operacional para conferência e exportação.'),
    [viewMode],
  );

  const statusCards = useMemo(() => {
    const counts = detailRows.reduce((acc, row) => {
      const key = row.situacao || 'Não informado';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const total = detailRows.length || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value, share: `${Math.round((value / total) * 100)}%` }));
  }, [detailRows]);

  const summaryCards = [
    { label: 'Leads', value: summary?.total_leads ?? 0, helper: 'Contagem no período' },
    { label: 'Visitas', value: summary?.total_visitas ?? 0, helper: 'Contagem no período' },
    { label: 'Propostas', value: summary?.total_propostas_geral ?? summary?.total_propostas ?? 0, helper: 'Última ocorrência entre os 3 status' },
    { label: 'Reservas', value: summary?.total_vendas ?? 0, helper: 'Reservas por data de cadastro' },
    { label: 'Repasses', value: summary?.total_repasses ?? 0, helper: 'Por assinatura contrato' },
  ];

  return (
    <div className="analytics-page">
      <header className="analytics-header">
        <div className="analytics-header-copy">
          <p className="label-md text-variant">Análise Gerencial</p>
          <h2 className="headline-sm">Visão SDR</h2>
        </div>
      </header>

      <section className="analytics-top-filters">
        <SelectFilter id="analytics-section-filter" label="Visão" value={activeSection} options={SECTION_OPTIONS} onChange={setActiveSection} className="analytics-compact-filter" />
        <SelectFilter id="analytics-view-mode" label="Modo" value={viewMode} options={VIEW_OPTIONS} onChange={setViewMode} className="analytics-compact-filter" />
        <SelectFilter id="analytics-status-filter" label="Situação" value={statusFilter} options={STATUS_OPTIONS} onChange={setStatusFilter} className="analytics-compact-filter" />
      </section>

      <section className="analytics-kpi-grid">
        {summaryCards.map((item) => (
          <article key={item.label} className="analytics-summary-card tone-primary">
            <div className="analytics-summary-status-bar" />
            <span className="analytics-summary-label">{item.label}</span>
            <h4 className="analytics-summary-value">{item.value}</h4>
            <p className="analytics-summary-helper">{item.helper}</p>
          </article>
        ))}
      </section>

      {activeSection === 'dashboard' && (
        <section className="analytics-status-overview">
          <Card title="Situações dos Leads" subtitle="Dados reais do banco no recorte filtrado">
            <div className="analytics-status-grid">
              {statusCards.map((item) => (
                <div key={item.label} className="analytics-status-card tone-primary">
                  <span className="analytics-status-label">{item.label}</span>
                  <h5 className="analytics-status-value">{item.value}</h5>
                  <span className="body-sm text-variant">{item.share}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      {activeSection === 'detalhamento' && (
        <section className="analytics-detail-section">
          <Card title="Workspace de Relatórios" subtitle="Base real para exploração e exportação">
            <div className="analytics-report-shell">
              <div className="analytics-report-toolbar">
                <div className="analytics-report-heading">
                  <h3 className="analytics-report-title">{detailSummary}</h3>
                  <p className="body-sm text-variant">Situação {selectedStatusLabel} | Registros {detailRows.length}</p>
                  <p className="body-sm text-variant">Cidade {activeFilterLabels.cidade} | Período {activeFilterLabels.periodo}</p>
                </div>
                <div className="analytics-report-actions">
                  <button type="button" className="analytics-action-button analytics-action-button-secondary" onClick={() => handleExportCSV(detailRows)}>Exportar CSV</button>
                  <button type="button" className="analytics-action-button analytics-action-button-primary" onClick={() => handleExportExcel(detailRows)}>Exportar Excel</button>
                </div>
              </div>
              <DetailTable rows={detailRows} />
            </div>
          </Card>
        </section>
      )}
    </div>
  );
};

export default Analytics;
