import { useState, useMemo, useCallback, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Target, Save, RefreshCw, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { useGoalConfig, computeProratedTarget } from '../hooks/useGoalConfig';
import { useCommercialFilters } from '../hooks/useCommercialFilters';
import { countBusinessDays } from '../utils/dateUtils';
import './GoalSettings.css';

// ── Zod Schema ────────────────────────────────────────────────────────────────
const GoalRowSchema = z.object({
  kpi_id: z.string(),
  goal_value: z.coerce.number().min(0, 'Meta deve ser ≥ 0'),
  period_type: z.enum(['monthly', 'weekly', 'daily']),
  hierarchy_level: z.enum(['all', 'gerencia', 'coordenacao', 'corretor', 'cidade']),
  hierarchy_value: z.string().optional().default(''),
  target_type: z.enum(['absolute', 'ratio_limit', 'days_max']),
  business_days_aware: z.boolean().default(true),
});

const GoalFormSchema = z.object({
  goals: z.array(GoalRowSchema),
});

// ── KPI Definitions ───────────────────────────────────────────────────────────
const KPI_DEFINITIONS = [
  { id: 'leads', label: 'Leads', unit: 'total', defaultType: 'absolute' },
  { id: 'visitas', label: 'Visitas', unit: 'total', defaultType: 'absolute' },
  { id: 'propostas', label: 'Prop. Aprovada / Condicionada', unit: 'total', defaultType: 'absolute' },
  { id: 'cancelamentos', label: 'Cancelamentos', unit: 'total', defaultType: 'ratio_limit' },
  { id: 'vendas', label: 'Vendas', unit: 'total', defaultType: 'absolute' },
  { id: 'distratos', label: 'Distratos', unit: 'total', defaultType: 'ratio_limit' },
  { id: 'repasses', label: 'Repasses', unit: 'total', defaultType: 'absolute' },
  { id: 'sla_f', label: 'SLA Finalização', unit: 'dias', defaultType: 'days_max' },
  { id: 'sla_r', label: 'SLA Repasse', unit: 'dias', defaultType: 'days_max' },
  { id: 'ipc', label: 'IPC', unit: 'un', defaultType: 'absolute' },
];

const HIERARCHY_OPTIONS = [
  { value: 'all', label: 'Todos (Global)' },
  { value: 'gerencia', label: 'Por Gerência' },
  { value: 'coordenacao', label: 'Por Coordenação' },
  { value: 'corretor', label: 'Por Corretor' },
  { value: 'cidade', label: 'Por Cidade' },
];

const PERIOD_OPTIONS = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'daily', label: 'Diário' },
];

const TARGET_TYPE_LABELS = {
  absolute: 'Volume Absoluto',
  ratio_limit: '% sobre Vendas (Teto)',
  days_max: 'Limite Máximo (dias)',
};


// ── Component ─────────────────────────────────────────────────────────────────
const GoalSettings = () => {
  const { goals, saveGoal, refreshGoals, isLoading: isGoalsLoading, error: goalsError } = useGoalConfig();
  const { filters, filterOptions } = useCommercialFilters();
  const [expandedRow, setExpandedRow] = useState(null);
  const [saveStatus, setSaveStatus] = useState(null);

  // ── Reference month info ────────────────────────────────────────────────
  const referenceMonth = useMemo(() => {
    const ref = filters.dataFinal ?? filters.dataInicial ?? new Date().toISOString().split('T')[0];
    const refDate = new Date(`${ref}T00:00:00Z`);
    const start = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
    const end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
    const fmt = (d) => d.toISOString().split('T')[0];
    return {
      start: fmt(start),
      end: fmt(end),
      label: start.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      businessDays: countBusinessDays(fmt(start), fmt(end)),
    };
  }, [filters.dataFinal, filters.dataInicial]);

  // Build default form values from existing goals or KPI definitions
  const defaultValues = useMemo(() => {
    return {
      goals: KPI_DEFINITIONS.map((def) => {
        const existing = goals.find((g) => g.kpi_id === def.id);
        return {
          kpi_id: def.id,
          goal_value: Number(existing?.goal_value ?? existing?.goalValue ?? 0),
          period_type: existing?.period_type ?? 'monthly',
          hierarchy_level: existing?.hierarchy_level ?? 'all',
          hierarchy_value: existing?.hierarchy_value ?? '',
          target_type: existing?.target_type ?? def.defaultType,
          business_days_aware: existing?.business_days_aware ?? true,
        };
      }),
    };
  }, [goals]);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(GoalFormSchema),
    defaultValues,
  });

  const { fields } = useFieldArray({ control, name: 'goals' });

  // Reset form when goals are reloaded from API
  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const watchedGoals = watch('goals');

  // ── Proration preview ───────────────────────────────────────────────────
  const prorationPreviews = useMemo(() => {
    return (watchedGoals ?? []).map((row) => {
      if (!row || row.target_type !== 'absolute') return null;
      const { goal_value, period_type, business_days_aware } = row;
      const monthBd = referenceMonth.businessDays || 21;
      const periodBd = countBusinessDays(filters.dataInicial, filters.dataFinal) || monthBd;

      if (period_type === 'daily') {
        return {
          daily: Number(goal_value),
          period: business_days_aware
            ? Number((goal_value * periodBd).toFixed(1))
            : Number((goal_value * 30).toFixed(1)),
          monthly: business_days_aware
            ? Number((goal_value * monthBd).toFixed(1))
            : Number((goal_value * 30).toFixed(1)),
        };
      }

      if (period_type === 'weekly') {
        const weeklyGoal = Number(goal_value);
        return {
          daily: Number((weeklyGoal / 5).toFixed(2)),
          period: Number(((weeklyGoal / 5) * periodBd).toFixed(1)),
          monthly: Number(((weeklyGoal / 5) * monthBd).toFixed(1)),
        };
      }

      // monthly
      const dailyGoal = business_days_aware
        ? (goal_value / monthBd)
        : (goal_value / 30);

      return {
        daily: Number(dailyGoal.toFixed(2)),
        period: computeProratedTarget(
          goal_value,
          filters.dataInicial,
          filters.dataFinal,
          referenceMonth.start,
          referenceMonth.end,
        ),
        monthly: Number(goal_value),
      };
    });
  }, [watchedGoals, referenceMonth, filters.dataInicial, filters.dataFinal]);

  // ── Hierarchy value options ─────────────────────────────────────────────
  const hierarchyValueOptions = useCallback(
    (level) => {
      if (level === 'all') return [];
      const raw = filterOptions?.[level];
      if (!Array.isArray(raw)) return [];
      return raw.filter((opt) => opt.value !== '__blank__');
    },
    [filterOptions],
  );

  // ── Submit ──────────────────────────────────────────────────────────────
  const onSubmit = useCallback(
    async (data) => {
      setSaveStatus('saving');
      try {
        for (const row of data.goals) {
          await saveGoal(row);
        }
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(null), 2000);
      } catch {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus(null), 3000);
      }
    },
    [saveGoal],
  );


  return (
    <div className="goal-settings">
      <header className="goal-settings-header">
        <div className="goal-settings-header-left">
          <Target size={22} />
          <div>
            <h2 className="goal-settings-title">Metas Comerciais</h2>
            <p className="goal-settings-subtitle">
              Configuração granular de metas por KPI, hierarquia e período.
              Referência: <strong>{referenceMonth.label}</strong> ({referenceMonth.businessDays} dias úteis).
            </p>
          </div>
        </div>
        <div className="goal-settings-header-actions">
          <button
            type="button"
            className="goal-btn goal-btn-secondary"
            onClick={refreshGoals}
            disabled={isGoalsLoading}
          >
            <RefreshCw size={14} className={isGoalsLoading ? 'spin' : ''} />
            Recarregar
          </button>
        </div>
      </header>

      {goalsError && (
        <div className="goal-alert goal-alert-warning">
          <Info size={14} />
          <span>Falha ao sincronizar metas da API. Usando dados locais. <em>({goalsError})</em></span>
        </div>
      )}

      <section className="goal-section-block">
        <header className="goal-section-header">
          <h3>Metas Globais (Ativo no Dashboard)</h3>
          <p>
            Esta seção segue o fluxo atual. Os cards e gráficos continuam consumindo estas metas globais.
          </p>
        </header>

        <form onSubmit={handleSubmit(onSubmit)} className="goal-form">
        {/* Table header */}
        <div className="goal-table-header">
          <span className="goal-col-kpi">KPI</span>
          <span className="goal-col-value">Meta (Pai)</span>
          <span className="goal-col-type">Tipo</span>
          <span className="goal-col-period">Período</span>
          <span className="goal-col-hierarchy">Hierarquia</span>
          <span className="goal-col-preview">Rateio →</span>
          <span className="goal-col-expand" />
        </div>

        {/* Rows */}
        {fields.map((field, index) => {
          const def = KPI_DEFINITIONS.find((d) => d.id === field.kpi_id);
          const preview = prorationPreviews[index];
          const isExpanded = expandedRow === index;
          const watchedLevel = watchedGoals?.[index]?.hierarchy_level ?? 'all';
          const watchedType = watchedGoals?.[index]?.target_type ?? 'absolute';
          const hasError = errors?.goals?.[index];

          return (
            <div key={field.id} className={`goal-row ${isExpanded ? 'is-expanded' : ''} ${hasError ? 'has-error' : ''}`}>
              {/* Main row */}
              <div className="goal-row-main">
                <span className="goal-col-kpi">
                  <span className="goal-kpi-label">{def?.label ?? field.kpi_id}</span>
                  <span className="goal-kpi-unit">{def?.unit}</span>
                </span>

                <span className="goal-col-value">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    className="goal-input"
                    {...register(`goals.${index}.goal_value`, { valueAsNumber: true })}
                  />
                  {hasError?.goal_value && (
                    <span className="goal-field-error">{hasError.goal_value.message}</span>
                  )}
                </span>

                <span className="goal-col-type">
                  <select className="goal-select" {...register(`goals.${index}.target_type`)}>
                    {Object.entries(TARGET_TYPE_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </span>

                <span className="goal-col-period">
                  <select className="goal-select" {...register(`goals.${index}.period_type`)}>
                    {PERIOD_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </span>

                <span className="goal-col-hierarchy">
                  <select className="goal-select" {...register(`goals.${index}.hierarchy_level`)}>
                    {HIERARCHY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </span>

                <span className="goal-col-preview">
                  {watchedType === 'absolute' && preview ? (
                    <span className="goal-preview-text">
                      {preview.daily}/dia · {preview.monthly}/mês
                    </span>
                  ) : watchedType === 'ratio_limit' ? (
                    <span className="goal-preview-text">% teto</span>
                  ) : watchedType === 'days_max' ? (
                    <span className="goal-preview-text">Max {watchedGoals?.[index]?.goal_value} dias</span>
                  ) : (
                    <span className="goal-preview-text">—</span>
                  )}
                </span>

                <span className="goal-col-expand">
                  <button
                    type="button"
                    className="goal-expand-btn"
                    onClick={() => setExpandedRow(isExpanded ? null : index)}
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </span>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="goal-row-detail">
                  <div className="goal-detail-grid">
                    {/* Hierarchy value selector */}
                    {watchedLevel !== 'all' && (
                      <div className="goal-detail-field">
                        <label className="goal-detail-label">
                          Valor da Hierarquia ({HIERARCHY_OPTIONS.find((o) => o.value === watchedLevel)?.label})
                        </label>
                        <select className="goal-select" {...register(`goals.${index}.hierarchy_value`)}>
                          <option value="">Todos (hierarquia global)</option>
                          {hierarchyValueOptions(watchedLevel).map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Business days toggle */}
                    <div className="goal-detail-field">
                      <label className="goal-detail-label">
                        <input
                          type="checkbox"
                          {...register(`goals.${index}.business_days_aware`)}
                          className="goal-checkbox"
                        />
                        Considerar dias úteis no rateio
                      </label>
                    </div>

                    {/* Proration breakdown */}
                    {watchedType === 'absolute' && preview && (
                      <div className="goal-detail-proration">
                        <h4 className="goal-detail-proration-title">
                          <Info size={12} /> Rateio Calculado
                        </h4>
                        <div className="goal-proration-grid">
                          <div className="goal-proration-item">
                            <span className="goal-proration-label">Meta Diária</span>
                            <span className="goal-proration-value">{preview.daily}</span>
                          </div>
                          <div className="goal-proration-item">
                            <span className="goal-proration-label">Meta Período Filtrado</span>
                            <span className="goal-proration-value">{preview.period}</span>
                          </div>
                          <div className="goal-proration-item">
                            <span className="goal-proration-label">Meta Mensal</span>
                            <span className="goal-proration-value">{preview.monthly}</span>
                          </div>
                          <div className="goal-proration-item">
                            <span className="goal-proration-label">Dias Úteis (mês)</span>
                            <span className="goal-proration-value">{referenceMonth.businessDays}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Submit bar */}
        <div className="goal-form-actions">
          <div className="goal-form-status">
            {saveStatus === 'saving' && <span className="goal-status-text">Salvando...</span>}
            {saveStatus === 'success' && <span className="goal-status-text goal-status-success">✓ Metas salvas com sucesso</span>}
            {saveStatus === 'error' && <span className="goal-status-text goal-status-error">✗ Erro ao salvar metas</span>}
          </div>
          <button
            type="submit"
            className="goal-btn goal-btn-primary"
            disabled={!isDirty && saveStatus !== null}
          >
            <Save size={14} />
            Salvar Metas
          </button>
        </div>
        </form>
      </section>

    </div>
  );
};

export default GoalSettings;
