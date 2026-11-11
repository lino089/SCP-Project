import { useContext } from 'react';
import { ThemeContext } from '../context/themeContextInstance';

export default function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme harus dipakai di dalam ThemeProvider');
  return ctx;
}
