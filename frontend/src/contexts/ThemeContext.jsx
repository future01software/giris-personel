import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);

const THEME_KEY = 'clear2work_theme'; // "dark" | "light"

function applyThemeClass(theme) {
  const root = document.documentElement; // <html>
  if (theme === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
}

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'dark' || saved === 'light') return saved;

  // İlk defa gelen kullanıcı: HER ZAMAN light başlasın
  return 'light';
}

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyThemeClass(theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    const root = document.documentElement;
    const strip = document.querySelector('.image-strip');

    // 1) Instantly hide the image strip so rectangles never show
    if (strip) {
      strip.style.transition = 'none';
      strip.style.opacity = '0';
    }

    // 2) Enable smooth transitions for everything else
    root.classList.add('theme-transitioning');

    // 3) Switch the theme
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

    // 4) After theme has applied, fade the strip back in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (strip) {
          strip.style.transition = 'opacity 500ms ease-in';
          strip.style.opacity = '';
        }
        // Clean up the transitioning class
        setTimeout(() => {
          root.classList.remove('theme-transitioning');
          if (strip) strip.style.transition = '';
        }, 500);
      });
    });
  };

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      setTheme,
      toggleTheme,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};
