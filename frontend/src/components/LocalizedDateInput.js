import React from 'react';
import { CalendarDays } from 'lucide-react';

const formatTurkishDate = (value) => {
  if (!value) return 'gg.aa.yyyy';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
};

const LocalizedDateInput = ({ className = '', value = '', disabled = false, ...props }) => (
  <span
    className={`relative inline-flex h-11 w-full min-w-[170px] items-center overflow-hidden rounded-xl px-3 pr-11 text-sm transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 ${className}`}
  >
    <input
      {...props}
      type="date"
      lang="tr-TR"
      value={value}
      disabled={disabled}
      aria-label={props['aria-label'] || 'Tarih seçin'}
      className={`absolute inset-0 z-10 h-full w-full opacity-0 ${
        disabled ? 'cursor-not-allowed' : 'cursor-pointer'
      }`}
    />
    <span
      aria-hidden="true"
      className={`pointer-events-none whitespace-nowrap ${
        disabled ? 'opacity-60' : ''
      } ${value ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}
    >
      {formatTurkishDate(value)}
    </span>
    <CalendarDays
      aria-hidden="true"
      className={`pointer-events-none absolute right-3 h-4 w-4 ${
        disabled ? 'opacity-40' : 'text-slate-600 dark:text-slate-300'
      }`}
    />
  </span>
);

export default LocalizedDateInput;
