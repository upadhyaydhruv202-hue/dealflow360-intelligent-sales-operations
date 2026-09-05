import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'hsk.theme';

interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredTheme(): ThemePreference {
  if (typeof window === 'undefined') {
    return 'system';
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

function resolveTheme(theme: ThemePreference): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyThemeClass(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children, defaultTheme = 'system' }: { children: ReactNode; defaultTheme?: ThemePreference }) {
  const [theme, setThemeState] = useState<ThemePreference>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(defaultTheme));

  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    const resolved = resolveTheme(stored);
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  useEffect(() => {
    if (theme !== 'system') {
      return;
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      const resolved = getSystemTheme();
      setResolvedTheme(resolved);
      applyThemeClass(resolved);
    };
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    const resolved = resolveTheme(next);
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return value;
}
