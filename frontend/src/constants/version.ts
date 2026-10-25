import type { ChangelogEntry, UpdateManifest } from '../types';

// ============================================================
// SYSTEM BASELINE VERSION — bump alongside /public/version.json
// when deploying a new release. See docs/VERSION-BUMP.md.
// ============================================================
export const APP_VERSION = 'AQ-SYS-V2.1-PRO';
export const APP_BUILD_DATE = '2026-10-25';
export const APP_CODENAME = 'Sky Ariana';
export const LEAD_DEVELOPER = 'Ahsanullah Qureshi';
export const SYSTEM_VENDOR = 'AQ Companies';

// Extracts the numeric core from tags like "AQ-SYS-V2.1-PRO" -> 2.1
export function parseVersionCore(tag: string): number {
  const match = String(tag || '').match(/v?(\d+(?:\.\d+)*)/i);
  if (!match) return 0;
  return Number(match[1].split('.').reduce((acc, part, idx) => acc + Number(part) / Math.pow(1000, idx), 0));
}

// Returns > 0 if remote is newer than local, 0 if equal, < 0 if older
export function compareVersionTags(local: string, remote: string): number {
  const a = parseVersionCore(local);
  const b = parseVersionCore(remote);
  return b - a;
}

const MANIFEST_URL = '/version.json';

export async function fetchUpdateManifest(): Promise<UpdateManifest | null> {
  try {
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!res.ok) return null;
    const manifest = (await res.json()) as UpdateManifest;
    if (!manifest || typeof manifest.version !== 'string') return null;
    return manifest;
  } catch {
    return null;
  }
}

export interface UpdateCheckResult {
  manifest: UpdateManifest | null;
  checkedAt: string;
  updateAvailable: boolean;
  isDowngrade: boolean;
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const manifest = await fetchUpdateManifest();
  const checkedAt = new Date().toISOString();
  if (!manifest) {
    return { manifest: null, checkedAt, updateAvailable: false, isDowngrade: false };
  }
  const delta = compareVersionTags(APP_VERSION, manifest.version);
  return {
    manifest,
    checkedAt,
    updateAvailable: delta > 0,
    isDowngrade: delta < 0
  };
}

// Clears every browser cache bucket then hard-reloads the client so the
// freshly deployed build replaces the stale one seamlessly.
export async function updateAndRestart(): Promise<void> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch {
    // cache API unavailable — reload anyway
  }
  window.location.href = `${window.location.pathname}?_rel=${Date.now()}`;
  window.location.reload();
}

export const DEFAULT_CHANGELOG: ChangelogEntry[] = [
  {
    version: 'AQ-SYS-V2.1-PRO',
    releaseDate: APP_BUILD_DATE,
    type: 'release',
    title: 'System Settings & Passlock Suite',
    items: [
      'Full User Management panel with role assignment, activation control and audit-ready records',
      'Password & Account Security center with strength metering and change-password flow',
      'App Passlock: quick PIN, master password and WebAuthn biometric (Windows Hello / Touch ID) unlock',
      'Configurable auto-lock on startup and idle timeout (5 / 15 / 30 minutes) plus Ctrl+L / Cmd+L manual lock',
      'Live software update engine polling a remote version.json release manifest',
      'System Info & developer attribution signature'
    ]
  }
];
