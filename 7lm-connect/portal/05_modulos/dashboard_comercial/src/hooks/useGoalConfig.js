/**
 * useGoalConfig
 *
 * Centralised hook for goal management.
 *  - Loads goals from the API (with localStorage fallback)
 *  - Exposes getGoalForKpi(kpiId, filters) — returns the most specific goal for the
 *    current filter context (hierarchy-aware: gerencia > coordenacao > all)
 *  - Exposes computeProratedTarget() for business-day-aware goal proration
 *  - Exposes saveGoal() / refreshGoals()
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { countBusinessDays } from '../utils/dateUtils';

const GOALS_LS_KEY = 'commercial-dashboard:goals-v2';

// ── LocalStorage helpers ──────────────────────────────────────────────────────
const lsLoad = () => {
  try {
    const raw = window.localStorage?.getItem(GOALS_LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const lsSave = (goals) => {
  try {
    window.localStorage?.setItem(GOALS_LS_KEY, JSON.stringify(goals));
  } catch { /* noop */ }
};

// ── Hierarchy matching ────────────────────────────────────────────────────────
/**
 * Score a goal entry against active filters.
 * Higher score = more specific match.
 * Returns -1 if the entry is incompatible with the current filters.
 */
const scoreGoal = (goal, filters) => {
  if (!goal) return -1;

  const { hierarchy_level = 'all', hierarchy_value = '' } = goal;

  if (hierarchy_level === 'all') return 0;

  const activeValues = filters?.[hierarchy_level] ?? [];
  const activeArr = Array.isArray(activeValues) ? activeValues : [activeValues];

  if (activeArr.length === 0) return 0; // filter not set — treat as global

  if (hierarchy_value && !activeArr.includes(hierarchy_value)) return -1; // incompatible

  const levelScore = { gerencia: 3, coordenacao: 2, corretor: 4, cidade: 1, imobiliaria: 2, all: 0 };
  return levelScore[hierarchy_level] ?? 0;
};

// ── Business-day proration ────────────────────────────────────────────────────

/**
 * Given a monthly goal value, prorate it to the analysis period.
 * Uses business days for accuracy.
 *
 * @param {number} monthlyGoal   - The monthly (parent) goal value
 * @param {string} periodStart   - YYYY-MM-DD
 * @param {string} periodEnd     - YYYY-MM-DD
 * @param {string} monthStart    - YYYY-MM-DD (first day of the reference month)
 * @param {string} monthEnd      - YYYY-MM-DD (last day of the reference month)
 * @returns {number}
 */
export const computeProratedTarget = (
  monthlyGoal,
  periodStart,
  periodEnd,
  monthStart,
  monthEnd,
) => {
  if (monthlyGoal == null || !periodStart || !periodEnd) return null;

  const periodBd = countBusinessDays(periodStart, periodEnd) || 1;
  const monthBd = countBusinessDays(monthStart, monthEnd) || 21;

  return Number(((monthlyGoal / monthBd) * periodBd).toFixed(2));
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useGoalConfig = () => {
  const [goals, setGoals] = useState(() => lsLoad());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // ── Fetch from API (with localStorage fallback) ───────────────────────────
  const refreshGoals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/v1/dashboard/goals');
      if (!response.ok) throw new Error(`Goals API ${response.status}`);
      const data = await response.json();
      const normalized = Array.isArray(data) ? data : [];
      setGoals(normalized);
      lsSave(normalized);
    } catch (err) {
      // Fall back to whatever was persisted locally
      const cached = lsLoad();
      if (cached.length) {
        setGoals(cached);
      }
      setError(err?.message ?? 'Erro ao carregar metas');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshGoals();
  }, [refreshGoals]);

  // ── Save a single goal ────────────────────────────────────────────────────
  const saveGoal = useCallback(async (goalData) => {
    /**
     * goalData shape:
     * {
     *   kpi_id: string,
     *   goal_value: number,
     *   period_type: 'monthly' | 'weekly' | 'daily',
     *   hierarchy_level: 'all' | 'gerencia' | 'coordenacao' | 'corretor' | 'cidade',
     *   hierarchy_value?: string,
     *   target_type: 'absolute' | 'ratio_limit' | 'days_max',
     *   business_days_aware: boolean,
     * }
     */
    const optimisticId = goalData.id ?? `local-${goalData.kpi_id}-${Date.now()}`;
    const entry = { ...goalData, id: optimisticId };

    // Optimistic update
    setGoals((prev) => {
      const idx = prev.findIndex(
        (g) =>
          g.kpi_id === entry.kpi_id &&
          g.hierarchy_level === entry.hierarchy_level &&
          g.hierarchy_value === entry.hierarchy_value,
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = entry;
        lsSave(next);
        return next;
      }
      const next = [...prev, entry];
      lsSave(next);
      return next;
    });

    // Persist to backend
    try {
      const response = await fetch(`/api/v1/dashboard/goals/${entry.kpi_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalValue: entry.goal_value,
          targetType: entry.target_type,
          periodType: entry.period_type,
          hierarchyLevel: entry.hierarchy_level,
          hierarchyValue: entry.hierarchy_value,
          businessDaysAware: entry.business_days_aware,
        }),
      });
      if (response.ok) {
        const updated = await response.json();
        setGoals((prev) => {
          const idx = prev.findIndex((g) => g.id === optimisticId);
          if (idx < 0) return prev;
          const next = [...prev];
          next[idx] = updated;
          lsSave(next);
          return next;
        });
      }
    } catch {
      // Optimistic update stays — backend sync silently fails but localStorage keeps it
    }
  }, []);

  // ── Lookup helpers ────────────────────────────────────────────────────────

  /**
   * Return the goal config for a KPI given the active filters context.
   * Picks the most-specific matching goal (highest hierarchy score).
   */
  const getGoalForKpi = useCallback(
    (kpiId, filters) => {
      const candidates = goals.filter((g) => g.kpi_id === kpiId);
      if (!candidates.length) return null;

      let best = null;
      let bestScore = -1;

      for (const goal of candidates) {
        const score = scoreGoal(goal, filters);
        if (score >= 0 && score > bestScore) {
          best = goal;
          bestScore = score;
        }
      }

      return best;
    },
    [goals],
  );

  /** Indexed for O(1) lookup: kpiId → best-matching goal entry */
  const goalsByKpi = useMemo(
    () =>
      goals.reduce((acc, g) => {
        if (!acc[g.kpi_id]) acc[g.kpi_id] = g;
        return acc;
      }, {}),
    [goals],
  );

  return {
    goals,
    goalsByKpi,
    isLoading,
    error,
    refreshGoals,
    saveGoal,
    getGoalForKpi,
    computeProratedTarget,
  };
};
