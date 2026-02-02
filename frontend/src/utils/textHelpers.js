/**
 * Türkçe karakterlere uygun büyük harf dönüşümü
 * CSS uppercase yerine kullanılır
 */
export const toTurkishUpperCase = (text) => {
  if (!text) return '';
  
  const trMap = {
    'i': 'İ',
    'ı': 'I',
    'ş': 'Ş',
    'ğ': 'Ğ',
    'ü': 'Ü',
    'ö': 'Ö',
    'ç': 'Ç',
  };
  
  return text
    .split('')
    .map(char => trMap[char] || char.toUpperCase())
    .join('');
};

/**
 * Türkçe karakterlere uygun küçük harf dönüşümü
 */
export const toTurkishLowerCase = (text) => {
  if (!text) return '';
  
  const trMap = {
    'İ': 'i',
    'I': 'ı',
    'Ş': 'ş',
    'Ğ': 'ğ',
    'Ü': 'ü',
    'Ö': 'ö',
    'Ç': 'ç',
  };
  
  return text
    .split('')
    .map(char => trMap[char] || char.toLowerCase())
    .join('');
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
