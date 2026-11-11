import { useEffect, useMemo, useState } from 'react';
import { ThemeContext, THEME_STORAGE_KEY } from './themeContextInstance';

const readStored = () => {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  } catch {
    return 'system';
  }
};

const systemPrefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;

const applyTheme = (dark) => {
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.colorScheme = dark ? 'dark' : 'light';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0F0F10' : '#F9FAFB');
};

export default function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readStored);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Ikuti perubahan preferensi OS saat mode "system"
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event) => setSystemDark(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isDark = theme === 'dark' || (theme === 'system' && systemDark);

  useEffect(() => {
    applyTheme(isDark);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* storage tidak tersedia (mode privat) — abaikan */
    }
  }, [theme, isDark]);

  const value = useMemo(
    () => ({
      theme,
      isDark,
      setTheme,
      toggleTheme: () => setTheme(isDark ? 'light' : 'dark'),
    }),
    [theme, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
