import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [themeColor, setThemeColor] = useState('#7c3aed');
  const [companyName, setCompanyName] = useState('VM Panel');

  const applyTheme = useCallback((color) => {
    const root = document.documentElement;
    root.style.setProperty('--primary', color);
    
    // Generate lighter/darker variants
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    root.style.setProperty('--primary-light', `rgba(${Math.min(r+60,255)}, ${Math.min(g+60,255)}, ${Math.min(b+60,255)}, 1)`);
    root.style.setProperty('--primary-dark', `rgba(${Math.max(r-40,0)}, ${Math.max(g-40,0)}, ${Math.max(b-40,0)}, 1)`);
    root.style.setProperty('--shadow-glow', `0 0 20px rgba(${r}, ${g}, ${b}, 0.15)`);
  }, []);

  useEffect(() => {
    applyTheme(themeColor);
  }, [themeColor, applyTheme]);

  const updateTheme = (color, company) => {
    if (color) {
      setThemeColor(color);
      applyTheme(color);
    }
    if (company !== undefined) setCompanyName(company || 'VM Panel');
  };

  return (
    <ThemeContext.Provider value={{ themeColor, companyName, updateTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
