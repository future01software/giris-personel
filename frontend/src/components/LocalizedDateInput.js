import React from 'react';

const formatTurkishDate = (value) => {
  if (!value) return 'gg.aa.yyyy';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
};

const LocalizedDateInput = ({ className = '', value = '', ...props }) => (
  <span className="relative inline-flex w-full min-w-[170px]">
    <input
      {...props}
      type="date"
      lang="tr-TR"
      value={value}
      className={`localized-date-input h-11 w-full min-w-0 rounded-xl px-3 pr-11 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 ${className}`}
    />
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-y-0 left-3 right-11 flex items-center whitespace-nowrap text-sm ${
        props.disabled ? 'opacity-60' : ''
      } ${value ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}
    >
      {formatTurkishDate(value)}
    </span>
  </span>
);

export default LocalizedDateInput;
