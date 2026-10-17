import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { LedgerTransaction, Invoice } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useAutoSave } from '../utils/useAutoSave';
import { AutoSaveIndicator, DraftRecoveryBanner } from '../components/AutoSaveIndicator';
import { formatDisplayDate, formatDateForInput } from '../utils/date';
import {
  DollarSign,
  Plus,
  RotateCcw,
  Download,
  Search,
  X,
  ShieldCheck,
  Edit,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  FileText,
  Printer
} from 'lucide-react';
import { LedgerPrintModal } from '../components/LedgerPrintModal';
import { LedgerReportModal } from '../components/LedgerReportModal';

export const Ledger: React.FC = () => {
  const { t, isRtl } = useLanguage();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [openingBalance, setOpeningBalance] = useState('0.00');
  const [currentEndingBalance, setCurrentEndingBalance] = useState('0.00');
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  // Modals
  const [showCashInModal, setShowCashInModal] = useState(false);
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [editingTx, setEditingTx] = useState<LedgerTransaction | null>(null);
  const [deletingTx, setDeletingTx] = useState<LedgerTransaction | null>(null);
  const [reversalTx, setReversalTx] = useState<LedgerTransaction | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [printConfig, setPrintConfig] = useState<{
    transactions: LedgerTransaction[];
    openingBalance: string | number;
    closingBalance: string | number;
    periodLabel?: string;
    totalCredits?: number;
    totalDebits?: number;
    creditCount?: number;
    debitCount?: number;
  } | null>(null);

  // Cash In Form State
  const [cashInDate, setCashInDate] = useState(new Date().toISOString().split('T')[0]);
  const [cashInAmount, setCashInAmount] = useState('');
  const [cashInSwiftFee, setCashInSwiftFee] = useState('');
  const [cashInPayer, setCashInPayer] = useState('');
  const [cashInDescription, setCashInDescription] = useState('');
  const [cashInReference, setCashInReference] = useState('');
  const [cashInInvoiceId, setCashInInvoiceId] = useState('');
  const [cashInNotes, setCashInNotes] = useState('');
  const [cashInCreateReceipt, setCashInCreateReceipt] = useState(true);

  // Cash Out Form State
  const [cashOutDate, setCashOutDate] = useState(new Date().toISOString().split('T')[0]);
  const [cashOutAmount, setCashOutAmount] = useState('');
  const [cashOutPayee, setCashOutPayee] = useState('');
  const [cashOutCategory, setCashOutCategory] = useState('OPERATING_EXPENSE');
  const [cashOutDescription, setCashOutDescription] = useState('');
  const [cashOutReference, setCashOutReference] = useState('');
  const [cashOutNotes, setCashOutNotes] = useState('');

  // Edit Form State
  const [editDate, setEditDate] = useState('');
  const [editReference, setEditReference] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<'CREDIT' | 'DEBIT' | 'BALANCE'>('CREDIT');
  const [editDebitAmount, setEditDebitAmount] = useState('0');
  const [editCreditAmount, setEditCreditAmount] = useState('0');
  const [editNotes, setEditNotes] = useState('');

  // Close open modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPrintModal) setShowPrintModal(false);
        else if (showReportModal) setShowReportModal(false);
        else if (showCashInModal) setShowCashInModal(false);
        else if (showCashOutModal) setShowCashOutModal(false);
        else if (editingTx) setEditingTx(null);
        else if (deletingTx) setDeletingTx(null);
        else if (reversalTx) setReversalTx(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPrintModal, showReportModal, showCashInModal, showCashOutModal, editingTx, deletingTx, reversalTx]);

  // Cash In Auto-Save
  const cashInDraftData = {
    cashInDate,
    cashInAmount,
    cashInSwiftFee,
    cashInPayer,
    cashInDescription,
    cashInReference,
    cashInInvoiceId,
    cashInNotes,
    cashInCreateReceipt
  };

  const cashInAutoSave = useAutoSave(
    'aq_draft_cash_in',
    cashInDraftData,
    800,
    showCashInModal
  );

  const handleRestoreCashInDraft = () => {
    const draft = cashInAutoSave.getSavedDraft();
    if (draft) {
      if (draft.cashInDate) setCashInDate(draft.cashInDate);
      if (draft.cashInAmount !== undefined) setCashInAmount(draft.cashInAmount);
      if (draft.cashInSwiftFee !== undefined) setCashInSwiftFee(draft.cashInSwiftFee);
      if (draft.cashInPayer !== undefined) setCashInPayer(draft.cashInPayer);
      if (draft.cashInDescription !== undefined) setCashInDescription(draft.cashInDescription);
      if (draft.cashInReference !== undefined) setCashInReference(draft.cashInReference);
      if (draft.cashInInvoiceId !== undefined) setCashInInvoiceId(draft.cashInInvoiceId);
      if (draft.cashInNotes !== undefined) setCashInNotes(draft.cashInNotes);
      if (draft.cashInCreateReceipt !== undefined) setCashInCreateReceipt(draft.cashInCreateReceipt);
      toast.info('Restored unsaved Cash In draft');
    }
  };

  const handleDiscardCashInDraft = () => {
    cashInAutoSave.discardDraft();
    setCashInAmount('');
    setCashInSwiftFee('');
    setCashInPayer('');
    setCashInDescription('');
    setCashInReference('');
    setCashInInvoiceId('');
    setCashInNotes('');
    toast.info('Cash In draft discarded');
  };

  // Cash Out Auto-Save
  const cashOutDraftData = {
    cashOutDate,
    cashOutAmount,
    cashOutPayee,
    cashOutCategory,
    cashOutDescription,
    cashOutReference,
    cashOutNotes
  };

  const cashOutAutoSave = useAutoSave(
    'aq_draft_cash_out',
    cashOutDraftData,
    800,
    showCashOutModal
  );

  const handleRestoreCashOutDraft = () => {
    const draft = cashOutAutoSave.getSavedDraft();
    if (draft) {
      if (draft.cashOutDate) setCashOutDate(draft.cashOutDate);
      if (draft.cashOutAmount !== undefined) setCashOutAmount(draft.cashOutAmount);
      if (draft.cashOutPayee !== undefined) setCashOutPayee(draft.cashOutPayee);
      if (draft.cashOutCategory !== undefined) setCashOutCategory(draft.cashOutCategory);
      if (draft.cashOutDescription !== undefined) setCashOutDescription(draft.cashOutDescription);
      if (draft.cashOutReference !== undefined) setCashOutReference(draft.cashOutReference);
      if (draft.cashOutNotes !== undefined) setCashOutNotes(draft.cashOutNotes);
      toast.info('Restored unsaved Cash Out draft');
    }
  };

  const handleDiscardCashOutDraft = () => {
    cashOutAutoSave.discardDraft();
    setCashOutAmount('');
    setCashOutPayee('');
    setCashOutDescription('');
    setCashOutReference('');
    setCashOutNotes('');
    toast.info('Cash Out draft discarded');
  };

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

  const loadInvoices = async () => {
    try {
      const invs = await api.getInvoices();
      setInvoices(invs);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, [categoryFilter, search]);

  useEffect(() => {
    loadInvoices();
  }, []);

  const handleSelectInvoiceForCashIn = (invId: string) => {
    setCashInInvoiceId(invId);
    if (!invId) return;
    const inv = invoices.find(i => i.id === invId);
    if (inv) {
      if (!cashInPayer) setCashInPayer(inv.customer?.companyName || '');
      if (!cashInAmount) {
        const remaining = inv.remainingBalance !== undefined ? inv.remainingBalance : inv.totalAmount;
        setCashInAmount(String(remaining));
      }
      if (!cashInDescription) {
        setCashInDescription(`Inward Wire for PI ${inv.invoiceNumber} - ${inv.customer?.companyName || ''}`);
      }
    }
  };

  const handleCashInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amount = Number(cashInAmount);
      if (!amount || amount <= 0) {
        toast.error('Please enter a valid positive amount');
        return;
      }
      await api.postCashIn({
        effectiveDate: cashInDate,
        amount,
        swiftFee: Number(cashInSwiftFee) || 0,
        payerName: cashInPayer || undefined,
        description: cashInDescription || `Inward Wire Payment`,
        reference: cashInReference || undefined,
        invoiceId: cashInInvoiceId || undefined,
        notes: cashInNotes || undefined,
        createReceipt: cashInCreateReceipt
      });
      cashInAutoSave.clearDraft();
      setShowCashInModal(false);
      setCashInAmount('');
      setCashInSwiftFee('');
      setCashInPayer('');
      setCashInDescription('');
      setCashInReference('');
      setCashInInvoiceId('');
      setCashInNotes('');
      toast.success('Cash In (+ Inward Wire) recorded successfully!');
      await loadData();
      await loadInvoices();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record cash in');
    }
  };

  const handleCashOutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amount = Number(cashOutAmount);
      if (!amount || amount <= 0) {
        toast.error('Please enter a valid positive amount');
        return;
      }
      await api.postCashOut({
        effectiveDate: cashOutDate,
        amount,
        payeeName: cashOutPayee || undefined,
        category: cashOutCategory,
        description: cashOutDescription || (cashOutPayee ? `Payment to ${cashOutPayee}` : 'Disbursement / Cash Out'),
        reference: cashOutReference || undefined,
        notes: cashOutNotes || undefined
      });
      cashOutAutoSave.clearDraft();
      setShowCashOutModal(false);
      setCashOutAmount('');
      setCashOutPayee('');
      setCashOutDescription('');
      setCashOutReference('');
      setCashOutNotes('');
      toast.success('Cash Out (- Expense) recorded successfully!');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record cash out');
    }
  };

  const handleOpenEdit = (tx: LedgerTransaction) => {
    setEditingTx(tx);
    setEditDate(formatDateForInput(tx.effectiveDate));
    setEditReference(tx.reference || '');
    setEditDescription(tx.description);
    setEditCategory(tx.category as any);
    setEditDebitAmount(String(tx.debitAmount || 0));
    setEditCreditAmount(String(tx.creditAmount || 0));
    setEditNotes(tx.notes || '');
  };

  const handleUpdateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;
    try {
      await api.updateLedgerEntry(editingTx.id, {
        effectiveDate: editDate,
        reference: editReference || null,
        description: editDescription,
        category: editCategory,
        debitAmount: Number(editDebitAmount) || 0,
        creditAmount: Number(editCreditAmount) || 0,
        notes: editNotes || null
      });
      setEditingTx(null);
      toast.success('Transaction updated successfully');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update transaction');
    }
  };

  const handleDeleteEntry = async () => {
    if (!deletingTx) return;
    try {
      await api.deleteLedgerEntry(deletingTx.id);
      setDeletingTx(null);
      toast.success('Transaction deleted successfully');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete transaction');
    }
  };

  const handlePostReversal = async () => {
    if (!reversalTx || !reversalReason) return;
    try {
      await api.reverseLedgerEntry(reversalTx.id, reversalReason);
      setReversalTx(null);
      setReversalReason('');
      toast.success('Reversal transaction posted successfully');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reverse transaction');
    }
  };

  const exportCsv = () => {
    const headers = ['Date', 'Reference', 'Description', 'Category', 'Debit', 'Credit', 'Running Balance', 'Reconciliation Status'];
    const rows = transactions.map(item => [
      formatDisplayDate(item.effectiveDate),
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

  // KPI Calculations
  const totalDebits = transactions.reduce((sum, t) => sum + (Number(t.debitAmount) || 0), 0);
  const totalCredits = transactions.reduce((sum, t) => sum + (Number(t.creditAmount) || 0), 0);
  const debitCount = transactions.filter(t => (Number(t.debitAmount) || 0) > 0).length;
  const creditCount = transactions.filter(t => (Number(t.creditAmount) || 0) > 0).length;

  const handleOpenPrintStatement = () => {
    setPrintConfig({
      transactions,
      openingBalance,
      closingBalance: currentEndingBalance,
      periodLabel: categoryFilter ? `Filtered View (${categoryFilter})` : 'All Chronological Transactions',
      totalCredits,
      totalDebits,
      creditCount,
      debitCount
    });
    setShowPrintModal(true);
  };

  const handleOpenReportModal = () => {
    setShowReportModal(true);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{t('ledger.title')}</h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
              AFGHAN UNITED BANK • 101502USD2940472
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Official chronological bank statement ledger with verified deterministic running balance.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleOpenPrintStatement}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-lg border border-slate-700 transition shadow-sm"
            title={t('ledger.print', 'Print Statement')}
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span>{t('ledger.print', 'Print Statement')}</span>
          </button>
          <button
            onClick={handleOpenReportModal}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold rounded-lg border border-slate-700 transition shadow-sm"
            title={t('ledger.report', 'Statement Report')}
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>{t('ledger.report', 'Statement Report')}</span>
          </button>
          <button
            onClick={exportCsv}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition"
          >
            <Download className="w-3.5 h-3.5" /> {t('common.export', 'Export CSV')}
          </button>
          <button
            onClick={() => setShowCashInModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-emerald-950 transition"
          >
            <ArrowDownLeft className="w-4 h-4 text-emerald-200" />
            <span>+ {t('ledger.cashIn', 'Cash In (Receive Money)')}</span>
          </button>
          <button
            onClick={() => setShowCashOutModal(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[40px] bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-rose-950 transition"
          >
            <ArrowUpRight className="w-4 h-4 text-rose-200" />
            <span>- {t('ledger.cashOut', 'Cash Out (Pay Expense)')}</span>
          </button>
        </div>
      </div>

      {/* 4 Liquid Glass KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Opening Baseline */}
        <div className="p-3 sm:p-4 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden">
          <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold block">{t('ledger.balance', 'Opening Baseline Balance')}</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-slate-900 dark:text-white mt-1" dir="ltr">
            ${Number(openingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Prior period baseline ($83.36)</p>
        </div>

        {/* 2. Total Cash In (Credits) */}
        <div className="p-3 sm:p-4 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden">
          <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold block">{t('ledger.credit', 'Total Cash In (Credits)')}</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1" dir="ltr">
            +${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-500 flex items-center gap-1 mt-0.5 font-medium">
            <ArrowDownLeft className="w-3.5 h-3.5" /> {creditCount} inward credit transactions
          </p>
        </div>

        {/* 3. Total Cash Out (Debits) */}
        <div className="p-3 sm:p-4 bg-slate-900 border border-slate-800 rounded-xl relative overflow-hidden">
          <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold block">{t('ledger.debit', 'Total Cash Out (Debits)')}</span>
          <div className="text-lg sm:text-xl font-bold font-mono text-rose-700 dark:text-rose-400 mt-1" dir="ltr">
            -${totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-rose-700 dark:text-rose-500 flex items-center gap-1 mt-0.5 font-medium">
            <ArrowUpRight className="w-3.5 h-3.5" /> {debitCount} outward disbursement entries
          </p>
        </div>

        {/* 4. Verified Available Balance */}
        <div className="p-3 sm:p-4 bg-slate-900 border border-emerald-300 dark:border-emerald-900/60 rounded-xl relative overflow-hidden">
          <span className="text-[10px] sm:text-xs text-emerald-700 dark:text-emerald-400 uppercase font-semibold block">Verified Available Balance</span>
          <div className="text-xl sm:text-2xl font-extrabold font-mono text-emerald-700 dark:text-emerald-400 mt-1" dir="ltr">
            ${Number(currentEndingBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 mt-0.5 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" /> Account: 101502******0472
          </p>
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
                  <span dir="ltr" className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-medium">
                    {formatDisplayDate(tx.effectiveDate)}
                  </span>
                  {tx.reference && (
                    <span dir="ltr" className="text-[11px] text-slate-900 dark:text-slate-300 font-mono block font-semibold">
                      Ref: {tx.reference}
                    </span>
                  )}
                </div>
                <div className="text-right rtl:text-left">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    tx.category === 'CREDIT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' :
                    tx.category === 'DEBIT' ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' :
                    'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {tx.category}
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-900 dark:text-slate-200 font-medium">
                {tx.description}
                {tx.isReversal && (
                  <span className="mx-2 px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800 font-mono">
                    {t('ledger.reversal', 'REVERSAL')}
                  </span>
                )}
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800/80 font-mono text-xs">
                <div>
                  <span className="text-slate-500 block text-[10px] font-sans">Amount:</span>
                  <span dir="ltr">
                    {Number(tx.creditAmount) > 0 ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">+${Number(tx.creditAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    ) : Number(tx.debitAmount) > 0 ? (
                      <span className="text-rose-700 dark:text-rose-400 font-bold">-${Number(tx.debitAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    ) : (
                      <span className="text-slate-400">$0.00</span>
                    )}
                  </span>
                </div>
                <div className="text-right rtl:text-left">
                  <span className="text-slate-500 block text-[10px] font-sans">{t('ledger.runningBalance')}:</span>
                  <span dir="ltr" className="text-slate-900 dark:text-white font-extrabold text-sm">
                    ${Number(tx.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Mobile Actions */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-end rtl:justify-start gap-2">
                <button
                  onClick={() => handleOpenEdit(tx)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-700 hover:text-emerald-700 bg-slate-100 hover:bg-emerald-50 border border-slate-200 rounded dark:text-slate-300 dark:hover:text-emerald-400 dark:bg-slate-800/60 dark:border-transparent transition"
                >
                  <Edit className="w-3.5 h-3.5" /> {t('ledger.editEntry', 'Edit')}
                </button>
                <button
                  onClick={() => setDeletingTx(tx)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-700 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 border border-slate-200 rounded dark:text-slate-300 dark:hover:text-rose-400 dark:bg-slate-800/60 dark:border-transparent transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {t('ledger.deleteEntry', 'Delete')}
                </button>
                {!tx.isReversal && (
                  <button
                    onClick={() => setReversalTx(tx)}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-700 hover:text-amber-700 bg-slate-100 hover:bg-amber-50 border border-slate-200 rounded dark:text-slate-400 dark:hover:text-amber-400 dark:bg-slate-800/60 dark:border-transparent transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> {t('ledger.reverseAction', 'Reverse')}
                  </button>
                )}
              </div>
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
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">{t('common.actions')}</th>
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
              ) : transactions.length > 0 ? (
                transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    <td className={`py-3 px-4 text-slate-600 dark:text-slate-400 ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                      {formatDisplayDate(tx.effectiveDate)}
                    </td>
                    <td className={`py-3 px-4 text-slate-800 dark:text-slate-300 font-semibold ${isRtl ? 'text-right' : 'text-left'}`} dir="ltr">
                      {tx.reference || '-'}
                    </td>
                    <td className={`py-3 px-4 font-sans text-slate-900 dark:text-slate-200 ${isRtl ? 'text-right' : 'text-left'}`}>
                      {tx.description}
                      {tx.isReversal && (
                        <span className="mx-2 px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800 font-mono">
                          {t('ledger.reversal', 'REVERSAL')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold uppercase ${
                        tx.category === 'CREDIT' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' :
                        tx.category === 'DEBIT' ? 'bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' :
                        'bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {tx.category}
                      </span>
                    </td>
                    <td className={`py-3 px-4 text-rose-700 dark:text-rose-400 font-semibold ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      {Number(tx.debitAmount) > 0 ? `$${Number(tx.debitAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className={`py-3 px-4 text-emerald-700 dark:text-emerald-400 font-semibold ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      {Number(tx.creditAmount) > 0 ? `$${Number(tx.creditAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className={`py-3 px-4 font-bold text-slate-900 dark:text-white ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                      ${Number(tx.runningBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800">
                        <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        Reconciled
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-sans">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(tx)}
                          title={t('ledger.editEntry', 'Edit Entry')}
                          className="p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 border border-slate-200 rounded transition dark:text-slate-400 dark:hover:text-emerald-400 dark:hover:bg-slate-800 dark:border-transparent"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingTx(tx)}
                          title={t('ledger.deleteEntry', 'Delete Entry')}
                          className="p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 rounded transition dark:text-slate-400 dark:hover:text-rose-400 dark:hover:bg-slate-800 dark:border-transparent"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {!tx.isReversal ? (
                          <button
                            onClick={() => setReversalTx(tx)}
                            title={t('ledger.reverseAction', 'Reverse Entry')}
                            className="p-1.5 min-h-[32px] min-w-[32px] flex items-center justify-center text-slate-600 hover:text-amber-700 hover:bg-amber-50 border border-slate-200 rounded transition dark:text-slate-400 dark:hover:text-amber-400 dark:hover:bg-slate-800 dark:border-transparent"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-500 font-sans">
                    {t('ledger.emptyState')}
                  </td>
                </tr>
              )}
            </tbody>
            {/* SUMMARY FOOTER ROW */}
            <tfoot className="bg-slate-950/95 font-mono text-xs border-t-2 border-slate-700">
              <tr>
                <td colSpan={4} className="py-3.5 px-4 text-white font-bold uppercase tracking-wider font-sans">
                  Statement Summary Footer ({transactions.length} Rows)
                </td>
                <td className={`py-3.5 px-4 font-extrabold text-rose-400 text-sm ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                  ${totalDebits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className={`py-3.5 px-4 font-extrabold text-emerald-400 text-sm ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                  ${totalCredits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className={`py-3.5 px-4 font-extrabold text-emerald-300 text-sm ${isRtl ? 'text-left' : 'text-right'}`} dir="ltr">
                  ${Number(currentEndingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td colSpan={2} className="py-3.5 px-4 text-center font-sans text-[11px] text-emerald-400 font-bold">
                  Closing Balance Verified
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* CASH IN MODAL (+ Receive Money) */}
      {showCashInModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ArrowDownLeft className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                  <span>+ {t('ledger.cashIn', 'Cash In (Receive Money)')}</span>
                </h2>
                <AutoSaveIndicator status={cashInAutoSave.status} lastSaved={cashInAutoSave.lastSaved} />
              </div>
              <button
                onClick={() => setShowCashInModal(false)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCashInSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
                {cashInAutoSave.hasDraft && (
                  <DraftRecoveryBanner
                    timestamp={cashInAutoSave.draftTimestamp}
                    onRestore={handleRestoreCashInDraft}
                    onDiscard={handleDiscardCashInDraft}
                    className="mb-2"
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('ledger.effectiveDate')}</label>
                    <input
                      type="date"
                      value={cashInDate}
                      onChange={e => setCashInDate(e.target.value)}
                      required
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Received Amount (USD) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cashInAmount}
                      onChange={e => setCashInAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">SWIFT Fee Deducted ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cashInSwiftFee}
                      onChange={e => setCashInSwiftFee(e.target.value)}
                      placeholder="0.00 (e.g. 23.75)"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('ledger.reference', 'Wire / Bank Reference')}</label>
                    <input
                      type="text"
                      value={cashInReference}
                      onChange={e => setCashInReference(e.target.value)}
                      placeholder="e.g. 0464AIR261771143"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Live Net Wire Calculation Preview */}
                {Number(cashInSwiftFee) > 0 && Number(cashInAmount) > 0 && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1 text-xs">
                    <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                      <span>Gross Invoiced / Payment Amount:</span>
                      <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                        ${Number(cashInAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-amber-600 dark:text-amber-400">
                      <span>SWIFT Fee Deducted:</span>
                      <span className="font-mono font-bold">
                        -${Number(cashInSwiftFee).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                      <span>Net Wire Credited to Bank Ledger:</span>
                      <span className="font-mono text-sm font-black">
                        ${Math.max(0, Number(cashInAmount) - Number(cashInSwiftFee)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                      </span>
                    </div>
                  </div>
                )}

                {/* Link to Proforma Invoice */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('ledger.linkInvoice', 'Link to Proforma Invoice (Optional)')}</label>
                  <select
                    value={cashInInvoiceId}
                    onChange={e => handleSelectInvoiceForCashIn(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- None / General Inward Wire --</option>
                    {invoices
                      .filter(inv => inv.status !== 'VOID')
                      .map(inv => (
                        <option key={inv.id} value={inv.id}>
                          {inv.invoiceNumber} • {inv.customer?.companyName} • ${Number(inv.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} ({inv.paymentStatus})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('ledger.payer', 'Payer / Remitting Entity')}</label>
                  <input
                    type="text"
                    value={cashInPayer}
                    onChange={e => setCashInPayer(e.target.value)}
                    placeholder="e.g. GT INDIA PVT LTD"
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('ledger.description')}</label>
                  <input
                    type="text"
                    value={cashInDescription}
                    onChange={e => setCashInDescription(e.target.value)}
                    placeholder="e.g. Inward Wire Transfer from Consignee"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('common.notes', 'Internal Notes')}</label>
                  <input
                    type="text"
                    value={cashInNotes}
                    onChange={e => setCashInNotes(e.target.value)}
                    placeholder="Optional internal remarks..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-800 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={cashInCreateReceipt}
                      onChange={e => setCashInCreateReceipt(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 h-4 w-4 bg-white dark:bg-slate-900"
                    />
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5" />
                      Auto-generate Official Deposit Receipt
                    </span>
                  </label>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 pl-6">
                    Creates an immutable Sky Ariana Ltd verified deposit receipt linked to this credit entry.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/95 z-10">
                <button
                  type="button"
                  onClick={() => setShowCashInModal(false)}
                  className="px-4 py-2 min-h-[44px] bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5 keep-white-text"
                >
                  <ArrowDownLeft className="w-4 h-4" />
                  + Record Inward Credit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CASH OUT MODAL (- Pay Expense) */}
      {showCashOutModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-rose-500 dark:text-rose-400" />
                  <span>- {t('ledger.cashOut', 'Cash Out (Pay Expense)')}</span>
                </h2>
                <AutoSaveIndicator status={cashOutAutoSave.status} lastSaved={cashOutAutoSave.lastSaved} />
              </div>
              <button
                onClick={() => setShowCashOutModal(false)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCashOutSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
                {cashOutAutoSave.hasDraft && (
                  <DraftRecoveryBanner
                    timestamp={cashOutAutoSave.draftTimestamp}
                    onRestore={handleRestoreCashOutDraft}
                    onDiscard={handleDiscardCashOutDraft}
                    className="mb-2"
                  />
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('ledger.effectiveDate')}</label>
                    <input
                      type="date"
                      value={cashOutDate}
                      onChange={e => setCashOutDate(e.target.value)}
                      required
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Payment Amount (USD) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cashOutAmount}
                      onChange={e => setCashOutAmount(e.target.value)}
                      placeholder="0.00"
                      required
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-rose-500"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('ledger.payee', 'Payee / Supplier')}</label>
                    <input
                      type="text"
                      value={cashOutPayee}
                      onChange={e => setCashOutPayee(e.target.value)}
                      placeholder="e.g. NAJEB AMIN LTD / Sodiqjon Aminov"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('ledger.reference', 'Wire / Reference')}</label>
                    <input
                      type="text"
                      value={cashOutReference}
                      onChange={e => setCashOutReference(e.target.value)}
                      placeholder="e.g. OUT-WIRE-889"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Expense Category</label>
                  <select
                    value={cashOutCategory}
                    onChange={e => setCashOutCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-rose-500"
                  >
                    <option value="SUPPLIER_PAYMENT">Supplier Payment (Goods / Produce)</option>
                    <option value="OPERATING_EXPENSE">Operating Expense (General)</option>
                    <option value="PORT_HANDLING">Port Handling & Logistics</option>
                    <option value="CUSTOMS_DUTY">Customs Clearance & Duty</option>
                    <option value="BANK_CHARGES">Bank Charges & SWIFT Fees</option>
                    <option value="OTHER">Other Disbursement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('ledger.description')}</label>
                  <input
                    type="text"
                    value={cashOutDescription}
                    onChange={e => setCashOutDescription(e.target.value)}
                    placeholder="e.g. Payment for Raisin Processing & Packaging"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('common.notes', 'Internal Notes')}</label>
                  <input
                    type="text"
                    value={cashOutNotes}
                    onChange={e => setCashOutNotes(e.target.value)}
                    placeholder="Optional internal remarks..."
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/95 z-10">
                <button
                  type="button"
                  onClick={() => setShowCashOutModal(false)}
                  className="px-4 py-2 min-h-[44px] bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 min-h-[44px] bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-md flex items-center gap-1.5 keep-white-text"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  - Post Outflow Debit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT ENTRY MODAL */}
      {editingTx && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-10">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                <span>{t('ledger.editEntry', 'Edit Ledger Entry')}</span>
              </h2>
              <button
                onClick={() => setEditingTx(null)}
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateEntry} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('ledger.effectiveDate')}</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={e => setEditDate(e.target.value)}
                      required
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('ledger.reference')}</label>
                    <input
                      type="text"
                      value={editReference}
                      onChange={e => setEditReference(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('ledger.description')}</label>
                  <input
                    type="text"
                    value={editDescription}
                    onChange={e => setEditDescription(e.target.value)}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Debit Amount (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editDebitAmount}
                      onChange={e => setEditDebitAmount(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Credit Amount (USD)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editCreditAmount}
                      onChange={e => setEditCreditAmount(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
                      dir="ltr"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('common.notes')}</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg p-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-300">
                  <span className="font-semibold block mb-0.5">Deterministic Running Balance Recalculation</span>
                  Modifying this entry will automatically recalculate the chronological running balance across all subsequent statement entries.
                </div>
              </div>

              <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/95 z-10">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-4 py-2 min-h-[44px] bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-300 rounded-lg text-xs font-semibold transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 min-h-[44px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md keep-white-text"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingTx && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2 text-rose-400">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <span>{t('ledger.deleteEntry', 'Delete Ledger Entry')}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-2">
              Are you sure you want to delete this transaction? This will permanently remove the record and recalculate running balances for all subsequent transactions.
            </p>
            <div className="mt-3 p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-1">
              <div className="text-slate-400">Date: <span className="text-white font-mono">{formatDisplayDate(deletingTx.effectiveDate)}</span></div>
              <div className="text-slate-400">Reference: <span className="text-white font-mono">{deletingTx.reference || '-'}</span></div>
              <div className="text-slate-400">Description: <span className="text-white">{deletingTx.description}</span></div>
              <div className="text-slate-400 font-mono" dir="ltr">
                {Number(deletingTx.creditAmount) > 0 && <span className="text-emerald-400 font-bold">+${Number(deletingTx.creditAmount).toFixed(2)}</span>}
                {Number(deletingTx.debitAmount) > 0 && <span className="text-rose-400 font-bold">-${Number(deletingTx.debitAmount).toFixed(2)}</span>}
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setDeletingTx(null)}
                className="px-3 py-2 min-h-[44px] bg-slate-800 text-slate-300 rounded text-xs"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleDeleteEntry}
                className="px-4 py-2 min-h-[44px] bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold shadow-lg shadow-rose-950"
              >
                {t('common.confirm', 'Confirm Delete')}
              </button>
            </div>
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
              Posting a reversal creates a linked opposite adjustment entry to offset this transaction without altering historical audit integrity.
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

      {/* PRINTABLE STATEMENT MODAL */}
      {showPrintModal && printConfig && (
        <LedgerPrintModal
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          transactions={printConfig.transactions}
          openingBalance={printConfig.openingBalance}
          closingBalance={printConfig.closingBalance}
          periodLabel={printConfig.periodLabel}
          totalCredits={printConfig.totalCredits}
          totalDebits={printConfig.totalDebits}
          creditCount={printConfig.creditCount}
          debitCount={printConfig.debitCount}
        />
      )}

      {/* COMPREHENSIVE REPORT GENERATOR MODAL */}
      {showReportModal && (
        <LedgerReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          allTransactions={transactions}
          openingBalance={openingBalance}
          currentEndingBalance={currentEndingBalance}
          onPrintReport={(reportData) => {
            setPrintConfig(reportData);
            setShowPrintModal(true);
          }}
        />
      )}
    </div>
  );
};
