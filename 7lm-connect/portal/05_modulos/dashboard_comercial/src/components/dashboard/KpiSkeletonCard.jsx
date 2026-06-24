import { memo } from 'react';
import Card from '../Card';
import './ExecutiveDashboard.css';

/**
 * Lightweight skeleton placeholder for KPI cards.
 * Used during initial load and during filter-triggered refetches.
 *
 * The shimmer animation is handled via the `skeleton-loading` CSS class
 * already defined in ExecutiveDashboard.css.
 */
const SkeletonBar = ({ width = '60%', height = '1rem', style = {} }) => (
  <div
    className="skeleton-bar"
    style={{
      width,
      height,
      borderRadius: '4px',
      background: 'var(--surface-color-variant, #e5e7eb)',
      animation: 'shimmer 1.6s ease-in-out infinite',
      ...style,
    }}
  />
);

const KpiSkeletonCard = () => (
  <Card className="executive-kpi-card skeleton-loading" ghostBorder={false}>
    <div
      className="executive-kpi-status-bar"
      style={{ background: 'var(--surface-color-variant, #e5e7eb)' }}
    />

    {/* Header */}
    <div className="executive-kpi-header" style={{ gap: '0.5rem' }}>
      <SkeletonBar width="40%" height="0.85rem" />
      <SkeletonBar width="3rem" height="1rem" style={{ borderRadius: '6px' }} />
    </div>

    {/* Hero value area */}
    <div className="executive-kpi-hero" style={{ gap: '1rem' }}>
      <div className="executive-kpi-value-block" style={{ gap: '0.4rem' }}>
        <SkeletonBar width="35%" height="0.7rem" />
        <SkeletonBar width="55%" height="1.8rem" />
        <SkeletonBar width="50%" height="0.65rem" />
      </div>
      <div className="executive-kpi-chart-wrapper" aria-hidden="true">
        <SkeletonBar width="100%" height="100px" style={{ borderRadius: '6px' }} />
      </div>
    </div>

    {/* Footer */}
    <div className="executive-kpi-footer">
      <div className="executive-kpi-footer-item" style={{ gap: '0.25rem' }}>
        <SkeletonBar width="4rem" height="0.55rem" />
        <SkeletonBar width="3rem" height="0.75rem" />
      </div>
      <div className="executive-kpi-footer-item" style={{ gap: '0.25rem' }}>
        <SkeletonBar width="4rem" height="0.55rem" />
        <SkeletonBar width="3rem" height="0.75rem" />
      </div>
      <div className="executive-kpi-footer-item" style={{ gap: '0.25rem' }}>
        <SkeletonBar width="4rem" height="0.55rem" />
        <SkeletonBar width="3rem" height="0.75rem" />
      </div>
    </div>
  </Card>
);

export default memo(KpiSkeletonCard);
