export type Theme = 'light' | 'dark';

export interface ThemeColors {
  bg: string;
  card: string;
  cardBorder: string;
  headerBg: string;
  headerBorder: string;
  navBg: string;
  navBorder: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  inputBg: string;
  inputBorder: string;
  primary: string;
  primaryHover: string;
  accent: string;
  accentBg: string;
  danger: string;
  dangerBg: string;
  warning: string;
  warningBg: string;
  badgeBg: string;
  divider: string;
}

export const lightColors: ThemeColors = {
  bg: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#e2e8f0',
  headerBg: '#ffffff',
  headerBorder: '#e2e8f0',
  navBg: '#ffffff',
  navBorder: '#e2e8f0',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  inputBg: '#f1f5f9',
  inputBorder: '#cbd5e1',
  primary: '#0284c7',
  primaryHover: '#0369a1',
  accent: '#059669',
  accentBg: '#d1fae5',
  danger: '#dc2626',
  dangerBg: '#fee2e2',
  warning: '#d97706',
  warningBg: '#fef3c7',
  badgeBg: '#f1f5f9',
  divider: '#e2e8f0'
};

export const darkColors: ThemeColors = {
  bg: '#020617',
  card: '#0f172a',
  cardBorder: '#1e293b',
  headerBg: '#0f172a',
  headerBorder: '#1e293b',
  navBg: '#0f172a',
  navBorder: '#1e293b',
  text: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  inputBg: '#1e293b',
  inputBorder: '#334155',
  primary: '#38bdf8',
  primaryHover: '#0284c7',
  accent: '#10b981',
  accentBg: '#064e3b',
  danger: '#f87171',
  dangerBg: '#450a0a',
  warning: '#fbbf24',
  warningBg: '#451a03',
  badgeBg: '#1e293b',
  divider: '#1e293b'
};
