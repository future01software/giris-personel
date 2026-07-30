import React, { useRef } from 'react';
import { CalendarDays } from 'lucide-react';

const formatTurkishDate = (value) => {
  if (!value) return 'gg.aa.yyyy';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}.${month}.${year}` : value;
};

const LocalizedDateInput = ({
  className = '',
  value = '',
  disabled = false,
  'aria-label': ariaLabel = 'Tarih seçin',
  ...props
}) => {
  const inputRef = useRef(null);

  const openPicker = () => {
    if (disabled || !inputRef.current) return;

    inputRef.current.focus({ preventScroll: true });
    if (typeof inputRef.current.showPicker === 'function') {
      try {
        inputRef.current.showPicker();
        return;
      } catch {
        // Older mobile browsers can reject showPicker; fall back to a native click.
      }
    }
    inputRef.current.click();
  };

  return (
    <span className="relative block w-full min-w-[170px]">
      <input
        {...props}
        ref={inputRef}
        type="date"
        lang="tr-TR"
        value={value}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="pointer-events-none absolute h-px w-px opacity-0"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={openPicker}
        aria-label={ariaLabel}
        className={`flex h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <span
          className={`min-w-0 truncate ${
            value ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          {formatTurkishDate(value)}
        </span>
        <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          <CalendarDays aria-hidden="true" className="h-[18px] w-[18px]" />
        </span>
      </button>
    </span>
  );
};

export default LocalizedDateInput;
