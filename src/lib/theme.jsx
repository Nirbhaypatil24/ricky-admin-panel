import { createContext, useContext } from 'react';
import { useTheme } from './hooks';

const ThemeContext = createContext({ theme: 'system', resolved: 'light', setTheme: () => {} });

export function ThemeProvider({ children }) {
  const value = useTheme();
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useThemeContext = () => useContext(ThemeContext);
