import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { LockSettings } from '../types';

const LOCK_SETTINGS_KEY = 'aq_lock_settings_v1';
const LOCK_ACTIVE_KEY = 'aq_lock_active';

export const DEFAULT_LOCK_SETTINGS: LockSettings = {
  enabled: false,
  inactivityMinutes: 15,
  pinEnabled: false,
  passwordEnabled: false,
  biometricEnabled: false,
  pinHash: null,
  masterPasswordHash: null,
  biometricCredentialId: null
};

export async function hashSecret(text: string): Promise<string> {
  const salted = `aq-salt::${text}`;
  try {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salted));
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Non-secure-context fallback (crypto.subtle unavailable)
    let h = 0;
    for (let i = 0; i < salted.length; i++) h = (h * 31 + salted.charCodeAt(i)) | 0;
    return `fb-${h.toString(16)}`;
  }
}

async function detectBiometricAvailability(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) return false;
    if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

function bufferToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuffer(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

interface LockContextValue {
  settings: LockSettings;
  isLocked: boolean;
  biometricAvailable: boolean;
  updateSettings: (patch: Partial<LockSettings>) => void;
  lock: () => void;
  unlock: () => void;
  verifyPin: (pin: string) => Promise<boolean>;
  verifyMasterPassword: (password: string) => Promise<boolean>;
  verifyBiometric: () => Promise<boolean>;
}

const LockContext = createContext<LockContextValue | null>(null);

export const useLock = (): LockContextValue => {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock must be used within LockProvider');
  return ctx;
};

export const LockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<LockSettings>(() => {
    try {
      const raw = localStorage.getItem(LOCK_SETTINGS_KEY);
      if (raw) return { ...DEFAULT_LOCK_SETTINGS, ...JSON.parse(raw) };
    } catch {}
    return DEFAULT_LOCK_SETTINGS;
  });
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    // Lock on startup whenever the passlock system is armed
    if (settings?.enabled) return true;
    try {
      return sessionStorage.getItem(LOCK_ACTIVE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    detectBiometricAvailability().then(setBiometricAvailable);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOCK_SETTINGS_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings]);

  useEffect(() => {
    try {
      if (isLocked) sessionStorage.setItem(LOCK_ACTIVE_KEY, '1');
      else sessionStorage.removeItem(LOCK_ACTIVE_KEY);
    } catch {}
  }, [isLocked]);

  const updateSettings = useCallback((patch: Partial<LockSettings>) => {
    setSettings(prev => ({ ...prev, ...patch }));
  }, []);

  const lock = useCallback(() => setIsLocked(true), []);
  const unlock = useCallback(() => {
    lastActivityRef.current = Date.now();
    setIsLocked(false);
  }, []);

  // Manual lock shortcut: Ctrl+L / Cmd+L
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
        if (settings.enabled) {
          e.preventDefault();
          setIsLocked(true);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [settings.enabled]);

  // Configurable inactivity auto-lock
  useEffect(() => {
    if (!settings.enabled) return;
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    const record = () => { lastActivityRef.current = Date.now(); };
    events.forEach(evt => window.addEventListener(evt, record, { passive: true }));

    const interval = setInterval(() => {
      if (isLocked) return;
      const elapsedMs = Date.now() - lastActivityRef.current;
      if (elapsedMs >= settings.inactivityMinutes * 60_000) {
        setIsLocked(true);
      }
    }, 5_000);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, record));
      clearInterval(interval);
    };
  }, [settings.enabled, settings.inactivityMinutes, isLocked]);

  const verifyPin = useCallback(async (pin: string) => {
    if (!settings.pinHash) return false;
    return (await hashSecret(pin)) === settings.pinHash;
  }, [settings.pinHash]);

  const verifyMasterPassword = useCallback(async (password: string) => {
    if (!settings.masterPasswordHash) return false;
    return (await hashSecret(password)) === settings.masterPasswordHash;
  }, [settings.masterPasswordHash]);

  const verifyBiometric = useCallback(async () => {
    if (!settings.biometricCredentialId || !window.PublicKeyCredential) return false;
    try {
      await navigator.credentials.get({
        publicKey: {
          challenge: crypto.getRandomValues(new Uint8Array(32)),
          allowCredentials: [{
            id: base64ToBuffer(settings.biometricCredentialId) as BufferSource,
            type: 'public-key'
          }],
          userVerification: 'required',
          timeout: 60_000
        }
      } as CredentialRequestOptions);
      return true;
    } catch {
      return false;
    }
  }, [settings.biometricCredentialId]);

  return (
    <LockContext.Provider value={{
      settings,
      isLocked,
      biometricAvailable,
      updateSettings,
      lock,
      unlock,
      verifyPin,
      verifyMasterPassword,
      verifyBiometric
    }}>
      {children}
    </LockContext.Provider>
  );
};

export async function registerBiometricCredential(): Promise<string | null> {
  try {
    if (!window.PublicKeyCredential) return null;
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        rp: { name: 'AQ Companies Portal', id: window.location.hostname },
        user: {
          id: crypto.getRandomValues(new Uint8Array(16)) as BufferSource,
          name: 'aq-portal-device-lock',
          displayName: 'AQ Portal Device Unlock'
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred'
        },
        timeout: 60_000
      }
    } as CredentialCreationOptions);
    if (!credential) return null;
    const rawId = (credential as PublicKeyCredential).rawId;
    return rawId ? bufferToBase64(rawId) : null;
  } catch {
    return null;
  }
}
