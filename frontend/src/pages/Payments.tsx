import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Payment, Customer, Invoice } from '../types';
import {
  CreditCard,
  Plus,
  Search,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  X,
  Split
} from 'lucide-react';

export const Payments: React.FC = () => {
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
    if (allocations.some(a => a.invoiceId === invId)) return;
    setAllocations([...allocations, { invoiceId: invId, amount: maxAmount }]);
  };

  const handleUpdateAllocation = (invId: string, amt: number) => {
    setAllocations(allocations.map(a => a.invoiceId === invId ? { ...a, amount: amt } : a));
  };

  const handleRemoveAllocation = (invId: string) => {
    setAllocations(allocations.filter(a => a.invoiceId !== invId));
  };

  const totalAllocated = allocations.reduce((sum, a) => sum + (Number(a.amount) || 0), 0);
  const unallocatedRemaining = Math.max(0, (Number(totalAmount) || 0) - totalAllocated);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setWarningMessage(null);
    try {
      const res = await api.createPayment({
        customerId,
        paymentDate,
        reference: reference || undefined,
        totalAmount: Number(totalAmount),
        allocations: allocations.map(a => ({ invoiceId: a.invoiceId, amount: Number(a.amount) }))
      });
      if (res.duplicateWarning) {
        setWarningMessage(res.duplicateWarning);
      } else {
        setShowModal(false);
        setReference('');
        setTotalAmount('');
        setAllocations([]);
        loadData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Payments & Invoice Allocations</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Record customer inward transfers, allocate funds across proforma invoices, and track unallocated cash
          </p>
        </div>
        <button
          onClick={() => {
            setReference(`WIRE-${Math.floor(100000 + Math.random() * 900000)}`);
            setShowModal(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-950 transition w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" /> Record Payment
        </button>
      </div>

      {/* MOBILE CARD VIEW (< 640px) */}
      <div className="block sm:hidden space-y-3">
        {payments.length > 0 ? (
          payments.map(p => (
            <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-1.5 font-bold text-white text-sm">
                    <CreditCard className="w-4 h-4 text-blue-400" />
                    <span>{p.reference || 'N/A'}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono block mt-0.5">
                    {new Date(p.paymentDate).toLocaleDateString()} • {p.paymentMethod}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-extrabold text-emerald-400 text-sm block">
                    ${Number(p.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  {Number(p.unallocatedAmount) > 0 && (
                    <span className="text-[10px] text-amber-400 font-mono block mt-0.5">
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
                    <span key={a.id} className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-emerald-400">
                      {a.invoice?.invoiceNumber} (${Number(a.amount).toLocaleString()})
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-slate-500 text-xs">
            {loading ? 'Loading payment records...' : 'No payments recorded yet.'}
          </div>
        )}
      </div>

      {/* DESKTOP TABLE VIEW (>= 640px) */}
      <div className="hidden sm:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Payment Ref</th>
                <th className="py-3 px-4">Buyer / Consignee</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-right">Allocated</th>
                <th className="py-3 px-4 text-right">Unallocated</th>
                <th className="py-3 px-4">Linked Invoices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {payments.length > 0 ? (
                payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(p.paymentDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                      {p.reference || 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-200">
                      {p.customer?.companyName || 'Unknown'}
                    </td>
                    <td className="py-3 px-4 font-sans text-[11px] text-slate-400">
                      {p.paymentMethod}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400">
                      ${Number(p.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-300">
                      ${Number(p.allocatedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-amber-400">
                      ${Number(p.unallocatedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 font-sans">
                      <div className="flex flex-wrap gap-1">
                        {p.allocations && p.allocations.length > 0 ? (
                          p.allocations.map((a: any) => (
                            <span key={a.id} className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-emerald-400">
                              {a.invoice?.invoiceNumber} (${Number(a.amount).toLocaleString()})
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 text-[11px]">Unallocated deposit</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500 font-sans">
                    {loading ? 'Loading payment records...' : 'No payments recorded yet. Click Record Payment.'}
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
                <CreditCard className="w-5 h-5 text-emerald-400" /> Record Inward Payment & Allocation
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

            <form onSubmit={handleRecordPayment} className="mt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Buyer / Consignee</label>
                  <select
                    value={customerId}
                    onChange={e => {
                      setCustomerId(e.target.value);
                      setAllocations([]);
                    }}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 min-h-[44px] text-xs text-white"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 min-h-[44px] text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Payment Reference</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={e => setReference(e.target.value)}
                    placeholder="e.g. 0464AIR261771143"
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 min-h-[44px] text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Total Amount (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={totalAmount}
                    onChange={e => setTotalAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 min-h-[44px] text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* Invoice Allocation Section */}
              <div className="pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block mb-1">
                  Allocate to Customer's Open Invoices
                </span>

                {customerInvoices.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {customerInvoices.map(inv => {
                      const isAllocated = allocations.some(a => a.invoiceId === inv.id);
                      const currentAlloc = allocations.find(a => a.invoiceId === inv.id)?.amount || 0;
                      return (
                        <div key={inv.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded flex justify-between items-center text-xs">
                          <div>
                            <span className="font-semibold text-white">{inv.invoiceNumber}</span>
                            <span className="text-slate-400 text-[11px] ml-2">Total: ${Number(inv.totalAmount).toLocaleString()}</span>
                          </div>
                          {isAllocated ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.01"
                                value={currentAlloc}
                                onChange={e => handleUpdateAllocation(inv.id, Number(e.target.value))}
                                className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono min-h-[36px]"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveAllocation(inv.id)}
                                className="text-slate-500 hover:text-rose-400 p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddAllocation(inv.id, Number(inv.totalAmount))}
                              className="px-3 py-2 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded text-xs font-medium"
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
                    <span className="font-mono font-bold text-white">${totalAllocated.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block">Unallocated:</span>
                    <span className="font-mono font-bold text-amber-400">${unallocatedRemaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 min-h-[44px] bg-slate-800 text-slate-300 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
