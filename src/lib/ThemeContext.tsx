import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppTheme, applyTheme, readStoredTheme } from '../lib/theme';

interface ThemeContextType {
  theme: AppTheme;
  toggleTheme: () => void;
  setTheme: (theme: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() =>
    typeof document === 'undefined' ? 'light' : readStoredTheme()
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = (next: AppTheme) => setThemeState(next);
  const toggleTheme = () => setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: 'light' as AppTheme,
      toggleTheme: () => undefined,
      setTheme: () => undefined
    };
  }
  return ctx;
}
