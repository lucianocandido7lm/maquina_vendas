import { useEffect, useMemo, useState } from 'react';
import Card from '../Card';
import { Download } from 'lucide-react';
import { useFilters } from '../../contexts/FiltersContext';
import { fetchLeads } from '../../api';
import './IndicatorDetailPanel.css';

const handleExportCSV = async (rows, exportName) => {
  const { exportToCSV } = await import('../../utils/exportUtils');
  exportToCSV(rows, exportName);
};

const handleExportExcel = async (rows, exportName) => {
  const { exportToExcel } = await import('../../utils/exportUtils');
  await exportToExcel(rows, exportName, 'Relatorio');
};

const COLUMNS = [
  'id_lead',
  'id_precadastro',
  'id_reserva',
  'id_repasse',
  'situacao',
  'cidade',
  'coordenacao',
  'corretor',
  'origem',
  'empreendimento_reduzido',
  'dt_lead_conversao',
  'dt_visita_realizada',
  'dt_resposta_analise_precadastro',
  'dt_cadastro_reserva',
  'data_venda',
  'dt_contrato_contabilizado',
  'dt_assinatura_contrato',
  'sla_finalizacao_dias',
  'sla_repasse_dias',
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
  const dateA = Date.parse(aValue);
  const dateB = Date.parse(bValue);
  if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) return dateA - dateB;
  return String(aValue).localeCompare(String(bValue), 'pt-BR', { numeric: true, sensitivity: 'base' });
};

const IndicatorDetailPanel = ({ indicator }) => {
  const { filters } = useFilters();
  const [rows, setRows] = useState([]);
  const [sort, setSort] = useState({ key: 'id_lead', order: 'asc' });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await fetchLeads({ filters, page: 1, limit: 300 });
        if (!active) return;
        setRows(Array.isArray(data?.rows) ? data.rows : []);
      } catch {
        if (!active) return;
        setRows([]);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [filters]);

  const exportName = useMemo(() => `detalhamento_${indicator?.id || 'indicador'}`, [indicator?.id]);
  const sortedRows = useMemo(() => rows.slice().sort((a, b) => {
    const result = compareValues(a?.[sort.key], b?.[sort.key]);
    return sort.order === 'asc' ? result : -result;
  }), [rows, sort.key, sort.order]);

  const toggleSort = (key) => {
    setSort((current) => (
      current.key === key
        ? { key, order: current.order === 'asc' ? 'desc' : 'asc' }
        : { key, order: key.startsWith('dt_') || key.startsWith('data_') || key.startsWith('sla_') ? 'desc' : 'asc' }
    ));
  };

  return (
    <Card title="Explorador de Dados" subtitle="Base real do banco para App e BI">
      <div className="data-explorer-main">
        <div className="data-explorer-toolbar">
          <div className="data-explorer-context">
            <span className="data-table-title">{indicator?.title || 'Indicador'}</span>
            <div className="data-meta-tags">
              <span className="data-meta-tag">{rows.length} registros</span>
            </div>
          </div>
          <div className="data-explorer-actions">
            <button className="btn-secondary" onClick={() => handleExportCSV(sortedRows, exportName)}>
              <Download size={14} /> CSV
            </button>
            <button className="btn-primary" onClick={() => handleExportExcel(sortedRows, exportName)}>
              <Download size={14} /> Excel
            </button>
          </div>
        </div>

        <div className="indicator-table-wrapper">
          <table className="indicator-table">
            <thead>
              <tr>
                {COLUMNS.map((col) => (
                  <th key={col}>
                    <button type="button" className="indicator-sort-header" onClick={() => toggleSort(col)}>
                      {col} {sort.key === col ? (sort.order === 'asc' ? '↑' : '↓') : '↕'}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length ? sortedRows.map((row) => (
                <tr key={`${row.id_lead}-${row.data_referencia || ''}`}>
                  {COLUMNS.map((col) => (
                    <td key={`${row.id_lead}-${col}`}>{row[col] ?? '-'}</td>
                  ))}
                </tr>
              )) : (
                <tr>
                  <td colSpan={COLUMNS.length}>Nenhum dado encontrado para o filtro atual.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
};

export default IndicatorDetailPanel;
