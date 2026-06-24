import Card from '../Card';

const IndicatorExecutiveSummary = ({ indicator, activeFilterLabels }) => {
  const summaryItems = [
    { label: 'Perfil', value: activeFilterLabels.perfilVisualizacao },
    { label: 'Período', value: activeFilterLabels.periodo },
    { label: 'Cidade', value: activeFilterLabels.cidade },
    { label: 'Coordenação', value: activeFilterLabels.coordenacao },
    { label: 'Gerência', value: activeFilterLabels.gerencia },
  ];

  return (
    <section className="indicator-summary-grid">
      <Card title="Resumo Executivo" subtitle={indicator.description}>
        <p className="body-sm text-variant">{indicator.executiveSummary}</p>
        <p className="body-sm indicator-summary-note">
          Estrutura simplificada para preservar o foco analítico agora e abrir espaço para camadas gráficas mais avançadas depois.
        </p>
      </Card>

      <Card title="Contexto Atual" subtitle="Filtros selecionados visíveis em toda a navegação do indicador">
        <div className="indicator-context-list">
          {summaryItems.map((item) => (
            <div key={item.label} className="indicator-context-pill">
              <span className="indicator-context-pill-label">{item.label}</span>
              <strong className="indicator-context-pill-value">{item.value}</strong>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
};

export default IndicatorExecutiveSummary;
