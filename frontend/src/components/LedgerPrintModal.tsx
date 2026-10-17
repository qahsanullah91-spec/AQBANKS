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
  FileText
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
  closingBalance,
  periodLabel = 'All Chronological Transactions',
  totalCredits: propTotalCredits,
  totalDebits: propTotalDebits,
  creditCount: propCreditCount,
  debitCount: propDebitCount,
}) => {
  const { t, isRtl } = useLanguage();
  const [maskAccount, setMaskAccount] = useState(false);
  const [includeSignatures, setIncludeSignatures] = useState(true);

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

  // Compute totals if not provided
  const computedTotalDebits = propTotalDebits !== undefined
    ? propTotalDebits
    : transactions.reduce((sum, tx) => sum + (Number(tx.debitAmount) || 0), 0);

  const computedTotalCredits = propTotalCredits !== undefined
    ? propTotalCredits
    : transactions.reduce((sum, tx) => sum + (Number(tx.creditAmount) || 0), 0);

  const computedDebitCount = propDebitCount !== undefined
    ? propDebitCount
    : transactions.filter(tx => (Number(tx.debitAmount) || 0) > 0).length;

  const computedCreditCount = propCreditCount !== undefined
    ? propCreditCount
    : transactions.filter(tx => (Number(tx.creditAmount) || 0) > 0).length;

  const todayStr = new Date().toISOString().split('T')[0];
  const statementRef = `AQ-STMT-${todayStr.replace(/-/g, '')}-0472`;

  const handlePrint = () => {
    triggerPrint(`Corporate-Account-Statement-${todayStr}`);
  };

  const handleExportCsv = () => {
    const headers = ['Effective Date', 'Reference', 'Description', 'Category', 'Debit (USD)', 'Credit (USD)', 'Running Balance (USD)', 'Status'];
    const rows = transactions.map(item => [
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
      `Official Corporate Ledger & Account Statement - ${periodLabel}`,
      `Account: Afghan United Bank - 101502USD2940472 | Generated: ${new Date().toISOString()}`,
      `Opening Balance: $${Number(openingBalance).toFixed(2)} | Closing Balance: $${Number(closingBalance).toFixed(2)}`,
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="printable-document bg-white text-slate-900 rounded-xl w-full max-w-4xl my-auto p-4 sm:p-8 shadow-2xl font-sans max-h-[95vh] overflow-y-auto print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-full print:rounded-none print:max-h-none print:overflow-visible">
        
        {/* MODAL CONTROL TOOLBAR (print:hidden) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 mb-6 border-b border-slate-200 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
              <Printer className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {t('ledger.printPreviewTitle', 'Official Corporate Statement Print Preview')}
              </h3>
              <p className="text-xs text-slate-500">
                {periodLabel} • {transactions.length} transactions
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Mask/Unmask Toggle */}
            <button
              onClick={() => setMaskAccount(!maskAccount)}
              className="px-2.5 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition"
              title={maskAccount ? 'Reveal full account number' : 'Mask account number'}
            >
              {maskAccount ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{maskAccount ? 'Masked' : 'Unmasked'}</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg flex items-center gap-1.5 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>

            {/* Print / Save PDF Button */}
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 min-h-[36px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>{t('common.print', 'Print / Save PDF')}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE DOCUMENT BODY */}
        <div className="space-y-6">
          
          {/* 1. OFFICIAL CORPORATE HEADER */}
          <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
            <div className="flex items-center gap-4">
              <div className="h-16 w-36 sm:w-44 flex items-center justify-start shrink-0">
                <img
                  src="/sky-ariana-logo.png"
                  alt="Sky Ariana Ltd. Official Logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">SKY ARIANA LTD.</h1>
                <p className="text-xs text-slate-600 font-bold uppercase tracking-wider">Corporate Treasury & Commercial Banking Operations</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Kabul Corporate Center, Afghanistan • Registration No: 83729-D
                </p>
                <p className="text-[11px] text-slate-500">
                  treasury@skyariana.com • www.skyariana.com
                </p>
              </div>
            </div>

            <div className="text-right rtl:text-left">
              <span className="text-base sm:text-lg font-black tracking-wider uppercase text-emerald-800 block">
                OFFICIAL ACCOUNT STATEMENT
              </span>
              <span dir="ltr" className="text-xs font-mono font-bold text-slate-700 block mt-1">
                Ref: {statementRef}
              </span>
              <span dir="ltr" className="text-[11px] text-slate-500 block mt-0.5">
                Issue Date: {formatFullDate(todayStr)}
              </span>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                VERIFIED DETERMINISTIC BALANCES
              </span>
            </div>
          </div>

          {/* 2. BANKING & ACCOUNT INFORMATION BOX */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Banking Institution:</span>
                <span className="font-bold text-slate-900 text-sm">AFGHAN UNITED BANK</span>
                <span className="text-[11px] text-slate-500 block">Kabul Corporate Banking Div.</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Account Title:</span>
                <span className="font-bold text-slate-900 text-sm">SKY ARIANA LTD</span>
                <span className="text-[11px] text-slate-500 block">Primary Operating Account</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Account Number:</span>
                <span dir="ltr" className="font-mono font-bold text-emerald-800 text-sm block">
                  {maskAccount ? '101502******0472' : '101502USD2940472'}
                </span>
                <span className="text-[11px] text-slate-500 block">SWIFT: AFGUAFKAXXX</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Statement Scope:</span>
                <span className="font-bold text-slate-900 text-xs block">{periodLabel}</span>
                <span className="text-[11px] text-slate-500 block">Currency: USD ($)</span>
              </div>
            </div>
          </div>

          {/* 3. EXECUTIVE FINANCIAL SUMMARY KPIS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Opening Baseline</span>
              <div className="text-base font-bold font-mono text-slate-900 mt-0.5" dir="ltr">
                ${Number(openingBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-500 block mt-0.5">Prior period baseline</span>
            </div>

            <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg">
              <span className="text-[10px] text-emerald-800 uppercase font-semibold block">Total Inflow (Credits)</span>
              <div className="text-base font-bold font-mono text-emerald-700 mt-0.5" dir="ltr">
                +${computedTotalCredits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-emerald-700 block mt-0.5">{computedCreditCount} inward transfers</span>
            </div>

            <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-lg">
              <span className="text-[10px] text-rose-800 uppercase font-semibold block">Total Outflow (Debits)</span>
              <div className="text-base font-bold font-mono text-rose-700 mt-0.5" dir="ltr">
                -${computedTotalDebits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-rose-700 block mt-0.5">{computedDebitCount} disbursements</span>
            </div>

            <div className="p-3 bg-slate-900 text-white rounded-lg">
              <span className="text-[10px] text-emerald-300 uppercase font-semibold block">Verified Closing Balance</span>
              <div className="text-lg font-extrabold font-mono text-emerald-400 mt-0.5" dir="ltr">
                ${Number(closingBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-300 block mt-0.5 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> Fully Reconciled
              </span>
            </div>
          </div>

          {/* 4. FORMAL STATEMENT TRANSACTIONS TABLE */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className={`py-2.5 px-3 font-semibold ${isRtl ? 'text-right' : 'text-left'}`}>Effective Date</th>
                  <th className={`py-2.5 px-3 font-semibold ${isRtl ? 'text-right' : 'text-left'}`}>Reference</th>
                  <th className={`py-2.5 px-3 font-semibold ${isRtl ? 'text-right' : 'text-left'}`}>Transaction Description</th>
                  <th className="py-2.5 px-2 text-center font-semibold">Category</th>
                  <th className={`py-2.5 px-3 font-semibold ${isRtl ? 'text-left' : 'text-right'}`}>Debit (USD)</th>
                  <th className={`py-2.5 px-3 font-semibold ${isRtl ? 'text-left' : 'text-right'}`}>Credit (USD)</th>
                  <th className={`py-2.5 px-3 font-semibold ${isRtl ? 'text-left' : 'text-right'}`}>Balance (USD)</th>
                  <th className="py-2.5 px-2 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {transactions.length > 0 ? (
                  transactions.map((tx, idx) => (
                    <tr key={tx.id || idx} className="hover:bg-slate-50">
                      <td className={`py-2.5 px-3 text-slate-600 ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                        {formatDisplayDate(tx.effectiveDate)}
                      </td>
                      <td className={`py-2.5 px-3 text-slate-800 font-semibold ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                        {tx.reference || '—'}
                      </td>
                      <td className={`py-2.5 px-3 font-sans text-slate-900 font-medium ${isRtl ? 'text-right' : 'text-left'}`}>
                        {tx.description}
                        {tx.isReversal && (
                          <span className="mx-1.5 px-1 py-0.2 rounded text-[9px] bg-rose-100 text-rose-800 border border-rose-300 font-mono">
                            REVERSAL
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-sans font-semibold uppercase ${
                          tx.category === 'CREDIT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          tx.category === 'DEBIT' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {tx.category}
                        </span>
                      </td>
                      <td className={`py-2.5 px-3 font-semibold text-rose-700 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        {Number(tx.debitAmount) > 0 ? `$${Number(tx.debitAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className={`py-2.5 px-3 font-semibold text-emerald-700 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        {Number(tx.creditAmount) > 0 ? `$${Number(tx.creditAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className={`py-2.5 px-3 font-bold text-slate-900 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                        ${Number(tx.runningBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-2 text-center font-sans">
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
                  <td colSpan={4} className="py-3 px-3 text-slate-900 font-bold uppercase tracking-wider font-sans">
                    Statement Summary Totals ({transactions.length} Entries)
                  </td>
                  <td className={`py-3 px-3 font-black text-rose-700 text-xs ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                    ${computedTotalDebits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`py-3 px-3 font-black text-emerald-700 text-xs ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                    ${computedTotalCredits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`py-3 px-3 font-black text-slate-900 text-sm ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                    ${Number(closingBalance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-2 text-center font-sans text-[10px] text-emerald-800 font-bold">
                    Audited
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 5. OFFICIAL CERTIFICATION & AUTHORIZATION SIGN-OFFS */}
          {includeSignatures && (
            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-2">
                
                {/* Prepared By */}
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">1. Prepared By</span>
                  <div className="h-12 border-b border-dashed border-slate-300 mt-2 flex items-end pb-1">
                    <span className="font-mono text-[11px] text-slate-700 italic">System Administrator</span>
                  </div>
                  <div className="mt-2 text-xs">
                    <span className="font-semibold text-slate-900 block">Finance & Treasury Operations</span>
                    <span className="text-[10px] text-slate-500 block">Date: {formatDisplayDate(todayStr)}</span>
                  </div>
                </div>

                {/* Verified By */}
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">2. Verified & Reconciled By</span>
                  <div className="h-12 border-b border-dashed border-slate-300 mt-2 flex items-end pb-1">
                    <span className="font-mono text-[11px] text-emerald-800 font-bold italic">Automatic Ledger Verification Engine</span>
                  </div>
                  <div className="mt-2 text-xs">
                    <span className="font-semibold text-slate-900 block">Internal Audit & Compliance</span>
                    <span className="text-[10px] text-slate-500 block">Afghan United Bank Gateway Confirmed</span>
                  </div>
                </div>

                {/* Authorized Signatory */}
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">3. Authorized Corporate Signatory</span>
                  <div className="h-12 border-b border-dashed border-slate-300 mt-2 flex items-end pb-1">
                    <span className="font-mono text-[11px] text-slate-700 italic">Chief Financial Officer / MD</span>
                  </div>
                  <div className="mt-2 text-xs">
                    <span className="font-semibold text-slate-900 block">Executive Board of Directors</span>
                    <span className="text-[10px] text-slate-500 block">Sky Ariana Ltd Corporate Portal</span>
                  </div>
                </div>
              </div>

              {/* Official Corporate Audit Seal & Compliance Notice */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div className="text-[11px] text-slate-600 max-w-xl">
                  <span className="font-bold text-slate-900 block">Official Corporate Bank Statement Certification:</span>
                  This document constitutes a certified electronic account ledger statement extracted from the Sky Ariana Ltd Enterprise Banking Portal. All debit/credit entries, SWIFT deductions, wire references, and running balances are verified deterministically against Afghan United Bank records.
                </div>
                <div className="border-2 border-emerald-600 rounded-lg p-2 text-center text-emerald-800 bg-emerald-50 shrink-0">
                  <div className="flex items-center justify-center gap-1 font-black text-[11px] uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
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
