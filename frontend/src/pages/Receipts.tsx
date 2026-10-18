import React, { useEffect, useState } from 'react';
import { getAuthToken, getUserRole, api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { formatDisplayDate, formatFullDate } from '../utils/date';
import {
  Search,
  Printer,
  Ban,
  X,
  CheckCircle,
  Share2,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { triggerPrint } from '../utils/print';

export const Receipts: React.FC = () => {
  const { t, isRtl } = useLanguage();
  const userRole = getUserRole();
  const canVoidReceipt = userRole === 'ADMIN' || userRole === 'FINANCE_MGR';
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const data = await api.getReceipts();
      setReceipts(data);
    } catch (err: any) {
      console.error('Failed to load receipts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, []);

  const openReceiptModal = async (r: any) => {
    setSelectedReceipt(r);
  };

  const handleVoid = async () => {
    if (!canVoidReceipt) {
      setMessage({ text: 'Access Denied: Only Administrator or Finance Manager can void treasury receipts.', type: 'error' });
      return;
    }
    if (!selectedReceipt || !voidReason.trim()) return;
    setVoiding(true);
    setMessage(null);
    try {
      await api.voidReceipt(selectedReceipt.id, voidReason);
      setMessage({ text: 'Receipt successfully voided and logged to security audit trail.', type: 'success' });
      setShowVoidModal(false);
      setVoidReason('');
      setSelectedReceipt({ ...selectedReceipt, status: 'VOIDED', voidReason });
      await fetchReceipts();
    } catch (err: any) {
      setMessage({ text: err.message || 'Void request failed', type: 'error' });
    } finally {
      setVoiding(false);
    }
  };

  const handlePrint = () => {
    triggerPrint(selectedReceipt ? `Receipt-${selectedReceipt.receiptNumber}` : 'Official-Treasury-Receipt');
  };

  const handleCopyDetails = () => {
    if (!selectedReceipt) return;
    const text = `AQ COMPANIES OFFICIAL RECEIPT\nReceipt No: ${selectedReceipt.receiptNumber}\nDate: ${formatDisplayDate(selectedReceipt.issueDate)}\nPayer: ${selectedReceipt.payerName}\nAmount: $${Number(selectedReceipt.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD\nAmount in Words: ${selectedReceipt.amountInWords}\nAccount: ${selectedReceipt.receivingAccountMasked}\nPurpose: ${selectedReceipt.purpose}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredReceipts = receipts.filter(r => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const num = (r.receiptNumber || '').toLowerCase();
      const payer = (r.payerName || '').toLowerCase();
      const ref = (r.referenceNumber || '').toLowerCase();
      const purpose = (r.purpose || '').toLowerCase();
      return num.includes(q) || payer.includes(q) || ref.includes(q) || purpose.includes(q);
    }
    return true;
  });

  const totalReceipted = (receipts || [])
    .filter(r => r.status === 'ISSUED')
    .reduce((sum, r) => sum + Number(r.amount), 0);

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
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">{t('receipts.title')}</h1>
              <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                AUTOMATIC POSTING
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              {t('receipts.subtitle')}
            </p>
          </div>
        </div>

        <button
          onClick={fetchReceipts}
          className="self-start sm:self-auto flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {t('common.refresh', 'Refresh List')}
        </button>
      </div>

      {message && (
        <div className={`p-3 rounded-lg border text-xs ${
          message.type === 'success'
            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
            : 'bg-rose-950/60 border-rose-800 text-rose-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Valid Receipts</span>
          <div className="text-2xl font-extrabold text-white mt-1">
            {receipts.filter(r => r.status === 'ISSUED').length}
          </div>
          <span className="text-[11px] text-emerald-500 flex items-center gap-1 mt-1">
            <CheckCircle className="w-3.5 h-3.5" /> 100% Invariant Compliance
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Receipted (USD)</span>
          <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1" dir="ltr">
            ${totalReceipted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Atomic Ledger Synchronization
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Receiving Bank</span>
          <div className="text-base font-bold text-white mt-1">
            Afghan United Bank
          </div>
          <span className="text-[11px] font-mono text-sky-400 mt-1 block" dir="ltr">
            101502******0472
          </span>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className={`w-4 h-4 text-slate-500 absolute top-3.5 ${isRtl ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            placeholder={t('receipts.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`w-full bg-slate-900 border border-slate-800 rounded-lg py-2.5 min-h-[44px] text-xs text-white focus:outline-none focus:border-emerald-500 ${
              isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
            }`}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 min-h-[44px] text-xs text-slate-300 focus:outline-none"
        >
          <option value="ALL">{t('common.all')}</option>
          <option value="ISSUED">{t('status.issued')}</option>
          <option value="VOIDED">{t('status.void')}</option>
        </select>
      </div>

      {/* Receipts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className={`py-3 px-3.5 ${isRtl ? 'text-right' : 'text-left'}`}>{t('receipts.receiptNo')}</th>
                <th className={`py-3 px-2.5 ${isRtl ? 'text-right' : 'text-left'}`}>{t('common.date')}</th>
                <th className={`py-3 px-3.5 ${isRtl ? 'text-right' : 'text-left'}`}>{t('receipts.payer')}</th>
                <th className={`py-3 px-3 ${isRtl ? 'text-left' : 'text-right'}`}>Gross Invoiced</th>
                <th className={`py-3 px-3 ${isRtl ? 'text-left' : 'text-right'}`}>SWIFT Fee</th>
                <th className={`py-3 px-3.5 ${isRtl ? 'text-left' : 'text-right'}`}>Net Credited</th>
                <th className={`py-3 px-3.5 ${isRtl ? 'text-right' : 'text-left'}`}>{t('receipts.purpose')}</th>
                <th className={`py-3 px-2.5 ${isRtl ? 'text-right' : 'text-left'}`}>{t('common.status')}</th>
                <th className="py-3 px-3 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400 font-sans">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    {t('common.loading')}
                  </td>
                </tr>
              ) : filteredReceipts.length > 0 ? (
                filteredReceipts.map(r => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-800/80 hover:border-l-4 hover:border-l-emerald-500 transition-all border-l-4 border-l-transparent"
                  >
                    <td className={`py-3 px-3.5 font-bold text-emerald-700 dark:text-emerald-400 ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                      {r.receiptNumber}
                    </td>
                    <td className={`py-3 px-2.5 text-slate-600 dark:text-slate-400 ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                      {formatDisplayDate(r.issueDate)}
                    </td>
                    <td className={`py-3 px-3.5 font-sans font-medium text-slate-900 dark:text-slate-200 ${isRtl ? 'text-right' : 'text-left'}`}>
                      {r.payerName}
                    </td>
                    <td className={`py-3 px-3 text-slate-800 dark:text-slate-300 tabular-nums ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      ${Number(r.grossAmount || (Number(r.swiftFeeAmount || 0) > 0 ? Number(r.amount) + Number(r.swiftFeeAmount) : r.amount)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-3 px-3 tabular-nums ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      {r.swiftFeeAmount && Number(r.swiftFeeAmount) > 0 ? (
                        <span className="text-amber-700 dark:text-amber-400 font-semibold">
                          -${Number(r.swiftFeeAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">$0.00</span>
                      )}
                    </td>
                    <td className={`py-3 px-3.5 font-bold text-emerald-700 dark:text-emerald-400 tabular-nums ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      ${Number(
                        r.swiftFeeAmount && Number(r.swiftFeeAmount) > 0 && r.grossAmount && Number(r.grossAmount) === Number(r.amount)
                          ? Number(r.grossAmount) - Number(r.swiftFeeAmount)
                          : r.amount
                      ).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-3 px-3.5 font-sans text-slate-700 dark:text-slate-300 ${isRtl ? 'text-right' : 'text-left'}`}>
                      {r.purpose}
                    </td>
                    <td className="py-3 px-2.5 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.status === 'ISSUED'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                          : 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center font-sans">
                      <button
                        onClick={() => openReceiptModal(r)}
                        className="px-2.5 py-1 min-h-[32px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-medium rounded transition dark:border-slate-700"
                      >
                        {t('common.view')}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-500 font-sans">
                    {t('receipts.emptyState')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINTABLE RECEIPT MODAL */}
      {selectedReceipt && (() => {
        const issuerName =
          (selectedReceipt.issuedBy?.firstName && `${selectedReceipt.issuedBy.firstName} ${selectedReceipt.issuedBy.lastName || ''}`.trim()) ||
          (selectedReceipt.createdBy?.firstName && `${selectedReceipt.createdBy.firstName} ${selectedReceipt.createdBy.lastName || ''}`.trim()) ||
          'Ahsanullah Qureshi';

        const grossAmt = Number(
          selectedReceipt.grossAmount ||
          (Number(selectedReceipt.swiftFeeAmount || 0) > 0
            ? Number(selectedReceipt.amount) + Number(selectedReceipt.swiftFeeAmount)
            : selectedReceipt.amount)
        );

        const feeAmt = Number(selectedReceipt.swiftFeeAmount || 0);

        const netAmt = Number(
          feeAmt > 0 && selectedReceipt.grossAmount && Number(selectedReceipt.grossAmount) === Number(selectedReceipt.amount)
            ? Number(selectedReceipt.grossAmount) - feeAmt
            : selectedReceipt.amount
        );

        return (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
            <div className="printable-document bg-white text-slate-900 rounded-2xl w-full max-w-3xl my-auto p-5 sm:p-9 shadow-2xl font-sans max-h-[95vh] overflow-y-auto print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-full print:rounded-none print:max-h-none print:overflow-visible">
              {/* Modal Actions Bar (Hidden on Print) */}
              <div className="flex justify-between items-center pb-4 border-b border-slate-200 print:hidden">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Official Treasury Receipt Preview
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyDetails}
                    className="px-3 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <Share2 className="w-3.5 h-3.5" /> {copied ? 'Copied!' : t('receipts.copyText')}
                  </button>
                  <button
                    onClick={handlePrint}
                    className="px-3.5 py-1.5 min-h-[36px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" /> {t('receipts.printReceipt')}
                  </button>
                  {selectedReceipt.status === 'ISSUED' && canVoidReceipt && (
                    <button
                      onClick={() => setShowVoidModal(true)}
                      className="px-3 py-1.5 min-h-[36px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                    >
                      <Ban className="w-3.5 h-3.5" /> {t('invoices.void')}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedReceipt(null)}
                    className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* PRINTABLE RECEIPT CONTENT */}
              <div className="space-y-6 mt-4">
                {/* 1. RECEIPT HEADER WITH ENLARGED SKY ARIANA LOGO & CORPORATE CREST */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4">
                  <div className="flex items-center gap-4 sm:gap-5">
                    {/* Enlarged Sky Ariana Official Logo Container */}
                    <div className="h-20 w-44 sm:h-24 sm:w-56 flex items-center justify-start shrink-0">
                      <img
                        src="/sky-ariana-logo.png"
                        alt="Sky Ariana Ltd. Official Corporate Logo"
                        className="max-h-full max-w-full object-contain filter drop-shadow-sm"
                      />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-950 font-sans">
                        SKY ARIANA LTD.
                      </h2>
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 mt-0.5">
                        Corporate Treasury & Commercial Settlement
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        info@skyariana.com • www.skyariana.com
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right rtl:sm:text-left shrink-0 sm:ml-auto">
                    <span className="text-lg font-black tracking-wider uppercase text-emerald-800 block">
                      OFFICIAL RECEIPT
                    </span>
                    <span dir="ltr" className="text-base font-mono font-black text-slate-950 block mt-0.5">
                      {selectedReceipt.receiptNumber}
                    </span>
                    <span dir="ltr" className="text-xs text-slate-600 block mt-0.5">
                      Date: <strong className="text-slate-900">{formatFullDate(selectedReceipt.issueDate)}</strong>
                    </span>
                    <span className={`inline-block mt-1 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                      selectedReceipt.status === 'ISSUED'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}>
                      STATUS: {selectedReceipt.status}
                    </span>
                  </div>
                </div>

                {/* Elegant Corporate Double Divider */}
                <div className="h-1 bg-gradient-to-r from-emerald-800 via-teal-700 to-emerald-900 rounded-full" />

                {/* 2. MAIN RECEIPT BODY (PAYER & FINANCIAL SETTLEMENT BREAKDOWN) */}
                <div className="bg-slate-50/90 p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-3.5">
                  {/* Payer Info */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 border-b border-slate-200 pb-2.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      {t('receipts.payer', 'RECEIVED WITH THANKS FROM (PAYER / BUYER)')}:
                    </span>
                    <span className="text-sm sm:text-base font-black text-slate-950 uppercase tracking-tight">
                      {selectedReceipt.payerName}
                    </span>
                  </div>

                  {/* Financial Breakdown Table: Gross, SWIFT Deduction, Net Credited */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-600 uppercase tracking-wider text-[11px]">
                        Gross Commercial Invoiced:
                      </span>
                      <span dir="ltr" className="font-mono font-bold text-slate-900 text-sm tabular-nums">
                        ${grossAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </span>
                    </div>

                    {feeAmt > 0 && (
                      <div className="flex justify-between items-center text-xs text-amber-900 bg-amber-50/90 px-3 py-2 rounded-lg border border-amber-200">
                        <span className="font-bold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                          <span>⚠️</span> SWIFT Intermediary Banking Deduction:
                        </span>
                        <span dir="ltr" className="font-mono font-bold tabular-nums text-sm">
                          -${feeAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center pt-2.5 border-t-2 border-emerald-500/20 bg-emerald-50/60 p-3 rounded-lg border border-emerald-200">
                      <div>
                        <span className="text-xs sm:text-sm font-black uppercase text-emerald-950 tracking-wider block">
                          NET WIRE CREDITED TO OPERATING ACCOUNT:
                        </span>
                        <span className="text-[10px] text-emerald-700 font-medium">
                          Confirmed international telegraphic wire remittance
                        </span>
                      </div>
                      <span dir="ltr" className="text-xl sm:text-2xl font-black text-emerald-700 font-mono tabular-nums">
                        ${netAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </span>
                    </div>
                  </div>

                  {/* Amount in Words */}
                  <div className="border-b border-slate-200 pb-2.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                      {t('receipts.amountInWords', 'AMOUNT IN WORDS (CONFIRMED NET WIRE)')}:
                    </span>
                    <div className="text-xs sm:text-sm font-semibold text-slate-900 italic font-serif bg-slate-100/70 p-2.5 rounded-lg border border-slate-200">
                      "{selectedReceipt.amountInWords || 'Amount in words'}"
                    </div>
                  </div>

                  {/* Banking & Method Information Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-0.5">
                        {t('receipts.receivingAccount', 'RECEIVING OPERATING BANK ACCOUNT')}:
                      </span>
                      <span className="text-xs font-black text-slate-900 block">{selectedReceipt.receivingAccountName}</span>
                      <span dir="ltr" className="text-xs font-mono font-bold text-slate-700 block mt-0.5">
                        Account No: {selectedReceipt.receivingAccountMasked}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                        SWIFT / BIC: AFGUAFKAXXX (Field 57A)
                      </span>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-0.5">
                        PAYMENT METHOD & WIRE REFERENCE:
                      </span>
                      <span className="text-xs font-black text-slate-900 block">
                        {selectedReceipt.paymentMethod?.replace(/_/g, ' ') || 'WIRE TRANSFER'}
                      </span>
                      <span dir="ltr" className="text-xs font-mono font-bold text-emerald-800 block mt-0.5">
                        Ref: {selectedReceipt.referenceNumber || 'N/A'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                        Settlement Currency: USD ($)
                      </span>
                    </div>
                  </div>

                  {/* Purpose */}
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block mb-0.5">
                      {t('receipts.purpose', 'PAYMENT PURPOSE & COMMERCIAL SETTLEMENT')}:
                    </span>
                    <span className="text-xs font-semibold text-slate-800 block">{selectedReceipt.purpose}</span>
                    {selectedReceipt.notes && (
                      <span className="text-[10px] text-slate-500 italic block mt-0.5">
                        Note: {selectedReceipt.notes}
                      </span>
                    )}
                  </div>
                </div>

                {/* 3. SIGNATURE & VERIFICATION SECTION (DEFAULTS TO AHSANULLAH QURESHI) */}
                <div className="pt-4 border-t-2 border-slate-900/90 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 print:pt-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">
                      {t('receipts.issuedBy', 'ISSUED & CERTIFIED BY')}:
                    </span>
                    <div className="text-sm font-black text-slate-950 uppercase tracking-tight">
                      {issuerName}
                    </div>
                    <div className="text-[11px] font-bold text-emerald-800">
                      Managing Director & Head of Corporate Treasury
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                      Sky Ariana Ltd. • Commercial Settlement Division
                    </div>
                    <div className="mt-1.5 text-[10px] font-mono text-slate-400">
                      Certified On: {formatFullDate(selectedReceipt.issueDate)}
                    </div>
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-1.5 shrink-0">
                    <div className="border-2 border-emerald-700 bg-emerald-50/80 rounded-xl px-4 py-2 text-emerald-800 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-sm">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span>{t('receipts.verifiedStamp', 'OFFICIALLY VERIFIED & AUDITED')}</span>
                    </div>
                    <span className="text-[9px] font-mono text-slate-400">
                      AFGHAN UNITED BANK (AUB) • WIRE DEPOSIT RECORDED
                    </span>
                  </div>
                </div>

                {/* Document Legal Footer */}
                <div className="mt-4 pt-2 border-t border-slate-200 text-[9px] text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-1 text-center sm:text-left print:mt-2">
                  <span>This is an official computer-generated treasury deposit receipt valid for banking reconciliation, customs, and audit.</span>
                  <span className="font-mono text-slate-500">Sky Ariana Ltd. • Page 1 of 1</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* VOID MODAL */}
      {showVoidModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 text-rose-400">
              <Ban className="w-4 h-4" /> Void Official Receipt
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              Voiding a receipt marks it as legally cancelled. A mandatory reason is logged to the compliance trail.
            </p>
            <textarea
              value={voidReason}
              onChange={e => setVoidReason(e.target.value)}
              placeholder="Reason for voiding receipt..."
              rows={3}
              className="w-full mt-3 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowVoidModal(false)}
                className="px-3 py-2 min-h-[44px] bg-slate-800 text-slate-300 rounded text-xs"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleVoid}
                disabled={voiding || !voidReason.trim()}
                className="px-4 py-2 min-h-[44px] bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold disabled:opacity-50"
              >
                {voiding ? t('common.loading') : t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
