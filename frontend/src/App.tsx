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
  X
} from 'lucide-react';

export const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        <div className="text-center">
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header Bar */}
      <header className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wide text-white">AQ COMPANIES</span>
              <span className="hidden sm:inline-block text-[11px] text-slate-400 ml-2 border-l border-slate-700 pl-2">
                Sky Ariana Ltd Corporate Portal
              </span>
            </div>
          </div>
        </div>

        {/* User Context & Role Switcher */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-1.5 text-xs">
            <span className="text-slate-400">Switch Role:</span>
            <select
              value={currentUser.email}
              onChange={e => switchDemoRole(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-[11px] rounded px-2 py-1 text-slate-200"
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
              <div className="text-xs font-semibold text-white">{currentUser.firstName} {currentUser.lastName}</div>
              <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">
                {currentUser.roles[0]}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <aside
          className={`fixed md:static inset-y-0 left-0 z-30 w-64 bg-slate-900 border-r border-slate-800 transform ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
          } transition-transform duration-200 ease-in-out flex flex-col pt-14 md:pt-0`}
        >
          <div className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
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
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  {item.label}
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
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
    </div>
  );
};
