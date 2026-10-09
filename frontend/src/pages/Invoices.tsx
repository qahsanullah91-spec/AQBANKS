import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { Invoice, Customer, InvoiceLine } from '../types';
import {
  FileText,
  Plus,
  Printer,
  Ban,
  CheckCircle,
  Clock,
  Search,
  Filter,
  DollarSign,
  AlertTriangle,
  X,
  Lock
} from 'lucide-react';

export const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewInvoice, setPreviewInvoice] = useState<any | null>(null);
  const [voidInvoiceId, setVoidInvoiceId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // New Invoice Form State
  const [customerId, setCustomerId] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState('100% Advance Payment');
  const [lines, setLines] = useState<InvoiceLine[]>([
    { lineNumber: 1, description: 'Black Raisins (Best) - 1,385 CTNS', quantity: 22160, unitOfMeasure: 'KG', unitPrice: 3.58, lineTotal: 79332.80 }
  ]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [invRes, custRes] = await Promise.all([
        api.getInvoices({ search, status: statusFilter || undefined }),
        api.getCustomers()
      ]);
      setInvoices(invRes);
      setCustomers(custRes);
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
  }, [search, statusFilter]);

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
    try {
      await api.createInvoice({
        customerId,
        issueDate,
        paymentTerms,
        lines: lines.map(l => ({
          description: l.description,
          quantity: Number(l.quantity),
          unitOfMeasure: l.unitOfMeasure,
          unitPrice: Number(l.unitPrice)
        }))
      });
      setShowCreateModal(false);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create invoice');
    }
  };

  const handleIssue = async (id: string) => {
    if (!confirm('Issuing this invoice will freeze line items and banking details permanently. Proceed?')) return;
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
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Proforma Invoices & Receivables</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Issued commercial proforma invoices, immutable legal snapshots & customer balances
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-950 transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Create Proforma Invoice
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by invoice number, proforma ref, or customer name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
        >
          <option value="">All Lifecycle Statuses</option>
          <option value="DRAFT">Draft Only</option>
          <option value="ISSUED">Issued Only</option>
          <option value="VOID">Voided</option>
        </select>
      </div>

      {/* Invoices Register Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Invoice No</th>
                <th className="py-3 px-4">Source Ref</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Buyer / Consignee</th>
                <th className="py-3 px-4">Lifecycle</th>
                <th className="py-3 px-4">Payment</th>
                <th className="py-3 px-4 text-right">Total (USD)</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {invoices.length > 0 ? (
                invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-bold text-white flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" />
                      {inv.invoiceNumber}
                    </td>
                    <td className="py-3 px-4 text-amber-300 font-semibold">
                      {inv.sourceInvoiceRef || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(inv.issueDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-200">
                      {inv.customer?.companyName || 'Unknown Customer'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                        inv.status === 'ISSUED' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                        inv.status === 'VOID' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                        inv.paymentStatus === 'PAID' ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                        inv.paymentStatus === 'PARTIALLY_PAID' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                        'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-400">
                      ${Number(inv.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenPrintPreview(inv.id)}
                          title="Print / View Invoice Layout"
                          className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {inv.status === 'DRAFT' && (
                          <button
                            onClick={() => handleIssue(inv.id)}
                            title="Issue & Freeze Invoice"
                            className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950 rounded transition"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        {inv.status !== 'VOID' && (
                          <button
                            onClick={() => setVoidInvoiceId(inv.id)}
                            title="Void Invoice"
                            className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-950 rounded transition"
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
                  <td colSpan={8} className="text-center py-8 text-slate-500 font-sans">
                    {loading ? 'Loading proforma invoices...' : 'No proforma invoices found matching filters.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE INVOICE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-4 border-b border-slate-800">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" /> New Proforma Invoice
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDraft} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Buyer / Consignee</label>
                  <select
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.companyName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={e => setIssueDate(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              {/* Line Items Editor */}
              <div className="pt-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Line
                  </button>
                </div>

                <div className="space-y-3">
                  {lines.map((line, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 border border-slate-800 rounded-lg grid grid-cols-12 gap-2 items-center text-xs">
                      <div className="col-span-5">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Description</label>
                        <input
                          type="text"
                          value={line.description}
                          onChange={e => handleUpdateLine(idx, 'description', e.target.value)}
                          required
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Weight (KG)</label>
                        <input
                          type="number"
                          step="any"
                          value={line.quantity}
                          onChange={e => handleUpdateLine(idx, 'quantity', e.target.value)}
                          required
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Price (USD)</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={line.unitPrice}
                          onChange={e => handleUpdateLine(idx, 'unitPrice', e.target.value)}
                          required
                          className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div className="col-span-2 text-right">
                        <label className="text-[10px] text-slate-500 block mb-0.5">Total</label>
                        <span className="font-mono font-bold text-emerald-400">${Number(line.lineTotal).toLocaleString()}</span>
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-300">Server-Computed Grand Total:</span>
                  <span className="font-mono font-extrabold text-lg text-emerald-400">
                    ${calculateFormTotal().toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs"
                >
                  Save as Draft Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE / PREVIEW INVOICE MODAL (Matches Invoice Generator sheet) */}
      {previewInvoice && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white text-slate-900 rounded-xl w-full max-w-3xl max-h-[95vh] overflow-y-auto p-8 shadow-2xl font-sans">
            <div className="flex justify-between items-start pb-6 border-b border-slate-300">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{previewInvoice.company.legalName}</h1>
                <p className="text-xs text-slate-500 tracking-wider uppercase font-semibold">Brand: {previewInvoice.company.orgName}</p>
                <p className="text-xs text-slate-600 mt-1">{previewInvoice.company.email} | {previewInvoice.company.website}</p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold text-slate-900 uppercase tracking-wider">PROFORMA INVOICE</h2>
                <p className="text-xs font-mono font-bold text-emerald-700 mt-1">{previewInvoice.invoiceNumber}</p>
                {previewInvoice.sourceInvoiceRef && (
                  <p className="text-[11px] text-slate-500 font-mono">Workbook Ref: {previewInvoice.sourceInvoiceRef}</p>
                )}
                <p className="text-xs text-slate-600 mt-1">Date: {previewInvoice.issueDate}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6 my-6 text-xs">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h3 className="font-bold uppercase tracking-wider text-slate-700 mb-1">BILL TO / CONSIGNEE:</h3>
                <p className="font-semibold text-slate-900 text-sm">{previewInvoice.customer.companyName}</p>
                <p className="text-slate-600 mt-0.5">{previewInvoice.customer.addressLine1}</p>
                <p className="text-slate-600">{previewInvoice.customer.addressLine2}</p>
                <p className="text-slate-700 font-medium mt-1">{previewInvoice.customer.country}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h3 className="font-bold uppercase tracking-wider text-slate-700 mb-1">TERMS & SETTLEMENT:</h3>
                <p className="text-slate-700 mt-1">Payment Terms: <span className="font-semibold">{previewInvoice.paymentTerms}</span></p>
                <p className="text-slate-700 mt-1">Status: <span className="font-bold text-emerald-700">{previewInvoice.status}</span></p>
                <p className="text-slate-700 mt-1">Payment Status: <span className="font-bold text-blue-700">{previewInvoice.paymentStatus}</span></p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="my-6">
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3 border-b">Item Description</th>
                    <th className="py-2.5 px-3 border-b text-right">Net Wt</th>
                    <th className="py-2.5 px-3 border-b text-right">C&F Unit Price</th>
                    <th className="py-2.5 px-3 border-b text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {previewInvoice.lines.map((l: any, i: number) => (
                    <tr key={i}>
                      <td className="py-2.5 px-3 text-slate-900 font-medium">{l.description}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">{l.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-700">{l.unitPrice}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{l.lineTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end mt-3 text-sm">
                <div className="text-right">
                  <span className="text-xs uppercase text-slate-500 font-bold mr-4">GRAND TOTAL (USD):</span>
                  <span className="text-lg font-extrabold font-mono text-emerald-700">{previewInvoice.grandTotal}</span>
                </div>
              </div>
            </div>

            {/* Banking Details Snapshot */}
            {previewInvoice.bankingDetails && (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs mt-6">
                <h3 className="font-bold uppercase tracking-wider text-slate-700 mb-2">BANKING DETAILS FOR WIRE PAYMENT</h3>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>Bank Name: <span className="font-semibold text-slate-900">{previewInvoice.bankingDetails.bankName}</span></div>
                  <div>Beneficiary: <span className="font-semibold text-slate-900">{previewInvoice.bankingDetails.beneficiaryName}</span></div>
                  <div>Account No (USD): <span className="font-mono font-bold text-slate-900">{previewInvoice.bankingDetails.accountNumber}</span></div>
                  <div>SWIFT Code: <span className="font-mono font-semibold text-slate-900">{previewInvoice.bankingDetails.swiftCode}</span></div>
                  <div>Correspondent Bank: <span className="font-semibold text-slate-900">{previewInvoice.bankingDetails.correspondentBank}</span></div>
                  <div>Correspondent SWIFT: <span className="font-mono font-semibold text-slate-900">{previewInvoice.bankingDetails.correspondentSwift}</span></div>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center mt-8 pt-4 border-t border-slate-200">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-lg shadow"
              >
                Print / Save PDF
              </button>
              <button
                onClick={() => setPreviewInvoice(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VOID INVOICE MODAL */}
      {voidInvoiceId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5 text-rose-400" /> Void Proforma Invoice
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              Voiding an invoice marks it void permanently and cancels outstanding receivables. A mandatory audit reason is required.
            </p>
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-300 mb-1">Reason for Voiding</label>
              <textarea
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="e.g., Order cancelled by consignee, superseded by revised contract..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setVoidInvoiceId(null)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleVoid}
                disabled={!voidReason.trim()}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold disabled:opacity-50"
              >
                Confirm Void
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
