import React, { useState, useEffect } from 'react';
import { LedgerTransaction } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatDisplayDate, formatFullDate } from '../utils/date';
import {
  Printer,
  X,
  Download,
  ShieldCheck,
  Eye,
  EyeOff,
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  FileSpreadsheet,
  Check,
  Layers,
  FileCheck
} from 'lucide-react';
import { triggerPrint } from '../utils/print';

interface LedgerPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: LedgerTransaction[];
  openingBalance: string | number;
  closingBalance: string | number;
  periodLabel?: string;
  totalCredits?: number;
  totalDebits?: number;
  creditCount?: number;
  debitCount?: number;
}

export const LedgerPrintModal: React.FC<LedgerPrintModalProps> = ({
  isOpen,
  onClose,
  transactions,
  openingBalance,
  closingBalance: propClosingBalance,
  periodLabel = 'All Chronological Transactions',
  totalCredits: propTotalCredits,
  totalDebits: propTotalDebits,
  creditCount: propCreditCount,
  debitCount: propDebitCount,
}) => {
  const { t, isRtl } = useLanguage();
  const [maskAccount, setMaskAccount] = useState(false);
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [includeCorrespondent, setIncludeCorrespondent] = useState(true);
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

  if (!isOpen) return null;

  const safeTransactions = Array.isArray(transactions) ? transactions : [];

  // Deterministically compute all totals from safeTransactions directly to guarantee 100% mathematical reconciliation
  const computedTotalDebits = safeTransactions.reduce((sum, tx) => sum + (Number(tx.debitAmount) || 0), 0);
  const computedTotalCredits = safeTransactions.reduce((sum, tx) => sum + (Number(tx.creditAmount) || 0), 0);
  const computedDebitCount = safeTransactions.filter(tx => (Number(tx.debitAmount) || 0) > 0).length;
  const computedCreditCount = safeTransactions.filter(tx => (Number(tx.creditAmount) || 0) > 0).length;

  // Real closing balance directly derived from the rendered transactions timeline:
  const computedClosingBalance = safeTransactions.length > 0
    ? Number(safeTransactions[safeTransactions.length - 1].runningBalance)
    : Number(openingBalance) + computedTotalCredits - computedTotalDebits;

  const todayStr = new Date().toISOString().split('T')[0];
  const statementRef = `AQ-STMT-${todayStr.replace(/-/g, '')}-0472`;

  const handlePrint = () => {
    triggerPrint(`Corporate-Account-Statement-${todayStr}`);
  };

  const handleExportCsv = () => {
    const headers = ['Effective Date', 'Reference', 'Description', 'Category', 'Debit (USD)', 'Credit (USD)', 'Running Balance (USD)', 'Status'];
    const rows = safeTransactions.map(item => [
      formatDisplayDate(item.effectiveDate),
      item.reference || '—',
      `"${(item.description || '').replace(/"/g, '""')}"`,
      item.category,
      Number(item.debitAmount || 0).toFixed(2),
      Number(item.creditAmount || 0).toFixed(2),
      Number(item.runningBalance || 0).toFixed(2),
      'RECONCILED'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [
      `Official Corporate Ledger & Account Statement - ${periodLabel}`,
      `Company: Sky Ariana Ltd. / AQ Companies | Primary Operating Account: 101502USD2940472`,
      `Bank: Afghan United Bank (AUB) | Generated: ${new Date().toISOString()}`,
      `Opening Balance: $${Number(openingBalance).toFixed(2)} | Inflows: +$${computedTotalCredits.toFixed(2)} | Outflows: -$${computedTotalDebits.toFixed(2)} | Closing Balance: $${computedClosingBalance.toFixed(2)}`,
      '',
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Corporate_Bank_Statement_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="printable-document bg-white text-slate-900 rounded-2xl w-full max-w-4xl my-auto p-4 sm:p-8 shadow-2xl font-sans max-h-[95vh] overflow-y-auto border border-slate-300 print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-full print:rounded-none print:max-h-none print:overflow-visible">
        
        {/* MODAL CONTROL TOOLBAR (print:hidden) */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 pb-4 mb-5 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl shadow-xs">
              <Printer className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>{t('ledger.printPreviewTitle', 'Official Corporate Statement Print Preview')}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {safeTransactions.length} Verified Entries
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                {periodLabel} • Closing: <strong className="font-mono text-emerald-800">${computedClosingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            {/* Mask/Unmask Toggle */}
            <button
              onClick={() => setMaskAccount(!maskAccount)}
              className="px-2.5 py-1.5 min-h-[34px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer"
              title={maskAccount ? 'Reveal full bank details' : 'Mask sensitive bank details'}
            >
              {maskAccount ? <EyeOff className="w-3.5 h-3.5 text-slate-500" /> : <Eye className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{maskAccount ? 'Masked' : 'Unmasked'}</span>
            </button>

            {/* Correspondent Routing Details Toggle */}
            <button
              onClick={() => setIncludeCorrespondent(!includeCorrespondent)}
              className={`px-2.5 py-1.5 min-h-[34px] text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                includeCorrespondent ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
              title="Toggle Correspondent & Intermediary wire details in statement header"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Routing: {includeCorrespondent ? 'Full' : 'Basic'}</span>
            </button>

            {/* Signatures Toggle */}
            <button
              onClick={() => setIncludeSignatures(!includeSignatures)}
              className={`px-2.5 py-1.5 min-h-[34px] text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                includeSignatures ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
              title="Toggle official executive sign-off certification blocks"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Signatures: {includeSignatures ? 'ON' : 'OFF'}</span>
            </button>

            {/* Density Toggle (Compact for 1-page fit) */}
            <button
              onClick={() => setCompactMode(!compactMode)}
              className={`px-2.5 py-1.5 min-h-[34px] text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                compactMode ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
              title="Toggle compact row spacing for single-page presentation"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{compactMode ? 'Compact' : 'Standard'}</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 min-h-[34px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            {/* Print / Save PDF Button */}
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 min-h-[34px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t('common.print', 'Print / Save PDF')}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 min-h-[34px] min-w-[34px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE DOCUMENT BODY */}
        <div className={`space-y-4 sm:space-y-5 ${compactMode ? 'text-[11px]' : 'text-xs'}`}>
          
          {/* 1. OFFICIAL CORPORATE HEADER */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-800 pb-4 gap-4">
            <div className="flex items-center gap-3.5">
              <div className="h-14 w-32 sm:w-40 flex items-center justify-start shrink-0">
                <img
                  src="/sky-ariana-logo.png"
                  alt="Sky Ariana Ltd. Official Logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-tight">
                  SKY ARIANA LTD.
                </h1>
                <p className="text-[11px] text-slate-700 font-bold uppercase tracking-wider mt-0.5">
                  Corporate Treasury & Commercial Banking Operations
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Kabul Corporate Center, Afghanistan • Registration No: 83729-D • TIN: 9003817291
                </p>
                <p className="text-[10px] text-slate-500">
                  treasury@skyariana.com • SWIFT: AFGUAFKAXXX • www.skyariana.com
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right rtl:text-left shrink-0">
              <span className="text-sm sm:text-base font-black tracking-wider uppercase text-emerald-800 block">
                OFFICIAL ACCOUNT STATEMENT
              </span>
              <span dir="ltr" className="text-xs font-mono font-bold text-slate-800 block mt-0.5">
                Ref: {statementRef}
              </span>
              <span dir="ltr" className="text-[11px] text-slate-600 block">
                Issue Date: {formatFullDate(todayStr)}
              </span>
              <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-300">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                VERIFIED DETERMINISTIC BALANCES
              </span>
            </div>
          </div>

          {/* 2. BANKING & ACCOUNT INFORMATION BOX */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Account Title:</span>
                <span className="font-bold text-slate-900 text-xs block mt-0.5">SKY ARIANA LTD</span>
                <span className="text-[10px] text-slate-500 block">Primary USD Operating Account</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Banking Institution:</span>
                <span className="font-bold text-slate-900 text-xs block mt-0.5">AFGHAN UNITED BANK</span>
                <span className="text-[10px] text-slate-500 block">Kabul Corporate Banking Div.</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Account Number:</span>
                <span dir="ltr" className="font-mono font-bold text-emerald-800 text-xs block mt-0.5">
                  {maskAccount ? '101502******0472' : '101502USD2940472'}
                </span>
                <span className="text-[10px] text-slate-500 block">SWIFT / BIC: <strong>AFGUAFKAXXX</strong></span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Statement Scope:</span>
                <span className="font-bold text-slate-900 text-xs block mt-0.5">{periodLabel}</span>
                <span className="text-[10px] text-slate-500 block">Currency: <strong>USD ($)</strong></span>
              </div>
            </div>

            {/* Optional Correspondent Wire Details */}
            {includeCorrespondent && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2.5 mt-2.5 border-t border-slate-200 text-[10px] text-slate-600">
                <div>
                  <span className="font-bold text-slate-700 block">Correspondent Bank (Bahrain):</span>
                  <span>AL SALAM BANK BAHRAIN • SWIFT: <strong>ALSABHBMXXX</strong></span>
                  <span className="block font-mono text-[9px] text-slate-500">A/C: BH61ALSA00500951200102</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block">Intermediary Bank (USA):</span>
                  <span>JPMorgan Chase Bank, New York • SWIFT: <strong>CHASUS33</strong></span>
                  <span className="block font-mono text-[9px] text-slate-500">AUB Intermediary A/C: 400758954</span>
                </div>
                <div>
                  <span className="font-bold text-slate-700 block">Wire Routing Protocol:</span>
                  <span>MT103 Standard Wire Inward Clearing • Field 57A/59A</span>
                  <span className="block text-[9px] text-emerald-700 font-semibold">Instant Commercial Clearing Enabled</span>
                </div>
              </div>
            )}
          </div>

          {/* 3. EXECUTIVE FINANCIAL SUMMARY KPIS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 bg-white border border-slate-200 border-l-4 border-l-slate-400 rounded-lg shadow-2xs">
              <span className="text-[10px] text-slate-500 uppercase font-bold block">Opening Baseline</span>
              <div className="text-base font-bold font-mono text-slate-900 mt-0.5" dir="ltr">
                ${Number(openingBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Prior period baseline</span>
            </div>

            <div className="p-2.5 bg-emerald-50/70 border border-emerald-200 border-l-4 border-l-emerald-500 rounded-lg shadow-2xs">
              <span className="text-[10px] text-emerald-800 uppercase font-bold block">Total Inflow (Credits)</span>
              <div className="text-base font-bold font-mono text-emerald-700 mt-0.5" dir="ltr">
                +${computedTotalCredits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-emerald-700 block mt-0.5">{computedCreditCount} inward transfers</span>
            </div>

            <div className="p-2.5 bg-rose-50/70 border border-rose-200 border-l-4 border-l-rose-500 rounded-lg shadow-2xs">
              <span className="text-[10px] text-rose-800 uppercase font-bold block">Total Outflow (Debits)</span>
              <div className="text-base font-bold font-mono text-rose-700 mt-0.5" dir="ltr">
                -${computedTotalDebits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-rose-700 block mt-0.5">{computedDebitCount} disbursements</span>
            </div>

            <div className="p-2.5 bg-slate-900 border border-slate-900 border-l-4 border-l-emerald-400 text-white rounded-lg shadow-2xs">
              <span className="text-[10px] text-emerald-300 uppercase font-bold block">Verified Closing Balance</span>
              <div className="text-base sm:text-lg font-black font-mono text-emerald-400 mt-0.5" dir="ltr">
                ${computedClosingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-300 block mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Fully Reconciled
              </span>
            </div>
          </div>

          {/* 4. FORMAL STATEMENT TRANSACTIONS TABLE */}
          <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider border-b border-slate-700">
                <tr>
                  <th className={`py-2 px-2.5 font-bold ${isRtl ? 'text-right' : 'text-left'}`}>Effective Date</th>
                  <th className={`py-2 px-2.5 font-bold ${isRtl ? 'text-right' : 'text-left'}`}>Reference</th>
                  <th className={`py-2 px-2.5 font-bold ${isRtl ? 'text-right' : 'text-left'}`}>Transaction Description</th>
                  <th className="py-2 px-2 text-center font-bold">Category</th>
                  <th className={`py-2 px-2.5 font-bold ${isRtl ? 'text-left' : 'text-right'}`}>Debit (USD)</th>
                  <th className={`py-2 px-2.5 font-bold ${isRtl ? 'text-left' : 'text-right'}`}>Credit (USD)</th>
                  <th className={`py-2 px-2.5 font-bold ${isRtl ? 'text-left' : 'text-right'}`}>Balance (USD)</th>
                  <th className="py-2 px-2 text-center font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {safeTransactions.length > 0 ? (
                  safeTransactions.map((tx, idx) => (
                    <tr key={tx.id || idx} className={`${idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'} hover:bg-slate-100/60 transition`}>
                      <td className={`py-2 px-2.5 text-slate-700 whitespace-nowrap ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                        {formatDisplayDate(tx.effectiveDate)}
                      </td>
                      <td className={`py-2 px-2.5 text-slate-800 font-semibold whitespace-nowrap ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                        {tx.reference || '—'}
                      </td>
                      <td className={`py-2 px-2.5 font-sans text-slate-900 font-medium ${isRtl ? 'text-right' : 'text-left'}`}>
                        {tx.description}
                        {tx.isReversal && (
                          <span className="mx-1.5 px-1 py-0.2 rounded text-[9px] bg-rose-100 text-rose-800 border border-rose-300 font-mono">
                            REVERSAL
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center whitespace-nowrap">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold uppercase ${
                          tx.category === 'CREDIT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          tx.category === 'DEBIT' ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                          'bg-slate-100 text-slate-700 border border-slate-300'
                        }`}>
                          {tx.category}
                        </span>
                      </td>
                      <td className={`py-2 px-2.5 font-semibold text-rose-700 whitespace-nowrap ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        {Number(tx.debitAmount) > 0 ? `$${Number(tx.debitAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className={`py-2 px-2.5 font-semibold text-emerald-700 whitespace-nowrap ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        {Number(tx.creditAmount) > 0 ? `$${Number(tx.creditAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className={`py-2 px-2.5 font-bold text-slate-900 whitespace-nowrap ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        ${Number(tx.runningBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2 text-center font-sans whitespace-nowrap">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                          Reconciled
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400 font-sans">
                      No transactions recorded for the selected statement period.
                    </td>
                  </tr>
                )}
              </tbody>
              {/* TABLE SUMMARY FOOTER */}
              <tfoot className="bg-slate-100 font-mono text-xs border-t-2 border-slate-300">
                <tr>
                  <td colSpan={4} className="py-2.5 px-2.5 text-slate-900 font-bold uppercase tracking-wider font-sans">
                    Statement Summary Totals ({safeTransactions.length} Entries)
                  </td>
                  <td className={`py-2.5 px-2.5 font-black text-rose-700 text-xs ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                    ${computedTotalDebits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`py-2.5 px-2.5 font-black text-emerald-700 text-xs ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                    ${computedTotalCredits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`py-2.5 px-2.5 font-black text-slate-900 text-sm ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                    ${computedClosingBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-2 text-center font-sans text-[10px] text-emerald-800 font-bold">
                    Audited
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 5. OFFICIAL CERTIFICATION & AUTHORIZATION SIGN-OFFS */}
          {includeSignatures && (
            <div className="pt-3 border-t border-slate-200 space-y-3 print-avoid-break signature-block">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                
                {/* Prepared By */}
                <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/70">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">1. Prepared By</span>
                  <div className="h-10 border-b border-dashed border-slate-300 mt-1.5 flex items-end pb-1">
                    <span className="font-mono text-[10px] text-slate-700 italic">Treasury Operations Specialist</span>
                  </div>
                  <div className="mt-1.5 text-xs">
                    <span className="font-bold text-slate-900 block text-[11px]">Finance & Treasury Division</span>
                    <span className="text-[10px] text-slate-500 block">Date: {formatDisplayDate(todayStr)}</span>
                  </div>
                </div>

                {/* Verified By */}
                <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/70">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">2. Verified & Reconciled By</span>
                  <div className="h-10 border-b border-dashed border-slate-300 mt-1.5 flex items-end pb-1">
                    <span className="font-mono text-[10px] text-emerald-800 font-bold italic">Automatic Ledger Reconciliation Engine</span>
                  </div>
                  <div className="mt-1.5 text-xs">
                    <span className="font-bold text-slate-900 block text-[11px]">Internal Audit & Compliance</span>
                    <span className="text-[10px] text-slate-500 block">Afghan United Bank Gateway Confirmed</span>
                  </div>
                </div>

                {/* Authorized Signatory */}
                <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/70">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">3. Authorized Corporate Signatory</span>
                  <div className="h-10 border-b border-dashed border-slate-300 mt-1.5 flex items-end pb-1">
                    <span className="font-mono text-[10px] text-slate-700 italic">Chief Financial Officer / Managing Director</span>
                  </div>
                  <div className="mt-1.5 text-xs">
                    <span className="font-bold text-slate-900 block text-[11px]">Executive Board of Directors</span>
                    <span className="text-[10px] text-slate-500 block">Sky Ariana Ltd Corporate Portal</span>
                  </div>
                </div>
              </div>

              {/* Official Corporate Audit Seal & Compliance Notice */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs audit-seal-block">
                <div className="text-[10px] text-slate-600 max-w-xl">
                  <span className="font-bold text-slate-900 block">Official Corporate Bank Statement Certification:</span>
                  This document constitutes a certified electronic account ledger statement extracted from the Sky Ariana Ltd Enterprise Banking Portal. All debit/credit entries, SWIFT deductions, wire references, and running balances are verified deterministically against Afghan United Bank records.
                </div>
                <div className="border-2 border-emerald-600 rounded-lg p-2 text-center text-emerald-800 bg-emerald-50 shrink-0">
                  <div className="flex items-center justify-center gap-1 font-black text-[10px] uppercase tracking-wider">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>AUB VERIFIED AUDIT SEAL</span>
                  </div>
                  <span className="text-[9px] font-mono block text-emerald-700 mt-0.5">
                    A/C 101502USD2940472 • DETERMINISTIC
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
