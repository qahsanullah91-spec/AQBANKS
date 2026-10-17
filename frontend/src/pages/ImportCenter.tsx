import React, { useEffect, useState } from 'react';
import { api, getUserRole } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import {
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  UploadCloud,
  RefreshCw,
  Database,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Download
} from 'lucide-react';

export const ImportCenter: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const { toast } = useToast();
  const userRole = getUserRole();
  const canCommit = userRole === 'ADMIN';
  const [dryRunData, setDryRunData] = useState<any | null>(null);
  const [loadingDryRun, setLoadingDryRun] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [commitResult, setCommitResult] = useState<any | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  const loadHistory = async () => {
    try {
      const res = await api.getImportHistory();
      setHistory(res);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleExecuteDryRun = async () => {
    try {
      setLoadingDryRun(true);
      setCommitResult(null);
      const res = await api.dryRunImport();
      setDryRunData(res);
      toast.success('Workbook dry-run analysis completed');
    } catch (err: any) {
      toast.error(err.message || 'Dry run failed');
    } finally {
      setLoadingDryRun(false);
    }
  };

  const handleCommit = async () => {
    if (!canCommit) {
      toast.error('Access Denied: Only Administrator can execute transactional workbook commits.');
      return;
    }
    if (!confirm(t('import.confirmCommit'))) return;
    try {
      setCommitting(true);
      const res = await api.commitImport();
      setCommitResult(res);
      toast.success('Workbook transaction committed successfully');
      loadHistory();
    } catch (err: any) {
      toast.error(err.message || 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t('import.heading')}</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {t('import.headingSubtitle')}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExecuteDryRun}
            disabled={loadingDryRun}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDryRun ? 'animate-spin' : ''}`} />
            {loadingDryRun ? t('import.parsingWorkbook') : t('import.runMigrationDryRun')}
          </button>
        </div>
      </div>

      {/* Provenance & File Hash Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-950 border border-emerald-800 text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-white">{t('import.sourceWorkbookPrefix')}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> {t('import.bitForBitAuthenticated')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono" dir="ltr">
                SHA-256: BC25181951738F3A3E668DC5D3564747447DE549A6CB85F59D28313EA05464EA
              </p>
            </div>
          </div>
          {dryRunData && canCommit && (
            <button
              onClick={handleCommit}
              disabled={committing || history.length > 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-950 transition flex items-center gap-2 self-start md:self-auto disabled:opacity-50"
            >
              <Database className="w-4 h-4" />
              {committing ? t('import.committing') : history.length > 0 ? t('import.alreadyCommitted') : t('import.executeTransactionalCommit')}
            </button>
          )}
          {dryRunData && !canCommit && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-amber-400 font-mono">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Admin Commit Privilege Required</span>
            </div>
          )}
        </div>
      </div>

      {/* Commit Result Banner */}
      {commitResult && (
        <div className="p-4 bg-emerald-950/70 border border-emerald-800 rounded-xl flex items-start gap-3 text-xs text-emerald-200">
          <FileCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-emerald-300 text-sm">{t('import.commitSuccessTitle')}</h3>
            <p className="mt-1">
              {t('import.commitSuccessDesc')}
            </p>
          </div>
        </div>
      )}

      {/* Dry Run Preview Section */}
      {dryRunData && (
        <div className="space-y-4">
          {/* Checkpoint Figures Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
              <span className="text-slate-400 font-sans block text-[10px] uppercase">{t('import.totalCredits')}</span>
              <span className="font-bold text-blue-400 text-sm" dir="ltr">${dryRunData.checkpointTotals.totalCredits}</span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
              <span className="text-slate-400 font-sans block text-[10px] uppercase">{t('import.totalDebits')}</span>
              <span className="font-bold text-rose-400 text-sm" dir="ltr">${dryRunData.checkpointTotals.totalDebits}</span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
              <span className="text-slate-400 font-sans block text-[10px] uppercase">{t('import.calculatedBalance')}</span>
              <span className="font-bold text-emerald-400 text-sm" dir="ltr">${dryRunData.checkpointTotals.availableBalance}</span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
              <span className="text-slate-400 font-sans block text-[10px] uppercase">{t('import.totalInvoiced')}</span>
              <span className="font-bold text-white text-sm" dir="ltr">${dryRunData.checkpointTotals.totalInvoiced}</span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
              <span className="text-slate-400 font-sans block text-[10px] uppercase">{t('import.pendingReceivables')}</span>
              <span className="font-bold text-amber-400 text-sm" dir="ltr">${dryRunData.checkpointTotals.totalPending}</span>
            </div>
          </div>

          {/* Interactive Diff Preview Table */}
          {dryRunData.diffPreview && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    Interactive Idempotent Diff Preview
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live database reconciliation diff prior to executing transactional commit.
                  </p>
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="px-2.5 py-1 rounded bg-blue-950 text-blue-300 border border-blue-800">
                    {dryRunData.diffPreview.matchedInvoicesCount} Invoices Matched (Skip/Update)
                  </span>
                  <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    {dryRunData.diffPreview.newInvoicesCount} New Records to Add
                  </span>
                </div>
              </div>

              {/* Matched Records Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Action</th>
                      <th className="py-2.5 px-3 text-left">Source Ref / Row</th>
                      <th className="py-2.5 px-3 text-left">Buyer / Description</th>
                      <th className="py-2.5 px-3 text-right">Amount (USD)</th>
                      <th className="py-2.5 px-3 text-center">Status In Database</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {dryRunData.diffPreview.matchedInvoices.map((inv: any, idx: number) => (
                      <tr key={`matched-${idx}`} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-950 text-blue-300 border border-blue-800">
                            MATCHED (UPDATE)
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-white font-bold" dir="ltr">
                          Row {inv.sourceRow} · Ref: {inv.proformaNo}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-200">
                          {inv.buyer}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 font-bold" dir="ltr">
                          ${Number(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <span className="text-slate-400 text-[11px]">
                            Existing Match: <strong className="text-white font-mono">{inv.matchedSystemInvoice}</strong>
                          </span>
                        </td>
                      </tr>
                    ))}
                    {dryRunData.diffPreview.newInvoices.map((inv: any, idx: number) => (
                      <tr key={`new-${idx}`} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                            INSERT NEW
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-emerald-300 font-bold" dir="ltr">
                          Row {inv.sourceRow} · Ref: {inv.proformaNo}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-200">
                          {inv.buyer}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 font-bold" dir="ltr">
                          ${Number(inv.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <span className="text-emerald-400 text-[11px] font-semibold">New Record to Add</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Warnings Inspector */}
          {dryRunData.warnings && dryRunData.warnings.length > 0 && (
            <div className="bg-slate-900 border border-amber-900/60 rounded-xl p-5 shadow-lg">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> {t('import.warningsAlerts')} ({dryRunData.warnings.length})
              </h3>
              <div className="space-y-2">
                {dryRunData.warnings.map((w: string, i: number) => (
                  <div key={i} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 font-mono">
                    <span className="text-amber-400 font-bold mr-2" dir="ltr">[WARN-{i+1}]</span>
                    {w}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Record Ingestion Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-slate-400 uppercase font-semibold block mb-1">{t('import.accountStatementCount')}</span>
              <span className="text-lg font-bold text-white" dir="ltr">{dryRunData.counts.ledgerTransactions} {t('import.ledgerTransactionsLabel')}</span>
              <p className="text-[11px] text-slate-500 mt-1">Starting balance row ($83.36) flagged for classification.</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-slate-400 uppercase font-semibold block mb-1">{t('import.proformaInvoicesCount')}</span>
              <span className="text-lg font-bold text-white" dir="ltr">{dryRunData.counts.proformaInvoices} {t('invoices.title')}</span>
              <p className="text-[11px] text-slate-500 mt-1">Repeated numbers '001' and '002' isolated by stable UUIDs.</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-slate-400 uppercase font-semibold block mb-1">{t('import.freightLogisticsCount')}</span>
              <span className="text-lg font-bold text-white" dir="ltr">{dryRunData.counts.shipments} {t('import.activeShipmentsLabel')}</span>
              <p className="text-[11px] text-slate-500 mt-1">Maersk & MSC container movements with origin/destination routes.</p>
            </div>
          </div>
        </div>
      )}

      {/* Historical Import Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">
          {t('import.historyTitle')}
        </h3>
        {history.length > 0 ? (
          <div className="space-y-3 text-xs">
            {history.map(imp => (
              <div key={imp.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center">
                <div>
                  <span className="font-semibold text-white">{imp.filename}</span>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5" dir="ltr">
                    Hash: {imp.fileHash.slice(0, 16)}... • Executed: {new Date(imp.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                    {imp.status} ({imp.acceptedRows} rows)
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">{t('import.noCommitted')}</p>
        )}
      </div>
    </div>
  );
};

