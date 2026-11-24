import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';

export const ACCENT_PALETTES = {
  rose: {
    label: 'SkillForge Rose',
    pri: '#e11d48',
    priHover: '#be123c',
    priGradient: 'linear-gradient(135deg, #e11d48 0%, #db2777 100%)',
    priSubtle: '#fff1f5',
    priShadow: 'rgba(225, 29, 72, 0.28)',
    accent: '#f43f5e',
  },
  indigo: {
    label: 'Electric Indigo',
    pri: '#4f46e5',
    priHover: '#4338ca',
    priGradient: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
    priSubtle: '#eef2ff',
    priShadow: 'rgba(79, 70, 229, 0.28)',
    accent: '#6366f1',
  },
  emerald: {
    label: 'Emerald Green',
    pri: '#059669',
    priHover: '#047857',
    priGradient: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
    priSubtle: '#ecfdf5',
    priShadow: 'rgba(5, 150, 105, 0.28)',
    accent: '#10b981',
  },
  violet: {
    label: 'Deep Violet',
    pri: '#7c3aed',
    priHover: '#6d28d9',
    priGradient: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
    priSubtle: '#f5f3ff',
    priShadow: 'rgba(124, 58, 237, 0.28)',
    accent: '#8b5cf6',
  },
  amber: {
    label: 'Warm Amber',
    pri: '#d97706',
    priHover: '#b45309',
    priGradient: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)',
    priSubtle: '#fffbeb',
    priShadow: 'rgba(217, 119, 6, 0.28)',
    accent: '#f59e0b',
  },
};

export const DEFAULT_SETTINGS = {
  profile: {
    displayName: '',
    avatarUrl: '',
    targetRole: 'Full Stack Developer',
    college: '',
    bio: '',
  },
  appearance: {
    theme: 'system', // 'light' | 'dark' | 'system'
    accentColor: 'rose', // 'rose' | 'indigo' | 'emerald' | 'violet' | 'amber'
    fontSize: 'medium', // 'small' | 'medium' | 'large'
    reducedMotion: false,
  },
  notifications: {
    enabled: true,
    reminderTime: '18:00',
    frequency: 'daily', // 'daily' | 'weekdays' | 'weekly'
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  },
  goals: {
    dailyQuestions: 5,
    weeklyInterviews: 2,
    weeklyAssessments: 1,
    studyMinutesPerDay: 30,
    weekStartDay: 'monday', // 'monday' | 'sunday'
    preferredLanguage: 'javascript',
    locale: 'en-US',
  },
  accessibility: {
    highContrast: false,
    largerTapTargets: false,
    enhancedFocus: true,
    screenReaderOptimized: false,
  },
};

const STORAGE_KEY = 'sf_settings';

const SettingsContext = createContext(null);

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return {
          profile: { ...DEFAULT_SETTINGS.profile, ...(parsed.profile || {}) },
          appearance: { ...DEFAULT_SETTINGS.appearance, ...(parsed.appearance || {}) },
          notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications || {}) },
          goals: { ...DEFAULT_SETTINGS.goals, ...(parsed.goals || {}) },
          accessibility: { ...DEFAULT_SETTINGS.accessibility, ...(parsed.accessibility || {}) },
        };
      }
    } catch (e) {
      console.warn('Failed to parse stored settings, falling back to defaults:', e);
    }
    return DEFAULT_SETTINGS;
  });

  // Apply theme and live styling side-effects to DOM root
  useEffect(() => {
    const root = document.documentElement;

    // 1. Theme application
    let isDark = false;
    if (settings.appearance.theme === 'dark') {
      isDark = true;
    } else if (settings.appearance.theme === 'system') {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    root.setAttribute('data-theme', isDark ? 'dark' : 'light');

    // System theme change listener
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e) => {
      if (settings.appearance.theme === 'system') {
        root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    // 2. Accent Color variables
    const palette = ACCENT_PALETTES[settings.appearance.accentColor] || ACCENT_PALETTES.rose;
    root.setAttribute('data-accent', settings.appearance.accentColor);
    root.style.setProperty('--pri', palette.pri);
    root.style.setProperty('--pri-hover', palette.priHover);
    root.style.setProperty('--pri-gradient', palette.priGradient);
    root.style.setProperty('--pri-subtle', palette.priSubtle);
    root.style.setProperty('--accent', palette.accent);

    // 3. Font Size
    root.setAttribute('data-font-size', settings.appearance.fontSize);
    if (settings.appearance.fontSize === 'small') {
      root.style.setProperty('--font-scale', '0.92');
    } else if (settings.appearance.fontSize === 'large') {
      root.style.setProperty('--font-scale', '1.08');
    } else {
      root.style.setProperty('--font-scale', '1');
    }

    // 4. Reduced Motion
    root.setAttribute('data-reduced-motion', settings.appearance.reducedMotion ? 'true' : 'false');

    // 5. Accessibility attributes
    root.setAttribute('data-high-contrast', settings.accessibility.highContrast ? 'true' : 'false');
    root.setAttribute('data-larger-targets', settings.accessibility.largerTapTargets ? 'true' : 'false');
    root.setAttribute('data-enhanced-focus', settings.accessibility.enhancedFocus ? 'true' : 'false');

    // 6. Sync programming language preference into localStorage for services
    if (settings.goals.preferredLanguage) {
      localStorage.setItem('preferredLanguage', settings.goals.preferredLanguage);
    }

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  }, [settings]);

  // Persist settings whenever they update
  const persistSettings = (nextSettings) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
    } catch (e) {
      console.error('Failed to persist settings to localStorage:', e);
    }
  };

  const updateSection = (sectionKey, updates) => {
    setSettings((prev) => {
      const next = {
        ...prev,
        [sectionKey]: {
          ...prev[sectionKey],
          ...updates,
        },
      };
      persistSettings(next);
      return next;
    });
  };

  const resetSection = (sectionKey) => {
    if (!DEFAULT_SETTINGS[sectionKey]) return;
    setSettings((prev) => {
      const next = {
        ...prev,
        [sectionKey]: { ...DEFAULT_SETTINGS[sectionKey] },
      };
      persistSettings(next);
      return next;
    });
    toast.success(`Reset ${sectionKey} to default values.`);
  };

  const resetAll = () => {
    setSettings(DEFAULT_SETTINGS);
    persistSettings(DEFAULT_SETTINGS);
    toast.success('All settings reset to defaults.');
  };

  const exportSettings = () => {
    return JSON.stringify(settings, null, 2);
  };

  const importSettings = (jsonString) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid settings format.');
      }
      const merged = {
        profile: { ...DEFAULT_SETTINGS.profile, ...(parsed.profile || {}) },
        appearance: { ...DEFAULT_SETTINGS.appearance, ...(parsed.appearance || {}) },
        notifications: { ...DEFAULT_SETTINGS.notifications, ...(parsed.notifications || {}) },
        goals: { ...DEFAULT_SETTINGS.goals, ...(parsed.goals || {}) },
        accessibility: { ...DEFAULT_SETTINGS.accessibility, ...(parsed.accessibility || {}) },
      };
      setSettings(merged);
      persistSettings(merged);
      toast.success('Settings imported and applied successfully!');
      return true;
    } catch (e) {
      console.error('Failed to import settings:', e);
      toast.error('Could not import settings. Please verify the JSON file.');
      return false;
    }
  };

  const contextValue = useMemo(
    () => ({
      settings,
      updateSection,
      resetSection,
      resetAll,
      exportSettings,
      importSettings,
      accentPalettes: ACCENT_PALETTES,
    }),
    [settings]
  );

  return <SettingsContext.Provider value={contextValue}>{children}</SettingsContext.Provider>;
}
