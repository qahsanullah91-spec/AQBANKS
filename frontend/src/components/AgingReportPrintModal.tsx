import React, { useState, useEffect } from 'react';
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
  CheckCircle2,
  AlertCircle,
  Clock
} from 'lucide-react';
import { triggerPrint } from '../utils/print';
import { exportToCsv } from '../utils/export';

export interface AgingInvoiceDetail {
  invoiceId: string;
  invoiceNumber: string;
  sourceInvoiceRef?: string | null;
  customerId: string;
  customerName: string;
  issueDate: string;
  daysOld: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  agingBucket: string;
}

export interface AgingData {
  summary: {
    current_0_30: number;
    aging_31_60: number;
    aging_61_90: number;
    aging_over_90: number;
    totalOutstanding: number;
  };
  details: AgingInvoiceDetail[];
}

interface AgingReportPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  agingData: AgingData | null;
}

export const AgingReportPrintModal: React.FC<AgingReportPrintModalProps> = ({
  isOpen,
  onClose,
  agingData
}) => {
  const { t, isRtl } = useLanguage();
  const [maskAccount, setMaskAccount] = useState(false);
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

  if (!isOpen || !agingData) return null;

  const todayStr = new Date().toISOString().split('T')[0];
  const reportRef = `AQ-AGING-${todayStr.replace(/-/g, '')}`;

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
    triggerPrint(`Receivables-Aging-Schedule-${todayStr}`);
  };

  const handleExportCsv = () => {
    const headers = [
      'Invoice No',
      'Source Ref',
      'Buyer / Consignee',
      'Issue Date',
      'Days Elapsed',
      'Current (0-30 Days) (USD)',
      '31-60 Days (USD)',
      '61-90 Days (USD)',
      '>90 Days (USD)',
      'Outstanding Total (USD)'
    ];

    const rows = (agingData.details || []).map(d => {
      const days = Number(d.daysOld) || 0;
      const outstanding = Number(d.outstandingAmount) || 0;
      return [
        d.invoiceNumber,
        d.sourceInvoiceRef || '',
        d.customerName,
        formatDisplayDate(d.issueDate),
        days,
        days <= 30 ? outstanding.toFixed(2) : '0.00',
        days > 30 && days <= 60 ? outstanding.toFixed(2) : '0.00',
        days > 60 && days <= 90 ? outstanding.toFixed(2) : '0.00',
        days > 90 ? outstanding.toFixed(2) : '0.00',
        outstanding.toFixed(2)
      ];
    });

    // Append summary totals
    rows.push([
      'TOTALS',
      '',
      '',
      '',
      '',
      Number(agingData.summary?.current_0_30 || 0).toFixed(2),
      Number(agingData.summary?.aging_31_60 || 0).toFixed(2),
      Number(agingData.summary?.aging_61_90 || 0).toFixed(2),
      Number(agingData.summary?.aging_over_90 || 0).toFixed(2),
      Number(agingData.summary?.totalOutstanding || 0).toFixed(2)
    ]);

    exportToCsv(`Receivables-Aging-Analysis-${todayStr}`, headers, rows);
  };

  const totalOutstanding = Number(agingData.summary?.totalOutstanding || 0);
  const current030 = Number(agingData.summary?.current_0_30 || 0);
  const aging3160 = Number(agingData.summary?.aging_31_60 || 0);
  const aging6190 = Number(agingData.summary?.aging_61_90 || 0);
  const agingOver90 = Number(agingData.summary?.aging_over_90 || 0);

  const currentPct = totalOutstanding > 0 ? ((current030 / totalOutstanding) * 100).toFixed(1) : '0.0';
  const over30Pct = totalOutstanding > 0 ? (((aging3160 + aging6190 + agingOver90) / totalOutstanding) * 100).toFixed(1) : '0.0';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-5xl w-full shadow-2xl flex flex-col max-h-[96vh] overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full print:bg-white text-slate-100">
        
        {/* Top Floating Action Bar (Hidden in Print) */}
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-950/80 border border-amber-800 flex items-center justify-center text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Executive Receivables Aging Schedule
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800 font-bold uppercase">
                  A4 Print & Export
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono">
                Ref: {reportRef} • As of {formatDisplayDate(todayStr)}
              </p>
            </div>
          </div>

          {/* Interactive Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setMaskAccount(!maskAccount)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center gap-1.5"
              title="Toggle account number privacy masking"
            >
              {maskAccount ? <EyeOff className="w-3.5 h-3.5 text-amber-400" /> : <Eye className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{maskAccount ? 'Unmask Bank' : 'Mask Bank'}</span>
            </button>

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
              <span>Print Document</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Preview Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-950 print:bg-white print:p-0 flex justify-center">
          
          {/* Printable Document Container */}
          <div className="printable-document bg-white text-slate-900 w-full max-w-4xl p-8 sm:p-10 rounded-xl shadow-2xl print:shadow-none print:rounded-none print:p-0 border border-slate-200 print:border-none space-y-6">
            
            {/* Header: Company Identity & Letterhead */}
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
                        Logistics & Financial Management System
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 font-sans pt-1">
                    Export Processing, Logistics Operations & Commercial Invoicing
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Afghan United Bank Operating Account: {maskAccount ? '101502******0472' : '1015020000000472'} • Currency: USD
                  </p>
                </div>

                <div className="text-right">
                  <span className="inline-block px-2.5 py-1 bg-slate-900 text-white font-mono font-bold text-xs uppercase tracking-wider rounded">
                    ACCOUNTS RECEIVABLE AGING
                  </span>
                  <div className="mt-2 text-xs font-mono space-y-0.5 text-slate-700">
                    <div><strong>Report Ref:</strong> {reportRef}</div>
                    <div><strong>As of Date:</strong> {formatFullDate(todayStr)}</div>
                    <div><strong>Callset:</strong> Commercial Raisins Export</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Executive Summary Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Receivables</span>
                <div className="text-base font-black font-mono text-slate-900 mt-1 tabular-nums" dir="ltr">
                  {formatCurrency(totalOutstanding)}
                </div>
                <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                  {(agingData.details || []).length} Outstanding Invoices
                </span>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-300 rounded-lg">
                <span className="text-[9px] uppercase font-bold text-emerald-800 block">Current (0–30 Days)</span>
                <div className="text-base font-black font-mono text-emerald-700 mt-1 tabular-nums" dir="ltr">
                  {formatCurrency(current030)}
                </div>
                <span className="text-[10px] text-emerald-800 font-semibold block mt-0.5">
                  {currentPct}% of Portfolio
                </span>
              </div>

              <div className="p-3 bg-blue-50/60 border border-blue-300 rounded-lg">
                <span className="text-[9px] uppercase font-bold text-blue-800 block">31–60 Days</span>
                <div className="text-base font-black font-mono text-blue-700 mt-1 tabular-nums" dir="ltr">
                  {formatCurrency(aging3160)}
                </div>
                <span className="text-[10px] text-blue-800 font-medium block mt-0.5">
                  Low Risk Bracket
                </span>
              </div>

              <div className="p-3 bg-amber-50/60 border border-amber-300 rounded-lg">
                <span className="text-[9px] uppercase font-bold text-amber-800 block">61–90 Days</span>
                <div className="text-base font-black font-mono text-amber-700 mt-1 tabular-nums" dir="ltr">
                  {formatCurrency(aging6190)}
                </div>
                <span className="text-[10px] text-amber-800 font-medium block mt-0.5">
                  Follow-Up Required
                </span>
              </div>

              <div className="p-3 bg-rose-50/60 border border-rose-300 rounded-lg">
                <span className="text-[9px] uppercase font-bold text-rose-800 block">&gt; 90 Days</span>
                <div className="text-base font-black font-mono text-rose-700 mt-1 tabular-nums" dir="ltr">
                  {formatCurrency(agingOver90)}
                </div>
                <span className="text-[10px] text-rose-800 font-semibold block mt-0.5">
                  Critical / Delinquent
                </span>
              </div>
            </div>

            {/* Risk Distribution Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-mono text-slate-600 font-bold">
                <span>PORTFOLIO AGING DISTRIBUTION</span>
                <span>Current: {currentPct}% • Aged (&gt;30d): {over30Pct}%</span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex border border-slate-300">
                <div style={{ width: `${currentPct}%` }} className="bg-emerald-600 h-full" title={`Current: ${currentPct}%`} />
                <div style={{ width: `${totalOutstanding > 0 ? ((aging3160 / totalOutstanding) * 100).toFixed(1) : 0}%` }} className="bg-blue-500 h-full" title={`31-60d: ${aging3160}`} />
                <div style={{ width: `${totalOutstanding > 0 ? ((aging6190 / totalOutstanding) * 100).toFixed(1) : 0}%` }} className="bg-amber-500 h-full" title={`61-90d: ${aging6190}`} />
                <div style={{ width: `${totalOutstanding > 0 ? ((agingOver90 / totalOutstanding) * 100).toFixed(1) : 0}%` }} className="bg-rose-500 h-full" title={`>90d: ${agingOver90}`} />
              </div>
            </div>

            {/* Aged Receivables Schedule Table */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 flex items-center justify-between border-b border-slate-300 pb-1 font-mono">
                <span>ITEMIZED OUTSTANDING INVOICES SCHEDULE</span>
                <span className="text-[10px] font-normal text-slate-500">Amounts denominated in USD</span>
              </h3>

              <div className="overflow-x-auto">
                <table className={`w-full text-left font-mono border-collapse border border-slate-300 ${compactMode ? 'text-[10px]' : 'text-[11px]'}`}>
                  <thead>
                    <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300 text-[10px] uppercase font-sans">
                      <th className="py-2 px-2 border-r border-slate-300">Invoice No</th>
                      <th className="py-2 px-2 border-r border-slate-300">Ref</th>
                      <th className="py-2 px-2 border-r border-slate-300">Buyer / Consignee</th>
                      <th className="py-2 px-2 border-r border-slate-300">Issue Date</th>
                      <th className="py-2 px-2 border-r border-slate-300 text-center">Days</th>
                      <th className="py-2 px-2 border-r border-slate-300 text-right">0–30 Days</th>
                      <th className="py-2 px-2 border-r border-slate-300 text-right">31–60 Days</th>
                      <th className="py-2 px-2 border-r border-slate-300 text-right">61–90 Days</th>
                      <th className="py-2 px-2 border-r border-slate-300 text-right">&gt;90 Days</th>
                      <th className="py-2 px-2 text-right">Total Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(agingData.details || []).length > 0 ? (
                      agingData.details.map((d, idx) => {
                        const days = Number(d.daysOld) || 0;
                        const outstanding = Number(d.outstandingAmount) || 0;
                        const isEven = idx % 2 === 0;

                        return (
                          <tr key={d.invoiceId} className={`border-b border-slate-200 ${isEven ? 'bg-white' : 'bg-slate-50/50'}`}>
                            <td className="py-1.5 px-2 border-r border-slate-200 font-bold text-slate-900" dir="ltr">
                              {d.invoiceNumber}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 text-slate-600 font-semibold" dir="ltr">
                              {d.sourceInvoiceRef || '—'}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 font-sans font-medium text-slate-800">
                              {d.customerName}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 text-slate-600" dir="ltr">
                              {formatDisplayDate(d.issueDate)}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 text-center font-bold text-slate-700">
                              {days}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 text-right font-medium text-emerald-700 tabular-nums">
                              {days <= 30 ? formatCurrency(outstanding) : '—'}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 text-right font-medium text-blue-700 tabular-nums">
                              {days > 30 && days <= 60 ? formatCurrency(outstanding) : '—'}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 text-right font-medium text-amber-700 tabular-nums">
                              {days > 60 && days <= 90 ? formatCurrency(outstanding) : '—'}
                            </td>
                            <td className="py-1.5 px-2 border-r border-slate-200 text-right font-medium text-rose-700 tabular-nums">
                              {days > 90 ? formatCurrency(outstanding) : '—'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-bold text-slate-900 tabular-nums" dir="ltr">
                              {formatCurrency(outstanding)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-500 italic">
                          No outstanding invoices recorded. All proforma invoices are settled.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black border-t-2 border-slate-900 text-slate-900">
                      <td colSpan={5} className="py-2.5 px-2 border-r border-slate-300 font-sans text-right uppercase tracking-wider text-[10px]">
                        Grand Totals
                      </td>
                      <td className="py-2.5 px-2 border-r border-slate-300 text-right text-emerald-800 tabular-nums">
                        {formatCurrency(current030)}
                      </td>
                      <td className="py-2.5 px-2 border-r border-slate-300 text-right text-blue-800 tabular-nums">
                        {formatCurrency(aging3160)}
                      </td>
                      <td className="py-2.5 px-2 border-r border-slate-300 text-right text-amber-800 tabular-nums">
                        {formatCurrency(aging6190)}
                      </td>
                      <td className="py-2.5 px-2 border-r border-slate-300 text-right text-rose-800 tabular-nums">
                        {formatCurrency(agingOver90)}
                      </td>
                      <td className="py-2.5 px-2 text-right text-slate-900 text-xs tabular-nums" dir="ltr">
                        {formatCurrency(totalOutstanding)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Reconciliation Audit Footnotes */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[10px] text-slate-600 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-800 uppercase font-sans">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Accounts Receivable Reconciliation & Compliance Certificate</span>
              </div>
              <p>
                This aging schedule reflects issued proforma invoices for commercial raisin export shipments. In accordance with standard international trade terms, invoices are tracked chronologically from bill of lading release date. Payments received via SWIFT inward wire to Afghan United Bank are allocated on a first-in, first-out (FIFO) basis upon receipt of correspondent settlement advice.
              </p>
            </div>

            {/* Executive Signatures Block */}
            {includeSignatures && (
              <div className="pt-4 border-t border-slate-300 grid grid-cols-2 gap-8 print:pt-6">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-sans mb-1">
                    Prepared By
                  </div>
                  <div className="h-12 border-b border-slate-400 flex items-end pb-1 font-mono text-xs text-slate-700">
                    Finance & Credit Officer
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1 font-sans">
                    AQ Companies Credit Control Division
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-sans mb-1">
                    Verified & Approved By
                  </div>
                  <div className="h-12 border-b border-slate-400 flex items-end justify-end pb-1 font-mono text-xs text-slate-900 font-bold">
                    Chief Financial Officer / Managing Director
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1 font-sans">
                    Authorized Signatory • AQ Companies
                  </div>
                </div>
              </div>
            )}

            {/* Printable Document Footer */}
            <div className="text-center text-[9px] text-slate-400 font-mono border-t border-slate-200 pt-3">
              Generated by AQ Companies Logistics & Financial Management Portal • Document ID: {reportRef} • Confidential Enterprise Record
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
