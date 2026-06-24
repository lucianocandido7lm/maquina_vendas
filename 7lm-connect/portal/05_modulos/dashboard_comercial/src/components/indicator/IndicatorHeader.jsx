import { NavLink } from 'react-router-dom';

const IndicatorHeader = ({ indicator, activeFilterLabels }) => {
  const contextItems = [
    `Perfil ${activeFilterLabels.perfilVisualizacao}`,
    `Período ${activeFilterLabels.periodo}`,
    `Cidade ${activeFilterLabels.cidade}`,
    `Gerência ${activeFilterLabels.gerencia}`,
  ];

  return (
    <header className="indicator-header">
      <div className="indicator-header-copy">
        <p className="label-md text-variant">Indicador</p>
        <h2 className="headline-sm">{indicator.title}</h2>
        <p className="body-sm text-variant">{indicator.description}</p>

        <div className="indicator-header-pills" aria-label="Contexto herdado da dashboard principal">
          {contextItems.map((item) => (
            <span key={item} className="indicator-filter-chip">
              {item}
            </span>
          ))}
        </div>
      </div>

      <nav className="indicator-tabs" aria-label="Abas do indicador">
        <NavLink
          to={`/indicadores/${indicator.id}/dashboard`}
          className={({ isActive }) => `indicator-tab ${isActive ? 'active' : ''}`}
        >
          Dashboard
        </NavLink>
        <NavLink
          to={`/indicadores/${indicator.id}/detalhamento`}
          className={({ isActive }) => `indicator-tab ${isActive ? 'active' : ''}`}
        >
          Detalhamento
        </NavLink>
      </nav>
    </header>
  );
};

export default IndicatorHeader;
