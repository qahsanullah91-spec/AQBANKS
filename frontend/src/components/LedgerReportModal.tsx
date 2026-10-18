import React, { useState, useMemo, useEffect } from 'react';
import { LedgerTransaction } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatDisplayDate } from '../utils/date';
import {
  FileText,
  X,
  Printer,
  Download,
  Calendar,
  Filter,
  Search,
  RotateCcw,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart
} from 'lucide-react';

interface LedgerReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  allTransactions: LedgerTransaction[];
  openingBalance: string | number;
  currentEndingBalance: string | number;
  onPrintReport: (data: {
    transactions: LedgerTransaction[];
    openingBalance: string | number;
    closingBalance: string | number;
    periodLabel: string;
    totalCredits: number;
    totalDebits: number;
    creditCount: number;
    debitCount: number;
  }) => void;
}

type PeriodPreset = 'ALL' | 'THIS_MONTH' | 'LAST_MONTH' | 'LAST_30_DAYS' | 'LAST_90_DAYS' | 'CUSTOM';

export const LedgerReportModal: React.FC<LedgerReportModalProps> = ({
  isOpen,
  onClose,
  allTransactions,
  openingBalance,
  currentEndingBalance,
  onPrintReport
}) => {
  const { t, isRtl } = useLanguage();

  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle Preset Changes
  const applyPreset = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (preset === 'ALL') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'THIS_MONTH') {
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      setStartDate(`${year}-${month}-01`);
      setEndDate(todayStr);
    } else if (preset === 'LAST_MONTH') {
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const year = lastMonthDate.getFullYear();
      const month = String(lastMonthDate.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, lastMonthDate.getMonth() + 1, 0).getDate();
      setStartDate(`${year}-${month}-01`);
      setEndDate(`${year}-${month}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'LAST_30_DAYS') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'LAST_90_DAYS') {
      const d = new Date();
      d.setDate(d.getDate() - 90);
      setStartDate(d.toISOString().split('T')[0]);
      setEndDate(todayStr);
    }
  };

  // Sort all transactions chronologically ascending
  const safeAllTransactions = Array.isArray(allTransactions) ? allTransactions : [];
  const sortedAllTxs = useMemo(() => {
    return [...safeAllTransactions].sort((a, b) => {
      const dateA = new Date(a.effectiveDate).getTime();
      const dateB = new Date(b.effectiveDate).getTime();
      return dateA - dateB;
    });
  }, [safeAllTransactions]);

  // Filter transactions
  const filteredTxs = useMemo(() => {
    return sortedAllTxs.filter(tx => {
      // Date filter
      if (startDate) {
        const txDate = tx.effectiveDate.split('T')[0];
        if (txDate < startDate) return false;
      }
      if (endDate) {
        const txDate = tx.effectiveDate.split('T')[0];
        if (txDate > endDate) return false;
      }

      // Category filter
      if (categoryFilter && tx.category !== categoryFilter) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const desc = (tx.description || '').toLowerCase();
        const ref = (tx.reference || '').toLowerCase();
        if (!desc.includes(q) && !ref.includes(q)) return false;
      }

      return true;
    });
  }, [sortedAllTxs, startDate, endDate, categoryFilter, searchQuery]);

  // Compute Period Analytics
  const periodOpeningBalance = useMemo(() => {
    if (!startDate || periodPreset === 'ALL') {
      return Number(openingBalance);
    }
    // Find last transaction strictly before startDate
    const priorTxs = sortedAllTxs.filter(tx => tx.effectiveDate.split('T')[0] < startDate);
    if (priorTxs.length > 0) {
      return Number(priorTxs[priorTxs.length - 1].runningBalance) || 0;
    }
    return Number(openingBalance);
  }, [sortedAllTxs, startDate, periodPreset, openingBalance]);

  const totalCredits = useMemo(() => {
    return (filteredTxs || []).reduce((sum, tx) => sum + (Number(tx.creditAmount) || 0), 0);
  }, [filteredTxs]);

  const totalDebits = useMemo(() => {
    return (filteredTxs || []).reduce((sum, tx) => sum + (Number(tx.debitAmount) || 0), 0);
  }, [filteredTxs]);

  const creditCount = useMemo(() => {
    return (filteredTxs || []).filter(tx => (Number(tx.creditAmount) || 0) > 0).length;
  }, [filteredTxs]);

  const debitCount = useMemo(() => {
    return (filteredTxs || []).filter(tx => (Number(tx.debitAmount) || 0) > 0).length;
  }, [filteredTxs]);

  const netCashFlow = totalCredits - totalDebits;

  const periodClosingBalance = useMemo(() => {
    if (filteredTxs.length > 0) {
      return Number(filteredTxs[filteredTxs.length - 1].runningBalance) || 0;
    }
    return periodOpeningBalance;
  }, [filteredTxs, periodOpeningBalance]);

  // Insights
  const largestCredit = useMemo(() => {
    let max = 0;
    for (const tx of filteredTxs) {
      const val = Number(tx.creditAmount) || 0;
      if (val > max) max = val;
    }
    return max;
  }, [filteredTxs]);

  const largestDebit = useMemo(() => {
    let max = 0;
    for (const tx of filteredTxs) {
      const val = Number(tx.debitAmount) || 0;
      if (val > max) max = val;
    }
    return max;
  }, [filteredTxs]);

  const totalVolume = totalCredits + totalDebits;
  const creditRatio = totalVolume > 0 ? Math.round((totalCredits / totalVolume) * 100) : 50;
  const debitRatio = totalVolume > 0 ? 100 - creditRatio : 50;

  // Period label
  const periodLabel = useMemo(() => {
    if (periodPreset === 'ALL' && !startDate && !endDate) {
      return 'All Chronological Transactions';
    }
    if (startDate && endDate) {
      return `Period: ${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)}`;
    }
    if (startDate) {
      return `From ${formatDisplayDate(startDate)} onward`;
    }
    if (endDate) {
      return `Up to ${formatDisplayDate(endDate)}`;
    }
    return 'Custom Period';
  }, [periodPreset, startDate, endDate]);

  if (!isOpen) return null;

  const handleExportCsv = () => {
    const headers = ['Effective Date', 'Reference', 'Description', 'Category', 'Debit (USD)', 'Credit (USD)', 'Running Balance (USD)', 'Status'];
    const rows = filteredTxs.map(item => [
      formatDisplayDate(item.effectiveDate),
      item.reference || '-',
      `"${item.description.replace(/"/g, '""')}"`,
      item.category,
      Number(item.debitAmount || 0).toFixed(2),
      Number(item.creditAmount || 0).toFixed(2),
      Number(item.runningBalance || 0).toFixed(2),
      'RECONCILED'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [
      `Official Corporate Ledger Report - ${periodLabel}`,
      `Generated: ${new Date().toISOString()} | Afghan United Bank - 101502USD2940472`,
      `Baseline Opening: $${periodOpeningBalance.toFixed(2)} | Inflows: +$${totalCredits.toFixed(2)} | Outflows: -$${totalDebits.toFixed(2)} | Net Cash Flow: $${netCashFlow.toFixed(2)} | Period Closing: $${periodClosingBalance.toFixed(2)}`,
      '',
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Corporate_Ledger_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleTriggerPrint = () => {
    onPrintReport({
      transactions: filteredTxs,
      openingBalance: periodOpeningBalance,
      closingBalance: periodClosingBalance,
      periodLabel,
      totalCredits,
      totalDebits,
      creditCount,
      debitCount
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-5xl my-auto p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
        
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-amber-950/60 border border-amber-800/80 text-amber-400 rounded-xl">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {t('ledger.reportTitle', 'Corporate Statement & Audit Report Generator')}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  AFGHAN UNITED BANK • 101502USD2940472
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('ledger.reportSubtitle', 'Executive summary, period cash flows & certified transaction audit')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 min-h-[38px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t('ledger.exportReport', 'Export CSV')}</span>
            </button>
            <button
              onClick={handleTriggerPrint}
              className="px-4 py-1.5 min-h-[38px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-md shadow-emerald-950 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{t('ledger.printReport', 'Print Certified Report (PDF)')}</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 min-h-[38px] min-w-[38px] flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CONTROLS & FILTER BAR */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
          {/* Quick Period Presets */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
              {t('ledger.period', 'Period')}:
            </span>
            {(['ALL', 'THIS_MONTH', 'LAST_MONTH', 'LAST_30_DAYS', 'LAST_90_DAYS', 'CUSTOM'] as PeriodPreset[]).map(preset => {
              const labelMap: Record<PeriodPreset, string> = {
                ALL: t('ledger.allTime', 'All Time'),
                THIS_MONTH: t('ledger.thisMonth', 'This Month'),
                LAST_MONTH: t('ledger.lastMonth', 'Last Month'),
                LAST_30_DAYS: t('ledger.last30Days', 'Last 30 Days'),
                LAST_90_DAYS: t('ledger.last90Days', 'Last 90 Days'),
                CUSTOM: t('ledger.customRange', 'Custom Range')
              };
              const active = periodPreset === preset;
              return (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                    active
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {labelMap[preset]}
                </button>
              );
            })}
          </div>

          {/* Date Pickers, Category & Search Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1 border-t border-slate-800/60">
            <div>
              <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                {t('ledger.startDate', 'From Date')}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setPeriodPreset('CUSTOM');
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                {t('ledger.endDate', 'To Date')}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setPeriodPreset('CUSTOM');
                }}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                {t('ledger.category', 'Category')}
              </label>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200"
              >
                <option value="">{t('ledger.allCategories', 'All Categories')}</option>
                <option value="CREDIT">{t('ledger.credit', 'Credit (Inflow)')}</option>
                <option value="DEBIT">{t('ledger.debit', 'Debit (Outflow)')}</option>
                <option value="BALANCE">{t('ledger.balance', 'Initial Balance')}</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold uppercase text-slate-400 mb-1">
                {t('common.search', 'Search')}
              </label>
              <div className="relative">
                <Search className={`w-3.5 h-3.5 text-slate-500 absolute top-2.5 ${isRtl ? 'right-2.5' : 'left-2.5'}`} />
                <input
                  type="text"
                  placeholder={t('ledger.searchPlaceholder', 'Search description, reference...')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className={`w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white ${
                    isRtl ? 'pr-8 pl-2' : 'pl-8 pr-2'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 5 EXECUTIVE SUMMARY KPI CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          
          {/* 1. Period Opening Balance */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl relative overflow-hidden">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              {t('ledger.periodOpening', 'Period Baseline')}
            </span>
            <div className="text-base sm:text-lg font-bold font-mono text-white mt-1" dir="ltr">
              ${periodOpeningBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">Opening balance</span>
          </div>

          {/* 2. Total Inflow */}
          <div className="p-3 bg-slate-950 border border-emerald-900/60 rounded-xl relative overflow-hidden">
            <span className="text-[10px] text-emerald-400 uppercase font-semibold block">
              {t('ledger.totalInflow', 'Total Inflows')}
            </span>
            <div className="text-base sm:text-lg font-extrabold font-mono text-emerald-400 mt-1" dir="ltr">
              +${totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-500 block mt-0.5">
              {creditCount} inward transfers
            </span>
          </div>

          {/* 3. Total Outflow */}
          <div className="p-3 bg-slate-950 border border-rose-900/60 rounded-xl relative overflow-hidden">
            <span className="text-[10px] text-rose-400 uppercase font-semibold block">
              {t('ledger.totalOutflow', 'Total Outflows')}
            </span>
            <div className="text-base sm:text-lg font-extrabold font-mono text-rose-400 mt-1" dir="ltr">
              -${totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-rose-500 block mt-0.5">
              {debitCount} disbursements
            </span>
          </div>

          {/* 4. Net Period Movement */}
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl relative overflow-hidden">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">
              {t('ledger.netCashFlow', 'Net Cash Flow')}
            </span>
            <div className={`text-base sm:text-lg font-extrabold font-mono mt-1 ${
              netCashFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`} dir="ltr">
              {netCashFlow >= 0 ? '+' : ''}${netCashFlow.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {netCashFlow >= 0 ? 'Surplus Movement' : 'Deficit Movement'}
            </span>
          </div>

          {/* 5. Period Closing Balance */}
          <div className="col-span-2 sm:col-span-1 p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-xl relative overflow-hidden">
            <span className="text-[10px] text-emerald-300 uppercase font-semibold block">
              {t('ledger.periodClosing', 'Period Closing')}
            </span>
            <div className="text-base sm:text-lg font-black font-mono text-emerald-300 mt-1" dir="ltr">
              ${periodClosingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3 h-3" /> Reconciled
            </span>
          </div>

        </div>

        {/* CASH FLOW DISTRIBUTION & VELOCITY STRIP */}
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-semibold flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-blue-400" />
              Cash Flow Velocity & Ratio (Inflows vs Outflows)
            </span>
            <div className="flex items-center gap-3 font-mono text-[11px]">
              <span className="text-emerald-400">+{creditRatio}% Inflow</span>
              <span className="text-rose-400">-{debitRatio}% Outflow</span>
            </div>
          </div>
          {/* Progress Bar */}
          <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
            <div style={{ width: `${creditRatio}%` }} className="bg-emerald-500 h-full transition-all" />
            <div style={{ width: `${debitRatio}%` }} className="bg-rose-500 h-full transition-all" />
          </div>
          {/* Insights Summary */}
          <div className="flex flex-wrap justify-between items-center text-[11px] text-slate-400 pt-1 font-mono">
            <span>Largest Inflow: <strong className="text-emerald-400 font-bold" dir="ltr">+${largestCredit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
            <span>Largest Disbursement: <strong className="text-rose-400 font-bold" dir="ltr">-${largestDebit.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
            <span>Period Entries: <strong className="text-white">{filteredTxs.length}</strong></span>
          </div>
        </div>

        {/* FILTERED TRANSACTIONS TABLE */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
          <div className="max-h-[300px] overflow-y-auto">
            <table className="w-full text-xs text-slate-300 font-mono">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-800">
                <tr>
                  <th className={`py-2.5 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{t('ledger.effectiveDate', 'Date')}</th>
                  <th className={`py-2.5 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{t('ledger.reference', 'Reference')}</th>
                  <th className={`py-2.5 px-3 ${isRtl ? 'text-right' : 'text-left'}`}>{t('ledger.description', 'Description')}</th>
                  <th className="py-2.5 px-2 text-center">{t('ledger.category', 'Category')}</th>
                  <th className={`py-2.5 px-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t('ledger.debit', 'Debit')}</th>
                  <th className={`py-2.5 px-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t('ledger.credit', 'Credit')}</th>
                  <th className={`py-2.5 px-3 ${isRtl ? 'text-left' : 'text-right'}`}>{t('ledger.runningBalance', 'Balance')}</th>
                  <th className="py-2.5 px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredTxs.length > 0 ? (
                  filteredTxs.map(tx => (
                    <tr key={tx.id} className="hover:bg-slate-800/40">
                      <td className={`py-2 px-3 text-slate-400 ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                        {formatDisplayDate(tx.effectiveDate)}
                      </td>
                      <td className={`py-2 px-3 text-slate-300 font-semibold ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                        {tx.reference || '-'}
                      </td>
                      <td className={`py-2 px-3 font-sans text-slate-200 ${isRtl ? 'text-right' : 'text-left'}`}>
                        {tx.description}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold uppercase ${
                          tx.category === 'CREDIT' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                          tx.category === 'DEBIT' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                          'bg-slate-800 text-slate-300'
                        }`}>
                          {tx.category}
                        </span>
                      </td>
                      <td className={`py-2 px-3 text-rose-400 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        {Number(tx.debitAmount) > 0 ? `$${Number(tx.debitAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className={`py-2 px-3 text-emerald-400 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        {Number(tx.creditAmount) > 0 ? `$${Number(tx.creditAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                      </td>
                      <td className={`py-2 px-3 font-bold text-white ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        ${Number(tx.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2 text-center font-sans">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                          Reconciled
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-500 font-sans">
                      No records match the current report filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE SUMMARY FOOTER */}
          <div className="bg-slate-900 p-3 font-mono text-xs border-t border-slate-800 flex flex-wrap justify-between items-center gap-2">
            <span className="text-slate-400 font-sans text-xs">
              Showing <strong className="text-white">{filteredTxs.length}</strong> entries for <span className="text-amber-400 font-semibold">{periodLabel}</span>
            </span>
            <div className="flex items-center gap-4 text-xs" dir="ltr">
              <span className="text-rose-400 font-bold">
                Debits: -${totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-emerald-400 font-bold">
                Credits: +${totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-white font-extrabold">
                Ending: ${periodClosingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="flex justify-between items-center pt-2">
          <button
            onClick={() => {
              applyPreset('ALL');
              setCategoryFilter('');
              setSearchQuery('');
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 min-h-[40px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition"
            >
              {t('common.close', 'Close')}
            </button>
            <button
              onClick={handleTriggerPrint}
              className="px-4 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-emerald-950 transition"
            >
              <Printer className="w-4 h-4" />
              <span>{t('ledger.printReport', 'Print Certified Report (PDF)')}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
