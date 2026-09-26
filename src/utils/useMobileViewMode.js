import { useState, useEffect } from 'react';

const STORAGE_KEY = 'soccer_mobile_view_mode'; // 'card' | 'table'

export function useMobileViewMode(defaultMode = 'table') {
  const [mode, setMode] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === 'table' || saved === 'card' ? saved : defaultMode;
    } catch {
      return defaultMode;
    }
  });

  const updateMode = (newMode) => {
    const validMode = newMode === 'table' ? 'table' : 'card';
    setMode(validMode);
    try {
      localStorage.setItem(STORAGE_KEY, validMode);
      window.dispatchEvent(new CustomEvent('mobile_view_mode_changed', { detail: validMode }));
    } catch {}
  };

  useEffect(() => {
    const handleSync = (e) => {
      if (e.detail && (e.detail === 'card' || e.detail === 'table')) {
        setMode(e.detail);
      }
    };
    window.addEventListener('mobile_view_mode_changed', handleSync);
    return () => window.removeEventListener('mobile_view_mode_changed', handleSync);
  }, []);

  return [mode, updateMode];
}
