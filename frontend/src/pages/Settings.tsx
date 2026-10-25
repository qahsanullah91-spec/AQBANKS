import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useLock, hashSecret, registerBiometricCredential } from '../context/LockContext';
import { api } from '../services/api';
import { SystemUser, User, UpdateManifest, ChangelogEntry } from '../types';
import {
  APP_VERSION, APP_BUILD_DATE, APP_CODENAME, LEAD_DEVELOPER, SYSTEM_VENDOR,
  checkForUpdates, updateAndRestart, DEFAULT_CHANGELOG, compareVersionTags
} from '../constants/version';
import {
  Users, KeyRound, Fingerprint, RefreshCw, Info, Search, Plus, Pencil, Trash2,
  UserCheck, UserX, Eye, EyeOff, ShieldCheck, Lock, MonitorSmartphone,
  Download, CheckCircle2, AlertTriangle, X, Clock, Sparkles, BadgeCheck, Cpu, Globe
} from 'lucide-react';

// ============================================================
// Shared role & permission catalog
// ============================================================
const ALL_PERMISSIONS = [
  'user:manage', 'settings:manage', 'invoice:create_draft', 'invoice:issue',
  'invoice:void', 'invoice:view', 'ledger:post_entry', 'ledger:reverse_entry',
  'ledger:view', 'payment:create', 'payment:allocate', 'shipment:manage',
  'shipment:view', 'bank_details:view_masked', 'bank_details:reveal_unmasked',
  'bank_details:manage', 'remittance:manage', 'remittance:set_default',
  'bank_details:export', 'bank_details:view_history', 'import:execute', 'audit:view'
];

const ROLE_PRESETS: Array<{ id: string; label: string; permissions: string[] }> = [
  { id: 'ADMIN', label: 'Admin — full system control', permissions: [...ALL_PERMISSIONS] },
  {
    id: 'MANAGER', label: 'Manager — operations & treasury, no user administration',
    permissions: ALL_PERMISSIONS.filter(p => !['user:manage', 'settings:manage'].includes(p))
  },
  {
    id: 'OPERATOR', label: 'Operator — invoicing, logistics & payments',
    permissions: ['invoice:create_draft', 'invoice:issue', 'invoice:view', 'shipment:manage', 'shipment:view', 'ledger:view', 'payment:create', 'payment:allocate', 'bank_details:view_masked']
  },
  {
    id: 'VIEWER', label: 'Viewer — read-only access',
    permissions: ['invoice:view', 'ledger:view', 'shipment:view', 'bank_details:view_masked', 'audit:view']
  },
  {
    id: 'FINANCE_MANAGER', label: 'Finance Manager — treasury, ledger & reporting',
    permissions: ['invoice:create_draft', 'invoice:issue', 'invoice:view', 'ledger:post_entry', 'ledger:reverse_entry', 'ledger:view', 'payment:create', 'payment:allocate', 'bank_details:view_masked', 'bank_details:reveal_unmasked', 'bank_details:manage', 'remittance:manage', 'remittance:set_default', 'audit:view', 'settings:manage']
  },
  {
    id: 'LOGISTICS_COORDINATOR', label: 'Logistics Coordinator — freight & shipments',
    permissions: ['shipment:manage', 'shipment:view', 'invoice:view']
  },
  { id: 'AUDITOR', label: 'Compliance Auditor — read-only + audit trail', permissions: ALL_PERMISSIONS.filter(p => p.endsWith(':view') || p === 'audit:view') }
];

const ROLE_BADGE: Record<string, string> = {
  ADMIN: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/60',
  MANAGER: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-800/60',
  OPERATOR: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800/60',
  VIEWER: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700/60',
  FINANCE_MANAGER: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/80 dark:text-violet-300 dark:border-violet-800/60',
  LOGISTICS_COORDINATOR: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/80 dark:text-cyan-300 dark:border-cyan-800/60',
  AUDITOR: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800/60'
};

function passwordScore(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  return { score, label: labels[score] };
}

type SettingsTab = 'users' | 'security' | 'passlock' | 'updates' | 'about';

interface SettingsProps {
  currentUser: User;
}

export const Settings: React.FC<SettingsProps> = ({ currentUser }) => {
  const { t } = useLanguage();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>('users');

  const tabs: Array<{ id: SettingsTab; label: string; icon: React.ElementType; adminOnly?: boolean }> = [
    { id: 'users', label: t('settings.tab.users', 'User Management'), icon: Users, adminOnly: true },
    { id: 'security', label: t('settings.tab.security', 'Password & Security'), icon: KeyRound },
    { id: 'passlock', label: t('settings.tab.passlock', 'App Lock & Biometric'), icon: Fingerprint },
    { id: 'updates', label: t('settings.tab.updates', 'Software Update'), icon: RefreshCw },
    { id: 'about', label: t('settings.tab.about', 'System Information'), icon: Info }
  ];

  const isAdmin = (currentUser.roles?.[0] || 'ADMIN').toUpperCase() === 'ADMIN';
  const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin);
  const effectiveTab: SettingsTab = visibleTabs.some(x => x.id === activeTab) ? activeTab : visibleTabs[0].id;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25">
              <Sparkles className="w-4.5 h-4.5" />
            </span>
            {t('settings.title', 'System Settings')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('settings.subtitle', 'User administration, security passlock, live updates and system information')}
          </p>
        </div>
        <span className="self-start sm:self-auto px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          {APP_VERSION}
        </span>
      </div>

      <div className="flex flex-col md:flex-row gap-4 md:gap-5 items-stretch md:items-start">
        {/* macOS-style frosted tab rail */}
        <aside className="md:w-60 shrink-0 md:sticky md:top-2">
          <div className="liquid-glass-card rounded-2xl p-2 flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
            {visibleTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = effectiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                    isActive
                      ? 'bg-white/90 dark:bg-white/15 text-slate-900 dark:text-white shadow-sm border border-slate-200/80 dark:border-white/10'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Content pane */}
        <section className="flex-1 min-w-0">
          {effectiveTab === 'users' && <UserManagementPanel currentUser={currentUser} />}
          {effectiveTab === 'security' && <PasswordSecurityPanel />}
          {effectiveTab === 'passlock' && <PasslockPanel />}
          {effectiveTab === 'updates' && <SoftwareUpdatePanel />}
          {effectiveTab === 'about' && <AboutPanel />}
        </section>
      </div>

      {/* Settings footer attribution badge */}
      <footer className="pt-2 pb-4 flex flex-col sm:flex-row items-center justify-center gap-1.5 text-[10px] font-mono text-slate-400 dark:text-slate-500">
        <span className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-bold text-slate-500 dark:text-slate-400">
          {APP_VERSION}
        </span>
        <span>
          {t('settings.footer.engineered', 'Engineered by')} <span className="font-bold text-slate-600 dark:text-slate-300">{LEAD_DEVELOPER}</span>
        </span>
        <span className="hidden sm:inline">•</span>
        <span>{SYSTEM_VENDOR} © {new Date().getFullYear()}</span>
      </footer>
    </div>
  );
};

// ============================================================
// 1. USER MANAGEMENT
// ============================================================
const UserManagementPanel: React.FC<{ currentUser: User }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const toast = useToast();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SystemUser | null>(null);
  const [saving, setSaving] = useState(false);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const list = await api.getUsers();
      setUsers(Array.isArray(list) ? list : []);
    } catch {
      toast.error(t('settings.users.loadError', 'Failed to load the user list.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, []);

  const filtered = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = !search ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchesRole = roleFilter === 'ALL' || (u.roles || []).includes(roleFilter);
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const availableRoleFilters = useMemo(() => {
    const set = new Set<string>();
    users.forEach(u => (u.roles || []).forEach(r => set.add(r)));
    return Array.from(set);
  }, [users]);

  const toggleActive = async (user: SystemUser) => {
    try {
      await api.updateSystemUser(user.id, { isActive: !user.isActive });
      toast.success(
        !user.isActive
          ? t('settings.users.activatedToast', 'User activated.')
          : t('settings.users.deactivatedToast', 'User deactivated.'),
        user.email
      );
      loadUsers();
    } catch (e: any) {
      toast.error(e?.message || t('settings.users.updateError', 'Failed to update the user.'));
    }
  };

  const handleDelete = async (user: SystemUser) => {
    try {
      await api.deleteSystemUser(user.id);
      toast.success(t('settings.users.deletedToast', 'User account deleted.'), user.email);
      setConfirmDelete(null);
      loadUsers();
    } catch (e: any) {
      toast.error(e?.message || t('settings.users.deleteError', 'Failed to delete the user.'));
    }
  };

  return (
    <div className="liquid-glass-card rounded-2xl border border-slate-200/70 dark:border-white/10 p-4 sm:p-5 space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5 sm:items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {t('settings.users.heading', 'Registered Users & Role Control')}
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {t('settings.users.subheading', 'Add operators, assign roles and control account access')}
          </p>
        </div>
        <button
          onClick={() => { setEditingUser(null); setModalOpen(true); }}
          className="self-start inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('settings.users.addUser', 'Add New User')}
        </button>
      </div>

      {/* Search + role filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('settings.users.searchPlaceholder', 'Search by name or email…')}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
        >
          <option value="ALL">{t('settings.users.allRoles', 'All Roles')}</option>
          {availableRoleFilters.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Users table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200/80 dark:border-white/10">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50/90 dark:bg-white/5 text-left text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="px-3.5 py-2.5 font-bold">{t('settings.users.colUser', 'User')}</th>
              <th className="px-3.5 py-2.5 font-bold">{t('settings.users.colRole', 'Role')}</th>
              <th className="px-3.5 py-2.5 font-bold">{t('settings.users.colStatus', 'Status')}</th>
              <th className="px-3.5 py-2.5 font-bold text-right">{t('settings.users.colActions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-3.5 py-8 text-center text-slate-400">{t('common.loading', 'Loading…')}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-3.5 py-8 text-center text-slate-400">{t('settings.users.empty', 'No users match your filters.')}</td></tr>
            ) : (
              filtered.map(u => {
                const role = (u.roles?.[0] || 'VIEWER').toUpperCase();
                const isSelf = u.id === currentUser.id;
                return (
                  <tr key={u.id} className="border-t border-slate-100 dark:border-white/5 hover:bg-slate-50/60 dark:hover:bg-white/[0.03] transition">
                    <td className="px-3.5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                          {(u.firstName?.[0] || '?')}{(u.lastName?.[0] || '')}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 dark:text-white truncate">
                            {u.firstName} {u.lastName}
                            {isSelf && <span className="ml-1.5 text-[9px] font-mono text-emerald-600 dark:text-emerald-400">({t('settings.users.you', 'you')})</span>}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${ROLE_BADGE[role] || ROLE_BADGE.VIEWER}`}>
                        {role}
                      </span>
                    </td>
                    <td className="px-3.5 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${u.isActive !== false ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${u.isActive !== false ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {u.isActive !== false ? t('settings.users.active', 'Active') : t('settings.users.inactive', 'Deactivated')}
                      </span>
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditingUser(u); setModalOpen(true); }}
                          title={t('settings.users.edit', 'Edit user')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40 transition"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          disabled={isSelf}
                          title={u.isActive !== false ? t('settings.users.deactivate', 'Deactivate') : t('settings.users.activate', 'Activate')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                          {u.isActive !== false ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(u)}
                          disabled={isSelf}
                          title={t('settings.users.delete', 'Delete user')}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-30 disabled:cursor-not-allowed transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <UserFormModal
          editingUser={editingUser}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); loadUsers(); }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="liquid-glass-card rounded-2xl p-6 max-w-sm w-full space-y-4 text-center border border-white/30 dark:border-white/10">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t('settings.users.deleteConfirmTitle', 'Delete this user account?')}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {confirmDelete.firstName} {confirmDelete.lastName} ({confirmDelete.email}) —{' '}
              {t('settings.users.deleteConfirmBody', 'this action is permanent and cannot be undone.')}
            </p>
            <div className="flex gap-2.5 pt-1">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition"
              >
                {t('common.delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const UserFormModal: React.FC<{
  editingUser: SystemUser | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ editingUser, onClose, onSaved }) => {
  const { t } = useLanguage();
  const toast = useToast();
  const [form, setForm] = useState({
    firstName: editingUser?.firstName || '',
    lastName: editingUser?.lastName || '',
    email: editingUser?.email || '',
    role: editingUser?.roles?.[0]?.toUpperCase() || 'OPERATOR',
    password: '',
    isActive: editingUser ? editingUser.isActive !== false : true
  });
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.email.trim()) {
      toast.error(t('settings.users.requiredFields', 'First name and email are required.'));
      return;
    }
    if (!editingUser && !form.password) {
      toast.error(t('settings.users.passwordRequired', 'Set an initial password for the new user.'));
      return;
    }
    if (form.password && !/^.{8,}$/.test(form.password)) {
      toast.error(t('settings.users.passwordTooShort', 'Passwords must be at least 8 characters.'));
      return;
    }
    setSaving(true);
    try {
      const preset = ROLE_PRESETS.find(r => r.id === form.role);
      const payload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        roles: [form.role],
        permissions: preset ? preset.permissions : [],
        isActive: form.isActive,
        ...(form.password ? { password: form.password } : {})
      };
      if (editingUser) {
        await api.updateSystemUser(editingUser.id, payload);
        toast.success(t('settings.users.updatedToast', 'User details updated.'), form.email);
      } else {
        await api.createSystemUser(payload);
        toast.success(t('settings.users.createdToast', 'New user account created.'), form.email);
      }
      onSaved();
    } catch (err: any) {
      toast.error(err?.message || t('settings.users.saveError', 'Failed to save the user.'));
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <form onSubmit={submit} className="liquid-glass-card rounded-2xl p-6 max-w-md w-full space-y-4 border border-white/30 dark:border-white/10">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            {editingUser ? t('settings.users.editTitle', 'Edit User Details') : t('settings.users.addTitle', 'Register New User')}
          </h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <input value={form.firstName} onChange={e => set({ firstName: e.target.value })} placeholder={t('settings.users.firstName', 'First name')} className={inputCls} />
          <input value={form.lastName} onChange={e => set({ lastName: e.target.value })} placeholder={t('settings.users.lastName', 'Last name')} className={inputCls} />
        </div>
        <input type="email" value={form.email} onChange={e => set({ email: e.target.value })} placeholder={t('settings.users.email', 'Corporate email address')} className={inputCls} />

        <select value={form.role} onChange={e => set({ role: e.target.value })} className={inputCls}>
          {ROLE_PRESETS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
        </select>

        <input
          type="text"
          value={form.password}
          onChange={e => set({ password: e.target.value })}
          placeholder={editingUser
            ? t('settings.users.newPasswordOptional', 'Set a new password (leave blank to keep current)')
            : t('settings.users.initialPassword', 'Initial password (min 8 characters)')}
          className={inputCls}
        />

        <label className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 cursor-pointer">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
            {t('settings.users.accountActive', 'Account is active')}
          </span>
          <input type="checkbox" checked={form.isActive} onChange={e => set({ isActive: e.target.checked })} className="w-4 h-4 accent-emerald-600" />
        </label>

        <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
          {t('settings.users.roleNote', 'Assigning a role automatically applies its permission set. Role changes take effect at the user\'s next sign-in.')}
        </p>

        <div className="flex gap-2.5 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition">
            {t('common.cancel', 'Cancel')}
          </button>
          <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg transition">
            {saving ? '…' : editingUser ? t('common.save', 'Save Changes') : t('settings.users.create', 'Create User')}
          </button>
        </div>
      </form>
    </div>
  );
};

// ============================================================
// 2. PASSWORD & ACCOUNT SECURITY
// ============================================================
const PasswordSecurityPanel: React.FC = () => {
  const { t } = useLanguage();
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const strength = passwordScore(newPassword);
  const strengthColors = ['bg-rose-500', 'bg-rose-400', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500', 'bg-emerald-400'];
  const strengthTextColors = ['text-rose-500', 'text-rose-400', 'text-amber-500', 'text-lime-600 dark:text-lime-400', 'text-emerald-600 dark:text-emerald-400', 'text-emerald-500'];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('settings.security.fillAll', 'Please fill in all three password fields.'));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t('settings.security.tooShort', 'New password must be at least 8 characters long.'));
      return;
    }
    if (newPassword === currentPassword) {
      toast.error(t('settings.security.samePassword', 'The new password must differ from the current password.'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('settings.security.mismatch', 'New password and confirmation do not match.'));
      return;
    }
    setSaving(true);
    try {
      await api.changePassword({ currentPassword, newPassword });
      toast.success(t('settings.security.successToast', 'Your password has been updated successfully.'));
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.message || t('settings.security.errorToast', 'Failed to update the password.'));
    } finally {
      setSaving(false);
    }
  };

  const field = (
    value: string, onChange: (v: string) => void, placeholder: string, show: boolean, toggle: () => void,
    autoComplete: string
  ) => (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full px-3.5 py-2.5 pr-11 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition"
      />
      <button
        type="button"
        onClick={toggle}
        title={show ? t('settings.security.hide', 'Hide password') : t('settings.security.show', 'Show password')}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );

  return (
    <div className="liquid-glass-card rounded-2xl border border-slate-200/70 dark:border-white/10 p-4 sm:p-5 space-y-4">
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          {t('settings.security.heading', 'Change Your Password')}
        </h2>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
          {t('settings.security.subheading', 'Passwords are validated for strength and confirmed before applying')}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3 max-w-md">
        {field(currentPassword, setCurrentPassword, t('settings.security.current', 'Current password'), showCurrent, () => setShowCurrent(s => !s), 'current-password')}
        {field(newPassword, setNewPassword, t('settings.security.next', 'New password (min 8 characters)'), showNew, () => setShowNew(s => !s), 'new-password')}

        {newPassword && (
          <div className="space-y-1.5">
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < strength.score ? strengthColors[strength.score] : 'bg-slate-200 dark:bg-white/10'}`} />
              ))}
            </div>
            <p className={`text-[10px] font-bold ${strengthTextColors[strength.score]}`}>
              {t('settings.security.strength', 'Strength')}: {strength.label}
            </p>
          </div>
        )}

        {field(confirmPassword, setConfirmPassword, t('settings.security.confirm', 'Confirm new password'), showConfirm, () => setShowConfirm(s => !s), 'new-password')}

        {confirmPassword && newPassword !== confirmPassword && (
          <p className="text-[11px] text-rose-500 font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {t('settings.security.mismatch', 'New password and confirmation do not match.')}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition"
        >
          {saving ? '…' : t('settings.security.updateButton', 'Update Password')}
        </button>
      </form>
    </div>
  );
};

// ============================================================
// 3. APP PASSLOCK & BIOMETRIC LOCK SYSTEM
// ============================================================
const PasslockPanel: React.FC = () => {
  const { t } = useLanguage();
  const toast = useToast();
  const {
    settings, updateSettings, lock, verifyPin, verifyMasterPassword,
    biometricAvailable, verifyBiometric
  } = useLock();

  const [pinDraft, setPinDraft] = useState('');
  const [pinConfirmDraft, setPinConfirmDraft] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [passwordConfirmDraft, setPasswordConfirmDraft] = useState('');
  const [registeringBiometric, setRegisteringBiometric] = useState(false);

  const hasPin = Boolean(settings.pinHash);
  const hasMasterPassword = Boolean(settings.masterPasswordHash);
  const hasBiometric = Boolean(settings.biometricCredentialId);

  const savePin = async () => {
    if (!/^\d{4,6}$/.test(pinDraft)) {
      toast.error(t('settings.lock.pinFormat', 'PIN must be 4 to 6 digits.'));
      return;
    }
    if (pinDraft !== pinConfirmDraft) {
      toast.error(t('settings.lock.pinMismatch', 'PIN entries do not match.'));
      return;
    }
    updateSettings({ pinHash: await hashSecret(pinDraft), pinEnabled: true });
    setPinDraft(''); setPinConfirmDraft('');
    toast.success(t('settings.lock.pinSaved', 'Quick PIN registered.'));
  };

  const removePin = () => {
    updateSettings({ pinHash: null, pinEnabled: false });
    toast.info(t('settings.lock.pinRemoved', 'Quick PIN removed.'));
  };

  const saveMasterPassword = async () => {
    if (passwordDraft.length < 8) {
      toast.error(t('settings.lock.passwordTooShort', 'Master password must be at least 8 characters.'));
      return;
    }
    if (passwordDraft !== passwordConfirmDraft) {
      toast.error(t('settings.lock.passwordMismatch', 'Password entries do not match.'));
      return;
    }
    updateSettings({ masterPasswordHash: await hashSecret(passwordDraft), passwordEnabled: true });
    setPasswordDraft(''); setPasswordConfirmDraft('');
    toast.success(t('settings.lock.passwordSaved', 'Master password registered.'));
  };

  const removeMasterPassword = () => {
    updateSettings({ masterPasswordHash: null, passwordEnabled: false });
    toast.info(t('settings.lock.passwordRemoved', 'Master password unlock removed.'));
  };

  const registerBiometric = async () => {
    setRegisteringBiometric(true);
    const credentialId = await registerBiometricCredential();
    setRegisteringBiometric(false);
    if (!credentialId) {
      toast.error(t('settings.lock.biometricRegisterFailed', 'Biometric registration failed or was cancelled. PIN/password remain available as fallback.'));
      return;
    }
    updateSettings({ biometricCredentialId: credentialId, biometricEnabled: true });
    toast.success(t('settings.lock.biometricRegistered', 'Biometric unlock registered on this device.'));
  };

  const testBiometric = async () => {
    const ok = await verifyBiometric();
    toast[ok ? 'success' : 'error'](ok
      ? t('settings.lock.biometricTestOk', 'Biometric verification succeeded.')
      : t('settings.lock.biometricTestFailed', 'Biometric verification failed.'));
  };

  const removeBiometric = () => {
    updateSettings({ biometricCredentialId: null, biometricEnabled: false });
    toast.info(t('settings.lock.biometricRemoved', 'Biometric unlock removed.'));
  };

  const cardCls = 'rounded-2xl bg-white/50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 p-4 space-y-3';
  const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition';

  return (
    <div className="space-y-4">
      {/* Master enable */}
      <div className="liquid-glass-card rounded-2xl border border-slate-200/70 dark:border-white/10 p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              {t('settings.lock.heading', 'App Passlock System')}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 max-w-md">
              {t('settings.lock.subheading', 'Locks the interface on startup, after inactivity, or via Ctrl+L / Cmd+L until a configured unlock method verifies.')}
            </p>
          </div>
          <button
            role="switch"
            aria-checked={settings.enabled}
            onClick={() => {
              const next = !settings.enabled;
              updateSettings({ enabled: next });
              toast[next ? 'success' : 'info'](
                next ? t('settings.lock.enabledToast', 'Passlock armed — the app will lock on next startup or idle timeout.')
                     : t('settings.lock.disabledToast', 'Passlock disarmed.'));
            }}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 mt-1 ${settings.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-white/15'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${settings.enabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0">
            {t('settings.lock.inactivityLabel', 'Auto-lock after inactivity:')}
          </label>
          <select
            value={settings.inactivityMinutes}
            onChange={e => updateSettings({ inactivityMinutes: Number(e.target.value) })}
            disabled={!settings.enabled}
            className="px-3 py-2 rounded-xl bg-white/70 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition disabled:opacity-50"
          >
            {[5, 15, 30, 60].map(m => <option key={m} value={m}>{m} {t('settings.lock.minutes', 'minutes')}</option>)}
          </select>
          <button
            onClick={lock}
            disabled={!settings.enabled}
            className="sm:ml-auto inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold transition"
          >
            <Lock className="w-3.5 h-3.5" />
            {t('settings.lock.lockNow', 'Lock Now')}
          </button>
        </div>
      </div>

      {/* Unlock methods */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Quick PIN */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MonitorSmartphone className="w-4 h-4" />
            </span>
            <div className="flex-1">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">{t('settings.lock.pinTitle', 'Quick PIN Lock')}</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('settings.lock.pinDesc', '4-to-6 digit numeric PIN pad')}</p>
            </div>
            {hasPin && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          </div>
          {hasPin ? (
            <div className="flex gap-2">
              <button onClick={removePin} className="flex-1 py-2 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold border border-rose-500/30 transition">
                {t('settings.lock.remove', 'Remove')}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="password" inputMode="numeric" maxLength={6}
                value={pinDraft}
                onChange={e => setPinDraft(e.target.value.replace(/\D/g, ''))}
                placeholder={t('settings.lock.pinEnter', 'Enter 4-6 digit PIN')}
                className={inputCls}
              />
              <input
                type="password" inputMode="numeric" maxLength={6}
                value={pinConfirmDraft}
                onChange={e => setPinConfirmDraft(e.target.value.replace(/\D/g, ''))}
                placeholder={t('settings.lock.pinConfirm', 'Confirm PIN')}
                className={inputCls}
              />
              <button onClick={savePin} className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition">
                {t('settings.lock.pinSave', 'Register PIN')}
              </button>
            </div>
          )}
        </div>

        {/* Master password */}
        <div className={cardCls}>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <KeyRound className="w-4 h-4" />
            </span>
            <div className="flex-1">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">{t('settings.lock.passwordTitle', 'Master Password Unlock')}</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{t('settings.lock.passwordDesc', 'Standard password prompt on the lock screen')}</p>
            </div>
            {hasMasterPassword && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          </div>
          {hasMasterPassword ? (
            <button onClick={removeMasterPassword} className="w-full py-2 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold border border-rose-500/30 transition">
              {t('settings.lock.remove', 'Remove')}
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="password"
                value={passwordDraft}
                onChange={e => setPasswordDraft(e.target.value)}
                placeholder={t('settings.lock.passwordEnter', 'Master password (min 8 characters)')}
                className={inputCls}
              />
              <input
                type="password"
                value={passwordConfirmDraft}
                onChange={e => setPasswordConfirmDraft(e.target.value)}
                placeholder={t('settings.lock.passwordConfirm', 'Confirm master password')}
                className={inputCls}
              />
              <button onClick={saveMasterPassword} className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition">
                {t('settings.lock.passwordSave', 'Register Master Password')}
              </button>
            </div>
          )}
        </div>

        {/* Biometric */}
        <div className={`${cardCls} md:col-span-2`}>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-600 dark:text-violet-400 flex items-center justify-center">
              <Fingerprint className="w-4 h-4" />
            </span>
            <div className="flex-1">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">{t('settings.lock.biometricTitle', 'Fingerprint / Biometric Unlock')}</h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {t('settings.lock.biometricDesc', 'WebAuthn passkeys via Windows Hello, Touch ID or Android biometrics — falls back to PIN/password automatically')}
              </p>
            </div>
            {hasBiometric && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border ${
              biometricAvailable
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${biometricAvailable ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {biometricAvailable
                ? t('settings.lock.biometricReady', 'Biometric hardware detected')
                : t('settings.lock.biometricNotDetected', 'No biometric hardware on this device')}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasBiometric ? (
              <>
                <button onClick={testBiometric} className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold transition">
                  {t('settings.lock.biometricTest', 'Test Verification')}
                </button>
                <button onClick={removeBiometric} className="px-3.5 py-2 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold border border-rose-500/30 transition">
                  {t('settings.lock.remove', 'Remove')}
                </button>
              </>
            ) : (
              <button
                onClick={registerBiometric}
                disabled={registeringBiometric || !biometricAvailable}
                className="px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-[11px] font-bold shadow-lg transition"
              >
                {registeringBiometric ? '…' : t('settings.lock.biometricRegister', 'Register This Device')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 4. LIVE SOFTWARE UPDATE & VERSION CONTROL
// ============================================================
const CHANGELOG_TYPE_STYLE: Record<string, string> = {
  feature: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/60',
  fix: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/80 dark:text-sky-300 dark:border-sky-800/60',
  security: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800/60',
  release: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/80 dark:text-violet-300 dark:border-violet-800/60'
};

const SoftwareUpdatePanel: React.FC = () => {
  const { t } = useLanguage();
  const toast = useToast();
  const [checking, setChecking] = useState(false);
  const [manifest, setManifest] = useState<UpdateManifest | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isDowngrade, setIsDowngrade] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(() => localStorage.getItem('aq_last_update_check'));
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const runCheck = async (silent: boolean) => {
    setChecking(true);
    const result = await checkForUpdates();
    setChecking(false);
    if (result.manifest) {
      setManifest(result.manifest);
      setUpdateAvailable(result.updateAvailable);
      setIsDowngrade(result.isDowngrade);
      if (!silent && !result.updateAvailable) {
        toast.success(t('settings.updates.upToDate', 'You are running the latest version.'), APP_VERSION);
      }
      if (!silent && result.updateAvailable) {
        toast.info(t('settings.updates.availableToast', 'A new version is available.'));
      }
    } else if (!silent) {
      toast.error(t('settings.updates.manifestError', 'Could not reach the update manifest (version.json).'));
    }
    localStorage.setItem('aq_last_update_check', result.checkedAt);
    setLastChecked(result.checkedAt);
  };

  // Check on mount (app launch also triggers a global check in App)
  useEffect(() => { runCheck(true); }, []);

  const changelog: ChangelogEntry[] = manifest?.changelog?.length ? manifest.changelog : DEFAULT_CHANGELOG;

  return (
    <div className="space-y-4">
      {updateAvailable && manifest && (
        <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 to-teal-500/10 p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {t('settings.updates.availableTitle', 'Update Available')} — {manifest.version}
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  {manifest.notes || t('settings.updates.availableBody', 'A newer build has been published. Update now to pull the latest release.')}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={async () => {
                toast.info(t('settings.updates.restarting', 'Updating and restarting…'));
                await updateAndRestart();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              {t('settings.updates.updateNow', 'Update & Reload Now')}
            </button>
            {manifest.minimumRequired && (
              <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-[11px] font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t('settings.updates.minimumRequired', 'This update is required')}
              </span>
            )}
          </div>
        </div>
      )}

      {isDowngrade && manifest && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            {t('settings.updates.downgradeNotice', 'The remote manifest reports an older version than this installation. No action needed.')}
          </p>
        </div>
      )}

      {/* Current version card */}
      <div className="liquid-glass-card rounded-2xl border border-slate-200/70 dark:border-white/10 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-slate-900 dark:bg-white/10 text-emerald-400 flex items-center justify-center shrink-0">
              <Cpu className="w-5 h-5" />
            </span>
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                {t('settings.updates.installedVersion', 'Current Installed Version')}
              </div>
              <div className="text-lg font-bold text-slate-900 dark:text-white font-mono tracking-tight">{APP_VERSION}</div>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-1">
            <button
              onClick={() => runCheck(false)}
              disabled={checking}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              {checking ? t('settings.updates.checking', 'Checking…') : t('settings.updates.checkNow', 'Check for Updates')}
            </button>
            {lastChecked && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {t('settings.updates.lastChecked', 'Last checked')}: {new Date(lastChecked).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {!updateAvailable && manifest && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
              {t('settings.updates.upToDateLine', 'This installation is up to date')} — {t('settings.updates.remoteVersion', 'remote version')}: {manifest.version}
            </p>
          </div>
        )}
      </div>

      {/* Changelog viewer */}
      <div className="liquid-glass-card rounded-2xl border border-slate-200/70 dark:border-white/10 p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          {t('settings.updates.changelogTitle', 'Release Notes / Changelog')}
        </h3>
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {changelog.map(entry => {
            const expanded = expandedEntry === entry.version || compareVersionTags(APP_VERSION, entry.version) === 0;
            return (
              <div key={entry.version} className="rounded-xl bg-white/50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 overflow-hidden">
                <button
                  onClick={() => setExpandedEntry(expanded ? null : entry.version)}
                  className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left hover:bg-white/60 dark:hover:bg-white/10 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`px-2 py-0.5 rounded-md text-[9px] font-mono font-bold border shrink-0 ${CHANGELOG_TYPE_STYLE[entry.type] || CHANGELOG_TYPE_STYLE.release}`}>
                      {entry.type.toUpperCase()}
                    </span>
                    <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{entry.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{entry.version}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">{entry.releaseDate}</span>
                  </div>
                </button>
                {expanded && (
                  <ul className="px-3.5 pb-3 pt-1 space-y-1.5">
                    {entry.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        <span className="w-1 h-1 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// 5. SYSTEM INFO & DEVELOPER ATTRIBUTION
// ============================================================
const AboutPanel: React.FC = () => {
  const { t } = useLanguage();
  const [uptimeSec] = useState(() => Math.floor(performance.now() / 1000));

  const infoRows: Array<{ label: string; value: string }> = [
    { label: t('settings.about.systemBuild', 'System Build'), value: APP_VERSION },
    { label: t('settings.about.codename', 'Release Codename'), value: APP_CODENAME },
    { label: t('settings.about.buildDate', 'Build Date'), value: APP_BUILD_DATE },
    { label: t('settings.about.environment', 'Runtime Environment'), value: navigator.userAgent.includes('Chrome') ? 'Chromium Browser Client' : 'Web Browser Client' },
    { label: t('settings.about.screen', 'Display'), value: `${window.screen.width}×${window.screen.height} @ ${window.devicePixelRatio}x` },
    { label: t('settings.about.uptime', 'Session Uptime'), value: `${Math.floor(uptimeSec / 60)} min` }
  ];

  return (
    <div className="space-y-4">
      <div className="liquid-glass-card rounded-2xl border border-slate-200/70 dark:border-white/10 p-5 sm:p-6 space-y-5">
        {/* Identity */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 text-center sm:text-left">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 shadow-lg p-2 shrink-0">
            <img src="/logo.png" alt="AQ Companies" className="w-full h-full object-contain" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {t('nav.portalTitle', 'AQ COMPANIES')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('nav.portalSubtitle', 'Sky Ariana Ltd Corporate Portal')}
            </p>
            <span className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="w-3.5 h-3.5" />
              {APP_VERSION} • {t('settings.about.licensed', 'ENTERPRISE LICENSE')}
            </span>
          </div>
        </div>

        <div className="h-px bg-slate-200/80 dark:bg-white/10" />

        {/* System info rows */}
        <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
          {infoRows.map(row => (
            <div key={row.label} className="flex items-center justify-between gap-3 py-1 border-b border-dashed border-slate-200/70 dark:border-white/5">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">{row.label}</span>
              <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 text-right truncate">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Developer attribution signature */}
      <div className="liquid-glass-card rounded-2xl border border-emerald-500/30 dark:border-emerald-500/20 p-5 sm:p-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-center gap-4 relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center text-lg font-bold shadow-lg shadow-emerald-600/25 shrink-0">
            AQ
          </div>
          <div className="flex-1 text-center sm:text-left">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400 font-bold">
              {t('settings.about.leadDeveloper', 'Lead Developer / Architect')}
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {LEAD_DEVELOPER}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 italic">
              {t('settings.about.signatureLine', 'Design, architecture & engineering of the AQ Companies enterprise platform.')}
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-[9px] font-mono font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest shrink-0">
            {t('settings.about.officialSignature', 'Official Signature')}
          </span>
        </div>
      </div>
    </div>
  );
};
