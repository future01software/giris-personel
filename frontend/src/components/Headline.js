import React from 'react';
import { useTranslation } from 'react-i18next';

const Headline = ({ i18nKey, children, className = '' }) => {
  const { t } = useTranslation();

  const text = i18nKey ? t(i18nKey) : (children ?? '');

  // 🔥 TÜRKÇE SAFE UPPERCASE
  const displayText = String(text);

  return (
    <h1 className={`page-title ${className}`}>
      {displayText}
    </h1>
  );
};

export default Headline;
