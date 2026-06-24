import { useState } from 'react';
import { useFilters } from '../contexts/FiltersContext';
import PeriodFilter from './PeriodFilter';
import MultiSelectFilter from './MultiSelectFilter';
import './DashboardFilters.css';

const FILTER_GROUPS = [
  {
    title: 'Operação',
    source: 'Fato comercial',
    tone: 'operation',
    hint: 'Campos da fato comercial: região da venda, imobiliária da operação, empreendimento, unidade e origem.',
    filters: [
      { key: 'regiaoOperacao', label: 'Região da operação', essential: true },
      { key: 'imobiliariaOperacao', label: 'Imobiliária da operação' },
      { key: 'corretorOperacao', label: 'Corretor da operação' },
      { key: 'sdrOperacao', label: 'SDR da operação' },
      { key: 'origem', label: 'Origem da campanha' },
      { key: 'empreendimento', label: 'Empreendimento', essential: true },
      { key: 'unidade', label: 'Unidade' },
    ],
  },
  {
    title: 'Reserva',
    source: 'Campos da reserva',
    tone: 'reservation',
    hint: 'Campos operacionais da própria reserva: situação atual, ID reserva, repasse no mês e agente quando disponível na base.',
    filters: [
      { key: 'situacaoAtual', label: 'Situação atual', essential: true },
      { key: 'idReserva', label: 'ID Reserva' },
      { key: 'repasseNoMes', label: 'Repasse no mês', essential: true },
      { key: 'agente', label: 'Agente' },
    ],
  },
  {
    title: 'Corretor',
    source: 'Cadastro de funcionário',
    tone: 'broker',
    hint: 'Cadastro completo de funcionários em sevenlm_connect.funcionario_acesso.',
    filters: [
      { key: 'corretorAtivo', label: 'Corretor', essential: true },
      { key: 'gestorCorretor', label: 'Gerência do corretor' },
      { key: 'coordenadorCorretor', label: 'Coordenação do corretor' },
      { key: 'regiaoCorretor', label: 'Região do corretor', essential: true },
      { key: 'imobiliariaCorretor', label: 'Imobiliária do corretor' },
    ],
  },
  {
    title: 'SDR',
    source: 'Cadastro de funcionário',
    tone: 'sdr',
    hint: 'Cadastro completo de funcionários em sevenlm_connect.funcionario_acesso.',
    filters: [
      { key: 'sdrAtivo', label: 'SDR' },
      { key: 'gestorSdr', label: 'Gerência do SDR' },
      { key: 'coordenadorSdr', label: 'Coordenação do SDR' },
      { key: 'regiaoSdr', label: 'Região do SDR' },
      { key: 'imobiliariaSdr', label: 'Imobiliária do SDR' },
    ],
  },
];

const DashboardFilters = ({ showReservationFilters = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { filters, filterOptions, setFilterValue, resetFilters, searchFilterOptions } = useFilters();

  const visibleGroups = FILTER_GROUPS
    .filter((group) => showReservationFilters || group.tone !== 'reservation')
    .map((group) => ({
      ...group,
      filters: group.filters.filter((filter) => {
        if (isExpanded) {
          return true;
        }
        return group.tone === 'operation' && filter.essential;
      }),
    }))
    .filter((group) => group.filters.length > 0);

  return (
    <section className={`dashboard-filters ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
      <div className="dashboard-filters-toolbar">
        <div>
          <p className="dashboard-filters-title label-md">Filtros</p>
          <p className="dashboard-filters-subtitle body-sm text-variant">
            Operação e cadastro de funcionário têm fontes separadas.
          </p>
        </div>

        <div className="dashboard-filters-actions">
          <button
            type="button"
            className="btn-secondary label-md dashboard-filters-toggle"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? 'Recolher filtros' : 'Expandir filtros'}
          </button>
          <button type="button" className="btn-secondary label-md dashboard-filters-reset" onClick={resetFilters}>
            Limpar
          </button>
        </div>
      </div>

      <div className="dashboard-filters-layout">
        <div className="period-filter-wrapper">
          <PeriodFilter isExpanded={isExpanded} />
        </div>
        <div className="dashboard-filters-other">
          {visibleGroups.map((group) => (
            <div key={group.title} className={`dashboard-filters-group dashboard-filters-group-${group.tone}`}>
              <div className="dashboard-filters-group-heading">
                <span className="dashboard-filters-group-dot" aria-hidden="true" />
                <div>
                  <div className="dashboard-filters-group-title-row">
                    <p className="dashboard-filters-group-title label-md">{group.title}</p>
                    <span className="dashboard-filters-group-source">{group.source}</span>
                  </div>
                  {isExpanded && <p className="dashboard-filters-group-hint body-sm">{group.hint}</p>}
                </div>
              </div>
              <div className="dashboard-filters-group-grid">
                {group.filters.map((filter) => (
                  <MultiSelectFilter
                    key={filter.key}
                    id={`global-filter-${filter.key}`}
                    label={filter.label}
                    value={filters[filter.key]}
                    options={filterOptions[filter.key]}
                    searchKey={filter.key}
                    onSearchOptions={searchFilterOptions}
                    onChange={(value) => setFilterValue(filter.key, value)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isExpanded && (
        <div className="dashboard-filters-footer">
          <p className="body-sm text-variant">
            Os filtros selecionados são compartilhados entre KPIs, gráficos, drill-down e estratificações futuras.
          </p>
        </div>
      )}
    </section>
  );
};

export default DashboardFilters;
