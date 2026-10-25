import React, { useState, useEffect } from 'react';
import { ProfitLossReport } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatDisplayDate, formatFullDate } from '../utils/date';
import {
  Printer,
  X,
  Download,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  FileCheck,
  TrendingUp,
  DollarSign,
  TrendingDown
} from 'lucide-react';
import { triggerPrint } from '../utils/print';
import { exportToCsv } from '../utils/export';

interface ProfitLossPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: ProfitLossReport | null;
}

export const ProfitLossPrintModal: React.FC<ProfitLossPrintModalProps> = ({
  isOpen,
  onClose,
  reportData
}) => {
  const { t, isRtl } = useLanguage();
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [compactMode, setCompactMode] = useState(false);

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

  if (!isOpen || !reportData) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const reportRef = `AQ-PL-${todayStr.replace(/-/g, '')}`;

  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  const handlePrint = () => {
    triggerPrint(`Profit-Loss-Statement-${todayStr}`);
  };

  const handleExportCsv = () => {
    const headers = ['Financial Line Item', 'Category Code', 'Transaction Count', 'Amount (USD)', '% of Revenue'];
    const billedRev = Number(reportData.revenue?.billedRevenue || 0);

    const rows: (string | number)[][] = [
      ['GROSS REVENUE (BILLED)', 'REVENUE', reportData.revenue?.invoiceCount || 0, billedRev.toFixed(2), '100.0%'],
      ['Cash Collected from Wires', 'REVENUE_COLLECTED', '—', Number(reportData.revenue?.cashCollected || 0).toFixed(2), billedRev > 0 ? `${((Number(reportData.revenue?.cashCollected || 0) / billedRev) * 100).toFixed(1)}%` : '0.0%'],
      ['Direct Trade & Logistics Costs', 'COGS', '—', Number(reportData.directTradeCosts || 0).toFixed(2), billedRev > 0 ? `${((Number(reportData.directTradeCosts || 0) / billedRev) * 100).toFixed(1)}%` : '0.0%'],
      ['GROSS PROFIT', 'GROSS_MARGIN', '—', Number(reportData.grossProfit || 0).toFixed(2), `${Number(reportData.grossMarginPercent || 0).toFixed(1)}%`],
      ['--- OPERATING EXPENSES ---', '', '', '', '']
    ];

    const expCategories = reportData.expensesByCategory || {};
    for (const [key, item] of Object.entries(expCategories)) {
      const amt = Number(item.amount || 0);
      const pct = billedRev > 0 ? `${((amt / billedRev) * 100).toFixed(1)}%` : '0.0%';
      rows.push([item.label || key, key, item.count || 0, amt.toFixed(2), pct]);
    }

    rows.push(
      ['TOTAL OPERATING EXPENSES', 'EXPENSES_TOTAL', '—', Number(reportData.totalExpenses || 0).toFixed(2), billedRev > 0 ? `${((Number(reportData.totalExpenses || 0) / billedRev) * 100).toFixed(1)}%` : '0.0%'],
      ['NET OPERATING INCOME / SURPLUS', 'NET_INCOME', '—', Number(reportData.netOperatingIncome || 0).toFixed(2), `${Number(reportData.netMarginPercent || 0).toFixed(1)}%`]
    );

    exportToCsv(`Profit-Loss-Statement-${todayStr}`, headers, rows);
  };

  const periodLabel = reportData.period?.startDate && reportData.period?.endDate
    ? `${formatDisplayDate(reportData.period.startDate)} — ${formatDisplayDate(reportData.period.endDate)}`
    : 'All-Time Operational Period';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[96vh] overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full print:bg-white text-slate-100">
        
        {/* Top Action Bar */}
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Profit & Loss (Income Statement)
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold uppercase">
                  A4 Print & Export
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Ref: {reportRef} • Period: {periodLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setIncludeSignatures(!includeSignatures)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1.5"
            >
              <FileCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>{includeSignatures ? 'Signatures ON' : 'Signatures OFF'}</span>
            </button>

            <button
              onClick={() => setCompactMode(!compactMode)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>{compactMode ? 'Normal View' : 'Compact A4'}</span>
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-950 transition flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print Statement</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950 print:bg-white print:p-0 flex justify-center">
          <div className="printable-document bg-white text-slate-900 w-full max-w-3xl p-8 sm:p-10 rounded-xl shadow-2xl print:shadow-none print:rounded-none print:p-0 border border-slate-200 print:border-none space-y-6">
            
            {/* Header */}
            <div className="border-b-2 border-slate-900 pb-5">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm tracking-widest shadow-md">
                      AQ
                    </div>
                    <div>
                      <h1 className="text-xl font-black uppercase tracking-tight text-slate-900 leading-none">
                        AQ Companies
                      </h1>
                      <span className="text-[10px] font-mono tracking-widest uppercase text-emerald-800 font-bold block mt-0.5">
                        Statement of Profit or Loss (Income Statement)
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 font-sans pt-1">
                    Export Logistics & Raisin Trading Operational Financial Summary
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Afghan United Bank Operating Account (101502******0472) • Currency: USD
                  </p>
                </div>

                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 bg-slate-900 text-white font-mono font-bold text-xs uppercase tracking-wider rounded">
                    P&L STATEMENT
                  </span>
                  <div className="mt-2 text-xs font-mono space-y-0.5 text-slate-700">
                    <div><strong>Ref:</strong> {reportRef}</div>
                    <div><strong>Period:</strong> {periodLabel}</div>
                    <div><strong>Generated:</strong> {formatFullDate(todayStr)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top KPI Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-emerald-50/70 border border-emerald-300 rounded-lg">
                <span className="text-[9px] uppercase font-bold text-emerald-800 block">Total Revenue</span>
                <div className="text-lg font-black font-mono text-emerald-700 mt-1 tabular-nums" dir="ltr">
                  {formatCurrency(reportData.revenue?.billedRevenue)}
                </div>
                <span className="text-[10px] text-emerald-800 font-medium block mt-0.5">
                  {reportData.revenue?.invoiceCount || 0} Export Invoices
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg">
                <span className="text-[9px] uppercase font-bold text-slate-600 block">Total Expenses</span>
                <div className="text-lg font-black font-mono text-slate-800 mt-1 tabular-nums" dir="ltr">
                  {formatCurrency(reportData.totalExpenses)}
                </div>
                <span className="text-[10px] text-slate-600 font-medium block mt-0.5">
                  Freight, Duties, SWIFT, Packing
                </span>
              </div>

              <div className="p-3 bg-cyan-50/70 border border-cyan-300 rounded-lg">
                <span className="text-[9px] uppercase font-bold text-cyan-800 block">Net Operating Income</span>
                <div className="text-lg font-black font-mono text-cyan-700 mt-1 tabular-nums" dir="ltr">
                  {formatCurrency(reportData.netOperatingIncome)}
                </div>
                <span className="text-[10px] text-cyan-800 font-bold block mt-0.5">
                  {Number(reportData.netMarginPercent || 0).toFixed(1)}% Operating Margin
                </span>
              </div>
            </div>

            {/* Income Statement Table */}
            <div>
              <table className={`w-full text-left font-mono border-collapse border border-slate-300 ${compactMode ? 'text-[11px]' : 'text-xs'}`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[10px] uppercase font-sans">
                    <th className="py-2.5 px-3 border-r border-slate-300">Particulars / Account Line Item</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center">Volume / Items</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-right">% Revenue</th>
                    <th className="py-2.5 px-3 text-right">Amount (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* Revenue Section */}
                  <tr className="bg-emerald-50/40 font-bold text-slate-900">
                    <td className="py-2 px-3 border-r border-slate-200 uppercase font-sans">1. Operating Revenue</td>
                    <td className="py-2 px-3 border-r border-slate-200 text-center"></td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right">100.0%</td>
                    <td className="py-2 px-3 text-right text-emerald-800 tabular-nums font-mono" dir="ltr">
                      {formatCurrency(reportData.revenue?.billedRevenue)}
                    </td>
                  </tr>
                  <tr className="text-slate-700">
                    <td className="py-1.5 px-3 border-r border-slate-200 pl-6">
                      Commercial Raisin Export Sales (Issued Proforma Invoices)
                    </td>
                    <td className="py-1.5 px-3 border-r border-slate-200 text-center text-slate-600">
                      {reportData.revenue?.invoiceCount || 0} Invoices
                    </td>
                    <td className="py-1.5 px-3 border-r border-slate-200 text-right text-slate-600">100.0%</td>
                    <td className="py-1.5 px-3 text-right text-slate-900 tabular-nums" dir="ltr">
                      {formatCurrency(reportData.revenue?.billedRevenue)}
                    </td>
                  </tr>
                  <tr className="text-slate-600 bg-slate-50/50">
                    <td className="py-1.5 px-3 border-r border-slate-200 pl-6 italic">
                      Memo: Inward Bank Collections Received via Wires
                    </td>
                    <td className="py-1.5 px-3 border-r border-slate-200 text-center">—</td>
                    <td className="py-1.5 px-3 border-r border-slate-200 text-right">
                      {Number(reportData.revenue?.billedRevenue) > 0 ? ((Number(reportData.revenue?.cashCollected || 0) / Number(reportData.revenue?.billedRevenue)) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td className="py-1.5 px-3 text-right text-emerald-700 tabular-nums" dir="ltr">
                      {formatCurrency(reportData.revenue?.cashCollected)}
                    </td>
                  </tr>

                  {/* Direct Trade Costs */}
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <td className="py-2 px-3 border-r border-slate-200 uppercase font-sans">2. Direct Trade & Port Costs</td>
                    <td className="py-2 px-3 border-r border-slate-200 text-center"></td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right">
                      {Number(reportData.revenue?.billedRevenue) > 0 ? ((Number(reportData.directTradeCosts || 0) / Number(reportData.revenue?.billedRevenue)) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td className="py-2 px-3 text-right text-rose-800 tabular-nums font-mono" dir="ltr">
                      ({formatCurrency(reportData.directTradeCosts)})
                    </td>
                  </tr>

                  {/* Gross Profit */}
                  <tr className="bg-emerald-50/70 font-black text-slate-900 border-t-2 border-b-2 border-emerald-300">
                    <td className="py-2.5 px-3 border-r border-emerald-300 uppercase font-sans">GROSS PROFIT</td>
                    <td className="py-2.5 px-3 border-r border-emerald-300 text-center"></td>
                    <td className="py-2.5 px-3 border-r border-emerald-300 text-right text-emerald-800">
                      {Number(reportData.grossMarginPercent || 0).toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-800 tabular-nums text-sm font-mono" dir="ltr">
                      {formatCurrency(reportData.grossProfit)}
                    </td>
                  </tr>

                  {/* Operating Expenses */}
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <td className="py-2 px-3 border-r border-slate-200 uppercase font-sans" colSpan={4}>
                      3. Operational Disbursements & Bank Charges
                    </td>
                  </tr>
                  {Object.entries(reportData.expensesByCategory || {}).map(([key, item]) => {
                    const amt = Number(item.amount || 0);
                    const rev = Number(reportData.revenue?.billedRevenue || 0);
                    const pct = rev > 0 ? ((amt / rev) * 100).toFixed(1) : '0.0';

                    return (
                      <tr key={key} className="text-slate-700">
                        <td className="py-1.5 px-3 border-r border-slate-200 pl-6">
                          {item.label}
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-center text-slate-600">
                          {item.count} Transactions
                        </td>
                        <td className="py-1.5 px-3 border-r border-slate-200 text-right text-slate-600">{pct}%</td>
                        <td className="py-1.5 px-3 text-right text-slate-900 tabular-nums" dir="ltr">
                          {formatCurrency(amt)}
                        </td>
                      </tr>
                    );
                  })}

                  <tr className="bg-slate-50 font-bold text-slate-900 border-t border-slate-300">
                    <td className="py-2 px-3 border-r border-slate-200 uppercase font-sans pl-6">
                      Total Operating Expenses
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-center"></td>
                    <td className="py-2 px-3 border-r border-slate-200 text-right text-slate-700">
                      {Number(reportData.revenue?.billedRevenue) > 0 ? ((Number(reportData.totalExpenses || 0) / Number(reportData.revenue?.billedRevenue)) * 100).toFixed(1) : '0.0'}%
                    </td>
                    <td className="py-2 px-3 text-right text-rose-800 tabular-nums font-mono" dir="ltr">
                      ({formatCurrency(reportData.totalExpenses)})
                    </td>
                  </tr>

                  {/* Net Operating Income */}
                  <tr className="bg-slate-900 text-white font-black text-sm border-t-2 border-slate-900">
                    <td className="py-3 px-3 border-r border-slate-800 uppercase font-sans">
                      NET OPERATING INCOME / SURPLUS
                    </td>
                    <td className="py-3 px-3 border-r border-slate-800 text-center"></td>
                    <td className="py-3 px-3 border-r border-slate-800 text-right text-emerald-400">
                      {Number(reportData.netMarginPercent || 0).toFixed(1)}%
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-400 tabular-nums text-base font-mono" dir="ltr">
                      {formatCurrency(reportData.netOperatingIncome)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Accounting Certificate Footnote */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[10px] text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 uppercase font-sans">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Accounting Standards & Reconciliation Note</span>
              </div>
              <p>
                Revenues are recognized upon issuance of official commercial proforma invoices and cargo release. Disbursements are reconciled against authentic Afghan United Bank ledger debits and correspondent SWIFT advices.
              </p>
            </div>

            {/* Signatures */}
            {includeSignatures && (
              <div className="pt-4 border-t border-slate-300 grid grid-cols-2 gap-8 print:pt-6">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-sans mb-1">
                    Prepared By
                  </div>
                  <div className="h-12 border-b border-slate-400 flex items-end pb-1 font-mono text-xs text-slate-700">
                    Senior Financial Accountant
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1 font-sans">
                    AQ Companies Treasury Division
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-sans mb-1">
                    Audited & Approved By
                  </div>
                  <div className="h-12 border-b border-slate-400 flex items-end justify-end pb-1 font-mono text-xs text-slate-900 font-bold">
                    Managing Director / Authorized Signatory
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1 font-sans">
                    Executive Board • AQ Companies
                  </div>
                </div>
              </div>
            )}

            <div className="text-center text-[9px] text-slate-400 font-mono border-t border-slate-200 pt-3">
              Generated by AQ Companies Logistics & Financial Management Portal • Document ID: {reportRef} • Confidential Enterprise Record
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
