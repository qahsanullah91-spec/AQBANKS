import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { DashboardOverview } from '../types';
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
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Executive Dashboard</h1>
              <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                LIVE SYSTEM
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              AQ Companies • Afghan United Bank Operating Account (101502******0472)
            </p>
          </div>
        </div>
        <button
          onClick={fetchOverview}
          className="self-start sm:self-auto flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh Metrics
        </button>
      </div>

      {/* Primary KPI Cards (Mirroring Excel Overview layout) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Available Balance */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">Total Available Balance</span>
            <div className="w-9 h-9 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 tracking-tight font-mono">
              ${Number(metrics.availableBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Corrected Deterministic Balance
            </p>
          </div>
        </div>

        {/* Pending Receivables */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Receivables</span>
            <div className="w-9 h-9 rounded-lg bg-amber-950 border border-amber-800 text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 tracking-tight font-mono">
              ${Number(metrics.pendingReceivables).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Invoiced expected amounts pending</p>
          </div>
        </div>

        {/* Total Credits */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">Total Credits (Inflow)</span>
            <div className="w-9 h-9 rounded-lg bg-blue-950 border border-blue-800 text-blue-400 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-400 tracking-tight font-mono">
              ${Number(metrics.totalCredits).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Total posted inward transfers</p>
          </div>
        </div>

        {/* Total Debits */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">Total Debits (Outflow)</span>
            <div className="w-9 h-9 rounded-lg bg-rose-950 border border-rose-800 text-rose-400 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 sm:mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-400 tracking-tight font-mono">
              ${Number(metrics.totalDebits).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Disbursements and payments</p>
          </div>
        </div>
      </div>

      {/* Secondary Metrics & Shortcuts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Cash Flow Breakdown */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Cash Flow Visualization
          </h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Total Incoming (Credits)</span>
                <span className="font-semibold text-blue-400 font-mono">${Number(cashFlow.totalIncoming).toLocaleString()}</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full" style={{ width: '54%' }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Total Outgoing (Debits)</span>
                <span className="font-semibold text-rose-400 font-mono">${Number(cashFlow.totalOutgoing).toLocaleString()}</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full rounded-full" style={{ width: '46%' }} />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
              <span className="text-slate-400">All-Time Invoiced:</span>
              <span className="font-bold text-white font-mono">${Number(metrics.totalInvoiced).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-400">Active Shipments:</span>
              <span className="font-bold text-emerald-400">{metrics.activeShipmentsCount} In-Transit</span>
            </div>
          </div>
        </div>

        {/* System Shortcuts */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300 mb-3">
            System Shortcuts
          </h2>
          <div className="grid grid-cols-1 gap-2">
            <button
              onClick={() => onNavigate('ledger')}
              className="w-full flex items-center justify-between p-3 min-h-[44px] bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-medium text-slate-200 transition"
            >
              <span className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Account Statement
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
            <button
              onClick={() => onNavigate('invoices')}
              className="w-full flex items-center justify-between p-3 min-h-[44px] bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-medium text-slate-200 transition"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-400" /> Proforma Invoices
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
            <button
              onClick={() => onNavigate('logistics')}
              className="w-full flex items-center justify-between p-3 min-h-[44px] bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-medium text-slate-200 transition"
            >
              <span className="flex items-center gap-2">
                <Ship className="w-4 h-4 text-cyan-400" /> Freight Tracking
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
            <button
              onClick={() => onNavigate('banking')}
              className="w-full flex items-center justify-between p-3 min-h-[44px] bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-medium text-slate-200 transition"
            >
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" /> Bank Routing Info
              </span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Active Shipments Preview */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Ship className="w-4 h-4 text-cyan-400" /> Active Freight
            </h2>
            <button
              onClick={() => onNavigate('logistics')}
              className="text-xs text-emerald-400 hover:underline min-h-[44px] px-2 flex items-center"
            >
              View All
            </button>
          </div>
          <div className="space-y-2.5">
            {data?.recentShipments && data.recentShipments.length > 0 ? (
              data.recentShipments.map(s => (
                <div key={s.id} className="p-3 bg-slate-950 border border-slate-800/80 rounded-lg text-xs">
                  <div className="flex justify-between items-center font-semibold text-white">
                    <span>{s.shipmentRef}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-950 text-cyan-300 border border-cyan-800">
                      {s.status}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px] mt-1">
                    {s.origin} → {s.destination} ({s.carrier})
                  </div>
                  <div className="text-slate-500 text-[10px] mt-0.5">
                    ETA: {s.estimatedArrivalDate ? new Date(s.estimatedArrivalDate).toLocaleDateString() : 'N/A'} • Container: {s.containerNumber}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">No active shipments in transit.</p>
            )}
          </div>
        </div>
      </div>

      {/* Latest Transactions (Mobile cards < 640px + Desktop Table >= 640px) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div>
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-200">Latest Account Transactions</h2>
            <p className="text-[11px] sm:text-xs text-slate-400">Drill-down from Afghan United Bank account statement</p>
          </div>
          <button
            onClick={() => onNavigate('ledger')}
            className="text-xs text-emerald-400 hover:underline flex items-center gap-1 font-medium min-h-[44px] px-2"
          >
            Full Statement <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* MOBILE CARD VIEW (< 640px) */}
        <div className="block sm:hidden space-y-2.5">
          {data?.latestTransactions && data.latestTransactions.length > 0 ? (
            data.latestTransactions.map(tx => (
              <div key={tx.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 font-mono">
                    {new Date(tx.effectiveDate).toLocaleDateString()}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                    tx.category === 'CREDIT' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                    tx.category === 'DEBIT' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    {tx.category}
                  </span>
                </div>
                <div className="text-slate-200 font-medium text-xs">{tx.description}</div>
                <div className="flex justify-between items-center pt-1.5 border-t border-slate-800/80 font-mono text-[11px]">
                  <div>
                    {Number(tx.creditAmount) > 0 ? (
                      <span className="text-emerald-400 font-bold">+${Number(tx.creditAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    ) : Number(tx.debitAmount) > 0 ? (
                      <span className="text-rose-400 font-bold">-${Number(tx.debitAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    ) : (
                      <span className="text-slate-400">$0.00</span>
                    )}
                  </div>
                  <div>
                    <span className="text-slate-500 font-sans text-[10px]">Bal: </span>
                    <span className="text-white font-bold">${Number(tx.runningBalanceFormatted).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 py-4 text-center">No transactions recorded yet.</p>
          )}
        </div>

        {/* DESKTOP TABLE VIEW (>= 640px) */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Reference</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-right">Debit</th>
                <th className="py-2.5 px-3 text-right">Credit</th>
                <th className="py-2.5 px-3 text-right">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {data?.latestTransactions && data.latestTransactions.length > 0 ? (
                data.latestTransactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 text-slate-400">
                      {new Date(tx.effectiveDate).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-300">{tx.reference || 'N/A'}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-200">{tx.description}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-sans font-semibold ${
                        tx.category === 'CREDIT' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                        tx.category === 'DEBIT' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {tx.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-rose-400">
                      {Number(tx.debitAmount) > 0 ? `$${Number(tx.debitAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-400">
                      {Number(tx.creditAmount) > 0 ? `$${Number(tx.creditAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      ${Number(tx.runningBalanceFormatted).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-500 font-sans">
                    No transactions recorded yet.
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
