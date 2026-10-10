import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Invoice, Customer, InvoiceLine, RemittanceProfile } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  FileText,
  Plus,
  Printer,
  Ban,
  CheckCircle,
  Search,
  AlertTriangle,
  X,
  RotateCcw,
  Check,
  Building2,
  Globe
} from 'lucide-react';

export const Invoices: React.FC = () => {
  const { t, isRtl } = useLanguage();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [remittanceProfiles, setRemittanceProfiles] = useState<RemittanceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [previewInvoice, setPreviewInvoice] = useState<any | null>(null);
  const [voidInvoiceId, setVoidInvoiceId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // New Invoice Form State
  const [customerId, setCustomerId] = useState('');
  const [remittanceProfileId, setRemittanceProfileId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState('100% Advance Payment');
  const [lines, setLines] = useState<InvoiceLine[]>([
    { lineNumber: 1, description: 'Black Raisins (Best) - 1,385 CTNS', quantity: 22160, unitOfMeasure: 'KG', unitPrice: 3.58, lineTotal: 79332.80 }
  ]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [invRes, custRes, profRes] = await Promise.all([
        api.getInvoices({ search, status: statusFilter || undefined }),
        api.getCustomers(),
        api.getRemittanceProfiles()
      ]);
      setInvoices(invRes);
      setCustomers(custRes);
      setRemittanceProfiles(profRes);
      if (custRes.length > 0 && !customerId) {
        setCustomerId(custRes[0].id);
      }
      if (profRes.length > 0 && !remittanceProfileId) {
        const def = profRes.find((p: any) => p.isDefault && p.isActive) || profRes.find((p: any) => p.isActive) || profRes[0];
        if (def) setRemittanceProfileId(def.id);
      }
    } catch (err: any) {
      console.error('Failed to load invoices:', err);
      setError(err.message || 'Failed to load proforma invoices from server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, statusFilter]);

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
  };

  const handleAddLine = () => {
    setLines([
      ...lines,
      {
        lineNumber: lines.length + 1,
        description: 'Black Raisins - New Batch',
        quantity: 20000,
        unitOfMeasure: 'KG',
        unitPrice: 3.00,
        lineTotal: 60000
      }
    ]);
  };

  const handleUpdateLine = (index: number, field: string, value: any) => {
    const updated = [...lines];
    (updated[index] as any)[field] = value;
    const qty = Number(updated[index].quantity) || 0;
    const price = Number(updated[index].unitPrice) || 0;
    updated[index].lineTotal = Number((qty * price).toFixed(2));
    setLines(updated);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const calculateFormTotal = () => {
    return lines.reduce((sum, l) => sum + (Number(l.lineTotal) || 0), 0);
  };

  const handleCreateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!customerId) {
      setCreateError(t('invoices.validationError', 'Please select a buyer / consignee company.'));
      return;
    }

    const invalidLine = lines.find(l => !l.description.trim() || Number(l.quantity) <= 0 || Number(l.unitPrice) <= 0);
    if (invalidLine) {
      setCreateError(t('invoices.validationError', 'All line items must have a description, positive quantity, and positive price.'));
      return;
    }

    try {
      const created = await api.createInvoice({
        customerId,
        remittanceProfileId: remittanceProfileId || undefined,
        issueDate,
        paymentTerms,
        lines: lines.map(l => ({
          description: l.description,
          quantity: Number(l.quantity),
          unitOfMeasure: l.unitOfMeasure,
          unitPrice: Number(l.unitPrice)
        }))
      });

      // Immediately prepend new invoice to list
      setInvoices(prev => [created, ...prev.filter(i => i.id !== created.id)]);
      setShowCreateModal(false);
      setSuccessMessage(t('invoices.createSuccess', 'Proforma invoice created successfully!'));
      setTimeout(() => setSuccessMessage(null), 5000);

      // Reload fresh data from backend
      loadData();
    } catch (err: any) {
      console.error('Create invoice error:', err);
      setCreateError(err.message || 'Failed to create invoice');
    }
  };

  const handleIssue = async (id: string) => {
    if (!confirm(t('invoices.issueConfirm', 'Issuing this invoice will freeze line items and banking details permanently. Proceed?'))) return;
    try {
      await api.issueInvoice(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to issue invoice');
    }
  };

  const handleVoid = async () => {
    if (!voidInvoiceId || !voidReason) return;
    try {
      await api.voidInvoice(voidInvoiceId, voidReason);
      setVoidInvoiceId(null);
      setVoidReason('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to void invoice');
    }
  };

  const handleOpenPrintPreview = async (id: string) => {
    try {
      const data = await api.getInvoicePdfData(id);
      setPreviewInvoice(data);
    } catch (err: any) {
      alert(err.message || 'Failed to load invoice layout');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{t('invoices.title')}</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {t('invoices.subtitle')}
          </p>
        </div>
        <button
          onClick={() => {
            setCreateError(null);
            setShowCreateModal(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-950 transition w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" /> {t('invoices.createInvoice')}
        </button>
      </div>

      {/* Global Success Notification */}
      {successMessage && (
        <div className="bg-emerald-950/80 border border-emerald-700 text-emerald-200 px-4 py-3 rounded-lg text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="p-1 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Error Alert Banner with Retry Button */}
      {error && (
        <div className="bg-rose-950/80 border border-rose-700 text-rose-200 px-4 py-3 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadData}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-rose-800 hover:bg-rose-700 text-white rounded text-xs font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> {t('common.retry', 'Retry')}
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className={`w-4 h-4 text-slate-500 absolute top-3.5 ${isRtl ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            placeholder={t('invoices.searchPlaceholder')}
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
          <option value="">{t('invoices.allStatuses')}</option>
          <option value="DRAFT">{t('invoices.draftOnly')}</option>
          <option value="ISSUED">{t('invoices.issuedOnly')}</option>
          <option value="VOID">{t('invoices.voidOnly')}</option>
        </select>
        {(search || statusFilter) && (
          <button
            onClick={handleClearFilters}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition"
          >
            <X className="w-3.5 h-3.5" /> {t('common.clearFilters', 'Clear Filters')}
          </button>
        )}
      </div>

      {/* MOBILE CARD VIEW (< 640px) */}
      <div className="block sm:hidden space-y-3">
        {loading ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            {t('invoices.loading')}
          </div>
        ) : invoices.length > 0 ? (
          invoices.map(inv => (
            <div key={inv.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                    <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span dir="ltr" className="font-mono">{inv.invoiceNumber}</span>
                  </div>
                  {inv.sourceInvoiceRef && (
                    <span dir="ltr" className="text-[11px] text-amber-300 font-mono block mt-0.5">
                      Ref: {inv.sourceInvoiceRef}
                    </span>
                  )}
                  <span dir="ltr" className="text-[11px] text-slate-400 block mt-0.5 font-mono">
                    {new Date(inv.issueDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-right rtl:text-left">
                  <span dir="ltr" className="font-mono font-extrabold text-emerald-400 text-sm block">
                    ${Number(inv.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <div className="flex gap-1 justify-end rtl:justify-start mt-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      inv.status === 'ISSUED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                      inv.status === 'VOID' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                      'bg-slate-800 text-slate-300'
                    }`}>
                      {t(`status.${inv.status.toLowerCase()}`, inv.status)}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      inv.paymentStatus === 'PAID' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                      inv.paymentStatus === 'PARTIALLY_PAID' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                      'bg-slate-800 text-slate-400'
                    }`}>
                      {t(`status.${inv.paymentStatus.toLowerCase().replace('_', '')}`, inv.paymentStatus)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-300 border-t border-slate-800/80 pt-2 font-medium">
                {inv.customer?.companyName || 'Unknown Customer'}
              </div>

              {/* Mobile Touch Action Buttons (Min 44px target) */}
              <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800/80">
                <button
                  onClick={() => handleOpenPrintPreview(inv.id)}
                  className="flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition"
                >
                  <Printer className="w-4 h-4 text-slate-400" /> {t('common.print')}
                </button>
                {inv.status === 'DRAFT' && (
                  <button
                    onClick={() => handleIssue(inv.id)}
                    className="flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-xs font-semibold rounded-lg transition"
                  >
                    <CheckCircle className="w-4 h-4" /> {t('invoices.issue')}
                  </button>
                )}
                {inv.status !== 'VOID' && (
                  <button
                    onClick={() => setVoidInvoiceId(inv.id)}
                    className="flex items-center justify-center gap-1.5 py-2.5 min-h-[44px] bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-xs font-semibold rounded-lg transition"
                  >
                    <Ban className="w-4 h-4" /> {t('invoices.void')}
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs bg-slate-900 border border-slate-800 rounded-xl p-6">
            {t('invoices.emptyState')}
          </div>
        )}
      </div>

      {/* DESKTOP TABLE VIEW (>= 640px) */}
      <div className="hidden sm:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('invoices.invoiceNo')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('invoices.sourceRef')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('invoices.issueDate')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('invoices.buyerConsignee')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('invoices.lifecycle')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('invoices.paymentStatus')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t('invoices.totalUsd')}</th>
                <th className="py-3 px-4 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400 font-sans">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    {t('invoices.loading')}
                  </td>
                </tr>
              ) : invoices.length > 0 ? (
                invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                    <td className={`py-3 px-4 font-bold text-white flex items-center gap-1.5 ${isRtl ? 'text-right' : 'text-left'}`}>
                      <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span dir="ltr">{inv.invoiceNumber}</span>
                    </td>
                    <td className="py-3 px-4 text-amber-300 font-semibold" dir="ltr">
                      {inv.sourceInvoiceRef || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-400" dir="ltr">
                      {new Date(inv.issueDate).toLocaleDateString()}
                    </td>
                    <td className={`py-3 px-4 font-sans text-slate-200 ${isRtl ? 'text-right' : 'text-left'}`}>
                      {inv.customer?.companyName || 'Unknown Customer'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                        inv.status === 'ISSUED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                        inv.status === 'VOID' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {t(`status.${inv.status.toLowerCase()}`, inv.status)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                        inv.paymentStatus === 'PAID' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                        inv.paymentStatus === 'PARTIALLY_PAID' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {t(`status.${inv.paymentStatus.toLowerCase().replace('_', '')}`, inv.paymentStatus)}
                      </span>
                    </td>
                    <td className={`py-3 px-4 font-bold text-emerald-400 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      ${Number(inv.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenPrintPreview(inv.id)}
                          title={t('common.print')}
                          className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {inv.status === 'DRAFT' && (
                          <button
                            onClick={() => handleIssue(inv.id)}
                            title={t('invoices.issue')}
                            className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950 rounded transition"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {inv.status !== 'VOID' && (
                          <button
                            onClick={() => setVoidInvoiceId(inv.id)}
                            title={t('invoices.void')}
                            className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-rose-400 hover:text-rose-300 hover:bg-rose-950 rounded transition"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400 font-sans">
                    {t('invoices.emptyState')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE INVOICE MODAL (Mobile-optimized) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl my-auto p-4 sm:p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 sm:pb-4 border-b border-slate-800">
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" /> {t('invoices.createModalTitle')}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                aria-label={t('common.close')}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="mt-3 bg-rose-950/80 border border-rose-700 text-rose-200 p-3 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateDraft} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t('invoices.customerLabel')}</label>
                  <select
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 min-h-[44px] text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- {t('invoices.selectCustomer')} --</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t('invoices.issueDate')}</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={e => setIssueDate(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 min-h-[44px] text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t('invoices.paymentTerms')}</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 min-h-[44px] text-xs text-white focus:outline-none"
                />
              </div>

              {/* Payment Instructions / Remittance Profile Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t('invoices.paymentInstructions')}
                </label>
                <select
                  value={remittanceProfileId}
                  onChange={e => setRemittanceProfileId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 min-h-[44px] text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  {remittanceProfiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.profileType === 'LOCAL' ? 'Local Wire - Da Afghanistan Bank' : 'International Wire - Al Salam / JPMorgan'}) {p.isDefault ? '★ Default' : ''}
                    </option>
                  ))}
                </select>

                {/* Dynamic Remittance Preview in Modal */}
                {(() => {
                  const activeP = remittanceProfiles.find(p => p.id === remittanceProfileId);
                  if (!activeP) return null;
                  const isIntl = activeP.profileType === 'INTERNATIONAL';
                  return (
                    <div className="mt-2 p-3 bg-slate-950 rounded-lg border border-slate-800 text-[11px] space-y-1.5 text-slate-300">
                      <div className="font-semibold text-emerald-400 flex items-center justify-between">
                        <span>{activeP.beneficiaryBank} ({activeP.profileType})</span>
                        <span className="font-mono text-slate-400" dir="ltr">SWIFT: {activeP.beneficiarySwift}</span>
                      </div>
                      <div>Beneficiary: <strong className="text-white">{activeP.beneficiaryName}</strong> (Acc: <span dir="ltr" className="font-mono text-emerald-400">{activeP.beneficiaryAccount}</span>)</div>
                      <div>Correspondent: <span className="text-white">{activeP.correspondentBank}</span> (SWIFT: <span dir="ltr" className="font-mono text-slate-300">{activeP.correspondentSwift}</span>)</div>
                      {isIntl && activeP.intermediaryBank && (
                        <div className="text-amber-300 pt-1 border-t border-slate-900">
                          Intermediary (Field 54A): {activeP.intermediaryBank} (SWIFT: <span dir="ltr" className="font-mono">{activeP.intermediarySwift}</span>)
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Line Items Editor */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">{t('invoices.lineItemsTitle')}</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:underline min-h-[44px] px-2"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t('invoices.addLine')}
                  </button>
                </div>

                <div className="space-y-3">
                  {lines.map((line, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-lg space-y-2 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-2 items-center text-xs">
                      <div className="sm:col-span-5">
                        <label className="text-[10px] text-slate-500 block mb-0.5">{t('invoices.itemDesc')}</label>
                        <input
                          type="text"
                          value={line.description}
                          onChange={e => handleUpdateLine(idx, 'description', e.target.value)}
                          required
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-white"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:contents">
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-slate-500 block mb-0.5">{t('invoices.netWeight')}</label>
                          <input
                            type="number"
                            step="any"
                            value={line.quantity}
                            onChange={e => handleUpdateLine(idx, 'quantity', e.target.value)}
                            required
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-white"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-[10px] text-slate-500 block mb-0.5">{t('invoices.unitPrice')}</label>
                          <input
                            type="number"
                            step="0.0001"
                            value={line.unitPrice}
                            onChange={e => handleUpdateLine(idx, 'unitPrice', e.target.value)}
                            required
                            className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-2 text-xs text-white"
                          />
                        </div>
                      </div>
                      <div className="flex justify-between sm:contents items-center pt-1 sm:pt-0">
                        <div className="sm:col-span-2 text-left sm:text-right rtl:sm:text-left">
                          <label className="text-[10px] text-slate-500 block mb-0.5 sm:inline">{t('invoices.lineTotal')}: </label>
                          <span dir="ltr" className="font-mono font-bold text-emerald-400">${Number(line.lineTotal).toLocaleString()}</span>
                        </div>
                        <div className="sm:col-span-1 text-right sm:text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            aria-label={t('common.delete')}
                            className="text-slate-500 hover:text-rose-400 p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center text-xs sm:text-sm">
                  <span className="font-semibold text-slate-300">{t('invoices.grandTotal')}</span>
                  <span dir="ltr" className="font-mono font-extrabold text-base sm:text-lg text-emerald-400">
                    ${calculateFormTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 min-h-[44px] bg-slate-800 text-slate-300 rounded-lg text-xs"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs"
                >
                  {t('invoices.createDraftButton')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE / PREVIEW INVOICE MODAL (Mobile-responsive) */}
      {previewInvoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 overflow-y-auto">
          <div className="printable-document bg-white text-slate-900 rounded-xl w-full max-w-3xl my-auto p-4 sm:p-8 shadow-2xl font-sans max-h-[95vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-4 sm:pb-6 border-b border-slate-300">
              <div className="flex items-center gap-4">
                <div className="h-16 w-36 sm:w-44 flex items-center justify-start shrink-0">
                  <img
                    src="/sky-ariana-logo.png"
                    alt="Sky Ariana Ltd. Official Logo"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">{previewInvoice.company.legalName || 'SKY ARIANA LTD.'}</h2>
                  <p className="text-xs text-slate-500 tracking-wider uppercase font-semibold">Corporate Commercial Settlement</p>
                  <p className="text-xs text-slate-600 mt-1">{previewInvoice.company.email} | {previewInvoice.company.website}</p>
                </div>
              </div>
              <div className="sm:text-right rtl:sm:text-left">
                <span className="text-lg sm:text-xl font-bold text-slate-900 uppercase tracking-wider block">PROFORMA INVOICE</span>
                <span dir="ltr" className="text-xs font-mono font-bold text-emerald-700 block mt-1">{previewInvoice.invoiceNumber}</span>
                {previewInvoice.sourceInvoiceRef && (
                  <span dir="ltr" className="text-[11px] text-slate-500 font-mono block">Workbook Ref: {previewInvoice.sourceInvoiceRef}</span>
                )}
                <span dir="ltr" className="text-xs text-slate-600 block mt-0.5">Date: {previewInvoice.issueDate}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 my-4 sm:my-6 text-xs">
              <div className="bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-200">
                <h3 className="font-bold uppercase tracking-wider text-slate-700 mb-1">BILL TO / CONSIGNEE:</h3>
                <p className="font-semibold text-slate-900 text-sm">{previewInvoice.customer.companyName}</p>
                <p className="text-slate-600 mt-0.5">{previewInvoice.customer.addressLine1}</p>
                <p className="text-slate-600">{previewInvoice.customer.addressLine2}</p>
                <p className="text-slate-700 font-medium mt-1">{previewInvoice.customer.country}</p>
              </div>
              <div className="bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-200">
                <h3 className="font-bold uppercase tracking-wider text-slate-700 mb-1">TERMS & SETTLEMENT:</h3>
                <p className="text-slate-700 mt-1">Payment Terms: <span className="font-semibold">{previewInvoice.paymentTerms}</span></p>
                <p className="text-slate-700 mt-1">Status: <span className="font-bold text-emerald-700">{previewInvoice.status}</span></p>
                <p className="text-slate-700 mt-1">Payment Status: <span className="font-bold text-blue-700">{previewInvoice.paymentStatus}</span></p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="my-4 sm:my-6 overflow-x-auto">
              <table className="w-full text-left rtl:text-right text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                  <tr>
                    <th className="py-2 px-2.5 border-b">Item Description</th>
                    <th className="py-2 px-2.5 border-b text-right rtl:text-left">Net Wt</th>
                    <th className="py-2 px-2.5 border-b text-right rtl:text-left">C&F Unit Price</th>
                    <th className="py-2 px-2.5 border-b text-right rtl:text-left">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {previewInvoice.lines.map((l: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2 px-2.5 text-slate-900 font-medium">{l.description}</td>
                      <td className="py-2 px-2.5 text-right rtl:text-left font-mono text-slate-700" dir="ltr">{l.quantity}</td>
                      <td className="py-2 px-2.5 text-right rtl:text-left font-mono text-slate-700" dir="ltr">{l.unitPrice}</td>
                      <td className="py-2 px-2.5 text-right rtl:text-left font-mono font-bold text-slate-900" dir="ltr">{l.lineTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end rtl:justify-start mt-3 text-sm">
                <div className="text-right rtl:text-left">
                  <span className="text-xs uppercase text-slate-500 font-bold mr-3 rtl:ml-3 rtl:mr-0">GRAND TOTAL (USD):</span>
                  <span dir="ltr" className="text-base sm:text-lg font-extrabold font-mono text-emerald-700">{previewInvoice.grandTotal}</span>
                </div>
              </div>
            </div>

            {/* Payment & Banking Wire Instructions */}
            {(() => {
              const snap = previewInvoice.bankSnapshot;
              const prof = previewInvoice.remittanceProfile;
              const fallback = previewInvoice.bankingDetails;

              const isSnapshot = !!snap;
              const data = snap || prof || fallback;
              if (!data) return null;

              const isIntl = data.profileType === 'INTERNATIONAL' || (data.profile && data.profile.profileType === 'INTERNATIONAL');
              const bankName = data.beneficiaryBank || data.bankName || 'Afghan United Bank (AUB)';
              const beneName = data.beneficiaryName || 'Sky Ariana LTD';
              const accNo = data.beneficiaryAccount || data.accountNumber || '101502USD2940472';
              const swift = data.beneficiarySwift || data.swiftCode || 'AFGUAFKAXXX';
              const corrBank = data.correspondentBank || (isIntl ? 'AL SALAM BANK BAHRAIN' : '(DAB) DA AFGHANISTAN BANK');
              const corrSwift = data.correspondentSwift || (isIntl ? 'ALSABHBMXXX' : 'AFGBAFKA');
              const corrAcc = data.correspondentAccount || (!isIntl ? '3000205027231' : '400758954');
              const interBank = data.intermediaryBank || (isIntl ? 'JPMorgan Chase Bank, New York' : null);
              const interSwift = data.intermediarySwift || (isIntl ? 'CHASUS33' : null);

              return (
                <div className="bg-slate-50 p-3 sm:p-4 rounded-lg border border-slate-200 text-xs mt-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2 pb-1.5 border-b border-slate-200">
                    <h3 className="font-bold uppercase tracking-wider text-slate-800 text-xs">
                      OFFICIAL PAYMENT & WIRE REMITTANCE INSTRUCTIONS
                    </h3>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                        {isIntl ? 'International USD Remittance' : 'Local USD Remittance'}
                      </span>
                      {isSnapshot && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Frozen Snapshot (Issued)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                    <div>Beneficiary (Field 59A): <strong className="text-slate-900">{beneName}</strong></div>
                    <div>Account No (USD): <span dir="ltr" className="font-mono font-bold text-slate-900">{accNo}</span></div>
                    <div>Beneficiary Bank {isIntl ? '(Field 57A)' : ''}: <span className="font-semibold text-slate-900">{bankName}</span></div>
                    <div>SWIFT / BIC: <span dir="ltr" className="font-mono font-bold text-emerald-800">{swift}</span></div>
                    <div>Correspondent Bank {isIntl ? '(Field 56A)' : ''}: <span className="font-semibold text-slate-900">{corrBank}</span></div>
                    <div>Correspondent SWIFT: <span dir="ltr" className="font-mono font-bold text-slate-900">{corrSwift}</span></div>
                    {corrAcc && (
                      <div>Correspondent Account: <span dir="ltr" className="font-mono text-slate-900">{corrAcc}</span></div>
                    )}
                    {data.aubAccountWithCorrespondent && (
                      <div>AUB Account with Al Salam: <span dir="ltr" className="font-mono text-slate-900">{data.aubAccountWithCorrespondent}</span></div>
                    )}
                    {interBank && (
                      <div className="sm:col-span-2 pt-1 border-t border-slate-200 text-amber-900">
                        Intermediary Bank (Field 54A - Mandatory): <strong className="font-bold">{interBank}</strong> (SWIFT: <span dir="ltr" className="font-mono font-bold">{interSwift}</span>)
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200 print:hidden">
              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 min-h-[44px] bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg shadow"
              >
                {t('common.print', 'Print / Save PDF')}
              </button>
              <button
                onClick={() => setPreviewInvoice(null)}
                className="px-4 py-2.5 min-h-[44px] bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg"
              >
                {t('common.close', 'Close Preview')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID INVOICE MODAL */}
      {voidInvoiceId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5 text-rose-400" /> {t('invoices.void')}
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              Voiding an invoice cancels outstanding receivables. A mandatory audit reason is required.
            </p>
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-300 mb-1">{t('invoices.voidPrompt')}</label>
              <textarea
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="e.g., Order cancelled by consignee, revised terms..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setVoidInvoiceId(null)}
                className="px-3 py-2 min-h-[44px] bg-slate-800 text-slate-300 rounded text-xs"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleVoid}
                disabled={!voidReason.trim()}
                className="px-4 py-2 min-h-[44px] bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold disabled:opacity-50"
              >
                {t('common.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
