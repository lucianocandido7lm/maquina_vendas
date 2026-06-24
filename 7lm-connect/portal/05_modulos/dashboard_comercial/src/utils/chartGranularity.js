export const ANALYSIS_VIEWS = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  YEARLY: 'yearly',
  CUMULATIVE: 'cumulative',
};

export const CUMULATIVE_GRANULARITIES = {
  BUSINESS_DAY: 'business_day',
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year',
};

const parseDate = (value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getCalendarDays = (startDate, endDate) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end || start > end) return 0;
  return Math.floor((end - start) / 86400000) + 1;
};

const isFullYear = (startDate, endDate) => {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (!start || !end) return false;
  return start.getUTCMonth() === 0
    && start.getUTCDate() === 1
    && end.getUTCMonth() === 11
    && end.getUTCDate() === 31
    && start.getUTCFullYear() === end.getUTCFullYear();
};

export const getChartGranularityPolicy = (period = {}) => {
  const businessDays = Number(period?.totalBusinessDays) || 0;
  const monthCount = Number(period?.monthCount) || Math.max(1, Math.ceil(businessDays / 21));
  const calendarDays = getCalendarDays(period?.startDate, period?.endDate) || Math.max(1, Math.ceil(businessDays * 1.4));
  const fullYear = isFullYear(period?.startDate, period?.endDate);

  let periodKind = 'short';
  if (calendarDays > 31) periodKind = 'month_plus';
  if (calendarDays > 75) periodKind = 'quarter';
  if (calendarDays > 180) periodKind = 'semester';
  if (calendarDays > 400) periodKind = 'multi_year';
  if (fullYear) periodKind = 'year';

  let defaultView = ANALYSIS_VIEWS.DAILY;
  if (calendarDays > 31) defaultView = ANALYSIS_VIEWS.WEEKLY;
  if (calendarDays > 75) defaultView = ANALYSIS_VIEWS.MONTHLY;
  if (calendarDays > 400) defaultView = ANALYSIS_VIEWS.QUARTERLY;

  let allowedViews = [ANALYSIS_VIEWS.DAILY, ANALYSIS_VIEWS.CUMULATIVE];
  if (calendarDays > 31) allowedViews = [ANALYSIS_VIEWS.WEEKLY, ANALYSIS_VIEWS.MONTHLY, ANALYSIS_VIEWS.CUMULATIVE];
  if (calendarDays > 75) allowedViews = [ANALYSIS_VIEWS.MONTHLY, ANALYSIS_VIEWS.CUMULATIVE];
  if (calendarDays > 180) allowedViews = [ANALYSIS_VIEWS.MONTHLY, ANALYSIS_VIEWS.QUARTERLY, ANALYSIS_VIEWS.CUMULATIVE];
  if (calendarDays > 400) allowedViews = [ANALYSIS_VIEWS.QUARTERLY, ANALYSIS_VIEWS.YEARLY, ANALYSIS_VIEWS.CUMULATIVE];
  if (fullYear) allowedViews = [ANALYSIS_VIEWS.MONTHLY, ANALYSIS_VIEWS.QUARTERLY, ANALYSIS_VIEWS.CUMULATIVE];

  let xAxisTickStrategy = 'dense';
  if (calendarDays > 31) xAxisTickStrategy = 'weekly';
  if (calendarDays > 75) xAxisTickStrategy = 'monthly';
  if (calendarDays > 180) xAxisTickStrategy = 'quarterly';
  if (monthCount > 18) xAxisTickStrategy = 'semester';

  return {
    businessDays,
    calendarDays,
    monthCount,
    periodKind,
    defaultView,
    allowedViews,
    defaultCumulativeGranularity: calendarDays > 400
      ? CUMULATIVE_GRANULARITIES.QUARTER
      : (calendarDays > 75 ? CUMULATIVE_GRANULARITIES.MONTH : (calendarDays > 31 ? CUMULATIVE_GRANULARITIES.WEEK : CUMULATIVE_GRANULARITIES.BUSINESS_DAY)),
    allowedCumulativeGranularities: calendarDays > 400
      ? [CUMULATIVE_GRANULARITIES.QUARTER, CUMULATIVE_GRANULARITIES.YEAR]
      : (calendarDays > 180
        ? [CUMULATIVE_GRANULARITIES.MONTH, CUMULATIVE_GRANULARITIES.QUARTER]
        : (calendarDays > 75
          ? [CUMULATIVE_GRANULARITIES.MONTH]
          : (calendarDays > 31 ? [CUMULATIVE_GRANULARITIES.WEEK, CUMULATIVE_GRANULARITIES.MONTH] : [CUMULATIVE_GRANULARITIES.BUSINESS_DAY]))),
    showDataLabels: calendarDays <= 95,
    showDots: calendarDays <= 31,
    xAxisTickStrategy,
    minTickGap: calendarDays > 180 ? 38 : (calendarDays > 75 ? 34 : (calendarDays > 31 ? 30 : 18)),
  };
};

export const getXAxisInterval = (policy = {}, dataLength = 0) => {
  if (dataLength <= 0) return 0;
  if (policy.xAxisTickStrategy === 'semester') return 5;
  if (policy.xAxisTickStrategy === 'quarterly') return 2;
  if (policy.xAxisTickStrategy === 'monthly') return 0;
  if (policy.xAxisTickStrategy === 'weekly') return Math.max(0, Math.floor(dataLength / 9));
  if (policy.xAxisTickStrategy === 'reduced') return Math.max(0, Math.floor(dataLength / 10));
  return 'preserveStartEnd';
};
