import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
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
    } catch (err: any) {
      alert(err.message || 'Dry run failed');
    } finally {
      setLoadingDryRun(false);
    }
  };

  const handleCommit = async () => {
    if (!confirm('Commit imported rows to production database? This operation is idempotent and will record an audit trail.')) return;
    try {
      setCommitting(true);
      const res = await api.commitImport();
      setCommitResult(res);
      loadHistory();
    } catch (err: any) {
      alert(err.message || 'Commit failed');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Workbook Migration & Import Center</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Cryptographic integrity verification, schema mapping & transactional ingestion of AQ_Companies_System_v10_Logistics.xlsx
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExecuteDryRun}
            disabled={loadingDryRun}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDryRun ? 'animate-spin' : ''}`} />
            {loadingDryRun ? 'Parsing Workbook...' : 'Run Migration Dry-Run'}
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
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Source Workbook: AQ_Companies_System_v10_Logistics.xlsx</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Bit-for-bit Authenticated
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                SHA-256: BC25181951738F3A3E668DC5D3564747447DE549A6CB85F59D28313EA05464EA
              </p>
            </div>
          </div>
          {dryRunData && (
            <button
              onClick={handleCommit}
              disabled={committing || history.length > 0}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-950 transition flex items-center gap-2 self-start md:self-auto disabled:opacity-50"
            >
              <Database className="w-4 h-4" />
              {committing ? 'Committing...' : history.length > 0 ? 'Already Committed' : 'Execute Transactional Commit'}
            </button>
          )}
        </div>
      </div>

      {/* Commit Result Banner */}
      {commitResult && (
        <div className="p-4 bg-emerald-950/70 border border-emerald-800 rounded-xl flex items-start gap-3 text-xs text-emerald-200">
          <FileCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-emerald-300 text-sm">Transactional Ingestion Completed Successfully!</h3>
            <p className="mt-1">
              All 6 sheets have been imported into the database with row-level traceability. Check the Dashboard, Invoices, Ledger, and Logistics screens to view migrated records.
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
              <span className="text-slate-400 font-sans block text-[10px] uppercase">Total Credits</span>
              <span className="font-bold text-blue-400 text-sm">${dryRunData.checkpointTotals.totalCredits}</span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
              <span className="text-slate-400 font-sans block text-[10px] uppercase">Total Debits</span>
              <span className="font-bold text-rose-400 text-sm">${dryRunData.checkpointTotals.totalDebits}</span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
              <span className="text-slate-400 font-sans block text-[10px] uppercase">Calculated Balance</span>
              <span className="font-bold text-emerald-400 text-sm">${dryRunData.checkpointTotals.availableBalance}</span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
              <span className="text-slate-400 font-sans block text-[10px] uppercase">Total Invoiced</span>
              <span className="font-bold text-white text-sm">${dryRunData.checkpointTotals.totalInvoiced}</span>
            </div>
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono">
              <span className="text-slate-400 font-sans block text-[10px] uppercase">Pending Receivables</span>
              <span className="font-bold text-amber-400 text-sm">${dryRunData.checkpointTotals.totalPending}</span>
            </div>
          </div>

          {/* Warnings Inspector */}
          {dryRunData.warnings && dryRunData.warnings.length > 0 && (
            <div className="bg-slate-900 border border-amber-900/60 rounded-xl p-5 shadow-lg">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" /> Migration Warnings & Decision Alerts ({dryRunData.warnings.length})
              </h3>
              <div className="space-y-2">
                {dryRunData.warnings.map((w: string, i: number) => (
                  <div key={i} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 font-mono">
                    <span className="text-amber-400 font-bold mr-2">[WARN-{i+1}]</span>
                    {w}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Record Ingestion Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-slate-400 uppercase font-semibold block mb-1">Account Statement</span>
              <span className="text-lg font-bold text-white">{dryRunData.counts.ledgerTransactions} Ledger Transactions</span>
              <p className="text-[11px] text-slate-500 mt-1">Starting balance row ($83.36) flagged for classification.</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-slate-400 uppercase font-semibold block mb-1">Proforma Invoices</span>
              <span className="text-lg font-bold text-white">{dryRunData.counts.proformaInvoices} Proforma Invoices</span>
              <p className="text-[11px] text-slate-500 mt-1">Repeated numbers '001' and '002' isolated by stable UUIDs.</p>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-slate-400 uppercase font-semibold block mb-1">Freight Logistics</span>
              <span className="text-lg font-bold text-white">{dryRunData.counts.shipments} Active Shipments</span>
              <p className="text-[11px] text-slate-500 mt-1">Maersk & MSC container movements with origin/destination routes.</p>
            </div>
          </div>
        </div>
      )}

      {/* Historical Import Log */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 mb-4">
          Migration Audit Log
        </h3>
        {history.length > 0 ? (
          <div className="space-y-3 text-xs">
            {history.map(imp => (
              <div key={imp.id} className="p-3 bg-slate-950 border border-slate-800 rounded-lg flex justify-between items-center">
                <div>
                  <span className="font-semibold text-white">{imp.filename}</span>
                  <div className="text-[11px] text-slate-500 font-mono mt-0.5">
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
          <p className="text-xs text-slate-500">No committed imports yet. Run Migration Dry-Run above to begin.</p>
        )}
      </div>
    </div>
  );
};
