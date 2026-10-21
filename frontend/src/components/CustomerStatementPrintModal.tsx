import React, { useState, useEffect } from 'react';
import { CustomerStatementReport } from '../types';
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
  Layers,
  FileCheck,
  User,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { triggerPrint } from '../utils/print';

interface CustomerStatementPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  statementData: CustomerStatementReport | null;
}

export const CustomerStatementPrintModal: React.FC<CustomerStatementPrintModalProps> = ({
  isOpen,
  onClose,
  statementData,
}) => {
  const { t, isRtl } = useLanguage();
  const [maskAccount, setMaskAccount] = useState(false);
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [includeRemittance, setIncludeRemittance] = useState(true);
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

  if (!isOpen || !statementData) return null;

  const { customer, period, summary, entries } = statementData;
  const safeEntries = Array.isArray(entries) ? entries : [];

  const todayStr = new Date().toISOString().split('T')[0];
  const statementRef = `AQ-CUST-${customer.companyName.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()}-${todayStr.replace(/-/g, '')}`;

  const periodLabel = period.isCustom
    ? `${formatDisplayDate(period.startDate || '')} — ${formatDisplayDate(period.endDate || '')}`
    : 'All-Time Inception to Date';

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
    const cleanName = customer.companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
    triggerPrint(`Statement-of-Account-${cleanName}-${todayStr}`);
  };

  const handleExportCsv = () => {
    const headers = ['Date', 'Type', 'Reference', 'Description', 'Debit / Billed (USD)', 'Credit / Paid (USD)', 'SWIFT Fee (USD)', 'Running Balance (USD)'];
    const rows = safeEntries.map(e => [
      formatDisplayDate(e.date),
      e.type,
      e.reference || '',
      `"${(e.description || '').replace(/"/g, '""')}"`,
      e.debit > 0 ? e.debit.toFixed(2) : '0.00',
      e.credit > 0 ? e.credit.toFixed(2) : '0.00',
      e.swiftFee > 0 ? e.swiftFee.toFixed(2) : '0.00',
      e.runningBalance.toFixed(2)
    ]);

    // Include Opening and Closing rows
    rows.unshift(['—', 'OPENING_BALANCE', 'PRIOR_BALANCE', 'Opening Balance at Period Start', '0.00', '0.00', '0.00', summary.openingBalance.toFixed(2)]);
    rows.push(['—', 'CLOSING_BALANCE', 'PERIOD_CLOSE', 'Closing Statement Balance', summary.totalInvoiced.toFixed(2), summary.totalPaymentsReceived.toFixed(2), '0.00', summary.closingBalance.toFixed(2)]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [
      `"STATEMENT OF ACCOUNT - ${customer.companyName}"`,
      `"Period: ${periodLabel}"`,
      `"Generated: ${todayStr}"`,
      '',
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `statement_${customer.companyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${todayStr}.csv`);
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
            <span className="p-2 bg-blue-100 text-blue-800 rounded-xl shadow-xs">
              <User className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Official Statement of Account Print Preview</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {safeEntries.length} Statement Items
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                {customer.companyName} • Period: <strong>{periodLabel}</strong> • Net Due: <strong className="font-mono text-emerald-800">{formatCurrency(summary.closingBalance)}</strong>
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

            {/* Remittance Toggle */}
            <button
              onClick={() => setIncludeRemittance(!includeRemittance)}
              className={`px-2.5 py-1.5 min-h-[34px] text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                includeRemittance ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
              title="Toggle Bank Remittance wire instruction box"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Remittance: {includeRemittance ? 'ON' : 'OFF'}</span>
            </button>

            {/* Signatures Toggle */}
            <button
              onClick={() => setIncludeSignatures(!includeSignatures)}
              className={`px-2.5 py-1.5 min-h-[34px] text-xs font-medium rounded-lg flex items-center gap-1.5 transition cursor-pointer ${
                includeSignatures ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
              title="Toggle official certification sign-off blocks"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>Signatures: {includeSignatures ? 'ON' : 'OFF'}</span>
            </button>

            {/* Density Toggle */}
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
                  Corporate Logistics, Global Trade & Commercial Accounts
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Kabul Corporate Center, Afghanistan • Registration No: 83729-D • TIN: 9003817291
                </p>
                <p className="text-[10px] text-slate-500">
                  accounts@skyariana.com • SWIFT: AFGUAFKAXXX • www.skyariana.com
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right rtl:text-left shrink-0">
              <span className="text-sm sm:text-base font-black tracking-wider uppercase text-blue-900 block">
                STATEMENT OF ACCOUNT
              </span>
              <span dir="ltr" className="text-xs font-mono font-bold text-slate-800 block mt-0.5">
                Ref: {statementRef}
              </span>
              <span dir="ltr" className="text-[11px] text-slate-600 block">
                Date: {formatFullDate(todayStr)}
              </span>
              <span className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-50 text-blue-800 border border-blue-300">
                <ShieldCheck className="w-3 h-3 text-blue-600" />
                AUDIT-RECONCILED STATEMENT
              </span>
            </div>
          </div>

          {/* 2. CLIENT & REMITTANCE PROFILE INFO BOX */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Details */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b border-slate-200 pb-1 flex items-center gap-1">
                <User className="w-3 h-3 text-blue-600" /> Account / Customer Information
              </span>
              <div>
                <span className="text-sm font-bold text-slate-900 block">{customer.companyName}</span>
                {customer.contactPerson && (
                  <span className="text-xs text-slate-700 block">Attn: <strong>{customer.contactPerson}</strong></span>
                )}
                {customer.addressLine1 && (
                  <span className="text-[11px] text-slate-600 block">{customer.addressLine1}{customer.addressLine2 ? `, ${customer.addressLine2}` : ''}</span>
                )}
                <span className="text-[11px] text-slate-600 block">
                  {customer.country || 'International Customer'} {customer.email ? `• ${customer.email}` : ''} {customer.phone ? `• ${customer.phone}` : ''}
                </span>
              </div>
            </div>

            {/* Statement Scope & Bank Remittance */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block border-b border-slate-200 pb-1 flex items-center gap-1">
                <Building2 className="w-3 h-3 text-emerald-600" /> Statement Period & Settlement Bank
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase block">Statement Scope:</span>
                  <span className="font-bold text-slate-800 block">{periodLabel}</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Currency: <strong>USD ($)</strong></span>
                </div>
                {includeRemittance ? (
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Remittance Account:</span>
                    <span className="font-bold text-slate-800 block">AFGHAN UNITED BANK</span>
                    <span dir="ltr" className="font-mono text-[11px] text-emerald-800 font-bold block">
                      {maskAccount ? '101502******0472' : '101502USD2940472'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">SWIFT: <strong>AFGUAFKAXXX</strong></span>
                  </div>
                ) : (
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Settlement Status:</span>
                    <span className="font-bold text-slate-800 block">Commercial Account</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. EXECUTIVE FINANCIAL SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900 text-white rounded-xl p-4 shadow-sm">
            <div className="border-r border-slate-800/80 pr-2">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Opening Balance</span>
              <div className="text-base sm:text-lg font-bold font-mono text-slate-200 mt-1" dir="ltr">
                {formatCurrency(summary.openingBalance)}
              </div>
              <span className="text-[9px] text-slate-400 block mt-0.5">Prior to period start</span>
            </div>

            <div className="border-r border-slate-800/80 pr-2">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Invoiced in Period (+)</span>
              <div className="text-base sm:text-lg font-bold font-mono text-blue-400 mt-1" dir="ltr">
                {formatCurrency(summary.totalInvoiced)}
              </div>
              <span className="text-[9px] text-slate-400 block mt-0.5">Commercial billings</span>
            </div>

            <div className="border-r border-slate-800/80 pr-2">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Payments Received (-)</span>
              <div className="text-base sm:text-lg font-bold font-mono text-emerald-400 mt-1" dir="ltr">
                {formatCurrency(summary.totalPaymentsReceived)}
              </div>
              <span className="text-[9px] text-slate-400 block mt-0.5">Settlements & wire in</span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Closing Balance Due</span>
              <div className={`text-base sm:text-lg font-extrabold font-mono mt-1 ${
                summary.closingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`} dir="ltr">
                {formatCurrency(summary.closingBalance)}
              </div>
              <span className="text-[9px] text-slate-400 block mt-0.5">
                {summary.closingBalance > 0 ? 'Outstanding Receivable' : 'Fully Settled / Advance'}
              </span>
            </div>
          </div>

          {/* 4. CHRONOLOGICAL TRANSACTIONS TIMELINE TABLE */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex justify-between items-center text-xs">
              <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-600" />
                Chronological Statement Transactions Ledger
              </span>
              <span className="font-mono text-slate-500 text-[10px]">
                {safeEntries.length} chronological items
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 text-left">Date</th>
                    <th className="py-2.5 px-3 text-left">Type</th>
                    <th className="py-2.5 px-3 text-left">Reference</th>
                    <th className="py-2.5 px-3 text-left">Description</th>
                    <th className="py-2.5 px-3 text-right">Debit (+)</th>
                    <th className="py-2.5 px-3 text-right">Credit (-)</th>
                    <th className="py-2.5 px-3 text-right">SWIFT Fee</th>
                    <th className="py-2.5 px-3 text-right">Running Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-slate-800">
                  {/* Row 0: Opening Balance Line */}
                  <tr className="bg-slate-50/80 font-semibold text-slate-600">
                    <td className="py-2 px-3 font-sans text-[11px]">
                      {period.startDate ? formatDisplayDate(period.startDate) : '—'}
                    </td>
                    <td className="py-2 px-3 font-sans">
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-200 text-slate-700 uppercase font-bold">
                        OPENING
                      </span>
                    </td>
                    <td className="py-2 px-3 text-[11px] text-slate-500">START-BAL</td>
                    <td className="py-2 px-3 font-sans text-[11px] text-slate-600 italic">
                      Opening Balance brought forward from prior periods
                    </td>
                    <td className="py-2 px-3 text-right text-slate-400">—</td>
                    <td className="py-2 px-3 text-right text-slate-400">—</td>
                    <td className="py-2 px-3 text-right text-slate-400">—</td>
                    <td className="py-2 px-3 text-right font-bold text-slate-800" dir="ltr">
                      {formatCurrency(summary.openingBalance)}
                    </td>
                  </tr>

                  {/* Transaction Entries */}
                  {safeEntries.length > 0 ? (
                    safeEntries.map((e, idx) => (
                      <tr
                        key={e.id || idx}
                        className={`${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'} hover:bg-blue-50/40 transition`}
                      >
                        <td className="py-2 px-3 text-[11px]" dir="ltr">
                          {formatDisplayDate(e.date)}
                        </td>
                        <td className="py-2 px-3 font-sans">
                          {e.type === 'INVOICE' ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-blue-100 text-blue-800 font-bold uppercase">
                              INVOICE
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-100 text-emerald-800 font-bold uppercase">
                              PAYMENT
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 text-[11px]" dir="ltr">
                          {e.reference || '—'}
                        </td>
                        <td className="py-2 px-3 font-sans text-slate-700 text-[11px] max-w-xs truncate">
                          {e.description}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-slate-900" dir="ltr">
                          {e.debit > 0 ? formatCurrency(e.debit) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-emerald-700" dir="ltr">
                          {e.credit > 0 ? `-${formatCurrency(e.credit)}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right text-amber-600 text-[11px]" dir="ltr">
                          {e.swiftFee > 0 ? formatCurrency(e.swiftFee) : '—'}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-slate-900" dir="ltr">
                          {formatCurrency(e.runningBalance)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-500 font-sans text-xs">
                        No transactions recorded for this customer during the selected period.
                      </td>
                    </tr>
                  )}
                </tbody>
                {/* Table Foot Totals */}
                <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-mono text-xs font-bold text-slate-900">
                  <tr>
                    <td colSpan={4} className="py-2.5 px-3 font-sans uppercase text-[11px]">
                      Period Net Activity & Closing Balance
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-900" dir="ltr">
                      {formatCurrency(summary.totalInvoiced)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-800" dir="ltr">
                      -{formatCurrency(summary.totalPaymentsReceived)}
                    </td>
                    <td className="py-2.5 px-3 text-right text-amber-700" dir="ltr">
                      {formatCurrency(safeEntries.reduce((s, e) => s + (e.swiftFee || 0), 0))}
                    </td>
                    <td className="py-2.5 px-3 text-right text-sm font-black text-slate-900" dir="ltr">
                      {formatCurrency(summary.closingBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* 5. REMITTANCE INSTRUCTIONS & AUDIT FOOTER */}
          {includeRemittance && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[10px] text-slate-600 space-y-1">
              <span className="font-bold text-slate-800 uppercase block">Wire Settlement Instructions:</span>
              <p>
                Please quote customer name <strong>{customer.companyName}</strong> and statement reference <strong>{statementRef}</strong> in SWIFT Field 70 (Remittance Information) for all outward transfers. Forward SWIFT MT103 confirmation slip to <strong>accounts@skyariana.com</strong> immediately upon execution.
              </p>
            </div>
          )}

          {/* 6. SIGNATURE & CERTIFICATION BLOCKS (Avoid page break) */}
          {includeSignatures && (
            <div className="print-avoid-break pt-4 border-t border-slate-200">
              <div className="grid grid-cols-3 gap-6 text-center text-xs">
                {/* Prepared By */}
                <div className="space-y-8">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Prepared By</span>
                  <div className="border-b border-slate-400 mx-auto w-3/4"></div>
                  <div>
                    <span className="font-bold text-slate-900 block text-[11px]">Senior Commercial Accountant</span>
                    <span className="text-[10px] text-slate-500">Corporate Finance & Treasury</span>
                  </div>
                </div>

                {/* Verified By */}
                <div className="space-y-8">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Verified & Audited</span>
                  <div className="border-b border-slate-400 mx-auto w-3/4"></div>
                  <div>
                    <span className="font-bold text-slate-900 block text-[11px]">Finance Director</span>
                    <span className="text-[10px] text-slate-500">Financial Control & Audit</span>
                  </div>
                </div>

                {/* Authorized Signatory & Corporate Stamp */}
                <div className="space-y-8">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold block">Authorized Officer & Seal</span>
                  <div className="border-b border-slate-400 mx-auto w-3/4"></div>
                  <div>
                    <span className="font-bold text-slate-900 block text-[11px]">SKY ARIANA LTD.</span>
                    <span className="text-[10px] text-slate-500">Corporate Treasury Seal</span>
                  </div>
                </div>
              </div>

              {/* Confidentiality Notice */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-[9px] text-slate-400">
                <span>CONFIDENTIAL • FOR THE NAMED ADDRESSEE ONLY • OFFICIAL TREASURY RECORD</span>
                <span className="font-mono">Page 1 of 1 • System Generated by Sky Ariana Bank Platform</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
