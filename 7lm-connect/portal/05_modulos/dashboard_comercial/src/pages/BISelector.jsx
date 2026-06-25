import { BarChart3, BookmarkCheck, Funnel, Gauge, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import './BISelector.css';

const BI_OPTIONS = [
  {
    title: 'Indicadores Gerais',
    description: 'Performance comercial consolidada',
    to: '/geral',
    icon: Gauge,
    stats: ['Leads', 'Reservas', 'Repasses', 'IPC'],
  },
  {
    title: 'BI de Reservas',
    description: 'Reservas, repasses e metas',
    to: '/reservas',
    icon: BookmarkCheck,
    stats: ['Situações', 'SLA', 'Metas', 'Tabela'],
  },
  {
    title: 'Funil Comercial',
    description: 'Movimentações, detalhe e metas em cascata',
    to: '/funil',
    icon: Funnel,
    stats: ['9 etapas', 'Drill-down', 'Auditoria', 'Metas'],
  },
  {
    title: 'Análise de Corretor',
    description: 'Consolidado e diário por corretor',
    to: '/corretores',
    icon: UsersRound,
    stats: ['Produção', 'Hierarquia', 'Diário', 'Ranking'],
  },
];

const BISelector = () => {
  return (
    <div className="bi-selector">
      <header className="bi-selector-header">
        <div className="bi-selector-title">
          <BarChart3 size={22} />
          <div>
            <h2 className="headline-sm">Dashboard Comercial</h2>
            <p className="body-sm text-variant">Selecione uma visão para continuar.</p>
          </div>
        </div>
      </header>

      <section className="bi-selector-grid" aria-label="Visões do Dashboard Comercial">
        {BI_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <Link key={option.to} to={option.to} className="bi-selector-card">
              <div className="bi-selector-card-top">
                <span className="bi-selector-icon">
                  <Icon size={22} />
                </span>
                <span className="bi-selector-open">Abrir</span>
              </div>
              <div>
                <h3>{option.title}</h3>
                <p>{option.description}</p>
              </div>
              <div className="bi-selector-tags">
                {option.stats.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
};

export default BISelector;
