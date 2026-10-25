import React, { useState, useEffect } from 'react';
import { CashFlowReport } from '../types';
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
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  Coins
} from 'lucide-react';
import { triggerPrint } from '../utils/print';
import { exportToCsv } from '../utils/export';

interface CashFlowPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportData: CashFlowReport | null;
}

export const CashFlowPrintModal: React.FC<CashFlowPrintModalProps> = ({
  isOpen,
  onClose,
  reportData
}) => {
  const { t, isRtl } = useLanguage();
  const [includeSignatures, setIncludeSignatures] = useState(true);
  const [compactMode, setCompactMode] = useState(false);

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
  const reportRef = `AQ-CF-${todayStr.replace(/-/g, '')}`;

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
    triggerPrint(`Statement-of-Cash-Flows-${todayStr}`);
  };

  const handleExportCsv = () => {
    const headers = ['Cash Flow Activity', 'Category Code', 'Inflow / Outflow (USD)', 'Running Total (USD)'];
    const op = reportData.cashFlows.operatingActivities;
    const summary = reportData.cashSummary;

    const rows: (string | number)[][] = [
      ['BEGINNING CASH & EQUIVALENTS', 'BEGIN_CASH', Number(summary.beginningCash || 0).toFixed(2), Number(summary.beginningCash || 0).toFixed(2)],
      ['--- CASH FLOWS FROM OPERATING ACTIVITIES ---', '', '', ''],
      ['Customer Inward Wire Receipts', 'CASH_INFLOW', Number(op.customerReceipts || 0).toFixed(2), ''],
      ['Vendor & Operational Disbursements', 'CASH_OUTFLOW', (-Math.abs(Number(op.vendorDisbursements || 0))).toFixed(2), ''],
      ['SWIFT Bank Wire Fees Deducted', 'SWIFT_FEES', (-Math.abs(Number(op.swiftFeesTracked || 0))).toFixed(2), ''],
      ['--- OPERATING DISBURSEMENTS BY CATEGORY ---', '', '', '']
    ];

    const catDisb = op.disbursementsByCategory || {};
    for (const [key, val] of Object.entries(catDisb)) {
      rows.push([key.replace(/_/g, ' '), key, (-Math.abs(Number(val) || 0)).toFixed(2), '']);
    }

    rows.push(
      ['NET CASH FLOW FROM OPERATING ACTIVITIES', 'NET_OPERATING_CF', Number(op.netCashFromOperations || 0).toFixed(2), ''],
      ['NET CHANGE IN CASH DURING PERIOD', 'NET_CHANGE', Number(summary.netChangeInCash || 0).toFixed(2), ''],
      ['ENDING CASH & EQUIVALENTS BALANCE', 'ENDING_CASH', Number(summary.endingCash || 0).toFixed(2), Number(summary.endingCash || 0).toFixed(2)]
    );

    exportToCsv(`Statement-of-Cash-Flows-${todayStr}`, headers, rows);
  };

  const periodLabel = reportData.period?.startDate && reportData.period?.endDate
    ? `${formatDisplayDate(reportData.period.startDate)} — ${formatDisplayDate(reportData.period.endDate)}`
    : 'All-Time Operational Period';

  const op = reportData.cashFlows.operatingActivities;
  const summary = reportData.cashSummary;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 print:p-0 print:bg-white animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-4xl w-full shadow-2xl flex flex-col max-h-[96vh] overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full print:bg-white text-slate-100">
        
        {/* Top Action Bar */}
        <div className="p-4 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-950/80 border border-blue-800 flex items-center justify-center text-blue-400">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Statement of Cash Flows (Direct Method)
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-800 font-bold uppercase">
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
              onClick={() => setCompactMode(!compactMode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                compactMode
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {compactMode ? 'Standard Layout' : 'Compact Layout'}
            </button>

            <button
              onClick={() => setIncludeSignatures(!includeSignatures)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                includeSignatures
                  ? 'bg-slate-800 text-emerald-400 border-slate-700'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700'
              }`}
            >
              {includeSignatures ? 'Signatures Included' : 'Signatures Hidden'}
            </button>

            <button
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-700 flex items-center gap-1.5 shadow-sm transition"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              Export CSV
            </button>

            <button
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 shadow-lg shadow-blue-900/30 transition"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Canvas */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-slate-950 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          <div className="printable-document bg-white text-slate-900 w-full max-w-[210mm] min-h-[297mm] p-8 sm:p-12 shadow-2xl rounded-sm print:shadow-none print:p-8 print:max-w-none print:w-full font-sans text-xs">
            
            {/* Document Header */}
            <div className="border-b-2 border-slate-900 pb-5 mb-6">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-sm">
                      AQ
                    </div>
                    <div>
                      <h1 className="text-xl font-black text-slate-950 tracking-tight leading-none uppercase">
                        AQ COMPANIES GROUP
                      </h1>
                      <span className="text-[10px] text-slate-500 font-medium tracking-wide">
                        Global Agro-Commodities • International Trade & Clearing
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] text-slate-600 leading-relaxed font-sans">
                    <p>Financial Control & Treasury Department</p>
                    <p>Kabul & Dubai Operational Clearing Centers</p>
                    <p>Official Currency of Settlement: <span className="font-semibold text-slate-900">USD ($)</span></p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-slate-900 text-amber-400 font-extrabold text-xs uppercase tracking-wider rounded mb-2">
                    Statement of Cash Flows
                  </div>
                  <p className="text-[11px] font-mono font-bold text-slate-800">
                    Doc Ref: <span className="text-slate-950">{reportRef}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Date of Issue: <span className="font-semibold text-slate-800">{formatFullDate(todayStr)}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 font-sans">
                    Accounting Method: <span className="font-semibold text-slate-800">Direct Method (Cash Basis)</span>
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap justify-between items-center text-[11px]">
                <div className="flex items-center gap-2 text-slate-700">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span className="font-bold text-slate-900">Reporting Period:</span> {periodLabel}
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Certified Bank Operating Ledger Reconciliation</span>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Beginning Cash</span>
                <span className="text-base font-extrabold font-mono text-slate-800 block mt-0.5">
                  {formatCurrency(summary.beginningCash)}
                </span>
                <span className="text-[9px] text-slate-400">Starting liquidity</span>
              </div>
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded">
                <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">Net Operating Cash Flow</span>
                <span className={`text-base font-extrabold font-mono block mt-0.5 ${Number(op.netCashFromOperations) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatCurrency(op.netCashFromOperations)}
                </span>
                <span className="text-[9px] text-blue-600">Period net cash flow</span>
              </div>
              <div className="p-3 bg-slate-900 text-white rounded">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">Ending Cash Balance</span>
                <span className="text-base font-extrabold font-mono text-amber-400 block mt-0.5">
                  {formatCurrency(summary.endingCash)}
                </span>
                <span className="text-[9px] text-slate-400">Liquid operating treasury</span>
              </div>
            </div>

            {/* Cash Flow Statement Details Table */}
            <div className="border border-slate-200 rounded overflow-hidden mb-6">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-4 text-left">Cash Flow Statement Line Item</th>
                    <th className="py-2.5 px-3 text-center">Category / Reference</th>
                    <th className="py-2.5 px-4 text-right">Inflow / (Outflow) USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-sans">
                  
                  {/* Beginning Balance */}
                  <tr className="bg-slate-50/80 font-bold">
                    <td className="py-2 px-4 text-slate-900">BEGINNING CASH & EQUIVALENTS</td>
                    <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-500">1010-CASH</td>
                    <td className="py-2 px-4 text-right font-mono text-slate-900">{formatCurrency(summary.beginningCash)}</td>
                  </tr>

                  {/* Operating Cash Inflows */}
                  <tr className="bg-blue-50/50 font-semibold text-blue-950">
                    <td colSpan={3} className="py-2 px-4 text-[11px] uppercase tracking-wider">
                      Cash Flows from Operating Activities
                    </td>
                  </tr>

                  <tr>
                    <td className="py-2 px-4 pl-6 text-slate-800">
                      Customer Wire Receipts & Collections
                      <div className="text-[10px] text-slate-500 font-normal">Realized inward wire remittances against trade invoices</div>
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-500">CASH-IN</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-emerald-700">
                      +{formatCurrency(op.customerReceipts)}
                    </td>
                  </tr>

                  {/* Operating Cash Outflows */}
                  <tr>
                    <td className="py-2 px-4 pl-6 text-slate-800">
                      Vendor & Operational Expense Disbursements
                      <div className="text-[10px] text-slate-500 font-normal">Freight, customs, border transit, and general trade expenses</div>
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-500">CASH-OUT</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-rose-700">
                      -{formatCurrency(op.vendorDisbursements)}
                    </td>
                  </tr>

                  {/* SWIFT Deductions */}
                  <tr>
                    <td className="py-2 px-4 pl-6 text-slate-800">
                      SWIFT Intermediary Banking Deductions
                      <div className="text-[10px] text-slate-500 font-normal">International wire clearance fees tracked on inward deposits</div>
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-500">SWIFT-FEES</td>
                    <td className="py-2 px-4 text-right font-mono font-semibold text-slate-600">
                      -{formatCurrency(op.swiftFeesTracked)}
                    </td>
                  </tr>

                  {/* Breakdown by Category */}
                  <tr className="bg-slate-50 text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                    <td colSpan={3} className="py-1.5 px-4 pl-6">
                      Itemized Disbursements by Operational Category:
                    </td>
                  </tr>

                  {Object.entries(op.disbursementsByCategory || {}).map(([key, val]) => (
                    <tr key={key} className="text-slate-700 hover:bg-slate-50/50">
                      <td className="py-1.5 px-4 pl-10 text-[11px]">
                        • {key.replace(/_/g, ' ')}
                      </td>
                      <td className="py-1.5 px-3 text-center font-mono text-[10px] text-slate-400">{key}</td>
                      <td className="py-1.5 px-4 text-right font-mono text-[11px] text-slate-600">
                        -{formatCurrency(val)}
                      </td>
                    </tr>
                  ))}

                  {/* Net Cash From Operations */}
                  <tr className="bg-blue-50 font-bold border-t border-b border-blue-200">
                    <td className="py-2.5 px-4 text-blue-950 font-extrabold uppercase">
                      NET CASH FROM OPERATING ACTIVITIES
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-[10px] text-blue-700">NET-OP-CF</td>
                    <td className={`py-2.5 px-4 text-right font-mono font-extrabold text-sm ${Number(op.netCashFromOperations) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatCurrency(op.netCashFromOperations)}
                    </td>
                  </tr>

                  {/* Period Net Change */}
                  <tr className="font-semibold text-slate-800">
                    <td className="py-2 px-4 text-slate-800">Net Period Change in Liquid Cash</td>
                    <td className="py-2 px-3 text-center font-mono text-[10px] text-slate-500">NET-CHANGE</td>
                    <td className="py-2 px-4 text-right font-mono text-slate-900">{formatCurrency(summary.netChangeInCash)}</td>
                  </tr>

                  {/* Ending Balance */}
                  <tr className="bg-slate-900 text-white font-extrabold text-sm">
                    <td className="py-3 px-4">ENDING CASH & CASH EQUIVALENTS (CLOSE OF PERIOD)</td>
                    <td className="py-3 px-3 text-center font-mono text-xs text-amber-400 font-bold">1010-CASH</td>
                    <td className="py-3 px-4 text-right font-mono text-amber-400 text-base">
                      {formatCurrency(summary.endingCash)}
                    </td>
                  </tr>

                </tbody>
              </table>
            </div>

            {/* Reconciliation Note & Corporate Signatures */}
            <div className="mt-6 pt-4 border-t border-slate-200 text-[10px] text-slate-500 leading-relaxed font-sans">
              <p className="font-bold text-slate-700 uppercase mb-1">Treasury Reconciled Statement Declaration</p>
              <p>
                This Statement of Cash Flows has been compiled strictly using the direct method from verified commercial wire receipts, vendor expense vouchers, and bank ledger transactions in compliance with International Accounting Standards (IAS 7). All ending cash figures agree with the official corporate operating ledger.
              </p>
            </div>

            {includeSignatures && (
              <div className="mt-8 pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 print:mt-6">
                <div>
                  <div className="border-b border-slate-400 pb-12 mb-2">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Authorized Financial Controller</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-900">Chief Treasury & Compliance Officer</p>
                  <p className="text-[10px] text-slate-500">AQ Companies Group • Corporate Treasury</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-12 mb-2">
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">Managing Director / Partner Approval</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-900">Executive Managing Partner</p>
                  <p className="text-[10px] text-slate-500">AQ Companies Group • Corporate Board</p>
                </div>
              </div>
            )}

            {/* Print Footer */}
            <div className="mt-8 pt-3 border-t border-slate-200 flex justify-between items-center text-[9px] text-slate-400 font-mono">
              <span>AQ COMPANIES FINANCIAL SYSTEM • CASH FLOWS IAS-7</span>
              <span>PAGE 1 OF 1 • BIT-FOR-BIT VERIFIED</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
