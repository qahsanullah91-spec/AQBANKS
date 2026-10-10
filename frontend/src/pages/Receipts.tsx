import React, { useEffect, useState } from 'react';
import { getAuthToken } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
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

export const Receipts: React.FC = () => {
  const { t, isRtl } = useLanguage();
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
      const token = getAuthToken();
      const res = await fetch('/api/receipts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReceipts(data);
      }
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
    if (!selectedReceipt || !voidReason.trim()) return;
    setVoiding(true);
    setMessage(null);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/receipts/${selectedReceipt.id}/void`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: voidReason })
      });
      if (res.ok) {
        setMessage({ text: 'Receipt successfully voided and logged to security audit trail.', type: 'success' });
        setShowVoidModal(false);
        setVoidReason('');
        setSelectedReceipt({ ...selectedReceipt, status: 'VOIDED', voidReason });
        await fetchReceipts();
      } else {
        const err = await res.json();
        setMessage({ text: err.message || 'Failed to void receipt', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Void request failed', type: 'error' });
    } finally {
      setVoiding(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyDetails = () => {
    if (!selectedReceipt) return;
    const text = `AQ COMPANIES OFFICIAL RECEIPT\nReceipt No: ${selectedReceipt.receiptNumber}\nDate: ${new Date(selectedReceipt.issueDate).toLocaleDateString()}\nPayer: ${selectedReceipt.payerName}\nAmount: $${Number(selectedReceipt.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD\nAmount in Words: ${selectedReceipt.amountInWords}\nAccount: ${selectedReceipt.receivingAccountMasked}\nPurpose: ${selectedReceipt.purpose}`;
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

  const totalReceipted = receipts
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
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('receipts.receiptNo')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('common.date')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('receipts.payer')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t('receipts.amount')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('receipts.purpose')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('common.status')}</th>
                <th className="py-3 px-4 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400 font-sans">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    {t('common.loading')}
                  </td>
                </tr>
              ) : filteredReceipts.length > 0 ? (
                filteredReceipts.map(r => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition">
                    <td className={`py-3 px-4 font-bold text-emerald-400 ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                      {r.receiptNumber}
                    </td>
                    <td className={`py-3 px-4 text-slate-400 ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                      {new Date(r.issueDate).toLocaleDateString()}
                    </td>
                    <td className={`py-3 px-4 font-sans text-slate-200 ${isRtl ? 'text-right' : 'text-left'}`}>
                      {r.payerName}
                    </td>
                    <td className={`py-3 px-4 font-bold text-white ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      ${Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className={`py-3 px-4 font-sans text-slate-300 ${isRtl ? 'text-right' : 'text-left'}`}>
                      {r.purpose}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.status === 'ISSUED'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-rose-950 text-rose-300 border border-rose-800'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <button
                        onClick={() => openReceiptModal(r)}
                        className="px-2.5 py-1 min-h-[36px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded transition"
                      >
                        {t('common.view')}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 font-sans">
                    {t('receipts.emptyState')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PRINTABLE RECEIPT MODAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="printable-document bg-white text-slate-900 rounded-xl w-full max-w-2xl my-auto p-4 sm:p-8 shadow-2xl font-sans max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 print:hidden">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Official Treasury Receipt Preview
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyDetails}
                  className="px-3 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <Share2 className="w-3.5 h-3.5" /> {copied ? 'Copied!' : t('receipts.copyText')}
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 min-h-[36px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" /> {t('receipts.printReceipt')}
                </button>
                {selectedReceipt.status === 'ISSUED' && (
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
              {/* Receipt Header with Sky Ariana Ltd. Official Logo */}
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
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">SKY ARIANA LTD.</h2>
                    <p className="text-xs text-slate-600 font-bold uppercase tracking-wider">Corporate Treasury & Commercial Settlement</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">info@skyariana.com • www.skyariana.com</p>
                  </div>
                </div>

                <div className="text-right rtl:text-left">
                  <span className="text-lg font-black tracking-wider uppercase text-emerald-800 block">OFFICIAL RECEIPT</span>
                  <span dir="ltr" className="text-sm font-mono font-extrabold text-slate-900 block mt-1">
                    {selectedReceipt.receiptNumber}
                  </span>
                  <span dir="ltr" className="text-[11px] text-slate-500 block mt-0.5">
                    Date: {new Date(selectedReceipt.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <span className={`inline-block mt-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold ${
                    selectedReceipt.status === 'ISSUED' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                  }`}>
                    STATUS: {selectedReceipt.status}
                  </span>
                </div>
              </div>

              {/* Main Receipt Body */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-baseline border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('receipts.payer')}:</span>
                  <span className="text-sm font-bold text-slate-900">{selectedReceipt.payerName}</span>
                </div>

                <div className="flex justify-between items-baseline border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('receipts.amount')}:</span>
                  <span dir="ltr" className="text-xl font-extrabold text-emerald-700 font-mono">
                    ${Number(selectedReceipt.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </span>
                </div>

                <div className="border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-0.5">{t('receipts.amountInWords')}:</span>
                  <span className="text-xs font-semibold text-slate-800 italic">
                    "{selectedReceipt.amountInWords || 'Amount in words'}"
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold block">{t('receipts.receivingAccount')}:</span>
                    <span className="text-xs font-bold text-slate-900">{selectedReceipt.receivingAccountName}</span>
                    <span dir="ltr" className="text-xs font-mono text-slate-600 block">Number: {selectedReceipt.receivingAccountMasked}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold block">Payment Method & Ref:</span>
                    <span className="text-xs font-bold text-slate-900">{selectedReceipt.paymentMethod?.replace(/_/g, ' ')}</span>
                    <span dir="ltr" className="text-xs font-mono text-slate-600 block">Ref: {selectedReceipt.referenceNumber || 'N/A'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[11px] text-slate-500 uppercase font-semibold block">{t('receipts.purpose')}:</span>
                  <span className="text-xs text-slate-800">{selectedReceipt.purpose}</span>
                </div>
              </div>

              {/* Verified Stamp */}
              <div className="flex justify-between items-center pt-2">
                <div className="text-xs text-slate-500">
                  <span>{t('receipts.issuedBy')}: </span>
                  <span className="font-semibold text-slate-800">{selectedReceipt.issuedBy?.firstName} {selectedReceipt.issuedBy?.lastName}</span>
                </div>
                <div className="border-2 border-emerald-600 rounded-lg px-3 py-1 text-emerald-700 font-extrabold text-xs uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" /> {t('receipts.verifiedStamp')}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
