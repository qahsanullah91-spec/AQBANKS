import React, { useState, useEffect } from 'react';
import { getAuthToken, removeAuthToken, api, setAuthToken } from './services/api';
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
  Building2,
  Menu,
  X,
  MoreHorizontal
} from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (token) {
      api.getMe()
        .then(u => setCurrentUser(u))
        .catch(() => removeAuthToken())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    removeAuthToken();
    setCurrentUser(null);
  };

  const switchDemoRole = async (email: string) => {
    try {
      const res = await api.login({ email, password: 'AQCompanies@2026' });
      setAuthToken(res.accessToken);
      setCurrentUser(res.user);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center p-4">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Initializing AQ Companies System...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={u => setCurrentUser(u)} />;
  }

  const navItems = [
    { id: 'dashboard', label: 'Overview Dashboard', icon: LayoutDashboard },
    { id: 'invoices', label: 'Proforma Invoices', icon: FileText },
    { id: 'logistics', label: 'Freight Logistics', icon: Ship },
    { id: 'ledger', label: 'Account Statement', icon: DollarSign },
    { id: 'payments', label: 'Payments & Allocations', icon: CreditCard },
    { id: 'reconciliation', label: 'Reconciliation Review', icon: CheckSquare },
    { id: 'banking', label: 'Restricted Bank Details', icon: ShieldCheck },
    { id: 'import', label: 'Workbook Import Center', icon: FileSpreadsheet },
    { id: 'reports', label: 'Financial Reports', icon: BarChart3 },
    { id: 'admin', label: 'Admin & Compliance', icon: Settings, adminOnly: true }
  ];

  // Primary items for mobile bottom tab bar (thumb-accessible)
  const mobilePrimaryTabs = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'invoices', label: 'Invoices', icon: FileText },
    { id: 'logistics', label: 'Logistics', icon: Ship },
    { id: 'ledger', label: 'Ledger', icon: DollarSign },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col overflow-x-hidden">
      {/* Top Header Bar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 sm:px-4 sticky top-0 z-40 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation menu"
            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="truncate">
              <span className="font-extrabold text-xs sm:text-sm tracking-wide text-white block sm:inline">
                AQ COMPANIES
              </span>
              <span className="hidden sm:inline-block text-[11px] text-slate-400 ml-2 border-l border-slate-700 pl-2">
                Sky Ariana Ltd Corporate Portal
              </span>
            </div>
          </div>
        </div>

        {/* User Context & Role Switcher */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden lg:flex items-center gap-1.5 text-xs">
            <span className="text-slate-400">Role:</span>
            <select
              value={currentUser.email}
              onChange={e => switchDemoRole(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-[11px] rounded px-2 py-1 text-slate-200 focus:outline-none"
            >
              <option value="admin@aqcompanies.com">Admin (Full Access)</option>
              <option value="finance@aqcompanies.com">Finance Manager</option>
              <option value="logistics@aqcompanies.com">Logistics Coordinator</option>
              <option value="auditor@aqcompanies.com">Auditor (Read-Only)</option>
              <option value="viewer@aqcompanies.com">Guest Viewer</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pl-2 sm:border-l sm:border-slate-800">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-semibold text-white leading-tight">{currentUser.firstName} {currentUser.lastName}</div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">
                {currentUser.roles[0]}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Backdrop for mobile drawer */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Navigation Sidebar Drawer */}
        <aside
          className={`fixed md:static inset-y-0 left-0 z-40 w-64 max-w-[80vw] bg-slate-900 border-r border-slate-800 transform ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          } transition-transform duration-200 ease-in-out flex flex-col pt-14 md:pt-0 shrink-0 shadow-2xl md:shadow-none`}
        >
          {/* Mobile User Profile info inside drawer */}
          <div className="p-3 border-b border-slate-800 md:hidden bg-slate-950/60">
            <div className="text-xs font-bold text-white">{currentUser.firstName} {currentUser.lastName}</div>
            <div className="text-[11px] text-slate-400 truncate">{currentUser.email}</div>
            <span className="mt-1 inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
              {currentUser.roles.join(', ')}
            </span>
          </div>

          <div className="flex-1 py-3 px-2 sm:px-3 space-y-1 overflow-y-auto">
            {navItems.map(item => {
              if (item.adminOnly && !currentUser.roles.includes('ADMIN')) return null;
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* System Footer Info */}
          <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500 font-mono">
            <div>v1.0.0-PROD • Build 2026.10</div>
            <div className="text-[10px] text-slate-600 mt-0.5">SHA256: BC2518195...</div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-6 lg:p-8 pb-20 md:pb-8 w-full max-w-full">
          {activeTab === 'dashboard' && <Dashboard onNavigate={t => setActiveTab(t)} />}
          {activeTab === 'invoices' && <Invoices />}
          {activeTab === 'logistics' && <Logistics />}
          {activeTab === 'ledger' && <Ledger />}
          {activeTab === 'payments' && <Payments />}
          {activeTab === 'reconciliation' && <Reconciliation />}
          {activeTab === 'banking' && <BankRouting />}
          {activeTab === 'import' && <ImportCenter />}
          {activeTab === 'reports' && <Reports />}
          {activeTab === 'admin' && <Admin />}
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
          <span className="text-[10px] font-medium mt-0.5">More</span>
        </button>
      </nav>
    </div>
  );
};
