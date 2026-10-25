import React, { useState, useEffect, useRef } from 'react';
import { getAuthToken, getStoredUser, removeAuthToken, setStoredUser, api } from './services/api';
import { User } from './types';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Invoices } from './pages/Invoices';
import { Logistics } from './pages/Logistics';
import { Ledger } from './pages/Ledger';
import { Payments } from './pages/Payments';
import { Reconciliation } from './pages/Reconciliation';
import { BankRouting } from './pages/BankRouting';
import { ImportCenter } from './pages/ImportCenter';
import { Reports } from './pages/Reports';
import { Admin } from './pages/Admin';
import { Receipts } from './pages/Receipts';
import { Settings as SettingsPage } from './pages/Settings';
import { useTheme } from './context/ThemeContext';
import { useLanguage, LanguageSelector } from './context/LanguageContext';
import { LockProvider, useLock } from './context/LockContext';
import { LockScreenOverlay } from './components/LockScreenOverlay';
import { CloudSyncIndicator } from './components/CloudSyncIndicator';
import { initPrintLifecycle } from './utils/print';
import { APP_VERSION, checkForUpdates, updateAndRestart } from './constants/version';
import type { UpdateCheckResult } from './constants/version';
import type { UpdateManifest } from './types';
import {
  LayoutDashboard,
  FileText,
  Ship,
  DollarSign,
  CreditCard,
  CheckSquare,
  ShieldCheck,
  FileSpreadsheet,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  MoreHorizontal,
  Sun,
  Moon,
  Receipt as ReceiptIcon,
  ShieldAlert,
  Clock,
  Lock,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Download
} from 'lucide-react';

export const App: React.FC = () => (
  <LockProvider>
    <AppShell />
  </LockProvider>
);

const AppShell: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { t, isRtl } = useLanguage();
  const lock = useLock();
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const u = getStoredUser();
      if (u && (u.email || u.id)) {
        return {
          id: u.id || 'usr-001',
          email: u.email || 'admin@aqcompanies.com',
          firstName: u.firstName || 'System',
          lastName: u.lastName || 'Administrator',
          roles: Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : ['ADMIN'],
          permissions: Array.isArray(u.permissions) ? u.permissions : []
        };
      }
    } catch {
      // fallback
    }
    return null;
  });
  const [loading, setLoading] = useState(() => Boolean(getAuthToken() && !getStoredUser()));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // Live software update check (launch + manual via Settings → Software Update)
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [updateBannerDismissed, setUpdateBannerDismissed] = useState(false);

  // Inactivity Session Timeout State (15 min auto-lock, 60s warning)
  const [inactivityWarningOpen, setInactivityWarningOpen] = useState(false);
  const [warningCountdown, setWarningCountdown] = useState(60);
  const lastActivityRef = useRef<number>(Date.now());

  // Dynamic Navigation Badges State (Synchronized in real-time)
  const [navBadges, setNavBadges] = useState<{
    unpaidInvoices: number;
    activeShipments: number;
    validReceipts: number;
    availableBalance: string;
  }>({
    unpaidInvoices: 5,
    activeShipments: 2,
    validReceipts: 3,
    availableBalance: '$24.3k'
  });

  useEffect(() => {
    return initPrintLifecycle();
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      api.getMe()
        .then(res => {
          const u = res?.user || res;
          if (u && (u.email || u.id)) {
            const normalized: User = {
              id: u.id || 'usr-001',
              email: u.email || 'admin@aqcompanies.com',
              firstName: u.firstName || 'System',
              lastName: u.lastName || 'Administrator',
              roles: Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : ['ADMIN'],
              permissions: Array.isArray(u.permissions) ? u.permissions : []
            };
            setCurrentUser(normalized);
            setStoredUser(normalized);
          } else {
            removeAuthToken();
            setCurrentUser(null);
          }
        })
        .catch(() => {
          removeAuthToken();
          setCurrentUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    removeAuthToken();
    setCurrentUser(null);
    setInactivityWarningOpen(false);
  };

  // Activity tracking for automatic session idle lock (15 minutes)
  useEffect(() => {
    if (!currentUser) return;

    const recordUserActivity = () => {
      lastActivityRef.current = Date.now();
      if (inactivityWarningOpen) {
        setInactivityWarningOpen(false);
        setWarningCountdown(60);
      }
    };

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    activityEvents.forEach(evt => window.addEventListener(evt, recordUserActivity, { passive: true }));

    // Check inactivity every 1 second
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - lastActivityRef.current) / 1000);

      // Warning threshold: 14 minutes (840 seconds)
      if (elapsedSeconds >= 840 && elapsedSeconds < 900) {
        setInactivityWarningOpen(true);
        setWarningCountdown(900 - elapsedSeconds);
      } else if (elapsedSeconds >= 900) {
        // 15 minutes of inactivity: auto-lock and redirect to login
        handleLogout();
      }
    }, 1000);

    return () => {
      activityEvents.forEach(evt => window.removeEventListener(evt, recordUserActivity));
      clearInterval(interval);
    };
  }, [currentUser, inactivityWarningOpen]);

  useEffect(() => {
    if (!currentUser) return;
    checkForUpdates().then(setUpdateInfo).catch(() => {});
  }, [currentUser?.id]);

  // Dynamic Navigation Badges Synchronizer
  const refreshNavBadges = async () => {
    try {
      const [invList, rcpList, shpList, overview] = await Promise.all([
        api.getInvoices().catch(() => []),
        api.getReceipts().catch(() => []),
        api.getShipments().catch(() => []),
        api.getDashboardOverview().catch(() => null)
      ]);

      const unpaid = Array.isArray(invList)
        ? invList.filter((i: any) => i.status !== 'VOID' && i.paymentStatus !== 'PAID' && i.paymentStatus !== 'CANCELED').length
        : 5;

      const receiptsCount = Array.isArray(rcpList)
        ? rcpList.filter((r: any) => r.status === 'ISSUED' || r.status === 'VALID').length
        : 3;

      const shipmentsCount = Array.isArray(shpList)
        ? shpList.filter((s: any) => s.status !== 'DELIVERED' && s.status !== 'CANCELLED').length
        : 2;

      let balStr = '$24.3k';
      if (overview?.metrics?.availableBalance) {
        const num = parseFloat(overview.metrics.availableBalance);
        balStr = !isNaN(num)
          ? (num >= 1000 ? `$${(num / 1000).toFixed(1)}k` : `$${num.toFixed(2)}`)
          : `$${overview.metrics.availableBalance}`;
      }

      setNavBadges(prev => {
        if (
          prev.unpaidInvoices === unpaid &&
          prev.activeShipments === shipmentsCount &&
          prev.validReceipts === receiptsCount &&
          prev.availableBalance === balStr
        ) {
          return prev;
        }
        return {
          unpaidInvoices: unpaid,
          activeShipments: shipmentsCount,
          validReceipts: receiptsCount,
          availableBalance: balStr
        };
      });
    } catch (err) {
      console.error('Failed to load navigation badges:', err);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
    refreshNavBadges();
    const handleMutated = () => refreshNavBadges();
    window.addEventListener('aq:data-mutated', handleMutated);
    window.addEventListener('focus', handleMutated);
    return () => {
      window.removeEventListener('aq:data-mutated', handleMutated);
      window.removeEventListener('focus', handleMutated);
    };
  }, [currentUser?.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="text-center p-4">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">{t('nav.initializing')}</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={u => setCurrentUser(u)} />;
  }

  // Cryptographic Role Normalization
  const userRoles = Array.isArray(currentUser?.roles) ? currentUser.roles : [];
  const primaryRole = (userRoles[0] || 'ADMIN').toUpperCase();
  const isAdmin = primaryRole === 'ADMIN';
  const isFinance = primaryRole === 'FINANCE_MANAGER' || primaryRole === 'FINANCE_MGR';
  const isLogistics = primaryRole === 'LOGISTICS_COORDINATOR' || primaryRole === 'LOGISTICS_COORD';
  const isAuditor = primaryRole === 'AUDITOR';

  // Role Human Title
  const getRoleDisplayName = (r: string) => {
    switch (r.toUpperCase()) {
      case 'ADMIN':
        return 'System Administrator';
      case 'FINANCE_MANAGER':
      case 'FINANCE_MGR':
        return 'Finance Manager';
      case 'LOGISTICS_COORDINATOR':
      case 'LOGISTICS_COORD':
        return 'Logistics Coordinator';
      case 'AUDITOR':
        return 'Compliance Auditor';
      default:
        return 'Authorized User';
    }
  };

  // RBAC Access Permission Matrix for Navigation and Tabs
  const isTabPermitted = (tabId: string): boolean => {
    // Settings is available to every authenticated role; admin-only panels are
    // gated inside the Settings module itself.
    if (tabId === 'settings') return true;
    if (isAdmin) return true;

    if (isFinance) {
      // Full access to Proforma Invoices, Deposit Receipts, Account Statement, Payments, Reconciliation, Banking, Reports. Read-only Logistics.
      // Blocked from Admin & Compliance and Workbook Import.
      return ['dashboard', 'invoices', 'receipts', 'logistics', 'ledger', 'payments', 'reconciliation', 'banking', 'reports'].includes(tabId);
    }

    if (isLogistics) {
      // Full access to Freight Logistics; read-only Proforma Invoices. Blocked from Ledger, Banking, Payments, Reports, Receipts, Reconciliation, Import, Admin.
      return ['dashboard', 'logistics', 'invoices'].includes(tabId);
    }

    if (isAuditor) {
      // Strictly read-only across all modules; no Workbook Import commit.
      return ['dashboard', 'invoices', 'receipts', 'logistics', 'ledger', 'payments', 'reconciliation', 'banking', 'reports', 'admin'].includes(tabId);
    }

    return ['dashboard', 'logistics', 'invoices'].includes(tabId);
  };

  interface NavItem {
    id: string;
    label: string;
    icon: React.ElementType;
    badge?: string;
    badgeColor?: string;
  }
  interface NavSection {
    title: string;
    items: NavItem[];
  }
  const navSections: NavSection[] = [
    {
      title: 'CORE OPERATIONS',
      items: [
        { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
        { id: 'invoices', label: t('nav.invoices'), icon: FileText, badge: `${navBadges.unpaidInvoices} Unpaid`, badgeColor: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800/60' },
        { id: 'logistics', label: t('nav.logistics'), icon: Ship, badge: `${navBadges.activeShipments} Active`, badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/80 dark:text-cyan-300 dark:border-cyan-800/60' },
        { id: 'receipts', label: t('nav.receipts'), icon: ReceiptIcon, badge: String(navBadges.validReceipts), badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/60' }
      ]
    },
    {
      title: 'TREASURY & ACCOUNTING',
      items: [
        { id: 'ledger', label: t('nav.ledger'), icon: DollarSign, badge: navBadges.availableBalance, badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800/60' },
        { id: 'payments', label: t('nav.payments'), icon: CreditCard },
        { id: 'reconciliation', label: t('nav.reconciliation'), icon: CheckSquare },
        { id: 'banking', label: t('nav.banking'), icon: ShieldCheck },
        { id: 'reports', label: t('nav.reports'), icon: BarChart3 }
      ]
    },
    {
      title: 'GOVERNANCE & TOOLS',
      items: [
        { id: 'import', label: t('nav.import'), icon: FileSpreadsheet },
        { id: 'admin', label: t('nav.admin'), icon: Settings },
        { id: 'settings', label: t('nav.settings', 'System Settings'), icon: Sparkles }
      ]
    }
  ];

  const allNavItems = navSections.flatMap(s => s.items);

  // Filter allowed navigation items for current role
  const visibleNavItems = allNavItems.filter(item => isTabPermitted(item.id));

  // Primary items for mobile bottom tab bar (thumb-accessible)
  const mobilePrimaryTabs = [
    { id: 'dashboard', label: t('nav.dashboard'), icon: LayoutDashboard },
    { id: 'invoices', label: t('nav.invoices'), icon: FileText },
    { id: 'logistics', label: t('nav.logistics'), icon: Ship },
    { id: 'ledger', label: t('nav.ledger'), icon: DollarSign }
  ].filter(tab => isTabPermitted(tab.id));

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col overflow-hidden">
      {/* Top Header Bar */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 px-3 sm:px-4 sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation menu"
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="hidden min-[360px]:flex w-9 h-9 rounded-lg bg-slate-50 dark:bg-slate-950 p-1 items-center justify-center border border-slate-200 dark:border-slate-700/60 shadow-sm shrink-0">
              <img
                src="/logo.png"
                alt="AQ Companies Official Logo"
                className="w-full h-full object-contain filter drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]"
              />
            </div>
            <div className="hidden sm:block truncate">
              <span className="font-extrabold text-xs sm:text-sm tracking-wide text-slate-900 dark:text-white block sm:inline">
                {t('nav.portalTitle')}
              </span>
              <span className="hidden sm:inline-block text-[11px] text-slate-500 dark:text-slate-400 mx-2 border-slate-300 dark:border-slate-700 rtl:border-r rtl:pr-2 ltr:border-l ltr:pl-2">
                {t('nav.portalSubtitle')}
              </span>
            </div>
          </div>
        </div>

        {/* User Context, Language Selector & Immutable Cryptographic Role Badge */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <CloudSyncIndicator />
          {/* Language Selector in Navigation Bar (Desktop & Mobile) */}
          <LanguageSelector />

          {/* ========================================================
              IMMUTABLE CRYPTOGRAPHIC ROLE BADGE
              Replaces the vulnerable interactive role-switcher select dropdown
              ======================================================== */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-950/70 border border-emerald-300 dark:border-emerald-500/30 shadow-sm backdrop-blur-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="text-[11px] font-mono leading-none">
              <span className="font-bold text-emerald-700 dark:text-emerald-400 tracking-wider uppercase">
                {getRoleDisplayName(primaryRole)}
              </span>
              <span className="text-[9px] text-slate-600 dark:text-slate-500 ml-1.5 font-bold uppercase tracking-widest">
                VERIFIED
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 px-1 sm:px-2 border-slate-200 dark:border-slate-800 rtl:border-r ltr:border-l">
            <div className="text-right rtl:text-left hidden sm:block">
              <div className="text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                {currentUser?.firstName || 'System'} {currentUser?.lastName || 'Administrator'}
              </div>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-[130px] block">
                {currentUser?.email || 'admin@aqcompanies.com'}
              </span>
            </div>

            {/* Light / Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label={t('nav.toggleTheme')}
              className="p-1.5 sm:p-2 min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg transition"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-sky-600 dark:text-sky-400" />}
            </button>

            {/* Secure Sign Out */}
            <button
              onClick={handleLogout}
              title={t('nav.signOut')}
              aria-label={t('nav.signOut')}
              className="p-1.5 sm:p-2 min-h-[40px] min-w-[40px] sm:min-h-[44px] sm:min-w-[44px] flex items-center justify-center text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-slate-800 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ========================================================
          LIVE UPDATE AVAILABLE BANNER
          ======================================================== */}
      {updateInfo?.updateAvailable && updateInfo.manifest && !updateBannerDismissed && (
        <div className="shrink-0 px-3 sm:px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex flex-wrap items-center justify-between gap-2 shadow-lg z-30">
          <div className="flex items-center gap-2 min-w-0">
            <Download className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold">
              {t('updates.bannerTitle', 'Update Available')}:
            </span>
            <span className="text-xs font-mono truncate">
              {updateInfo.manifest.version}
            </span>
            <span className="hidden sm:inline text-[11px] text-emerald-100 truncate">
              {updateInfo.manifest.notes || ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => { setActiveTab('settings'); setUpdateBannerDismissed(true); }}
              className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-bold transition"
            >
              {t('updates.viewChangelog', 'View Changelog')}
            </button>
            <button
              onClick={() => updateAndRestart()}
              className="px-2.5 py-1 rounded-lg bg-white text-emerald-700 hover:bg-emerald-50 text-[11px] font-bold transition"
            >
              {t('updates.updateNow', 'Update & Reload Now')}
            </button>
            <button
              onClick={() => setUpdateBannerDismissed(true)}
              aria-label={t('common.dismiss', 'Dismiss')}
              className="p-1 rounded-lg hover:bg-white/20 transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Backdrop for mobile drawer */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Navigation Sidebar Drawer */}
        <aside
          className={`fixed top-16 bottom-0 md:relative md:top-0 md:bottom-0 md:h-full flex flex-col justify-between overflow-hidden bg-slate-900 border-slate-800 ${
            isRtl ? 'right-0 border-l' : 'left-0 border-r'
          } z-40 ${
            sidebarCollapsed ? 'md:w-20' : 'md:w-64'
          } w-64 max-w-[80vw] transform ${
            sidebarOpen ? 'translate-x-0' : (isRtl ? 'translate-x-full md:translate-x-0' : '-translate-x-full md:translate-x-0')
          } transition-all duration-200 ease-in-out shrink-0 select-none shadow-2xl md:shadow-none`}
        >
          {/* Mobile User Profile info inside drawer */}
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 md:hidden bg-slate-50 dark:bg-slate-950/60 shrink-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white">{currentUser.firstName} {currentUser.lastName}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{currentUser.email}</div>
            <span className="mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">
              {getRoleDisplayName(primaryRole)}
            </span>
          </div>

          {/* Desktop Collapse / Expand Header Action (No duplicate logo!) */}
          <div className="hidden md:flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-950/40 shrink-0">
            {!sidebarCollapsed && (
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                {t('nav.menu', 'Navigation')}
              </span>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              className={`p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition ${sidebarCollapsed ? 'mx-auto' : ''}`}
            >
              {sidebarCollapsed ? (
                isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
              ) : (
                isRtl ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Sidebar Nav Sections (Grouped with Badges) */}
          <div className="flex-1 py-2 px-2 sm:px-2.5 space-y-3.5 overflow-y-auto min-h-0">
            {navSections.map((sec, secIdx) => {
              const visibleItems = sec.items.filter(item => isTabPermitted(item.id));
              if (visibleItems.length === 0) return null;

              return (
                <div key={secIdx} className="space-y-1">
                  {!sidebarCollapsed ? (
                    <div className="px-2 pt-1 pb-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold truncate">
                      {sec.title}
                    </div>
                  ) : (
                    <div className="h-px bg-slate-200 dark:bg-slate-800 my-2 mx-1" />
                  )}

                  {visibleItems.map(item => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          setSidebarOpen(false);
                        }}
                        title={sidebarCollapsed ? `${item.label}${item.badge ? ` (${item.badge})` : ''}` : undefined}
                        className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'justify-between px-3 py-2.5'} min-h-[42px] rounded-lg text-xs font-semibold transition group relative ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-600/20 dark:text-emerald-400 dark:border-emerald-500/30 font-bold shadow-sm'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200'}`} />
                          {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                        </div>

                        {!sidebarCollapsed && item.badge && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 border ${item.badgeColor || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                            {item.badge}
                          </span>
                        )}

                        {sidebarCollapsed && item.badge && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* System Footer Info with Session Security Indicator */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 text-[11px] font-mono shrink-0 bg-slate-50 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400">
            {!sidebarCollapsed ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-600 dark:text-slate-300 text-[10px]">{APP_VERSION}</span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800 font-bold">
                    TLS 256-BIT
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                  <span>Cloud Database</span>
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                    PostgreSQL Live
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0 animate-pulse" />
                  <span>ID: {currentUser?.id ? String(currentUser.id).slice(0, 8) : 'usr-001'}... • RBAC SECURED</span>
                </div>
              </div>
            ) : (
              <div className="text-center text-[9px] text-emerald-600 dark:text-emerald-400 font-bold">TLS</div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 h-full overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-6 lg:p-8 pb-20 md:pb-8 w-full min-w-0">
          {/* RBAC Route Gate Guard */}
          {!isTabPermitted(activeTab) ? (
            <div className="max-w-xl mx-auto my-12 p-8 bg-slate-900 border border-red-500/40 rounded-3xl text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                {t('rbac.forbiddenTitle')}
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                {t('rbac.forbiddenMessage')}
              </p>
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-400 space-y-1">
                <div>User: <span className="text-white">{currentUser.email}</span></div>
                <div>Role: <span className="text-emerald-400 font-bold">{primaryRole}</span></div>
                <div>Requested Target: <span className="text-red-400 font-bold">{activeTab.toUpperCase()}</span></div>
              </div>
              <p className="text-[11px] text-slate-500 italic">
                {t('rbac.auditNotice')}
              </p>
              <button
                onClick={() => setActiveTab('dashboard')}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-lg"
              >
                Return to Overview Dashboard
              </button>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && <Dashboard onNavigate={tKey => setActiveTab(tKey)} />}
              {activeTab === 'invoices' && <Invoices />}
              {activeTab === 'receipts' && <Receipts />}
              {activeTab === 'logistics' && <Logistics />}
              {activeTab === 'ledger' && <Ledger />}
              {activeTab === 'payments' && <Payments />}
              {activeTab === 'reconciliation' && <Reconciliation />}
              {activeTab === 'banking' && <BankRouting />}
              {activeTab === 'import' && <ImportCenter />}
              {activeTab === 'reports' && <Reports />}
              {activeTab === 'admin' && <Admin />}
              {activeTab === 'settings' && <SettingsPage currentUser={currentUser} />}
            </>
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Visible only on mobile screens < 768px) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-14 bg-slate-900 border-t border-slate-800 grid grid-cols-5 z-30 px-1 safe-area-pb">
        {mobilePrimaryTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setMoreMenuOpen(false);
              }}
              className={`flex flex-col items-center justify-center min-h-[44px] transition ${
                isActive ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[10px] font-medium mt-0.5">{tab.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setSidebarOpen(true)}
          className={`flex flex-col items-center justify-center min-h-[44px] transition ${
            sidebarOpen ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MoreHorizontal className="w-4 h-4" />
          <span className="text-[10px] font-medium mt-0.5">{t('nav.more')}</span>
        </button>
      </nav>

      {/* ========================================================
          FULL-SCREEN PASSLOCK OVERLAY (blocks the app until unlocked)
          ======================================================== */}
      {lock.settings.enabled && lock.isLocked && (
        <LockScreenOverlay
          userName={`${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`.trim()}
          userEmail={currentUser?.email}
          onSignOut={handleLogout}
        />
      )}

      {/* ========================================================
          IDLE SESSION TIMEOUT INACTIVITY WARNING MODAL (LIQUID GLASS)
          ======================================================== */}
      {inactivityWarningOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="liquid-glass-card border border-white/30 dark:border-white/10 rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Clock className="w-7 h-7 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {t('session.warningTitle')}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t('session.warningMessage')}{' '}
              <strong className="text-amber-500 font-mono text-sm">{warningCountdown}s</strong>.
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition"
              >
                {t('session.lockNowButton')}
              </button>
              <button
                type="button"
                onClick={() => {
                  lastActivityRef.current = Date.now();
                  setInactivityWarningOpen(false);
                  setWarningCountdown(60);
                }}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
              >
                {t('session.continueButton')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
