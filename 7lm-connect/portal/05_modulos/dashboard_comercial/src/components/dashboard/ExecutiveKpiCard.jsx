import { memo, useMemo } from 'react';
import { ResponsiveContainer, Bar, YAxis, XAxis, Tooltip, CartesianGrid, ComposedChart, Line } from 'recharts';
import Card from '../Card';
import KpiSkeletonCard from './KpiSkeletonCard';
import { useNavigate } from 'react-router-dom';
import './ExecutiveDashboard.css';

const formatValue = (value, unit = '') => {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const numericValue = Number(value);
  if (unit === 'ratio') {
    return numericValue.toFixed(2);
  }
  const suffix = unit && unit !== 'total' && unit !== 'un' && unit !== 'ratio' ? ` ${unit}` : '';
  if (!Number.isInteger(numericValue)) {
    return `${numericValue.toFixed(1)}${suffix}`;
  }
  return `${new Intl.NumberFormat('pt-BR').format(numericValue)}${suffix}`;
};

const KpiCardTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const dataLabel = payload[0]?.name || "Data";
  const dataValue = payload[0]?.value || 0;

  return (
    <div style={{
      background: 'rgba(83, 147, 239, 0.95)',
      padding: '0.5rem',
      borderRadius: '6px',
      color: '#fff',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
    }}>
      <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>{label}</div>
      <div style={{ fontSize: '0.8rem' }}>
        <strong>{dataLabel}:</strong> {new Intl.NumberFormat('en-US').format(dataValue)}
      </div>
    </div>
  );
};

const STATUS_LABELS = { good: 'Acima', attention: 'Atenção', risk: 'Risco' };

const ExecutiveKpiCard = ({ kpi, goalOverride, dailySeries = [], isExpanded = false, onToggleExpand, isLoading = false }) => {
  const isLargeScreen = typeof window === 'undefined' ? true : window.innerWidth > 600;
  const lowerIsBetter = Boolean(kpi.lowerIsBetter);
  const hasMomentum = Number.isFinite(Number(kpi.mom));
  const momentumValue = Number(kpi.mom ?? 0);
  const isFavorableMomentum = hasMomentum ? (lowerIsBetter ? momentumValue <= 0 : momentumValue >= 0) : false;
  const isMomentumIncrease = momentumValue >= 0;
  const kpiTitle = kpi.title ?? kpi.label ?? kpi.id;
  const statusKey = STATUS_LABELS[kpi.status] ? kpi.status : 'attention';
  const navigate = useNavigate();
  const monthlyTarget = goalOverride ?? kpi.monthlyTarget ?? kpi.target ?? 0;
  const periodTarget = kpi.target ?? monthlyTarget;
  const hasCustomGoal = goalOverride != null;
  const recentSeries = useMemo(() => (
    Array.isArray(dailySeries) ? dailySeries.slice(-5) : []
  ), [dailySeries]);
  const showForecast = kpi.forecastVisible !== false;
  const forecastValue = showForecast ? kpi.forecast : kpi.actual;
  const isSlaKpi = kpi.id === 'sla_f' || kpi.id === 'sla_r';
  const forecastLabels = {
    short: showForecast ? 'Previsto' : 'Fechamento',
    long: showForecast ? 'Previsto até o fim do mês' : 'Fechamento do mês'
  };
  const baseGoalLabel = kpi.targetType === 'ratio_limit'
    ? `${formatValue(monthlyTarget, '%')} sobre vendas (${formatValue(kpi.qualityBaseValue ?? 0, 'total')} no período)`
    : formatValue(monthlyTarget, kpi.unit === 'ratio' ? '' : kpi.unit);

  const isRatioVariant = kpi.unit === 'ratio';
  const ratioForecastNote = kpi.ratioNote ?? (kpi.isIpc ? 'Base mensal do período' : 'Repasses / base mensal acumulada');
  const ratioNumeratorLabel = kpi.numeratorLabel || 'Repasses';
  const ratioDenominatorLabel = kpi.denominatorLabel || 'Base mensal';
  const ratioDenominatorSecondaryLabel = kpi.denominatorSecondaryLabel || 'Base Sec.';

  const STATUS_CHART_COLORS = { 
    default: '#5393ef'  // Blue color for all bars
  };
  const activeColor = STATUS_CHART_COLORS.default;

  if (isLoading) {
    return <KpiSkeletonCard />;
  }

  return (
    <Card
      className={`executive-kpi-card status-${kpi.status} ${isExpanded ? 'is-active' : ''}`}
      ghostBorder={false}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        if (e.shiftKey) {
          navigate(`/indicadores/${kpi.id}/dashboard`);
          return;
        }
        onToggleExpand();
      }}
    >
      <div className={`executive-kpi-status-bar bg-${statusKey}`} />

      <div className="executive-kpi-header">
        <span className="executive-kpi-title">{kpiTitle}</span>
        <span className={`executive-kpi-status-badge badge-${statusKey}`}>
          {STATUS_LABELS[statusKey]}
        </span>
      </div>

      <div className="executive-kpi-hero">
        <div className="executive-kpi-value-block">
          <div className={`executive-kpi-trend ${isFavorableMomentum ? 'is-positive' : 'is-negative'}`}>
            <span style={{ fontSize: '1.1em', marginRight: '2px' }}>{hasMomentum ? (isMomentumIncrease ? '↑' : '↓') : '•'}</span>
            <span>{hasMomentum ? `${Math.abs(kpi.mom ?? 0).toFixed(1)}%` : 'Sem base comparativa'}</span>
            <span
              style={{
                opacity: 0.5, fontWeight: 500, marginLeft: '4px',
                maxWidth: '10rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', verticalAlign: 'bottom',
              }}
              title={kpi.previousPeriodLabel ? `Compara o período filtrado com ${kpi.previousPeriodLabel}` : 'Compara com o período anterior de mesma duração'}
            >
              {hasMomentum ? `vs ${formatValue(kpi.prevValue, kpi.unit)} ant.` : ''}
            </span>
          </div>
          <h3 className={`executive-kpi-value value-${statusKey}`}>{formatValue(kpi.actual ?? 0, kpi.unit)}</h3>
          <p className="executive-kpi-forecast-note">
            {isRatioVariant
              ? ratioForecastNote
              : (showForecast
              ? `Forecast ${lowerIsBetter
                ? ((kpi.forecast ?? 0) <= (periodTarget ?? 0) ? 'em rota' : 'acima do limite')
                : ((kpi.forecast ?? 0) >= (periodTarget ?? 0) ? 'em rota' : 'abaixo')}`
              : `Mês concluído`)}
          </p>
        </div>

        {isRatioVariant ? (
          <div className="executive-kpi-ratio-content">
            {kpi.calcDescription && (
              <div className="executive-kpi-formula-box">
                <span className="executive-kpi-formula-label">Fórmula do Indicador</span>
                <p className="executive-kpi-formula-text">{kpi.calcDescription}</p>
              </div>
            )}
            <div className="executive-kpi-ratio-breakdown">
              <div className="executive-kpi-ratio-item">
                <span className="ratio-value-label">{ratioNumeratorLabel}</span>
                <span className="ratio-value-num">{formatValue(kpi.numerator, 'total')}</span>
              </div>
              <span style={{ opacity: 0.3, fontSize: '1.2rem', fontWeight: 300 }}>/</span>
               <div className="executive-kpi-ratio-item">
                 <span className="ratio-value-label">{ratioDenominatorLabel}</span>
                 <span className="ratio-value-num">{formatValue(kpi.denominator, 'total')}</span>
               </div>
               {kpi.denominatorSecondary != null && (
                 <>
                   <span style={{ opacity: 0.3, fontSize: '1.2rem', fontWeight: 300 }}>&</span>
                   <div className="executive-kpi-ratio-item">
                     <span className="ratio-value-label">{ratioDenominatorSecondaryLabel}</span>
                     <span className="ratio-value-num">{formatValue(kpi.denominatorSecondary, 'total')}</span>
                   </div>
                 </>
               )}
            </div>
          </div>
        ) : (
          <div className="executive-kpi-chart-wrapper" aria-hidden="true">
            {recentSeries.length ? (
              <div className="executive-kpi-chart">
                <span className="executive-kpi-chart-label">Tendência (5 dias)</span>
                <div style={{ width: '100%', height: '100px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={recentSeries} margin={{ top: 5, right: 0, left: 0, bottom: 20 }}>
                      <defs>
                        <linearGradient id={`gradBar-${kpi.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={activeColor} stopOpacity={1} />
                          <stop offset="100%" stopColor={activeColor} stopOpacity={0.3} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156,168,184,0.05)" />
                      <XAxis 
                        dataKey="label" 
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                        minTickGap={14}
                        tick={{ fontSize: '0.6rem', fill: 'var(--on-surface-variant)', fontWeight: 500, dy: 6, opacity: 0.7 }}
                      />
                      <YAxis 
                        orientation="right"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: '0.55rem', fill: 'var(--on-surface-variant)', opacity: 0.4 }}
                        width={22}
                        domain={[0, 'auto']}
                      />
                      {isLargeScreen && (
                        <Tooltip cursor={{ fill: 'rgba(255,255,255,0.02)' }} content={<KpiCardTooltip unit={kpi.unit} />} />
                      )}
                      {isSlaKpi ? (
                        <Line
                          type="monotone"
                          dataKey="value"
                          name="Realizado"
                          stroke={activeColor}
                          strokeWidth={2.5}
                          dot={{ r: 2.2, fill: activeColor, strokeWidth: 0 }}
                          isAnimationActive={false}
                          connectNulls={false}
                        />
                      ) : (
                        <Bar
                          dataKey="value"
                          name="Realizado"
                          fill={`url(#gradBar-${kpi.id})`}
                          radius={[4, 4, 0, 0]}
                          isAnimationActive={false}
                          barSize={12}
                        />
                      )}
                      <Line
                        type="stepAfter"
                        dataKey="target"
                        name="Meta Diária"
                        stroke="#9ca8b8"
                        strokeWidth={1.5}
                        strokeDasharray="3 3"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="executive-kpi-chart-placeholder">N/D</div>
            )}
          </div>
        )}
      </div>

      <div className="executive-kpi-footer">
        {kpi.isIpc ? (
          <>
            <div className="executive-kpi-footer-item">
              <span className="footer-label">IPC Imobiliária</span>
              <span className="footer-value">{formatValue(kpi.ipcImobiliaria, kpi.unit)}</span>
            </div>
            <div className="executive-kpi-footer-item">
              <span className="footer-label">Meta IPC</span>
              <span className="footer-value">{formatValue(periodTarget, kpi.unit)}</span>
            </div>
            <div className="executive-kpi-footer-item">
              <span className="footer-label">Atingimento</span>
              <span className="footer-value">{Number(kpi.attainment ?? 0).toFixed(1)}%</span>
            </div>
          </>
        ) : (
          <>
            <div className="executive-kpi-footer-item">
              <span className="footer-label">Meta do Período</span>
              <span className="footer-value">{formatValue(periodTarget, kpi.unit)}</span>
            </div>
            {!kpi.hideForecast && (
              <div className="executive-kpi-footer-item">
                <span className="footer-label">{forecastLabels.short}</span>
                <span className="footer-value">{formatValue(forecastValue, kpi.unit)}</span>
              </div>
            )}
            <div className="executive-kpi-footer-item">
              <span className="footer-label" title={kpi.avgPeriodLabel ? `Média no período ${kpi.avgPeriodLabel} usando ${kpi.avgBusinessDaysUsed ?? 0} dias úteis` : 'Média por dia útil no período filtrado'}>Média útil/dia</span>
              <span className="footer-value">{formatValue(kpi.avgPerBusinessDay, kpi.unit)}</span>
            </div>
          </>
        )}
      </div>

      <div className="executive-kpi-footer-actions">
        {hasCustomGoal && (
          <span className="executive-kpi-config-indicator">
            Meta Personalizada
          </span>
        )}
        <span className="executive-kpi-base-goal">Base mensal: {baseGoalLabel}</span>
      </div>
    </Card>
  );
};

/**
 * Custom comparator avoids re-renders when parent re-renders but this card's
 * data hasn't actually changed. Compares only the props that affect output.
 */
const arePropsEqual = (prev, next) => {
  if (prev.isLoading !== next.isLoading) return false;
  if (prev.isExpanded !== next.isExpanded) return false;
  if (prev.goalOverride !== next.goalOverride) return false;
  if (prev.dailySeries !== next.dailySeries) return false;

  const pk = prev.kpi;
  const nk = next.kpi;
  if (!pk || !nk) return pk === nk;
  if (pk.actual !== nk.actual) return false;
  if (pk.status !== nk.status) return false;
  if (pk.target !== nk.target) return false;
  if (pk.mom !== nk.mom) return false;
  if (pk.forecast !== nk.forecast) return false;
  if (pk.avgPerBusinessDay !== nk.avgPerBusinessDay) return false;
  return true;
};

export default memo(ExecutiveKpiCard, arePropsEqual);
