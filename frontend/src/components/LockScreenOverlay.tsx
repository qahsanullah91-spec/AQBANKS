import React, { useEffect, useRef, useState } from 'react';
import { useLock } from '../context/LockContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Fingerprint, Delete, Lock as LockIcon, LogOut, ShieldCheck, AlertCircle
} from 'lucide-react';

interface LockScreenOverlayProps {
  userName?: string;
  userEmail?: string;
  onSignOut: () => void;
}

export const LockScreenOverlay: React.FC<LockScreenOverlayProps> = ({ userName, userEmail, onSignOut }) => {
  const { settings, unlock, verifyPin, verifyMasterPassword, verifyBiometric, biometricAvailable } = useLock();
  const { t } = useLanguage();

  const hasPin = settings.pinEnabled && Boolean(settings.pinHash);
  const hasPassword = settings.passwordEnabled && Boolean(settings.masterPasswordHash);
  const hasBiometric = settings.biometricEnabled && Boolean(settings.biometricCredentialId);

  // Default to the most convenient configured method
  const [mode, setMode] = useState<'pin' | 'password' | 'none'>(
    hasPin ? 'pin' : hasPassword ? 'password' : 'none'
  );

  const [pin, setPin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [clock, setClock] = useState(() => new Date());
  const passwordRef = useRef<HTMLInputElement>(null);
  const biometricTriedRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleUnlockSuccess = () => {
    setPin('');
    setPassword('');
    setError('');
    unlock();
  };

  const attemptBiometric = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const ok = await verifyBiometric();
    setBusy(false);
    if (ok) {
      handleUnlockSuccess();
    } else {
      setError(t('lock.biometricFailed', 'Biometric verification failed. Use your PIN or master password.'));
      // Automatic fallback to PIN/password
      setMode(hasPin ? 'pin' : hasPassword ? 'password' : 'none');
    }
  };

  // Auto-prompt the platform authenticator once when the lock screen appears
  useEffect(() => {
    if (hasBiometric && biometricAvailable && !biometricTriedRef.current) {
      biometricTriedRef.current = true;
      attemptBiometric();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitPin = async (candidate?: string) => {
    const value = candidate ?? pin;
    if (busy || value.length < 4) return;
    setBusy(true);
    const ok = await verifyPin(value);
    setBusy(false);
    if (ok) {
      handleUnlockSuccess();
    } else {
      setError(t('lock.wrongPin', 'Incorrect PIN. Please try again.'));
      setPin('');
    }
  };

  const submitPassword = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    const ok = await verifyMasterPassword(password);
    setBusy(false);
    if (ok) {
      handleUnlockSuccess();
    } else {
      setError(t('lock.wrongPassword', 'Incorrect master password. Please try again.'));
      setPassword('');
    }
  };

  const pressDigit = (d: string) => {
    setError('');
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 6) setTimeout(() => submitPin(next), 120);
  };

  const backspace = () => setPin(p => p.slice(0, -1));

  // Keyboard support for the PIN pad
  useEffect(() => {
    if (mode !== 'pin') return;
    const handler = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) pressDigit(e.key);
      else if (e.key === 'Backspace') backspace();
      else if (e.key === 'Enter') submitPin();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pin, busy]);

  useEffect(() => {
    if (mode === 'password') passwordRef.current?.focus();
  }, [mode]);

  const noMethodsConfigured = !hasPin && !hasPassword && !hasBiometric;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden">
      {/* Frosted-glass backdrop that fully obscures the application behind it */}
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-2xl" />
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-slate-900/40 to-slate-950/60" />

      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="liquid-glass-card border border-white/20 dark:border-white/10 rounded-[2rem] p-8 shadow-2xl text-center space-y-5 animate-fade-in">
          {/* App Identity */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-white/40 dark:border-white/10 shadow-lg p-2 flex items-center justify-center">
              <img src="/logo.png" alt="AQ Companies" className="w-full h-full object-contain" />
            </div>
            <div className="space-y-0.5">
              <div className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {userName || 'Operator'}
              </div>
              <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
                {userEmail || ''}
              </div>
            </div>
          </div>

          {/* Clock */}
          <div className="text-4xl font-extralight tracking-widest text-slate-800 dark:text-slate-100 tabular-nums">
            {clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>

          <div className="flex items-center justify-center gap-2 text-[11px] font-mono font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            <LockIcon className="w-3.5 h-3.5" />
            {t('lock.screenTitle', 'System Locked')}
          </div>

          {/* No methods configured: guardrail so the user can never be permanently stuck */}
          {noMethodsConfigured && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300/60 dark:border-amber-700/60 text-left">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  {t('lock.noMethods', 'The passlock is enabled but no unlock method has been configured yet. Set a PIN or master password in Settings → App Lock.')}
                </p>
              </div>
              <button
                onClick={onSignOut}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
              >
                {t('lock.signOutInstead', 'Sign Out Instead')}
              </button>
            </div>
          )}

          {/* Quick PIN pad */}
          {mode === 'pin' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-3 h-10">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-2.5 rounded-full border transition-all duration-150 ${
                      i < pin.length
                        ? 'bg-emerald-500 border-emerald-500 scale-110'
                        : 'bg-transparent border-slate-400/60 dark:border-slate-500/60'
                    }`}
                  />
                ))}
              </div>
              {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}
              <div className="grid grid-cols-3 gap-2.5">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                  <button
                    key={d}
                    onClick={() => pressDigit(d)}
                    className="h-12 rounded-xl bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white text-base font-semibold transition active:scale-95"
                  >
                    {d}
                  </button>
                ))}
                <button
                  onClick={() => { setMode(hasPassword ? 'password' : 'none'); setError(''); }}
                  title={t('lock.usePassword', 'Use master password')}
                  className="h-12 rounded-xl bg-transparent hover:bg-white/40 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center transition"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>
                <button
                  onClick={() => pressDigit('0')}
                  className="h-12 rounded-xl bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 border border-slate-200/80 dark:border-white/10 text-slate-900 dark:text-white text-base font-semibold transition active:scale-95"
                >
                  0
                </button>
                <button
                  onClick={backspace}
                  className="h-12 rounded-xl bg-transparent hover:bg-white/40 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 flex items-center justify-center transition"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Master password */}
          {mode === 'password' && (
            <form onSubmit={submitPassword} className="space-y-3">
              <div className="relative">
                <input
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder={t('lock.masterPasswordPlaceholder', 'Master password')}
                  className="w-full px-4 py-3 pr-12 rounded-xl liquid-glass-input border border-slate-300/70 dark:border-white/10 bg-white/60 dark:bg-white/10 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
              {error && <p className="text-[11px] text-rose-500 font-semibold">{error}</p>}
              <button
                type="submit"
                disabled={busy || !password}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg transition"
              >
                {busy ? '…' : t('lock.unlockButton', 'Unlock')}
              </button>
              {hasPin && (
                <button
                  type="button"
                  onClick={() => { setMode('pin'); setPassword(''); setError(''); }}
                  className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 font-semibold transition"
                >
                  {t('lock.usePin', 'Use PIN instead')}
                </button>
              )}
            </form>
          )}

          {/* Biometric unlock */}
          {hasBiometric && biometricAvailable && (
            <button
              onClick={attemptBiometric}
              disabled={busy}
              className="w-full py-3 rounded-xl bg-white/60 dark:bg-white/10 hover:bg-white/80 dark:hover:bg-white/20 border border-slate-200/80 dark:border-white/10 text-slate-800 dark:text-white text-xs font-bold flex items-center justify-center gap-2 transition"
            >
              <Fingerprint className={`w-4 h-4 text-emerald-600 dark:text-emerald-400 ${busy ? 'animate-pulse' : ''}`} />
              {t('lock.biometricButton', 'Unlock with Fingerprint / Windows Hello')}
            </button>
          )}

          {hasBiometric && !biometricAvailable && (
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {t('lock.biometricUnavailable', 'Biometric hardware not detected — PIN / password fallback active')}
            </p>
          )}

          <button
            onClick={onSignOut}
            className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 font-semibold inline-flex items-center gap-1.5 transition"
          >
            <LogOut className="w-3 h-3" />
            {t('lock.signOutInstead', 'Sign Out Instead')}
          </button>
        </div>
      </div>
    </div>
  );
};
