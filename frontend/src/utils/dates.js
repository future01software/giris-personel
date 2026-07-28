const shiftDateYear = (value, amount) => {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return value;

  const targetYear = year + amount;
  const lastDayOfMonth = new Date(targetYear, month, 0).getDate();
  const safeDay = Math.min(day, lastDayOfMonth);

  return [
    String(targetYear).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(safeDay).padStart(2, '0'),
  ].join('-');
};

export const addOneYear = (value) => shiftDateYear(value, 1);
export const subtractOneYear = (value) => shiftDateYear(value, -1);
