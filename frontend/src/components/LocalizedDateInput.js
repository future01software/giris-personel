import React from 'react';

const formatTurkishDate = (value) => {
  if (!value) return 'gg.aa.yyyy';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
};

const LocalizedDateInput = ({ className = '', value = '', ...props }) => (
  <span className={`relative inline-flex ${className.includes('w-full') ? 'w-full' : ''}`}>
    <input
      {...props}
      type="date"
      lang="tr-TR"
      value={value}
      className={`${className} localized-date-input`}
    />
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm ${
        props.disabled ? 'opacity-60' : ''
      } ${value ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}
    >
      {formatTurkishDate(value)}
    </span>
  </span>
);

export default LocalizedDateInput;
