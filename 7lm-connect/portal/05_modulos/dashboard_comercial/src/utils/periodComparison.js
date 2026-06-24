const shiftDate = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
};

export const getComparisonRange = (startDate, endDate, rule) => {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const rangeDays = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;

  switch (rule) {
    case 'ontem': {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      return { start: yesterdayStr, end: yesterdayStr };
    }
    case 'mes_anterior': {
      const dS = new Date(start);
      dS.setUTCMonth(dS.getUTCMonth() - 1);
      const dE = new Date(end);
      dE.setUTCMonth(dE.getUTCMonth() - 1);
      const isWholeMonth = start.getUTCDate() === 1 &&
        (new Date(start.getUTCFullYear(), start.getUTCMonth() + 1, 0).getUTCDate() === end.getUTCDate());
      if (isWholeMonth) {
        const prevStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
        const prevEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 0));
        return { start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] };
      }
      return { start: dS.toISOString().split('T')[0], end: dE.toISOString().split('T')[0] };
    }
    case 'trimestre_anterior': {
      const dS = new Date(start);
      dS.setUTCMonth(dS.getUTCMonth() - 3);
      const dE = new Date(end);
      dE.setUTCMonth(dE.getUTCMonth() - 3);
      const isWholeQuarter = start.getUTCDate() === 1 && (start.getUTCMonth() % 3 === 0) &&
        (new Date(start.getUTCFullYear(), start.getUTCMonth() + 3, 0).getUTCDate() === end.getUTCDate());
      if (isWholeQuarter) {
        const prevStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 3, 1));
        const prevEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 0));
        return { start: prevStart.toISOString().split('T')[0], end: prevEnd.toISOString().split('T')[0] };
      }
      return { start: dS.toISOString().split('T')[0], end: dE.toISOString().split('T')[0] };
    }
    case 'ano_anterior': {
      const dS = new Date(start);
      dS.setUTCFullYear(dS.getUTCFullYear() - 1);
      const dE = new Date(end);
      dE.setUTCFullYear(dE.getUTCFullYear() - 1);
      const isWholeYear = start.getUTCDate() === 1 && start.getUTCMonth() === 0 &&
        end.getUTCDate() === 31 && end.getUTCMonth() === 11;
      if (isWholeYear) {
        const prevYear = start.getUTCFullYear() - 1;
        return { start: `${prevYear}-01-01`, end: `${prevYear}-12-31` };
      }
      return { start: dS.toISOString().split('T')[0], end: dE.toISOString().split('T')[0] };
    }
    case 'anterior':
    default:
      return {
        start: shiftDate(startDate, -rangeDays),
        end: shiftDate(startDate, -1),
      };
  }
};
