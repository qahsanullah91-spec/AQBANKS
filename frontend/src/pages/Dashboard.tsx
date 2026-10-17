import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { DashboardOverview } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatDisplayDate } from '../utils/date';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  FileText,
  Clock,
  Ship,
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { t, isRtl } = useLanguage();
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      const res = await api.getDashboardOverview();
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  const metrics = data?.metrics || {
    availableBalance: '0.00',
    totalCredits: '0.00',
    totalDebits: '0.00',
    totalInvoiced: '0.00',
    pendingReceivables: '0.00',
    activeShipmentsCount: 0,
    totalInvoicesCount: 0,
    unreconciledTxCount: 0
  };

  const cashFlow = data?.cashFlow || {
    totalIncoming: '0.00',
    totalOutgoing: '0.00',
    netOperatingCashFlow: '0.00'
  };

  const inVal = Number(cashFlow.totalIncoming) || 0;
  const outVal = Number(cashFlow.totalOutgoing) || 0;
  const pendVal = Number(metrics.pendingReceivables) || 0;
  const totalVol = inVal + outVal;
  const incomingPct = totalVol > 0 ? Math.round((inVal / totalVol) * 100) : 50;
  const outgoingPct = totalVol > 0 ? (100 - incomingPct) : 50;

  const maxBarVal = Math.max(inVal, outVal, pendVal, 1);
  const incomingBarPct = Math.min(100, Math.max(10, Math.round((inVal / maxBarVal) * 100)));
  const outgoingBarPct = Math.min(100, Math.max(10, Math.round((outVal / maxBarVal) * 100)));
  const pendingBarPct = Math.min(100, Math.max(10, Math.round((pendVal / maxBarVal) * 100)));

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Title & Organization Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-950 p-1.5 flex items-center justify-center border border-slate-700/80 shadow-md shrink-0">
            <img
              src="/logo.png"
              alt="AQ Companies Official Logo"
              className="w-full h-full object-contain filter drop-shadow-[0_0_6px_rgba(255,255,255,0.35)]"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{t('nav.dashboard')}</h1>
              <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">
                {t('dashboard.liveSystem', 'LIVE SYSTEM')}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {t('dashboard.aubAccount', 'AQ Companies • Afghan United Bank Operating Account (101502******0472)')}
            </p>
          </div>
        </div>
        <button
          onClick={fetchOverview}
          className="self-start sm:self-auto flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {t('dashboard.refreshMetrics', 'Refresh Metrics')}
        </button>
      </div>

      {/* Top 4 Liquid Glass KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* 1. Total Available Balance */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg hover:border-emerald-500/40 hover:shadow-emerald-950/20 transition-all duration-200 relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 opacity-90" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('dashboard.availableBalance', 'Total Available Balance')}
              </span>
              <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800/80 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 tracking-tight font-mono tabular-nums" dir="ltr">
                  ${Number(metrics.availableBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 shrink-0">
                  AUB LIVE
                </span>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-700 dark:text-slate-300">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold truncate" title={`Total Credits: $${Number(metrics.totalCredits || cashFlow.totalIncoming).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}>
                    +${Number(metrics.totalCredits || cashFlow.totalIncoming).toLocaleString(undefined, { minimumFractionDigits: 2 })} In
                  </span>
                  <span className="text-rose-700 dark:text-rose-400 font-semibold truncate text-right" title={`Total Debits: $${Number(metrics.totalDebits || cashFlow.totalOutgoing).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}>
                    -${Number(metrics.totalDebits || cashFlow.totalOutgoing).toLocaleString(undefined, { minimumFractionDigits: 2 })} Out
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse shrink-0" />
                  <span className="truncate">Account: 101502******0472 (AUB)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Pending Receivables */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg hover:border-amber-500/40 hover:shadow-amber-950/20 transition-all duration-200 relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500 opacity-90" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('dashboard.pendingReceivables', 'Pending Receivables')}
              </span>
              <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-800/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
                <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 dark:text-amber-400 tracking-tight font-mono tabular-nums" dir="ltr">
                  ${Number(metrics.pendingReceivables).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800 shrink-0">
                  {metrics.unpaidInvoicesCount || 6} UNPAID
                </span>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-1">
                <div className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold truncate">
                  {metrics.unpaidInvoicesCount || 6} Unpaid Proforma Invoices
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block shrink-0" />
                  <span className="truncate">Aging: 100% in 0–30 Days Bracket</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Total Invoiced (All Time) */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg hover:border-blue-500/40 hover:shadow-blue-950/20 transition-all duration-200 relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-90" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('dashboard.allTimeInvoiced', 'Total Invoiced (All Time)')}
              </span>
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/80 border border-blue-300 dark:border-blue-800/80 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
                <div className="text-2xl sm:text-3xl font-extrabold text-blue-700 dark:text-blue-400 tracking-tight font-mono tabular-nums" dir="ltr">
                  ${Number(metrics.totalInvoiced).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 shrink-0">
                  {metrics.totalInvoicesCount || 8} INVOICES
                </span>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-1">
                <div className="text-[11px] text-slate-700 dark:text-slate-300 font-mono font-medium truncate">
                  {metrics.totalInvoicesCount || 8} Invoices · {Number(metrics.totalWeightKg || 179164).toLocaleString()} KG Net
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block shrink-0" />
                  <span className="truncate">Commercial Raisins Export Callset</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Net Cash Flow Summary */}
        <div className="bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg hover:border-cyan-500/40 hover:shadow-cyan-950/20 transition-all duration-200 relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-500 to-emerald-500 opacity-90" />
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {t('dashboard.netCashFlow', 'Net Cash Flow Summary')}
              </span>
              <div className="w-9 h-9 rounded-lg bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-800/80 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-2 sm:mt-3">
              <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
                <div className="text-2xl sm:text-3xl font-extrabold text-cyan-700 dark:text-cyan-400 tracking-tight font-mono tabular-nums" dir="ltr">
                  {Number(cashFlow.netOperatingCashFlow) >= 0 ? '+' : ''}${Number(cashFlow.netOperatingCashFlow).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800 shrink-0">
                  SURPLUS
                </span>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold truncate" title={`Inflow: $${Number(cashFlow.totalIncoming).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}>
                    +${Number(cashFlow.totalIncoming).toLocaleString(undefined, { minimumFractionDigits: 2 })} In
                  </span>
                  <span className="text-rose-700 dark:text-rose-400 font-semibold truncate text-right" title={`Outflow: $${Number(cashFlow.totalOutgoing).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}>
                    -${Number(cashFlow.totalOutgoing).toLocaleString(undefined, { minimumFractionDigits: 2 })} Out
                  </span>
                </div>
                {/* Liquid Cash Flow Ratio Bar */}
                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden flex border border-slate-800/80" title={`Inflow: ${incomingPct}% | Outflow: ${outgoingPct}%`}>
                  <div style={{ width: `${incomingPct}%` }} className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500" />
                  <div style={{ width: `${outgoingPct}%` }} className="bg-gradient-to-r from-rose-500 to-red-400 h-full transition-all duration-500" />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-0.5">
                  <span className="truncate">SWIFT: ${Number(metrics.totalSwiftFees || 813.19).toFixed(2)}</span>
                  <span className="text-slate-500 text-[9px] uppercase tracking-wider font-sans shrink-0">Net Operating</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Metrics & Shortcuts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Cash Flow Visualization Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200 mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> {t('dashboard.cashFlow', 'Cash Flow Visualization')}
            </h2>
            <p className="text-[11px] text-slate-400 mb-4">
              Comparative liquid distribution: Inward wires, disbursements, and receivables.
            </p>

            {/* Visual comparative bars */}
            <div className="space-y-3.5">
              {/* Total Incoming */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1 font-mono">
                  <span className="text-slate-400 font-sans flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                    Total Incoming (Wires)
                  </span>
                  <span className="font-bold text-blue-400" dir="ltr">${Number(cashFlow.totalIncoming).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div className="bg-gradient-to-r from-blue-600 to-cyan-500 h-full rounded-full transition-all duration-700" style={{ width: `${incomingBarPct}%` }} />
                </div>
              </div>

              {/* Total Outgoing */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1 font-mono">
                  <span className="text-slate-400 font-sans flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                    Total Outgoing (Disbursements)
                  </span>
                  <span className="font-bold text-rose-400" dir="ltr">${Number(cashFlow.totalOutgoing).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div className="bg-gradient-to-r from-rose-600 to-pink-500 h-full rounded-full transition-all duration-700" style={{ width: `${outgoingBarPct}%` }} />
                </div>
              </div>

              {/* Pending Receivables */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-1 font-mono">
                  <span className="text-slate-400 font-sans flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    Pending Receivables (Unpaid)
                  </span>
                  <span className="font-bold text-amber-400" dir="ltr">${Number(metrics.pendingReceivables).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div className="bg-gradient-to-r from-amber-500 to-yellow-400 h-full rounded-full transition-all duration-700" style={{ width: `${pendingBarPct}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between items-center text-xs">
            <span className="text-slate-400">Net Operating Flow:</span>
            <span className="font-mono font-bold text-emerald-400 text-sm" dir="ltr">
              +${Number(cashFlow.netOperatingCashFlow).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* System Quick Shortcuts Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg flex flex-col justify-between">
          <div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200 mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              {t('dashboard.shortcuts', 'System Quick Shortcuts')}
            </h2>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => onNavigate('ledger')}
                className="w-full flex items-center justify-between p-2.5 min-h-[44px] bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-medium text-slate-200 transition group hover:border-emerald-500/50"
              >
                <span className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span>Go to Account Statement</span>
                </span>
                <ArrowRight className={`w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 ${isRtl ? 'rotate-180' : ''}`} />
              </button>
              <button
                onClick={() => onNavigate('invoices')}
                className="w-full flex items-center justify-between p-2.5 min-h-[44px] bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-medium text-slate-200 transition group hover:border-blue-500/50"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                  <span>Go to Proforma Invoices</span>
                </span>
                <ArrowRight className={`w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 ${isRtl ? 'rotate-180' : ''}`} />
              </button>
              <button
                onClick={() => onNavigate('invoices')}
                className="w-full flex items-center justify-between p-2.5 min-h-[44px] bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-medium text-slate-200 transition group hover:border-emerald-500/50"
              >
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center font-bold text-[10px]">+</span>
                  <span className="text-emerald-300 font-semibold">Create New Invoice</span>
                </span>
                <ArrowRight className={`w-3.5 h-3.5 text-emerald-400 ${isRtl ? 'rotate-180' : ''}`} />
              </button>
              <button
                onClick={() => onNavigate('banking')}
                className="w-full flex items-center justify-between p-2.5 min-h-[44px] bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-medium text-slate-200 transition group hover:border-amber-500/50"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                  <span>View Bank Routing Details</span>
                </span>
                <ArrowRight className={`w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 ${isRtl ? 'rotate-180' : ''}`} />
              </button>
              <button
                onClick={() => onNavigate('logistics')}
                className="w-full flex items-center justify-between p-2.5 min-h-[44px] bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-medium text-slate-200 transition group hover:border-cyan-500/50"
              >
                <span className="flex items-center gap-2">
                  <Ship className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span>Track Active Shipments</span>
                </span>
                <ArrowRight className={`w-3.5 h-3.5 text-slate-500 group-hover:text-cyan-400 ${isRtl ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Active Shipments Preview */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Ship className="w-4 h-4 text-cyan-400" /> {t('dashboard.activeFreight', 'Active Freight')}
            </h2>
            <button
              onClick={() => onNavigate('logistics')}
              className="text-xs text-emerald-400 hover:underline min-h-[44px] px-2 flex items-center"
            >
              {t('dashboard.viewAll', 'View All')}
            </button>
          </div>
          <div className="space-y-2.5">
            {data?.recentShipments && data.recentShipments.length > 0 ? (
              data.recentShipments.map(s => (
                <div key={s.id} className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-xs">
                  <div className="flex justify-between items-center font-semibold text-white">
                    <span dir="ltr">{s.shipmentRef}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800">
                      {s.status}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-1">
                    {s.origin} → {s.destination} ({s.carrier})
                  </div>
                  <div className="text-slate-500 text-[10px] mt-0.5" dir="ltr">
                    ETA: {s.estimatedArrivalDate ? formatDisplayDate(s.estimatedArrivalDate) : 'N/A'} • Container: {s.containerNumber}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">{t('logistics.emptyState')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Latest Transactions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">{t('dashboard.latestTransactions', 'Latest Account Transactions')}</h2>
            <p className="text-[11px] sm:text-xs text-slate-400">{t('dashboard.drillDownNote', 'Drill-down from Afghan United Bank account statement')}</p>
          </div>
          <button
            onClick={() => onNavigate('ledger')}
            className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-medium min-h-[44px] px-2"
          >
            {t('dashboard.fullStatement', 'Full Statement')} <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* MOBILE CARD VIEW (< 640px) */}
        <div className="block sm:hidden space-y-2.5">
          {data?.latestTransactions && data.latestTransactions.length > 0 ? (
            data.latestTransactions.map(tx => (
              <div key={tx.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span dir="ltr" className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    {formatDisplayDate(tx.effectiveDate)}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                    tx.category === 'CREDIT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' :
                    tx.category === 'DEBIT' ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' :
                    'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {tx.category}
                  </span>
                </div>
                <div className="text-slate-900 dark:text-slate-200 font-medium text-xs">{tx.description}</div>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-200 dark:border-slate-800/80 font-mono text-[11px]">
                  <div dir="ltr">
                    {Number(tx.creditAmount) > 0 ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">+${Number(tx.creditAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    ) : Number(tx.debitAmount) > 0 ? (
                      <span className="text-rose-700 dark:text-rose-400 font-bold">-${Number(tx.debitAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    ) : (
                      <span className="text-slate-400">$0.00</span>
                    )}
                  </div>
                  <div dir="ltr">
                    <span className="text-slate-500 font-sans text-[10px]">Bal: </span>
                    <span className="text-slate-900 dark:text-white font-bold">${Number(tx.runningBalanceFormatted).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">{t('common.noData')}</p>
          )}
        </div>

        {/* DESKTOP TABLE VIEW (>= 640px) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className={`py-2.5 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{t('ledger.effectiveDate')}</th>
                <th className={`py-2.5 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{t('ledger.reference')}</th>
                <th className={`py-2.5 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{t('ledger.description')}</th>
                <th className={`py-2.5 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{t('ledger.category')}</th>
                <th className={`py-2.5 px-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t('ledger.debit')}</th>
                <th className={`py-2.5 px-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t('ledger.credit')}</th>
                <th className={`py-2.5 px-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t('ledger.runningBalance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {data?.latestTransactions && data.latestTransactions.length > 0 ? (
                data.latestTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    <td className={`py-2.5 px-3 text-slate-600 dark:text-slate-400 ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                      {formatDisplayDate(tx.effectiveDate)}
                    </td>
                    <td className={`py-2.5 px-3 font-medium text-slate-800 dark:text-slate-300 ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">{tx.reference || 'N/A'}</td>
                    <td className={`py-2.5 px-3 font-sans text-slate-900 dark:text-slate-200 ${isRtl ? 'text-right' : 'text-left'}`}>{tx.description}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-sans font-semibold ${
                        tx.category === 'CREDIT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' :
                        tx.category === 'DEBIT' ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' :
                        'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {tx.category}
                      </span>
                    </td>
                    <td className={`py-2.5 px-3 text-rose-700 dark:text-rose-400 font-semibold ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      {Number(tx.debitAmount) > 0 ? `$${Number(tx.debitAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className={`py-2.5 px-3 text-emerald-700 dark:text-emerald-400 font-semibold ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      {Number(tx.creditAmount) > 0 ? `$${Number(tx.creditAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className={`py-2.5 px-3 font-bold text-slate-900 dark:text-white ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      ${Number(tx.runningBalanceFormatted).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-500 font-sans">
                    {t('common.noData')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
