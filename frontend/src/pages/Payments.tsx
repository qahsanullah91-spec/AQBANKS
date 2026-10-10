import React, { useEffect, useState } from 'react';
import { api, getAuthToken } from '../services/api';
import { Payment, Customer, Invoice } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  CreditCard,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle,
  X,
  Split
} from 'lucide-react';

export const Payments: React.FC = () => {
  const { t, isRtl } = useLanguage();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Record Payment Modal
  const [showModal, setShowModal] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [allocations, setAllocations] = useState<{ invoiceId: string; amount: number }[]>([]);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [selectedReceiptModal, setSelectedReceiptModal] = useState<any | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [payRes, custRes, invRes] = await Promise.all([
        api.getPayments({ reference: search || undefined }),
        api.getCustomers(),
        api.getInvoices({ paymentStatus: 'UNPAID' })
      ]);
      setPayments(payRes);
      setCustomers(custRes);
      setInvoices(invRes);
      if (custRes.length > 0 && !customerId) {
        setCustomerId(custRes[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  // Filter invoices for chosen customer
  const customerInvoices = invoices.filter(inv => inv.customerId === customerId);

  const handleAddAllocation = (invId: string, maxAmount: number) => {
    const existing = allocations.find(a => a.invoiceId === invId);
    if (existing) return;
    const currentAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);
    const enteredTotal = Number(totalAmount) || 0;
    const remainingToAllocate = Math.max(0, enteredTotal - currentAllocated);
    const amountToApply = Math.min(maxAmount, remainingToAllocate > 0 ? remainingToAllocate : maxAmount);

    setAllocations([...allocations, { invoiceId: invId, amount: amountToApply }]);
  };

  const handleUpdateAllocationAmount = (invId: string, val: number) => {
    setAllocations(allocations.map(a => (a.invoiceId === invId ? { ...a, amount: val } : a)));
  };

  const handleRemoveAllocation = (invId: string) => {
    setAllocations(allocations.filter(a => a.invoiceId !== invId));
  };

  const totalAllocated = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const unallocatedRemaining = Math.max(0, (Number(totalAmount) || 0) - totalAllocated);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setWarningMessage(null);
    const parsedTotal = Number(totalAmount) || 0;
    if (parsedTotal <= 0) {
      setWarningMessage('Payment amount must be greater than zero.');
      return;
    }

    if (totalAllocated > parsedTotal) {
      setWarningMessage(`Total allocated ($${totalAllocated}) exceeds payment total ($${parsedTotal}).`);
      return;
    }

    try {
      await api.createPayment({
        customerId,
        paymentDate,
        reference: reference || undefined,
        totalAmount: parsedTotal,
        allocations: allocations.filter(a => a.amount > 0)
      });
      setShowModal(false);
      setReference('');
      setTotalAmount('');
      setAllocations([]);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{t('payments.title')}</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {t('payments.subtitle')}
          </p>
        </div>
        <button
          onClick={() => {
            setReference(`WIRE-${Math.floor(100000 + Math.random() * 900000)}`);
            setShowModal(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-950 transition w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" /> {t('payments.recordPayment')}
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className={`w-4 h-4 text-slate-500 absolute top-3.5 ${isRtl ? 'right-3' : 'left-3'}`} />
        <input
          type="text"
          placeholder={t('payments.searchPlaceholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`w-full bg-slate-900 border border-slate-800 rounded-lg py-2.5 min-h-[44px] text-xs text-white focus:outline-none focus:border-emerald-500 ${
            isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
          }`}
        />
      </div>

      {/* MOBILE CARD VIEW (< 640px) */}
      <div className="block sm:hidden space-y-3">
        {loading ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            {t('common.loading')}
          </div>
        ) : payments.length > 0 ? (
          payments.map(p => (
            <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                    <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />
                    <span dir="ltr" className="font-mono">{p.reference || 'N/A'}</span>
                  </div>
                  <span dir="ltr" className="text-[11px] text-slate-400 font-mono block mt-0.5">
                    {new Date(p.paymentDate).toLocaleDateString()} • {p.paymentMethod}
                  </span>
                </div>
                <div className="text-right rtl:text-left">
                  <span dir="ltr" className="font-mono font-extrabold text-emerald-400 text-sm block">
                    ${Number(p.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  {Number(p.unallocatedAmount) > 0 && (
                    <span dir="ltr" className="text-[10px] text-amber-400 font-mono block mt-0.5">
                      Unallocated: ${Number(p.unallocatedAmount).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-xs text-slate-200 border-t border-slate-800/80 pt-2 font-medium">
                {p.customer?.companyName || 'Unknown Customer'}
              </div>

              {p.allocations && p.allocations.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-1">
                  {p.allocations.map((a: any) => (
                    <span key={a.id} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-emerald-400" dir="ltr">
                      {a.invoice?.invoiceNumber} (${Number(a.amount).toLocaleString()})
                    </span>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-slate-800/80">
                <button
                  onClick={() => {
                    const token = getAuthToken();
                    fetch(`/api/receipts?search=${p.reference || p.id}`, {
                      headers: { Authorization: `Bearer ${token}` }
                    })
                    .then(r => r.json())
                    .then(data => {
                      if (data && data.length > 0) setSelectedReceiptModal(data[0]);
                      else alert('Receipt being generated. Please check Deposit Receipts tab.');
                    })
                    .catch(() => alert('Failed to load receipt'));
                  }}
                  className="w-full py-2 min-h-[40px] bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition"
                >
                  📄 View Official Deposit Receipt
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs">
            {t('payments.emptyState')}
          </div>
        )}
      </div>

      {/* DESKTOP TABLE VIEW (>= 640px) */}
      <div className="hidden sm:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('payments.paymentDate')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('ledger.reference')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('invoices.buyerConsignee')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('payments.paymentMethod')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t('common.total')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t('payments.allocated')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t('payments.unallocated')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>Linked Invoices</th>
                <th className="py-3 px-4 text-center">{t('nav.receipts')}</th>
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
              ) : payments.length > 0 ? (
                payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition">
                    <td className={`py-3 px-4 text-slate-400 ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                      {new Date(p.paymentDate).toLocaleDateString()}
                    </td>
                    <td className={`py-3 px-4 font-bold text-white flex items-center gap-1.5 ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                      <CreditCard className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      {p.reference || 'N/A'}
                    </td>
                    <td className={`py-3 px-4 font-sans text-slate-200 ${isRtl ? 'text-right' : 'text-left'}`}>
                      {p.customer?.companyName || 'Unknown'}
                    </td>
                    <td className={`py-3 px-4 font-sans text-[11px] text-slate-400 ${isRtl ? 'text-right' : 'text-left'}`}>
                      {p.paymentMethod}
                    </td>
                    <td className={`py-3 px-4 font-bold text-emerald-400 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      ${Number(p.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`py-3 px-4 text-slate-300 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      ${Number(p.allocatedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`py-3 px-4 font-semibold text-amber-400 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      ${Number(p.unallocatedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className={`py-3 px-4 font-sans ${isRtl ? 'text-right' : 'text-left'}`}>
                      <div className="flex flex-wrap gap-1">
                        {p.allocations && p.allocations.length > 0 ? (
                          p.allocations.map((a: any) => (
                            <span key={a.id} className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-emerald-400" dir="ltr">
                              {a.invoice?.invoiceNumber} (${Number(a.amount).toLocaleString()})
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 text-[11px]">{t('payments.unallocated')}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <button
                        onClick={() => {
                          const token = getAuthToken();
                          fetch(`/api/receipts?search=${p.reference || p.id}`, {
                            headers: { Authorization: `Bearer ${token}` }
                          })
                          .then(r => r.json())
                          .then(data => {
                            if (data && data.length > 0) setSelectedReceiptModal(data[0]);
                            else alert('Receipt being generated. Please check Deposit Receipts tab.');
                          })
                          .catch(() => alert('Failed to load receipt'));
                        }}
                        className="px-2.5 py-1 min-h-[30px] bg-slate-800 hover:bg-slate-700 text-sky-400 border border-slate-700 rounded text-xs transition"
                      >
                        📄 Receipt
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-500 font-sans">
                    {t('payments.emptyState')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RECORD PAYMENT MODAL (Mobile-responsive) */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-400" /> {t('payments.recordPayment')}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {warningMessage && (
              <div className="mt-3 p-3 bg-amber-950/60 border border-amber-800 rounded-lg text-xs text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{warningMessage}</span>
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t('invoices.customerLabel')}</label>
                  <select
                    value={customerId}
                    onChange={e => {
                      setCustomerId(e.target.value);
                      setAllocations([]);
                    }}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t('payments.paymentDate')}</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t('ledger.reference')}</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="e.g. WIRE-849102"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t('common.total')} (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={totalAmount}
                    onChange={e => setTotalAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Invoices Allocation Section */}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Split className="w-3.5 h-3.5 text-blue-400" /> Allocate to Invoices
                  </span>
                  <span className="text-xs text-slate-400">
                    Remaining: <span className="font-mono text-emerald-400 font-bold" dir="ltr">${unallocatedRemaining.toLocaleString()}</span>
                  </span>
                </div>

                {customerInvoices.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {customerInvoices.map(inv => {
                      const alloc = allocations.find(a => a.invoiceId === inv.id);
                      const isAllocated = !!alloc;
                      return (
                        <div key={inv.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between text-xs">
                          <div>
                            <span className="font-mono font-bold text-white block" dir="ltr">{inv.invoiceNumber}</span>
                            <span className="text-[11px] text-slate-400 block" dir="ltr">
                              Total: ${Number(inv.totalAmount).toLocaleString()} • {inv.paymentStatus}
                            </span>
                          </div>

                          {isAllocated ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                max={Number(inv.totalAmount)}
                                value={alloc.amount}
                                onChange={e => handleUpdateAllocationAmount(inv.id, Number(e.target.value) || 0)}
                                className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono text-right"
                                dir="ltr"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveAllocation(inv.id)}
                                className="text-slate-500 hover:text-rose-400 p-1"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddAllocation(inv.id, Number(inv.totalAmount))}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-xs font-medium"
                            >
                              + Allocate
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No unpaid invoices pending for this customer.</p>
                )}

                {/* Balance summary */}
                <div className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded flex justify-between text-xs">
                  <div>
                    <span className="text-slate-400 block">Total Allocated:</span>
                    <span className="font-mono font-bold text-white" dir="ltr">${totalAllocated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="text-right rtl:text-left">
                    <span className="text-slate-400 block">Unallocated:</span>
                    <span className="font-mono font-bold text-amber-400" dir="ltr">${unallocatedRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 min-h-[44px] bg-slate-800 text-slate-300 rounded text-xs"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                >
                  {t('payments.recordPayment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OFFICIAL AUTOMATIC RECEIPT MODAL */}
      {selectedReceiptModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
          <div className="printable-document bg-white text-slate-900 rounded-xl w-full max-w-xl p-5 sm:p-7 shadow-2xl font-sans my-auto max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 mb-4 border-b border-slate-200 print:hidden">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" /> Automatic Deposit Receipt Generated
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center gap-1"
                >
                  {t('common.print', 'Print / Save PDF')}
                </button>
                <button
                  onClick={() => setSelectedReceiptModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content */}
            <div className="space-y-4">
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-14 w-32 sm:w-36 flex items-center justify-start shrink-0">
                    <img src="/sky-ariana-logo.png" alt="Sky Ariana Ltd. Official Logo" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base leading-tight">SKY ARIANA LTD.</h3>
                    <p className="text-[11px] text-slate-500 font-semibold uppercase">Corporate Treasury & Settlement</p>
                  </div>
                </div>
                <div className="text-right rtl:text-left">
                  <span className="text-sm font-bold text-emerald-800 uppercase block">DEPOSIT RECEIPT</span>
                  <span dir="ltr" className="font-mono font-bold text-xs text-slate-900 block">{selectedReceiptModal.receiptNumber}</span>
                  <span dir="ltr" className="text-[10px] text-slate-500 block">{new Date(selectedReceiptModal.issueDate || Date.now()).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2.5 text-xs">
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500 font-semibold">{t('receipts.payer')}:</span>
                  <span className="font-bold text-slate-900">{selectedReceiptModal.payerName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500 font-semibold">{t('receipts.amount')}:</span>
                  <span dir="ltr" className="font-mono font-extrabold text-base text-emerald-700">
                    ${Number(selectedReceiptModal.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                  </span>
                </div>
                <div className="border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500 font-semibold block mb-0.5">{t('receipts.amountInWords')}:</span>
                  <span className="italic text-slate-800 font-medium">"{selectedReceiptModal.amountInWords || 'Amount in words'}"</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-slate-500 font-semibold">{t('receipts.receivingAccount')}:</span>
                  <span dir="ltr" className="font-mono text-slate-800">{selectedReceiptModal.receivingAccountMasked || '101502******0472'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold block mb-0.5">{t('receipts.purpose')}:</span>
                  <span className="text-slate-800">{selectedReceiptModal.purpose}</span>
                </div>
              </div>

              <div className="pt-2 text-right rtl:text-left">
                <div className="border-b border-slate-300 w-40 ml-auto rtl:mr-auto rtl:ml-0 mb-1"></div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Authorized Financial Officer</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
