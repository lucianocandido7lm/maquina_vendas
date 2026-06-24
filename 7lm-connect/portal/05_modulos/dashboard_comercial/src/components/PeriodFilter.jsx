import { useFilters } from '../contexts/FiltersContext';
import SelectFilter from './SelectFilter';
import './PeriodFilter.css';

const formatDate = (value) => {
  if (!value) {
    return '';
  }

  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T00:00:00`));
};

const PeriodFilter = ({ isExpanded = false }) => {
  const { filters, filterOptions, setPeriodo, setDateRange } = useFilters();

  return (
    <div className={`period-filter ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
      <SelectFilter
        id="global-period-filter"
        label={'Per\u00EDodo'}
        value={filters.periodo}
        options={filterOptions.periodo}
        onChange={setPeriodo}
      />

      {isExpanded && (
        <div className="period-filter-expanded-content">
          <div className="period-filter-dates">
            <div className="date-filter-field">
              <label className="select-filter-label label-md" htmlFor="global-start-date">
                Data inicial
              </label>
              <input
                id="global-start-date"
                type="date"
                className="period-filter-date-input body-sm"
                value={filters.dataInicial}
                onChange={(event) => setDateRange({ dataInicial: event.target.value, periodo: 'custom' })}
              />
            </div>

            <div className="date-filter-field">
              <label className="select-filter-label label-md" htmlFor="global-end-date">
                Data final
              </label>
              <input
                id="global-end-date"
                type="date"
                className="period-filter-date-input body-sm"
                value={filters.dataFinal}
                onChange={(event) => setDateRange({ dataFinal: event.target.value, periodo: 'custom' })}
              />
            </div>
          </div>



          <div className="period-filter-info">
            <p className="period-filter-range body-sm text-variant">
              {'Intervalo ativo: '} <strong>{formatDate(filters.dataInicial)}</strong> {' at\u00E9 '} <strong>{formatDate(filters.dataFinal)}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PeriodFilter;
