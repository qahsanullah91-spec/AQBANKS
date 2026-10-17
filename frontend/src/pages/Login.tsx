import React, { useState, useEffect, useRef } from 'react';
import { api, setAuthToken, setStoredUser } from '../services/api';
import {
  ShieldCheck,
  Lock,
  Mail,
  AlertCircle,
  Eye,
  EyeOff,
  Sun,
  Moon,
  Languages,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2
} from 'lucide-react';
import { User } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

interface LoginProps {
  onLoginSuccess: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { t, language, setLanguage, isRtl } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  // Authentication State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockActive, setCapsLockActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lockout State
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);

  // Developer Quick-Fill Collapsible Drawer State (Dev Mode Only)
  const [devDrawerOpen, setDevDrawerOpen] = useState(false);
  const isDev = import.meta.env.DEV === true;

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds === null || lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          setError(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  // Caps lock listener
  const handleKeyModifier = (e: React.KeyboardEvent) => {
    if (typeof e.getModifierState === 'function') {
      setCapsLockActive(e.getModifierState('CapsLock'));
    }
  };

  // Format seconds to MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Step 1: Submit Credentials
  const handleLoginSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (lockoutSeconds && lockoutSeconds > 0) return;

    setError(null);

    const cleanEmail = email.trim().toLowerCase();

    // 1. Client-Side Corporate Domain Check
    if (!cleanEmail.endsWith('@aqcompanies.com') && !cleanEmail.endsWith('@skyariana.com')) {
      setError(t('login.invalidDomain'));
      return;
    }

    if (!password) {
      setError('Please enter your corporate password.');
      return;
    }

    setLoading(true);

    try {
      const res = await api.login({
        email: cleanEmail,
        password,
        devMode: isDev
      });

      if (res.accessToken) {
        setAuthToken(res.accessToken);
        setStoredUser(res.user);
        onLoginSuccess(res.user);
      } else {
        setError('Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      const errData = err.details || {};
      if (errData.error === 'SECURITY_LOCKOUT' || err.status === 429) {
        const secs = errData.remainingSeconds || 900;
        setLockoutSeconds(secs);
        setError(`${t('login.accountLockedDesc')} (${formatTime(secs)})`);
      } else {
        setError(err.message || t('login.invalidCredentials'));
      }
    } finally {
      setLoading(false);
    }
  };

  // Developer Quick-Fill Helper (Dev Mode Only)
  const quickFillDevAccount = (targetEmail: string, targetPassword = 'AQCompanies@2026') => {
    setEmail(targetEmail);
    setPassword(targetPassword);
    setError(null);
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white transition-colors duration-500">
      {/* ========================================================
          1. DYNAMIC AMBIENT MESH CANVAS (AURORA REFRACTION ORBS)
          ======================================================== */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 bg-slate-950/20 dark:bg-slate-950">
        {/* Orb 1: Corporate Emerald */}
        <div
          className="absolute -top-[10%] -left-[10%] w-[55vw] h-[55vw] max-w-[650px] max-h-[650px] rounded-full animate-orb-1"
          style={{
            background: 'radial-gradient(circle, rgba(5,150,105,0.45) 0%, rgba(5,150,105,0) 70%)',
            filter: 'blur(100px)'
          }}
        />
        {/* Orb 2: Deep Oceanic Slate / Cyan */}
        <div
          className="absolute -bottom-[15%] -right-[10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] rounded-full animate-orb-2"
          style={{
            background: 'radial-gradient(circle, rgba(13,148,136,0.38) 0%, rgba(15,23,42,0) 70%)',
            filter: 'blur(120px)'
          }}
        />
        {/* Orb 3: Warm Gold Accent */}
        <div
          className="absolute top-[35%] right-[15%] w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] rounded-full animate-orb-3"
          style={{
            background: 'radial-gradient(circle, rgba(217,119,6,0.22) 0%, rgba(217,119,6,0) 70%)',
            filter: 'blur(110px)'
          }}
        />
        {/* Orb 4: Subtle Deep Teal */}
        <div
          className="absolute bottom-[20%] left-[20%] w-[45vw] h-[45vw] max-w-[550px] max-h-[550px] rounded-full animate-orb-4"
          style={{
            background: 'radial-gradient(circle, rgba(16,185,129,0.28) 0%, rgba(16,185,129,0) 70%)',
            filter: 'blur(115px)'
          }}
        />
        {/* Architectural Grid Overlay */}
        <div className="absolute inset-0 architectural-grid opacity-40 dark:opacity-20" />
      </div>

      {/* ========================================================
          2. FLOATING TOP GLASS PILL (LANGUAGE & THEME CONTROLS)
          ======================================================== */}
      <div
        className={`fixed top-6 ${isRtl ? 'left-6' : 'right-6'} z-50 flex items-center gap-2`}
      >
        <div className="bg-white/40 dark:bg-slate-900/60 backdrop-blur-2xl border border-white/50 dark:border-white/10 rounded-full p-1 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.2),inset_0_1px_1px_rgba(255,255,255,0.4)] flex items-center gap-1.5 transition-all">
          <div className="flex items-center gap-1 px-2 text-slate-700 dark:text-slate-300">
            <Languages className="w-3.5 h-3.5 text-emerald-500" />
          </div>

          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all ${
              language === 'en'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-700 dark:text-slate-300 hover:text-emerald-500'
            }`}
            title="English (Default)"
          >
            EN
          </button>

          <button
            type="button"
            onClick={() => setLanguage('ps')}
            className={`px-2.5 py-1 text-xs font-bold rounded-full font-sans transition-all ${
              language === 'ps'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-700 dark:text-slate-300 hover:text-emerald-500'
            }`}
            title="پښتو (Pashto)"
          >
            پښتو
          </button>

          <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-0.5" />

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle Light/Dark Theme"
            className="p-1.5 text-slate-700 dark:text-slate-300 hover:text-emerald-500 rounded-full transition"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-emerald-600" />}
          </button>
        </div>
      </div>

      {/* ========================================================
          3. MULTI-LAYERED "LIQUID GLASS" CARD ARCHITECTURE
          ======================================================== */}
      <div className="w-full max-w-md relative z-10 transition-all duration-300">
        <div className="liquid-glass-card backdrop-blur-2xl backdrop-saturate-150 border border-white/50 dark:border-white/10 rounded-3xl p-7 sm:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3),inset_0_1px_2px_0_rgba(255,255,255,0.7)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7),inset_0_1px_1px_0_rgba(255,255,255,0.15)] relative overflow-hidden">
          {/* Specular Rim Top Highlight Reflection Bar */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-white/80 dark:via-white/40 to-transparent" />

          {/* Header & Crest */}
          <div className="flex flex-col items-center mb-6 text-center">
            {/* Logo Container: Frosted Glass Squircle with Security Pulse Ring */}
            <div className="relative mb-3 group">
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 opacity-30 blur group-hover:opacity-60 transition duration-500 animate-pulse" />
              <div className="w-20 h-20 relative bg-white/40 dark:bg-slate-900/50 backdrop-blur-md border border-white/60 dark:border-white/20 rounded-2xl p-2.5 flex items-center justify-center shadow-inner">
                <img
                  src="/logo.png"
                  alt="AQ Companies Official Logo"
                  className="w-full h-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)]"
                />
              </div>
            </div>

            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white drop-shadow-sm">
              {t('login.title')}
            </h1>
            <p className="text-xs uppercase tracking-widest text-slate-600 dark:text-slate-300 font-semibold mt-1">
              {t('login.subtitle')}
            </p>

            {/* Security Badge with Live Pulsing Green Dot */}
            <div className="mt-2.5 inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 shadow-sm backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>{t('login.securityBadge')}</span>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/15 border border-red-500/30 rounded-xl flex items-center gap-2.5 text-xs text-red-700 dark:text-red-300 backdrop-blur-md animate-shake">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="leading-tight font-medium">{error}</span>
            </div>
          )}

          {/* Lockout Warning Banner */}
          {lockoutSeconds && lockoutSeconds > 0 && (
            <div className="mb-4 p-3.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-xs text-amber-800 dark:text-amber-200 backdrop-blur-md space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <Lock className="w-4 h-4" />
                <span>{t('login.accountLockedTitle')}</span>
              </div>
              <p>{t('login.accountLockedDesc')}</p>
              <div className="pt-1 font-mono font-bold text-amber-700 dark:text-amber-300 text-sm">
                {t('login.retryIn')} {formatTime(lockoutSeconds)}
              </div>
            </div>
          )}

          {/* ========================================================
              CORPORATE EMAIL & PASSWORD LOGIN FORM
              ======================================================== */}
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Corporate Email Field */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('login.email')}
              </label>
              <div className="relative">
                <Mail
                  className={`w-4 h-4 text-slate-400 absolute top-3.5 ${
                    isRtl ? 'right-3.5' : 'left-3.5'
                  }`}
                />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={handleKeyModifier}
                  onKeyUp={handleKeyModifier}
                  disabled={Boolean(lockoutSeconds && lockoutSeconds > 0)}
                  required
                  autoComplete="username"
                  className={`liquid-glass-input w-full rounded-xl py-3 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-300 placeholder:text-slate-400 ${
                    isRtl ? 'pr-10 pl-3 text-right' : 'pl-10 pr-3 text-left'
                  }`}
                  placeholder="officer@aqcompanies.com"
                />
              </div>
            </div>

            {/* Password Field with Eye Toggle & Caps Lock Detection */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('login.password')}
                </label>
                {capsLockActive && (
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 animate-pulse">
                    ⚠️ {t('login.capsLockWarning')}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock
                  className={`w-4 h-4 text-slate-400 absolute top-3.5 ${
                    isRtl ? 'right-3.5' : 'left-3.5'
                  }`}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKeyModifier}
                  onKeyUp={handleKeyModifier}
                  disabled={Boolean(lockoutSeconds && lockoutSeconds > 0)}
                  required
                  autoComplete="current-password"
                  className={`liquid-glass-input w-full rounded-xl py-3 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all duration-300 placeholder:text-slate-400 ${
                    isRtl ? 'pr-10 pl-10 text-right' : 'pl-10 pr-10 text-left'
                  }`}
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                  className={`absolute top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition ${
                    isRtl ? 'left-3' : 'right-3'
                  }`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Primary Tactile Liquid Emerald Button */}
            <button
              type="submit"
              disabled={loading || Boolean(lockoutSeconds && lockoutSeconds > 0)}
              className="w-full mt-2 py-3.5 px-4 bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 active:scale-[0.99] text-white font-bold text-sm rounded-xl shadow-[0_10px_25px_-5px_rgba(16,185,129,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{t('common.loading')}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t('login.signIn')}</span>
                </>
              )}
            </button>
          </form>

          {/* ========================================================
              4. DEVELOPER QUICK-FILL DRAWER (DEV MODE ONLY)
              Strictly hidden on production builds
              ======================================================== */}
          {isDev && (
            <div className="mt-6 pt-4 border-t border-white/20 dark:border-white/10">
              <button
                type="button"
                onClick={() => setDevDrawerOpen(!devDrawerOpen)}
                className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-emerald-500 transition py-1"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                  {t('login.devQuickFill')}
                </span>
                {devDrawerOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>

              {devDrawerOpen && (
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs animate-fade-in">
                  <button
                    type="button"
                    onClick={() => quickFillDevAccount('ahsanullah@aqcompanies.com', 'Qur78Ahs@@')}
                    className="p-2 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-left rtl:text-right text-slate-800 dark:text-slate-200 transition"
                  >
                    👑 <span className="font-bold text-emerald-700 dark:text-emerald-300">Ahsanullah (Admin)</span>
                    <span className="block text-[10px] text-slate-500 truncate">ahsanullah@aqcompanies.com</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => quickFillDevAccount('danish@aqcompanies.com', 'Danish123@789')}
                    className="p-2 rounded-xl bg-emerald-500/15 dark:bg-emerald-500/10 hover:bg-emerald-500/25 border border-emerald-500/30 text-left rtl:text-right text-slate-800 dark:text-slate-200 transition"
                  >
                    👑 <span className="font-bold text-emerald-700 dark:text-emerald-300">Danish (Admin)</span>
                    <span className="block text-[10px] text-slate-500 truncate">danish@aqcompanies.com</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => quickFillDevAccount('admin@aqcompanies.com')}
                    className="p-2 rounded-xl bg-white/30 dark:bg-slate-950/40 hover:bg-emerald-500/20 border border-white/30 dark:border-white/10 text-left rtl:text-right text-slate-800 dark:text-slate-200 transition"
                  >
                    👑 <span className="font-bold">System Admin</span>
                    <span className="block text-[10px] text-slate-500 truncate">admin@aqcompanies.com</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => quickFillDevAccount('finance@aqcompanies.com')}
                    className="p-2 rounded-xl bg-white/30 dark:bg-slate-950/40 hover:bg-emerald-500/20 border border-white/30 dark:border-white/10 text-left rtl:text-right text-slate-800 dark:text-slate-200 transition"
                  >
                    💰 <span className="font-bold">Finance Mgr</span>
                    <span className="block text-[10px] text-slate-500 truncate">finance@aqcompanies.com</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => quickFillDevAccount('logistics@aqcompanies.com')}
                    className="p-2 rounded-xl bg-white/30 dark:bg-slate-950/40 hover:bg-emerald-500/20 border border-white/30 dark:border-white/10 text-left rtl:text-right text-slate-800 dark:text-slate-200 transition"
                  >
                    🚢 <span className="font-bold">Logistics Coord</span>
                    <span className="block text-[10px] text-slate-500 truncate">logistics@aqcompanies.com</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => quickFillDevAccount('auditor@aqcompanies.com')}
                    className="p-2 rounded-xl bg-white/30 dark:bg-slate-950/40 hover:bg-emerald-500/20 border border-white/30 dark:border-white/10 text-left rtl:text-right text-slate-800 dark:text-slate-200 transition"
                  >
                    🔍 <span className="font-bold">Auditor</span>
                    <span className="block text-[10px] text-slate-500 truncate">auditor@aqcompanies.com</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Encrypted Connection Security Footer */}
        <div className="mt-4 text-center">
          <p className="text-[11px] text-slate-600 dark:text-slate-400 tracking-wide font-medium">
            {t('login.securityFooter')}
          </p>
        </div>
      </div>
    </div>
  );
};
