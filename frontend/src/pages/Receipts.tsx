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
  RefreshCw,
  Eye,
  Download
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
  const [showRegisterPrintModal, setShowRegisterPrintModal] = useState(false);
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

  const handlePrintReceiptDirect = (r: any) => {
    setSelectedReceipt(r);
    setTimeout(() => {
      triggerPrint(`Official-Deposit-Receipt-${r.receiptNumber}`);
    }, 120);
  };

  const handleCopyDetails = () => {
    if (!selectedReceipt) return;
    const text = `AQ COMPANIES OFFICIAL RECEIPT\nReceipt No: ${selectedReceipt.receiptNumber}\nDate: ${formatDisplayDate(selectedReceipt.issueDate)}\nPayer: ${selectedReceipt.payerName}\nAmount: $${Number(selectedReceipt.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD\nAmount in Words: ${selectedReceipt.amountInWords}\nAccount: ${selectedReceipt.receivingAccountMasked}\nPurpose: ${selectedReceipt.purpose}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedReceipt) setSelectedReceipt(null);
        if (showRegisterPrintModal) setShowRegisterPrintModal(false);
        if (showVoidModal) setShowVoidModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedReceipt, showRegisterPrintModal, showVoidModal]);

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

  const totalFilteredGross = filteredReceipts.reduce((sum, r) => {
    const g = Number(r.grossAmount || (Number(r.swiftFeeAmount || 0) > 0 ? Number(r.amount) + Number(r.swiftFeeAmount) : r.amount));
    return sum + (isNaN(g) ? 0 : g);
  }, 0);
  const totalFilteredFees = filteredReceipts.reduce((sum, r) => sum + (Number(r.swiftFeeAmount) || 0), 0);
  const totalFilteredNet = filteredReceipts.reduce((sum, r) => {
    const fee = Number(r.swiftFeeAmount || 0);
    const net = fee > 0 && r.grossAmount && Number(r.grossAmount) === Number(r.amount)
      ? Number(r.grossAmount) - fee
      : Number(r.amount);
    return sum + (isNaN(net) ? 0 : net);
  }, 0);

  const handleExportRegisterCsv = () => {
    const headers = ['Receipt No', 'Date', 'Payer Name', 'Gross Invoiced (USD)', 'SWIFT Fee (USD)', 'Net Credited (USD)', 'Purpose', 'Reference', 'Status'];
    const rows = filteredReceipts.map(r => {
      const gross = Number(r.grossAmount || (Number(r.swiftFeeAmount || 0) > 0 ? Number(r.amount) + Number(r.swiftFeeAmount) : r.amount)).toFixed(2);
      const fee = Number(r.swiftFeeAmount || 0).toFixed(2);
      const net = Number(r.swiftFeeAmount && Number(r.swiftFeeAmount) > 0 && r.grossAmount && Number(r.grossAmount) === Number(r.amount) ? Number(r.grossAmount) - Number(r.swiftFeeAmount) : r.amount).toFixed(2);
      return [
        r.receiptNumber,
        formatDisplayDate(r.issueDate),
        `"${(r.payerName || '').replace(/"/g, '""')}"`,
        gross,
        fee,
        net,
        `"${(r.purpose || '').replace(/"/g, '""')}"`,
        r.referenceNumber || '—',
        r.status
      ];
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Official-Deposit-Receipts-Register-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowRegisterPrintModal(true)}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition shadow-sm"
            title="Print Official Deposit Receipts Summary Register"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{t('receipts.printRegister', 'Print Summary Report')}</span>
          </button>
          <button
            onClick={fetchReceipts}
            className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t('common.refresh', 'Refresh List')}
          </button>
        </div>
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
                <th className="py-3 px-3 text-center min-w-[130px] whitespace-nowrap">{t('common.actions')}</th>
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
                    <td className="py-3 px-3 text-center font-sans whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => openReceiptModal(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[32px] bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 text-xs font-medium rounded transition dark:border-slate-700"
                          title={t('receipts.viewTooltip', 'View Receipt Details')}
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                          <span>{t('common.view', 'View')}</span>
                        </button>
                        <button
                          onClick={() => handlePrintReceiptDirect(r)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 min-h-[32px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded transition shadow-sm"
                          title={t('receipts.printTooltip', 'Print Official Deposit Receipt')}
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{t('common.print', 'Print')}</span>
                        </button>
                      </div>
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

      {/* OFFICIAL DEPOSIT RECEIPTS REGISTER & AUDIT SUMMARY PRINT MODAL */}
      {showRegisterPrintModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="printable-document bg-white text-slate-900 rounded-2xl w-full max-w-5xl my-auto p-5 sm:p-8 shadow-2xl font-sans max-h-[95vh] overflow-y-auto print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-full print:rounded-none print:max-h-none print:overflow-visible">
            {/* Modal Actions Bar (Hidden on Print) */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-200 print:hidden">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {t('receipts.registerTitle', 'Official Deposit Receipts Register & Summary Report')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportRegisterCsv}
                  className="px-3 py-1.5 min-h-[36px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </button>
                <button
                  onClick={() => triggerPrint('Official-Deposit-Receipts-Register')}
                  className="px-3.5 py-1.5 min-h-[36px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Summary Report
                </button>
                <button
                  onClick={() => setShowRegisterPrintModal(false)}
                  className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PRINTABLE REGISTER CONTENT */}
            <div className="space-y-5 mt-4">
              {/* Document Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-3 border-b-2 border-slate-900">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-36 sm:h-20 sm:w-48 flex items-center justify-start shrink-0">
                    <img
                      src="/sky-ariana-logo.png"
                      alt="Sky Ariana Ltd."
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-slate-950 font-sans tracking-tight">
                      SKY ARIANA LTD.
                    </h2>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      Corporate Treasury & Commercial Settlement Division
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Operating Account: Afghan United Bank (AUB) • 101502USD2940472 • SWIFT: AFGUAFKAXXX
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right shrink-0 sm:ml-auto">
                  <span className="text-sm font-black tracking-wider uppercase text-emerald-800 block">
                    OFFICIAL RECEIPTS REGISTER
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-900 block mt-0.5" dir="ltr">
                    Ref: AQ-RCP-REG-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5" dir="ltr">
                    Statement Date: {formatFullDate(new Date().toISOString())}
                  </span>
                </div>
              </div>

              {/* Executive KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-sm">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Total Receipts</span>
                  <span className="text-base font-extrabold text-slate-900 font-mono">{filteredReceipts.length}</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-sm">
                  <span className="text-[9px] uppercase font-bold text-slate-500 block">Gross Invoiced</span>
                  <span className="text-base font-extrabold text-slate-900 font-mono" dir="ltr">
                    ${totalFilteredGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-sm">
                  <span className="text-[9px] uppercase font-bold text-amber-700 block">SWIFT Deductions</span>
                  <span className="text-base font-extrabold text-amber-700 font-mono" dir="ltr">
                    -${totalFilteredFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 shadow-sm">
                  <span className="text-[9px] uppercase font-bold text-emerald-800 block">Net Wire Credited</span>
                  <span className="text-base font-extrabold text-emerald-700 font-mono" dir="ltr">
                    ${totalFilteredNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Itemized Receipts Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-[11px] text-slate-800">
                  <thead className="bg-slate-950 text-white uppercase text-[9px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Receipt No</th>
                      <th className="py-2.5 px-2.5 text-left">Date</th>
                      <th className="py-2.5 px-3 text-left">Payer / Remitter</th>
                      <th className="py-2.5 px-2.5 text-right">Gross (USD)</th>
                      <th className="py-2.5 px-2.5 text-right">SWIFT Fee</th>
                      <th className="py-2.5 px-2.5 text-right">Net Credited</th>
                      <th className="py-2.5 px-3 text-left">Purpose & Reference</th>
                      <th className="py-2.5 px-2 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono text-[10px]">
                    {filteredReceipts.map(r => {
                      const gross = Number(r.grossAmount || (Number(r.swiftFeeAmount || 0) > 0 ? Number(r.amount) + Number(r.swiftFeeAmount) : r.amount));
                      const fee = Number(r.swiftFeeAmount || 0);
                      const net = Number(fee > 0 && r.grossAmount && Number(r.grossAmount) === Number(r.amount) ? Number(r.grossAmount) - fee : r.amount);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-bold text-emerald-800 text-left" dir="ltr">{r.receiptNumber}</td>
                          <td className="py-2 px-2.5 text-slate-600 text-left" dir="ltr">{formatDisplayDate(r.issueDate)}</td>
                          <td className="py-2 px-3 font-sans font-medium text-slate-900 text-left">{r.payerName}</td>
                          <td className="py-2 px-2.5 text-right tabular-nums text-slate-700" dir="ltr">
                            ${gross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums text-amber-700" dir="ltr">
                            {fee > 0 ? `-$${fee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
                          </td>
                          <td className="py-2 px-2.5 text-right tabular-nums font-bold text-emerald-800" dir="ltr">
                            ${net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 font-sans text-slate-600 text-left truncate max-w-[190px]">{r.purpose}</td>
                          <td className="py-2 px-2 text-center font-sans">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${r.status === 'ISSUED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-[10px]">
                    <tr>
                      <td colSpan={3} className="py-2.5 px-3 text-slate-900 font-sans uppercase">
                        Total Summary ({filteredReceipts.length} Official Receipts)
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-slate-900" dir="ltr">
                        ${totalFilteredGross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-amber-800" dir="ltr">
                        -${totalFilteredFees.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-emerald-800" dir="ltr">
                        ${totalFilteredNet.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td colSpan={2} className="py-2.5 px-3 text-right font-mono text-[9px] text-slate-500">
                        USD Currency
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Audit & Legal Sign-off Footer */}
              <div className="pt-3 border-t-2 border-slate-900 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 text-xs">
                <div>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-0.5">
                    OFFICIAL TREASURY CERTIFICATION:
                  </span>
                  <div className="text-xs font-black text-slate-950 uppercase">
                    Ahsanullah Qureshi
                  </div>
                  <div className="text-[10px] font-bold text-emerald-800">
                    Managing Director & Head of Corporate Treasury
                  </div>
                  <div className="text-[9px] text-slate-500">
                    Sky Ariana Ltd. • Commercial Settlement Division
                  </div>
                </div>
                <div className="text-left sm:text-right flex flex-col items-start sm:items-end gap-1">
                  <div className="border border-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg text-emerald-800 font-bold text-[10px] flex items-center gap-1.5 shadow-sm">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>OFFICIALLY AUDITED & VERIFIED</span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-400">
                    AFGHAN UNITED BANK (AUB) • ACCOUNT 101502USD2940472
                  </span>
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
