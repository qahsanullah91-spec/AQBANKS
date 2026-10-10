import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { LedgerTransaction } from '../types';
import { useLanguage } from '../context/LanguageContext';
import {
  DollarSign,
  Plus,
  RotateCcw,
  Download,
  Search,
  X,
  ShieldCheck
} from 'lucide-react';

export const Ledger: React.FC = () => {
  const { t, isRtl } = useLanguage();
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
    const rows = transactions.map(item => [
      new Date(item.effectiveDate).toLocaleDateString(),
      item.reference || '',
      `"${item.description.replace(/"/g, '""')}"`,
      item.category,
      item.debitAmount,
      item.creditAmount,
      item.runningBalance,
      item.reconciliationStatus
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
    <div className="space-y-4 sm:space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{t('ledger.title')}</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            {t('ledger.subtitle')}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={exportCsv}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 min-h-[44px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" /> {t('common.export', 'Export CSV')}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-950 transition"
          >
            <Plus className="w-4 h-4" /> {t('ledger.newEntry')}
          </button>
        </div>
      </div>

      {/* Balance Verification Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 sm:p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] sm:text-xs text-slate-400 uppercase font-semibold block">{t('ledger.balance', 'Opening Baseline Balance')}</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-white mt-1" dir="ltr">
            ${Number(openingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Prior period baseline</p>
        </div>

        <div className="p-3 sm:p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] sm:text-xs text-slate-400 uppercase font-semibold block">Verified Cash Balance</span>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-400 mt-1" dir="ltr">
            ${Number(currentEndingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-emerald-500 flex items-center gap-1 mt-0.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Opening + Credits - Debits
          </p>
        </div>

        <div className="p-3 sm:p-4 bg-slate-900 border border-slate-800 rounded-xl">
          <span className="text-[10px] sm:text-xs text-slate-400 uppercase font-semibold block">Reconciliation Policy</span>
          <div className="text-xs text-slate-300 font-medium mt-1">
            Deterministic: <code className="text-emerald-400" dir="ltr">Date → Posted → ID</code>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Row-offset formula bug corrected server-side.</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className={`w-4 h-4 text-slate-500 absolute top-3.5 ${isRtl ? 'right-3' : 'left-3'}`} />
          <input
            type="text"
            placeholder={t('ledger.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`w-full bg-slate-900 border border-slate-800 rounded-lg py-2.5 min-h-[44px] text-xs text-white focus:outline-none focus:border-emerald-500 ${
              isRtl ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'
            }`}
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2.5 min-h-[44px] text-xs text-slate-300 focus:outline-none"
        >
          <option value="">{t('ledger.allCategories')}</option>
          <option value="CREDIT">{t('ledger.credit')}</option>
          <option value="DEBIT">{t('ledger.debit')}</option>
          <option value="BALANCE">{t('ledger.balance')}</option>
        </select>
      </div>

      {/* MOBILE CARD VIEW (< 640px) */}
      <div className="block sm:hidden space-y-3">
        {loading ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            {t('common.loading')}
          </div>
        ) : transactions.length > 0 ? (
          transactions.map(tx => (
            <div key={tx.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md space-y-2.5">
              <div className="flex justify-between items-start">
                <div>
                  <span dir="ltr" className="text-[11px] text-slate-400 font-mono">
                    {new Date(tx.effectiveDate).toLocaleDateString()}
                  </span>
                  {tx.reference && (
                    <span dir="ltr" className="text-[11px] text-slate-300 font-mono block font-semibold">
                      Ref: {tx.reference}
                    </span>
                  )}
                </div>
                <div className="text-right rtl:text-left">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    tx.category === 'CREDIT' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                    tx.category === 'DEBIT' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                    'bg-slate-800 text-slate-300'
                  }`}>
                    {tx.category}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-200 font-medium">
                {tx.description}
                {tx.isReversal && (
                  <span className="mx-2 px-1.5 py-0.2 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800 font-mono">
                    {t('ledger.reversal', 'REVERSAL')}
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-800/80 font-mono text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans">Amount:</span>
                  <span dir="ltr">
                    {Number(tx.creditAmount) > 0 ? (
                      <span className="text-emerald-400 font-bold">+${Number(tx.creditAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    ) : Number(tx.debitAmount) > 0 ? (
                      <span className="text-rose-400 font-bold">-${Number(tx.debitAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    ) : (
                      <span className="text-slate-400">$0.00</span>
                    )}
                  </span>
                </div>
                <div className="text-right rtl:text-left">
                  <span className="text-slate-500 block text-[10px] font-sans">{t('ledger.runningBalance')}:</span>
                  <span dir="ltr" className="text-white font-extrabold text-sm">
                    ${Number(tx.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {!tx.isReversal && (
                <div className="pt-2 border-t border-slate-800/80 flex justify-end rtl:justify-start">
                  <button
                    onClick={() => setReversalTx(tx)}
                    className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] text-xs text-slate-400 hover:text-rose-400 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> {t('ledger.reverseAction')}
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs">
            {t('ledger.emptyState')}
          </div>
        )}
      </div>

      {/* DESKTOP TABLE VIEW (>= 640px) */}
      <div className="hidden sm:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('ledger.effectiveDate')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('ledger.reference')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('ledger.description')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-right' : 'text-left'}`}>{t('ledger.category')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t('ledger.debit')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t('ledger.credit')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t('ledger.runningBalance')}</th>
                <th className="py-3 px-4 text-center">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-400 font-sans">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    {t('common.loading')}
                  </td>
                </tr>
              ) : transactions.length > 0 ? (
                transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    <td className={`py-3 px-4 text-slate-400 ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                      {new Date(tx.effectiveDate).toLocaleDateString()}
                    </td>
                    <td className={`py-3 px-4 text-slate-300 font-semibold ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                      {tx.reference || '-'}
                    </td>
                    <td className={`py-3 px-4 font-sans text-slate-200 ${isRtl ? 'text-right' : 'text-left'}`}>
                      {tx.description}
                      {tx.isReversal && (
                        <span className="mx-2 px-1.5 py-0.5 rounded text-[10px] bg-rose-950 text-rose-300 border border-rose-800 font-mono">
                          {t('ledger.reversal', 'REVERSAL')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold uppercase ${
                        tx.category === 'CREDIT' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                        tx.category === 'DEBIT' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {tx.category}
                      </span>
                    </td>
                    <td className={`py-3 px-4 text-rose-400 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      {Number(tx.debitAmount) > 0 ? `$${Number(tx.debitAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className={`py-3 px-4 text-emerald-400 ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      {Number(tx.creditAmount) > 0 ? `$${Number(tx.creditAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className={`py-3 px-4 font-bold text-white ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      ${Number(tx.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      {!tx.isReversal ? (
                        <button
                          onClick={() => setReversalTx(tx)}
                          title={t('ledger.reverseAction')}
                          className="p-2 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition mx-auto"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-slate-600 text-xs">-</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-slate-500 font-sans">
                    {t('ledger.emptyState')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE ENTRY MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-5 shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" /> {t('ledger.newEntry')}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEntry} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t('ledger.effectiveDate')}</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={e => setEffectiveDate(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 min-h-[44px] text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t('ledger.category')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCategory('CREDIT')}
                    className={`py-2.5 min-h-[44px] text-xs font-semibold rounded border ${
                      category === 'CREDIT' ? 'bg-emerald-950 text-emerald-300 border-emerald-600' : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    + {t('ledger.credit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('DEBIT')}
                    className={`py-2.5 min-h-[44px] text-xs font-semibold rounded border ${
                      category === 'DEBIT' ? 'bg-rose-950 text-rose-300 border-rose-600' : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    - {t('ledger.debit')}
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
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 min-h-[44px] text-xs text-white font-mono"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t('ledger.reference')}</label>
                <input
                  type="text"
                  value={reference}
                  onChange={e => setReference(e.target.value)}
                  placeholder="e.g. 0464AIR261771143"
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 min-h-[44px] text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t('ledger.description')}</label>
                <input
                  type="text"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="e.g. Inward Wire Transfer from Consignee"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 min-h-[44px] text-xs text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-2 min-h-[44px] bg-slate-800 text-slate-300 rounded text-xs"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVERSAL MODAL */}
      {reversalTx && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 text-rose-400">
              <RotateCcw className="w-5 h-5 text-rose-400" /> {t('ledger.reverseAction')}
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              Posted entries cannot be mutated. Posting a reversal creates a linked opposite adjustment entry.
            </p>
            <div className="mt-3 p-2.5 bg-slate-950 border border-slate-800 rounded text-xs">
              <span className="text-slate-500 block">Target Transaction:</span>
              <span className="text-white font-medium">{reversalTx.description}</span>
              <div className="mt-1 font-mono text-slate-300" dir="ltr">
                Debit: ${reversalTx.debitAmount} | Credit: ${reversalTx.creditAmount}
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-300 mb-1">{t('common.notes')}</label>
              <textarea
                value={reversalReason}
                onChange={e => setReversalReason(e.target.value)}
                placeholder="e.g. Bank correction, duplicate entry reversed..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-800 rounded p-2.5 text-xs text-white"
              />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setReversalTx(null)}
                className="px-3 py-2 min-h-[44px] bg-slate-800 text-slate-300 rounded text-xs"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handlePostReversal}
                disabled={!reversalReason.trim()}
                className="px-3 py-2 min-h-[44px] bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold disabled:opacity-50"
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
