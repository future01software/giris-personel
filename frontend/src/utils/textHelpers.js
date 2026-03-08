/**
 * Türkçe karakterlere uygun büyük harf dönüşümü
 * CSS uppercase yerine kullanılır
 */
export const toTurkishUpperCase = (text) => {
  if (!text) return '';
  return text.toLocaleUpperCase('tr-TR');
};

/**
 * Türkçe karakterlere uygun küçük harf dönüşümü
 */
export const toTurkishLowerCase = (text) => {
  if (!text) return '';
  return text.toLocaleLowerCase('tr-TR');
};

/**
 * İlk harfi büyük, geri kalanı küçük (Türkçe uyumlu)
 */
export const toTurkishCapitalize = (text) => {
  if (!text) return '';

  const firstChar = text.charAt(0);
  const restOfText = text.slice(1);

  return toTurkishUpperCase(firstChar) + toTurkishLowerCase(restOfText);
};
