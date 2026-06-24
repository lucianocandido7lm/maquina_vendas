const isBusinessDay = (date) => {
  const weekday = date.getUTCDay();
  return weekday !== 0 && weekday !== 6;
};

export const parseDate = (value) => new Date(`${value}T00:00:00Z`);

export const countBusinessDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  if (start > end) return 0;
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    if (isBusinessDay(cursor)) {
      count += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
};

export const getBusinessDayRange = (startDate, endDate) => {
  if (!startDate || !endDate) return [];
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (start > end) return [];
  const days = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    if (isBusinessDay(cursor)) {
      days.push(cursor.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
};
