import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { LedgerTransaction } from '../types';
import {
  DollarSign,
  Plus,
  RotateCcw,
  Download,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  X,
  ShieldCheck
} from 'lucide-react';

export const Ledger: React.FC = () => {
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [openingBalance, setOpeningBalance] = useState('0.00');
  const [currentEndingBalance, setCurrentEndingBalance] = useState('0.00');
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reversalTx, setReversalTx] = useState<LedgerTransaction | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // Form State
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [amount, setAmount] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await api.getLedger({ category: categoryFilter || undefined, search });
      setTransactions(res.transactions);
      setOpeningBalance(res.openingBalance);
      setCurrentEndingBalance(res.currentEndingBalance);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [categoryFilter, search]);

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const numAmount = Number(amount) || 0;
      await api.postLedgerEntry({
        effectiveDate,
        reference: reference || undefined,
        description,
        category,
        debitAmount: category === 'DEBIT' ? numAmount : 0,
        creditAmount: category === 'CREDIT' ? numAmount : 0
      });
      setShowCreateModal(false);
      setReference('');
      setDescription('');
      setAmount('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to post ledger entry');
    }
  };

  const handlePostReversal = async () => {
    if (!reversalTx || !reversalReason) return;
    try {
      await api.reverseLedgerEntry(reversalTx.id, reversalReason);
      setReversalTx(null);
      setReversalReason('');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to reverse transaction');
    }
  };

  const exportCsv = () => {
    const headers = ['Date', 'Reference', 'Description', 'Category', 'Debit', 'Credit', 'Running Balance', 'Reconciliation Status'];
    const rows = transactions.map(t => [
      new Date(t.effectiveDate).toLocaleDateString(),
      t.reference || '',
      `"${t.description.replace(/"/g, '""')}"`,
      t.category,
      t.debitAmount,
      t.creditAmount,
      t.runningBalance,
      t.reconciliationStatus
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Account_Statement_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Financial Ledger & Account Statement</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Afghan United Bank USD Operating Statement with deterministic cumulative balance calculations
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-950 transition"
          >
            <Plus className="w-4 h-4" /> Post Entry
          </button>
        </div>
      </div>

      {/* Balance Verification Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-xs text-slate-400 uppercase font-semibold block">Opening Baseline Balance</span>
          <div className="text-xl font-bold font-mono text-white mt-1">
            ${Number(openingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Prior period baseline</p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-xs text-slate-400 uppercase font-semibold block">Current Verified Cash Balance</span>
          <div className="text-2xl font-extrabold font-mono text-emerald-400 mt-1">
            ${Number(currentEndingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-emerald-500 flex items-center gap-1 mt-0.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Opening + Credits - Debits
          </p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-xs text-slate-400 uppercase font-semibold block">Reconciliation Policy</span>
          <div className="text-xs text-slate-300 font-medium mt-2">
            Deterministic order tie-breaker: <code className="text-emerald-400">Date → PostedAt → UUID</code>.
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Row-offset formula bug corrected server-side.</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by description or transaction reference..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none"
        >
          <option value="">All Categories</option>
          <option value="CREDIT">Credits Only (Inward)</option>
          <option value="DEBIT">Debits Only (Outward)</option>
          <option value="BALANCE">Starting Balance</option>
        </select>
      </div>

      {/* Statement Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Effective Date</th>
                <th className="py-3 px-4">Transaction ID / Ref</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Debit (USD)</th>
                <th className="py-3 px-4 text-right">Credit (USD)</th>
                <th className="py-3 px-4 text-right">Running Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {transactions.length > 0 ? (
                transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(tx.effectiveDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-300">
                      {tx.reference || 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-200">
                      {tx.description}
                      {tx.isReversal && (
                        <span className="ml-2 px-1.5 py-0.2 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800">
                          REVERSAL
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-sans font-semibold ${
                        tx.category === 'CREDIT' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                        tx.category === 'DEBIT' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {tx.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-rose-400 font-semibold">
                      {Number(tx.debitAmount) > 0 ? `$${Number(tx.debitAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-semibold">
                      {Number(tx.creditAmount) > 0 ? `$${Number(tx.creditAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-white text-sm">
                      ${Number(tx.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        tx.reconciliationStatus === 'RECONCILED' ? 'text-emerald-400' : 'text-slate-500'
                      }`}>
                        {tx.reconciliationStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      {!tx.isReversal && (
                        <button
                          onClick={() => setReversalTx(tx)}
                          title="Post Reversal Adjustment"
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-500 font-sans">
                    {loading ? 'Calculating balances...' : 'No ledger transactions match criteria.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POST ENTRY MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> Post Ledger Transaction
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEntry} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Effective Date</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={e => setEffectiveDate(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category & Direction</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCategory('CREDIT')}
                    className={`py-2 text-xs font-semibold rounded border ${
                      category === 'CREDIT' ? 'bg-emerald-950 text-emerald-300 border-emerald-600' : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    + Credit (Inward)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('DEBIT')}
                    className={`py-2 text-xs font-semibold rounded border ${
                      category === 'DEBIT' ? 'bg-rose-950 text-rose-300 border-rose-600' : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    - Debit (Outward)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Amount (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Reference / Transaction ID</label>
                <input
                  type="text"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder="e.g. 0464AIR261771143"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Inward Wire Transfer from Consignee"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                >
                  Post Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVERSAL MODAL */}
      {reversalTx && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 text-rose-400">
              <RotateCcw className="w-5 h-5 text-rose-400" /> Post Reversing Entry
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              Posted ledger entries cannot be mutated or deleted. Posting a reversal creates a linked opposite adjustment entry.
            </p>
            <div className="mt-3 p-2.5 bg-slate-950 border border-slate-800 rounded text-xs">
              <span className="text-slate-500 block">Target Transaction:</span>
              <span className="text-white font-medium">{reversalTx.description}</span>
              <div className="mt-1 font-mono text-slate-300">
                Debit: ${reversalTx.debitAmount} | Credit: ${reversalTx.creditAmount}
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-300 mb-1">Reason for Reversal</label>
              <textarea
                value={reversalReason}
                onChange={e => setReversalReason(e.target.value)}
                placeholder="e.g. Bank correction, duplicate entry reversed..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setReversalTx(null)}
                className="px-3 py-1.5 bg-slate-800 text-slate-300 rounded text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handlePostReversal}
                disabled={!reversalReason.trim()}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold disabled:opacity-50"
              >
                Confirm Reversal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
