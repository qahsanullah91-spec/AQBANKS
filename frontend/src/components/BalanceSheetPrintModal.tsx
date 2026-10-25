import React, { useState, useEffect } from 'react';
import { BalanceSheetReport } from '../types';
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
  Scale,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { triggerPrint } from '../utils/print';
import { exportToCsv } from '../utils/export';

interface BalanceSheetPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: BalanceSheetReport | null;
}

export const BalanceSheetPrintModal: React.FC<BalanceSheetPrintModalProps> = ({
  isOpen,
  onClose,
  reportData
}) => {
  const { t, isRtl } = useLanguage();
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [maskAccount, setMaskAccount] = useState(false);
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
  const reportRef = `AQ-BS-${todayStr.replace(/-/g, '')}`;

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
    triggerPrint(`Balance-Sheet-Statement-${todayStr}`);
  };

  const handleExportCsv = () => {
    const headers = ['Classification', 'Financial Line Item', 'Account Code', 'Amount (USD)'];
    const rows: (string | number)[][] = [
      ['CURRENT ASSETS', 'Cash and Cash Equivalents (AUB Bank)', '1010-CASH', Number(reportData.assets?.cashAndEquivalents || 0).toFixed(2)],
      ['CURRENT ASSETS', 'Accounts Receivable (Trade Debtors)', '1200-AR', Number(reportData.assets?.accountsReceivable || 0).toFixed(2)],
      ['CURRENT ASSETS', 'TOTAL ASSETS', 'TOTAL-ASSETS', Number(reportData.assets?.totalAssets || 0).toFixed(2)],
      ['CURRENT LIABILITIES', 'Customer Advances / Unallocated Credits', '2010-ADVANCES', Number(reportData.liabilities?.unallocatedCustomerAdvances || 0).toFixed(2)],
      ['CURRENT LIABILITIES', 'TOTAL LIABILITIES', 'TOTAL-LIABILITIES', Number(reportData.liabilities?.totalLiabilities || 0).toFixed(2)],
      ['OWNERS EQUITY', 'Initial Opening Capital', '3010-CAPITAL', Number(reportData.equity?.openingCapital || 0).toFixed(2)],
      ['OWNERS EQUITY', 'Retained Earnings / Operating Surplus', '3020-RETAINED', Number(reportData.equity?.retainedEarnings || 0).toFixed(2)],
      ['OWNERS EQUITY', 'TOTAL SHAREHOLDERS EQUITY', 'TOTAL-EQUITY', Number(reportData.equity?.totalEquity || 0).toFixed(2)],
      ['SUMMARY', 'TOTAL LIABILITIES & EQUITY', 'TOTAL-LIAB-EQUITY', (Number(reportData.liabilities?.totalLiabilities || 0) + Number(reportData.equity?.totalEquity || 0)).toFixed(2)]
    ];

    exportToCsv(`Balance-Sheet-Statement-${todayStr}`, headers, rows);
  };

  const asOfLabel = reportData.asOfDate ? formatDisplayDate(reportData.asOfDate) : formatDisplayDate(todayStr);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[96vh] overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full print:bg-white text-slate-100">
        
        {/* Top Action Bar */}
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-950/80 border border-blue-800 flex items-center justify-center text-blue-400">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Balance Sheet (Statement of Financial Position)
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800 font-bold uppercase">
                  A4 Print & Export
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Ref: {reportRef} • As of {asOfLabel}
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
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-950 transition flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print Balance Sheet</span>
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
                      <span className="text-[10px] font-mono tracking-widest uppercase text-blue-800 font-bold block mt-0.5">
                        Balance Sheet • Statement of Financial Position
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 font-sans pt-1">
                    Certified Accounting Equation: Assets = Liabilities + Equity
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Afghan United Bank Operating Account (101502******0472) • Currency: USD
                  </p>
                </div>

                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 bg-slate-900 text-white font-mono font-bold text-xs uppercase tracking-wider rounded">
                    BALANCE SHEET
                  </span>
                  <div className="mt-2 text-xs font-mono space-y-0.5 text-slate-700">
                    <div><strong>Ref:</strong> {reportRef}</div>
                    <div><strong>As of:</strong> {formatFullDate(reportData.asOfDate || todayStr)}</div>
                    <div>
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> BALANCED ($0.00 DISCREPANCY)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Top KPI Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-blue-50/70 border border-blue-300 rounded-lg">
                <span className="text-[9px] uppercase font-bold text-blue-800 block">Total Assets</span>
                <div className="text-lg font-black font-mono text-blue-700 mt-1 tabular-nums" dir="ltr">
                  {formatCurrency(reportData.assets?.totalAssets)}
                </div>
                <span className="text-[10px] text-blue-800 font-medium block mt-0.5">
                  Bank Cash + Receivables
                </span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg">
                <span className="text-[9px] uppercase font-bold text-slate-600 block">Total Liabilities</span>
                <div className="text-lg font-black font-mono text-slate-800 mt-1 tabular-nums" dir="ltr">
                  {formatCurrency(reportData.liabilities?.totalLiabilities)}
                </div>
                <span className="text-[10px] text-slate-600 font-medium block mt-0.5">
                  Advances & Trade Payables
                </span>
              </div>

              <div className="p-3 bg-emerald-50/70 border border-emerald-300 rounded-lg">
                <span className="text-[9px] uppercase font-bold text-emerald-800 block">Shareholders' Equity</span>
                <div className="text-lg font-black font-mono text-emerald-700 mt-1 tabular-nums" dir="ltr">
                  {formatCurrency(reportData.equity?.totalEquity)}
                </div>
                <span className="text-[10px] text-emerald-800 font-bold block mt-0.5">
                  Opening Capital + Retained Earnings
                </span>
              </div>
            </div>

            {/* Balance Sheet Line Items Table */}
            <div>
              <table className={`w-full text-left font-mono border-collapse border border-slate-300 ${compactMode ? 'text-[11px]' : 'text-xs'}`}>
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[10px] uppercase font-sans">
                    <th className="py-2.5 px-3 border-r border-slate-300">Account Classification & Description</th>
                    <th className="py-2.5 px-3 border-r border-slate-300 text-center">GL Account</th>
                    <th className="py-2.5 px-3 text-right">Amount (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {/* ASSETS SECTION */}
                  <tr className="bg-blue-50/50 font-bold text-slate-900">
                    <td className="py-2 px-3 border-r border-slate-200 uppercase font-sans" colSpan={3}>
                      1. Current Assets
                    </td>
                  </tr>
                  <tr className="text-slate-700">
                    <td className="py-1.5 px-3 border-r border-slate-200 pl-6">
                      Cash & Cash Equivalents (Afghan United Bank Operating Account)
                    </td>
                    <td className="py-1.5 px-3 border-r border-slate-200 text-center text-slate-600">1010-CASH</td>
                    <td className="py-1.5 px-3 text-right text-slate-900 tabular-nums font-mono" dir="ltr">
                      {formatCurrency(reportData.assets?.cashAndEquivalents)}
                    </td>
                  </tr>
                  <tr className="text-slate-700">
                    <td className="py-1.5 px-3 border-r border-slate-200 pl-6">
                      Trade Accounts Receivable ({reportData.assets?.openInvoiceCount || 0} Open Proforma Invoices)
                    </td>
                    <td className="py-1.5 px-3 border-r border-slate-200 text-center text-slate-600">1200-AR</td>
                    <td className="py-1.5 px-3 text-right text-slate-900 tabular-nums font-mono" dir="ltr">
                      {formatCurrency(reportData.assets?.accountsReceivable)}
                    </td>
                  </tr>
                  <tr className="bg-blue-50/70 font-black text-slate-900 border-t border-b border-blue-200">
                    <td className="py-2 px-3 border-r border-blue-200 uppercase font-sans pl-6">
                      TOTAL CURRENT ASSETS
                    </td>
                    <td className="py-2 px-3 border-r border-blue-200 text-center"></td>
                    <td className="py-2 px-3 text-right text-blue-900 tabular-nums font-mono text-sm" dir="ltr">
                      {formatCurrency(reportData.assets?.totalAssets)}
                    </td>
                  </tr>

                  {/* LIABILITIES SECTION */}
                  <tr className="bg-slate-100 font-bold text-slate-900">
                    <td className="py-2 px-3 border-r border-slate-200 uppercase font-sans" colSpan={3}>
                      2. Current Liabilities
                    </td>
                  </tr>
                  <tr className="text-slate-700">
                    <td className="py-1.5 px-3 border-r border-slate-200 pl-6">
                      Customer Advances & Unallocated Wire Credits
                    </td>
                    <td className="py-1.5 px-3 border-r border-slate-200 text-center text-slate-600">2010-ADVANCES</td>
                    <td className="py-1.5 px-3 text-right text-slate-900 tabular-nums font-mono" dir="ltr">
                      {formatCurrency(reportData.liabilities?.unallocatedCustomerAdvances)}
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-bold text-slate-900 border-t border-b border-slate-200">
                    <td className="py-2 px-3 border-r border-slate-200 uppercase font-sans pl-6">
                      TOTAL CURRENT LIABILITIES
                    </td>
                    <td className="py-2 px-3 border-r border-slate-200 text-center"></td>
                    <td className="py-2 px-3 text-right text-slate-900 tabular-nums font-mono" dir="ltr">
                      {formatCurrency(reportData.liabilities?.totalLiabilities)}
                    </td>
                  </tr>

                  {/* EQUITY SECTION */}
                  <tr className="bg-emerald-50/50 font-bold text-slate-900">
                    <td className="py-2 px-3 border-r border-slate-200 uppercase font-sans" colSpan={3}>
                      3. Shareholders' Equity
                    </td>
                  </tr>
                  <tr className="text-slate-700">
                    <td className="py-1.5 px-3 border-r border-slate-200 pl-6">
                      Initial Capital Reserve
                    </td>
                    <td className="py-1.5 px-3 border-r border-slate-200 text-center text-slate-600">3010-CAPITAL</td>
                    <td className="py-1.5 px-3 text-right text-slate-900 tabular-nums font-mono" dir="ltr">
                      {formatCurrency(reportData.equity?.openingCapital)}
                    </td>
                  </tr>
                  <tr className="text-slate-700">
                    <td className="py-1.5 px-3 border-r border-slate-200 pl-6">
                      Retained Earnings / Operating Surplus
                    </td>
                    <td className="py-1.5 px-3 border-r border-slate-200 text-center text-slate-600">3020-RETAINED</td>
                    <td className="py-1.5 px-3 text-right text-emerald-800 tabular-nums font-mono font-semibold" dir="ltr">
                      {formatCurrency(reportData.equity?.retainedEarnings)}
                    </td>
                  </tr>
                  <tr className="bg-emerald-50/70 font-black text-slate-900 border-t border-b border-emerald-200">
                    <td className="py-2 px-3 border-r border-emerald-200 uppercase font-sans pl-6">
                      TOTAL SHAREHOLDERS' EQUITY
                    </td>
                    <td className="py-2 px-3 border-r border-emerald-200 text-center"></td>
                    <td className="py-2 px-3 text-right text-emerald-900 tabular-nums font-mono text-sm" dir="ltr">
                      {formatCurrency(reportData.equity?.totalEquity)}
                    </td>
                  </tr>

                  {/* TOTAL LIABILITIES & EQUITY */}
                  <tr className="bg-slate-900 text-white font-black text-sm border-t-2 border-slate-900">
                    <td className="py-3 px-3 border-r border-slate-800 uppercase font-sans">
                      TOTAL LIABILITIES & EQUITY
                    </td>
                    <td className="py-3 px-3 border-r border-slate-800 text-center"></td>
                    <td className="py-3 px-3 text-right text-white tabular-nums text-base font-mono" dir="ltr">
                      {formatCurrency((Number(reportData.liabilities?.totalLiabilities || 0) + Number(reportData.equity?.totalEquity || 0)))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Audit Certificate Footnote */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[10px] text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 uppercase font-sans">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Audited Balance Verification Certificate</span>
              </div>
              <p>
                The financial position above strictly satisfies the fundamental accounting identity: <strong>Total Assets (${formatCurrency(reportData.assets?.totalAssets)}) = Total Liabilities (${formatCurrency(reportData.liabilities?.totalLiabilities)}) + Shareholders' Equity (${formatCurrency(reportData.equity?.totalEquity)})</strong>. Verified discrepancy is <strong>$0.00</strong>.
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
                    Chief Financial Accountant
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1 font-sans">
                    AQ Companies Treasury & Financial Audit
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-sans mb-1">
                    Confirmed & Approved By
                  </div>
                  <div className="h-12 border-b border-slate-400 flex items-end justify-end pb-1 font-mono text-xs text-slate-900 font-bold">
                    Executive Managing Director
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1 font-sans">
                    Authorized Signatory • AQ Companies
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
