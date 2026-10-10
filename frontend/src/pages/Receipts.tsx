import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import {
  Receipt,
  Search,
  Filter,
  Printer,
  Download,
  Ban,
  X,
  CheckCircle,
  Building2,
  Share2,
  Clock,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export const Receipts: React.FC = () => {
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedReceipt, setSelectedReceipt] = useState<any | null>(null);
  const [receiptPdfData, setReceiptPdfData] = useState<any | null>(null);
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:4000/api/receipts', {
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
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:4000/api/receipts/${r.id}/pdf-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setReceiptPdfData(data);
      }
    } catch {
      setReceiptPdfData(null);
    }
  };

  const handleVoid = async () => {
    if (!selectedReceipt || !voidReason.trim()) return;
    setVoiding(true);
    setMessage(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:4000/api/receipts/${selectedReceipt.id}/void`, {
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
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Deposit Receipts</h1>
              <span className="px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
                AUTOMATIC POSTING
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              AQ Companies • Guaranteed Exactly-One-Receipt Workflow for All Deposits
            </p>
          </div>
        </div>

        <button
          onClick={fetchReceipts}
          className="self-start sm:self-auto flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh List
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
          <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
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
          <span className="text-[11px] font-mono text-sky-400 mt-1 block">
            Account: 101502******0472
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by receipt number, payer, wire reference, purpose..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 min-h-[44px] bg-slate-900 border border-slate-800 rounded-lg text-xs focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          {(['ALL', 'ISSUED', 'VOIDED'] as const).map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-2 min-h-[44px] rounded-lg text-xs font-semibold transition ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Card List (< 640px) */}
      <div className="block sm:hidden space-y-3">
        {loading ? (
          <div className="text-center py-8 text-xs text-slate-500">Loading receipts...</div>
        ) : filteredReceipts.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-4">
            No receipts found.
          </div>
        ) : (
          filteredReceipts.map(r => (
            <div
              key={r.id}
              onClick={() => openReceiptModal(r)}
              className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-sm space-y-2 cursor-pointer hover:border-emerald-500/50 transition"
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono font-bold text-xs text-emerald-400 block">{r.receiptNumber}</span>
                  <span className="text-xs font-semibold text-white mt-0.5 block">{r.payerName}</span>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  r.status === 'ISSUED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                }`}>
                  {r.status}
                </span>
              </div>

              <div className="text-[11px] text-slate-400">
                {r.purpose}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800 text-xs">
                <span className="text-[11px] text-slate-500">
                  {new Date(r.issueDate).toLocaleDateString()}
                </span>
                <span className="font-mono font-bold text-sm text-white">
                  ${Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table (>= 640px) */}
      <div className="hidden sm:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Receipt Number</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Payer / Remitter</th>
              <th className="py-3 px-4">Payment Method</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Amount (USD)</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-500">Loading receipts...</td>
              </tr>
            ) : filteredReceipts.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-500">No receipts found.</td>
              </tr>
            ) : (
              filteredReceipts.map(r => (
                <tr key={r.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-bold text-emerald-400 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5" />
                    {r.receiptNumber}
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-sans">
                    {new Date(r.issueDate).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-white font-sans font-medium">
                    {r.payerName}
                  </td>
                  <td className="py-3 px-4 text-slate-400 font-sans">
                    {r.paymentMethod?.replace(/_/g, ' ') || 'WIRE TRANSFER'}
                  </td>
                  <td className="py-3 px-4 font-sans">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.status === 'ISSUED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-white">
                    ${Number(r.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-center font-sans">
                    <button
                      onClick={() => openReceiptModal(r)}
                      className="px-2.5 py-1 min-h-[36px] bg-slate-800 hover:bg-slate-700 text-sky-400 rounded text-xs transition"
                    >
                      View Receipt
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* OFFICIAL PRINTABLE RECEIPT MODAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-xl w-full max-w-2xl my-auto p-4 sm:p-8 shadow-2xl font-sans max-h-[95vh] overflow-y-auto print:max-w-full print:p-0 print:shadow-none">
            {/* Modal Actions Bar (hidden in print) */}
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-200 print:hidden">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Official Treasury Receipt Preview
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyDetails}
                  className="px-3 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <Share2 className="w-3.5 h-3.5" /> {copied ? 'Copied!' : 'Share / Copy'}
                </button>
                <button
                  onClick={handlePrint}
                  className="px-3 py-1.5 min-h-[36px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" /> Print / Save PDF
                </button>
                {selectedReceipt.status === 'ISSUED' && (
                  <button
                    onClick={() => setShowVoidModal(true)}
                    className="px-3 py-1.5 min-h-[36px] bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                  >
                    <Ban className="w-3.5 h-3.5" /> Void
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

            {/* PRINTABLE RECEIPT CONTENT (Always pure white print background) */}
            <div className="space-y-6">
              {/* Receipt Header with Official Logo */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-16 h-16 bg-slate-950 p-1.5 rounded-2xl flex items-center justify-center border border-slate-300 shadow-sm shrink-0">
                    <img
                      src="/logo.png"
                      alt="AQ Companies Official Logo"
                      className="w-full h-full object-contain filter drop-shadow-[0_0_4px_rgba(255,255,255,0.4)]"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold tracking-tight text-slate-900">AQ COMPANIES</h2>
                    <p className="text-xs text-slate-600 font-semibold uppercase tracking-wider">Legal Entity: Sky Ariana Ltd</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">finance@aqcompanies.com • Operating Account</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-lg font-black tracking-wider uppercase text-emerald-800 block">OFFICIAL RECEIPT</span>
                  <span className="text-xs font-mono font-bold text-slate-900 block mt-1">
                    {selectedReceipt.receiptNumber}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Date: {new Date(selectedReceipt.issueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                    selectedReceipt.status === 'ISSUED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    STATUS: {selectedReceipt.status}
                  </span>
                </div>
              </div>

              {/* Main Receipt Body */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-baseline border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Received From (Payer):</span>
                  <span className="text-sm font-bold text-slate-900">{selectedReceipt.payerName}</span>
                </div>

                <div className="flex justify-between items-baseline border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">The Sum of (Amount):</span>
                  <span className="text-xl font-extrabold text-emerald-700 font-mono">
                    ${Number(selectedReceipt.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                  </span>
                </div>

                <div className="border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-0.5">Amount in Words:</span>
                  <span className="text-xs font-semibold text-slate-800 italic">
                    "{selectedReceipt.amountInWords || 'Amount in words'}"
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold block">Receiving Account:</span>
                    <span className="text-xs font-bold text-slate-900">{selectedReceipt.receivingAccountName}</span>
                    <span className="text-xs font-mono text-slate-600 block">Number: {selectedReceipt.receivingAccountMasked}</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 uppercase font-semibold block">Payment Method & Ref:</span>
                    <span className="text-xs font-bold text-slate-900">{selectedReceipt.paymentMethod?.replace(/_/g, ' ')}</span>
                    <span className="text-xs font-mono text-slate-600 block">Ref: {selectedReceipt.referenceNumber || 'N/A'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200">
                  <span className="text-[11px] text-slate-500 uppercase font-semibold block">Purpose / For:</span>
                  <span className="text-xs text-slate-800 font-medium">{selectedReceipt.purpose}</span>
                </div>

                {selectedReceipt.invoice && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[11px] text-slate-500 uppercase font-semibold block">Settled Invoice Reference:</span>
                    <span className="text-xs font-mono font-bold text-emerald-800">
                      {selectedReceipt.invoice.sourceInvoiceRef || selectedReceipt.invoice.invoiceNumber}
                    </span>
                  </div>
                )}
              </div>

              {/* Security & Stamp / Signatures */}
              <div className="grid grid-cols-2 gap-8 pt-4 items-end">
                <div className="text-[11px] text-slate-500 space-y-1">
                  <div className="flex items-center gap-1 font-semibold text-slate-700">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span>Cryptographically Audited Receipt</span>
                  </div>
                  <p className="text-[10px] leading-tight">
                    This official electronic receipt was atomically recorded in the AQ Companies corporate ledger.
                    Receipt ID: <span className="font-mono text-slate-600">{selectedReceipt.id}</span>
                  </p>
                </div>

                <div className="text-right">
                  <div className="border-b border-slate-400 w-48 ml-auto mb-1"></div>
                  <span className="text-xs font-bold text-slate-800 uppercase block">Authorized Treasury Signature</span>
                  <span className="text-[10px] text-slate-500 block">Sky Ariana Ltd / AQ Companies</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VOID CONFIRMATION MODAL */}
      {showVoidModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-500" /> Void Official Receipt
            </h3>
            <p className="text-xs text-slate-400">
              Voiding receipt <strong className="text-white">{selectedReceipt?.receiptNumber}</strong> will record an immutable reversal entry in the audit log. The original receipt record is preserved.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Mandatory Business Justification</label>
              <textarea
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="e.g. Inward wire reversed by issuing bank / wrong currency allocated"
                className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:outline-none"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowVoidModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleVoid}
                disabled={voiding || !voidReason.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-lg text-xs"
              >
                {voiding ? 'Recording Void...' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
