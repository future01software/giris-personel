import React from 'react';
import { useTranslation } from 'react-i18next';

const Headline = ({ i18nKey, children, className = '' }) => {
  const { t, i18n } = useTranslation();

  const text = i18nKey ? t(i18nKey) : (children ?? '');

  // 🔥 TÜRKÇE SAFE UPPERCASE
  const displayText =
    i18n.language === 'tr'
      ? String(text).toLocaleUpperCase('tr-TR')
      : String(text).toUpperCase();

  return (
    <h1 className={`text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight ${className}`}>
      {displayText}
    </h1>
  );
};

export default Headline;
