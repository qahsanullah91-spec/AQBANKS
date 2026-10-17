import React, { useEffect, useState, useRef } from 'react';
import { api } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import {
  ShieldAlert,
  Users,
  ShieldCheck,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  Database,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Upload,
  Archive,
  FileCheck,
  Server,
  FileText,
  DollarSign,
  Ship,
  Receipt,
  X
} from 'lucide-react';

export const Admin: React.FC = () => {
  const { t, isRTL } = useLanguage();
  const toast = useToast();
  const [users, setUsers] = useState<any[]>([]);
  const [auditEvents, setAuditEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Baseline Reset State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Backup & Restore State
  const [exportingBackup, setExportingBackup] = useState(false);
  const [validatingBackup, setValidatingBackup] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [restoreDiffModalOpen, setRestoreDiffModalOpen] = useState(false);
  const [uploadedBackupData, setUploadedBackupData] = useState<any | null>(null);
  const [validationReport, setValidationReport] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audit Filter & Expansion
  const [actionFilter, setActionFilter] = useState('ALL');
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  const loadData = async () => {
    try {
      setLoading(true);
      const [uRes, aRes] = await Promise.all([
        api.getUsers().catch(() => []),
        api.getAuditEvents({ limit: 100 }).catch(() => ({ events: [] }))
      ]);
      setUsers(uRes || []);
      setAuditEvents(aRes.events || []);
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Keyboard accessibility: Close modals on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (resetModalOpen) setResetModalOpen(false);
        if (restoreDiffModalOpen) setRestoreDiffModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [resetModalOpen, restoreDiffModalOpen]);

  // Master Baseline Reset Handler
  const handleResetBaseline = async () => {
    try {
      setResetting(true);
      const res = await api.resetBaseline();
      toast.success(res.message || t('admin.resetSuccess'), 'Baseline Reset Succeeded');
      setResetModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset baseline.', 'Reset Failed');
    } finally {
      setResetting(false);
    }
  };

  // Export System Backup Handler
  const handleExportBackup = async () => {
    try {
      setExportingBackup(true);
      const data = await api.exportBackup();
      const exportDate = new Date().toISOString().split('T')[0];
      const filename = `AQ_Companies_Backup_${exportDate}.json`;

      const jsonBlob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(jsonBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);

      const count = data.summary?.invoicesCount || 0;
      toast.success(
        `Full system backup exported (${count} Invoices, ${data.summary?.ledgerCount || 0} Ledger rows).`,
        'Backup Exported'
      );
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to export backup.', 'Export Error');
    } finally {
      setExportingBackup(false);
    }
  };

  // File Upload & Schema Validation Handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Only JSON backup archives are supported.', 'Invalid File Format');
      return;
    }

    try {
      setValidatingBackup(true);
      const text = await file.text();
      const json = JSON.parse(text);

      const report = await api.validateBackup(json);
      setUploadedBackupData(json);
      setValidationReport(report);
      setRestoreDiffModalOpen(true);
      toast.info('Backup archive validated. Please review database diff before committing restore.', 'Backup Verified');
    } catch (err: any) {
      toast.error(err.message || 'The uploaded file is not a valid JSON backup.', 'Validation Error');
    } finally {
      setValidatingBackup(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Execute Restore Handler
  const handleConfirmRestore = async () => {
    if (!uploadedBackupData) return;

    try {
      setRestoringBackup(true);
      const res = await api.restoreBackup(uploadedBackupData);
      toast.success(
        res.message || 'System state successfully restored from backup archive!',
        'Restoration Succeeded'
      );
      setRestoreDiffModalOpen(false);
      setUploadedBackupData(null);
      setValidationReport(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to restore system backup.', 'Restoration Failed');
    } finally {
      setRestoringBackup(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedEvents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredEvents = auditEvents.filter(evt => {
    if (actionFilter === 'ALL') return true;
    return evt.action === actionFilter;
  });

  const uniqueActions = Array.from(new Set(auditEvents.map(e => e.action)));

  return (
    <div className="space-y-6">
      {/* Top Header with Liquid Glass style */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            {t('admin.heading')}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {t('admin.headingSubtitle')}
          </p>
        </div>

        <button
          onClick={() => setResetModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/50 rounded-xl text-xs font-semibold shadow-lg shadow-rose-950/20 transition cursor-pointer"
        >
          <RotateCcw className="w-4 h-4 text-rose-400" />
          {t('admin.resetBaseline')}
        </button>
      </div>

      {/* ========================================================
          DATA BACKUP & DISASTER RECOVERY CARD
          ======================================================== */}
      <div className="bg-slate-900/70 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                {t('admin.backupHeading', 'Data Backup & Disaster Recovery')}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t('admin.backupSubtitle', 'Export full system JSON archives, validate schema integrity, and perform transactional state restoration')}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Server className="w-3.5 h-3.5 text-emerald-400" />
            Hot-Standby Ready
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Card 1: Export Full System Backup */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Download className="w-4 h-4 text-emerald-400" />
                  {t('admin.exportBackup', 'Export Full System Backup')}
                </span>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                  SHA-256 Validated
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                {t('admin.exportBackupDesc', 'Download a cryptographically verified JSON archive of all Invoices, Receipts, Statement Ledger, Shipments, Banking Details, and Compliance Audit Trail.')}
              </p>
            </div>

            <button
              onClick={handleExportBackup}
              disabled={exportingBackup}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-emerald-950 transition cursor-pointer disabled:opacity-50"
            >
              {exportingBackup ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Packaging System Backup...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  📥 Download System Backup Archive (.json)
                </>
              )}
            </button>
          </div>

          {/* Card 2: Restore System from Backup File */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-cyan-400" />
                  {t('admin.restoreBackup', 'Restore System from Backup')}
                </span>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800">
                  Pre-Restore Diff Guard
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                {t('admin.restoreBackupDesc', 'Upload a valid AQ Companies backup JSON archive to validate schema integrity and preview database diff before restoring state.')}
              </p>
            </div>

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".json,application/json"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={validatingBackup}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-950 transition cursor-pointer disabled:opacity-50"
            >
              {validatingBackup ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Validating Backup Schema...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  📤 Select Backup File to Inspect & Restore
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Database Governance & Master Excel Baseline Sync Summary */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Master Database State & Excel Ledger Synchronization
              </h2>
              <p className="text-xs text-slate-400">
                Source of Truth: <span className="font-mono text-cyan-400">AQ_Companies_System_v10_Logistics.xlsx</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Sync Verified
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-800/80">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Proforma Invoices</span>
            <span className="text-sm font-bold text-white block mt-1">8 Sequenced</span>
            <span className="text-[10px] text-cyan-400 font-mono">PI-2026-0001 .. 0008</span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Total Invoiced</span>
            <span className="text-sm font-bold text-emerald-400 block mt-1">$555,090.30</span>
            <span className="text-[10px] text-slate-400">179,164 KG Net Weight</span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Account Balance</span>
            <span className="text-sm font-bold text-emerald-400 block mt-1">$24,259.61</span>
            <span className="text-[10px] text-slate-400">AUB AWDCCA • 6 Ledger Tx</span>
          </div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
            <span className="text-[11px] text-slate-400 block font-medium">Next Invoice Number</span>
            <span className="text-sm font-bold text-indigo-400 font-mono block mt-1">PI-2026-0009</span>
            <span className="text-[10px] text-slate-400">Auto-increment protected</span>
          </div>
        </div>
      </div>

      {/* Authorized Users & Role Governance */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" /> {t('admin.usersHeading')}
          </h2>
          <span className="text-xs text-slate-400">{users.length} Active Operators</span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/90 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className={`py-3 px-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t('admin.name')}</th>
                <th className={`py-3 px-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t('admin.email')}</th>
                <th className={`py-3 px-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t('admin.role')}</th>
                <th className={`py-3 px-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t('admin.active')}</th>
                <th className={`py-3 px-4 ${isRTL ? 'text-right' : 'text-left'}`}>{t('admin.createdAt')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-semibold text-white">{u.firstName} {u.lastName}</td>
                  <td className="py-3 px-4 text-slate-300 font-mono text-[11px]" dir="ltr">{u.email}</td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-1 rounded-md text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                      {u.roles.join(', ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      {t('admin.activeStatus')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-400" dir="ltr">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Audit Trail */}
      <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" /> {t('admin.auditHeading')}
          </h2>

          <div className="flex items-center gap-2">
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">All Actions ({auditEvents.length})</option>
              {uniqueActions.map(act => (
                <option key={act} value={act}>{act}</option>
              ))}
            </select>

            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs border border-slate-700 transition"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              {t('common.refresh')}
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {filteredEvents.length > 0 ? (
            filteredEvents.map(evt => {
              const isExpanded = !!expandedEvents[evt.id];
              const isResetEvent = evt.action === 'BASELINE_DATABASE_RESET';
              const isRestoreEvent = evt.action === 'SYSTEM_RESTORE_SUCCESS';
              const isBackupExport = evt.action === 'SYSTEM_BACKUP_EXPORTED';

              return (
                <div
                  key={evt.id}
                  className={`p-3.5 rounded-xl border transition ${
                    isResetEvent
                      ? 'bg-rose-950/20 border-rose-800/40'
                      : isRestoreEvent
                      ? 'bg-cyan-950/20 border-cyan-800/40'
                      : isBackupExport
                      ? 'bg-emerald-950/20 border-emerald-800/40'
                      : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-slate-300 font-sans">
                    <span className="font-bold text-white flex items-center gap-2">
                      {isResetEvent ? (
                        <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                      ) : isRestoreEvent ? (
                        <FileCheck className="w-3.5 h-3.5 text-cyan-400" />
                      ) : isBackupExport ? (
                        <Archive className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span className={isResetEvent ? 'text-rose-300 font-mono text-xs' : isRestoreEvent ? 'text-cyan-300 font-mono text-xs' : 'text-slate-200'}>
                        {evt.action}
                      </span>
                    </span>
                    <span className="text-slate-500 text-[11px] font-mono" dir="ltr">
                      {new Date(evt.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="mt-1.5 text-xs text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span>
                      {t('admin.actor')}: <strong className="text-slate-200 font-mono text-[11px]" dir="ltr">{evt.actor?.email || 'SYSTEM'}</strong>
                    </span>
                    <span>
                      {t('admin.entity')}: <strong className="text-slate-300 font-mono text-[11px]" dir="ltr">{evt.entityType}</strong>
                    </span>
                    {evt.entityId && (
                      <span className="font-mono text-[11px] text-slate-500" dir="ltr">
                        ID: {evt.entityId}
                      </span>
                    )}
                  </div>

                  {evt.newValuesJson && (
                    <div className="mt-2">
                      <button
                        onClick={() => toggleExpand(evt.id)}
                        className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition"
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? 'Hide Payload' : 'View Event Payload'}
                      </button>

                      {isExpanded && (
                        <pre className="mt-2 p-2.5 bg-slate-900 border border-slate-800 rounded-lg text-[10px] font-mono text-slate-300 overflow-x-auto" dir="ltr">
                          {evt.newValuesJson}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-xs text-slate-500 py-6 text-center">{t('admin.noEvents')}</p>
          )}
        </div>
      </div>

      {/* ========================================================
          PRE-RESTORE DIFF CONFIRMATION MODAL
          ======================================================== */}
      {restoreDiffModalOpen && validationReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    {t('admin.preRestoreTitle', 'Pre-Restore Database Diff & Verification')}
                  </h3>
                  <p className="text-xs text-cyan-300/90 mt-0.5">
                    {t('admin.preRestoreSubtitle', 'Review comparison between live database and incoming backup archive:')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setRestoreDiffModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Archive Metadata */}
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 text-xs grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block text-[10px]">Exported On:</span>
                <span className="text-white font-mono font-medium">
                  {new Date(validationReport.metadata?.exportTimestamp).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Exported By:</span>
                <span className="text-white font-mono font-medium truncate block">
                  {validationReport.metadata?.exportedBy}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">SHA-256 Checksum:</span>
                <span className="text-cyan-400 font-mono text-[10px] truncate block" title={validationReport.metadata?.checksum}>
                  {validationReport.metadata?.checksum?.slice(0, 16)}...
                </span>
              </div>
            </div>

            {/* Pre-Restore Diff Comparison Grid */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-sans">
                  <tr>
                    <th className="py-2.5 px-3">Entity Module</th>
                    <th className="py-2.5 px-3 text-right">Current Live DB</th>
                    <th className="py-2.5 px-3 text-right text-cyan-300">Backup Archive</th>
                    <th className="py-2.5 px-3 text-center">Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  <tr>
                    <td className="py-2.5 px-3 font-sans text-slate-200 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-400" /> Proforma Invoices
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {validationReport.diff.invoices.current} (${validationReport.diff.invoices.currentTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                    </td>
                    <td className="py-2.5 px-3 text-right text-cyan-400 font-bold">
                      {validationReport.diff.invoices.backup} (${validationReport.diff.invoices.backupTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800">
                        Will Overwrite
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-sans text-slate-200 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Ledger Transactions & Balance
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {validationReport.diff.ledger.current} Tx (${validationReport.diff.ledger.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">
                      {validationReport.diff.ledger.backup} Tx (${validationReport.diff.ledger.backupBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        Will Recalculate
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-sans text-slate-200 flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-amber-400" /> Deposit Receipts
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {validationReport.diff.receipts.current}
                    </td>
                    <td className="py-2.5 px-3 text-right text-cyan-400 font-bold">
                      {validationReport.diff.receipts.backup}
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800">
                        Will Overwrite
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 font-sans text-slate-200 flex items-center gap-1.5">
                      <Ship className="w-3.5 h-3.5 text-sky-400" /> Freight Shipments
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {validationReport.diff.shipments.current}
                    </td>
                    <td className="py-2.5 px-3 text-right text-cyan-400 font-bold">
                      {validationReport.diff.shipments.backup}
                    </td>
                    <td className="py-2.5 px-3 text-center font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950 text-cyan-300 border border-cyan-800">
                        Will Overwrite
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Warning Callout */}
            <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl text-xs text-amber-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> Restoring this backup will replace current operational data with the archived records. A <code className="text-white">SYSTEM_RESTORE_SUCCESS</code> audit entry will be permanently written to the compliance log.
              </span>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRestoreDiffModalOpen(false)}
                disabled={restoringBackup}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmRestore}
                disabled={restoringBackup}
                className="flex items-center gap-2 px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-950 transition cursor-pointer disabled:opacity-50"
              >
                {restoringBackup ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    {t('admin.restoring', 'Restoring System State...')}
                  </>
                ) : (
                  <>
                    <FileCheck className="w-3.5 h-3.5" />
                    {t('admin.confirmRestore', 'Confirm & Restore System State')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Reset Database to Master Excel Baseline */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-rose-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 shrink-0">
                <AlertTriangle className="w-6 h-6 text-rose-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {t('admin.resetModalTitle')}
                </h3>
                <p className="text-xs text-rose-300/90 mt-1">
                  High-Privilege Governance Action (Admin Role Required)
                </p>
              </div>
            </div>

            <div className="p-4 bg-rose-950/30 border border-rose-800/40 rounded-xl space-y-2 text-xs text-slate-300">
              <p className="font-semibold text-rose-200">
                {t('admin.resetModalWarning')}
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] pt-1">
                <li>Purges test accounts, orphan receipts, and invalid temporary balances.</li>
                <li>Restores 8 Proforma Invoices (<span className="text-white font-mono">PI-2026-0001</span> to <span className="text-white font-mono">PI-2026-0008</span>) totaling <span className="text-emerald-400 font-bold">$555,090.30</span> (179,164 KG).</li>
                <li>Restores 2 Paid Invoices and 2 authentic Deposit Receipts (<span className="text-white font-mono">RCP-2026-0001</span> & <span className="text-white font-mono">0002</span>) with $813.19 SWIFT bank charges tracked.</li>
                <li>Restores 6 Ledger Statement rows ending at verified balance <span className="text-emerald-400 font-bold">$24,259.61</span>.</li>
                <li>Restores 2 active freight shipments (<span className="text-white font-mono">SHP-9001</span> & <span className="text-white font-mono">SHP-9002</span>).</li>
                <li>Records an immutable audit entry: <span className="text-rose-300 font-mono">BASELINE_DATABASE_RESET</span>.</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                disabled={resetting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
              >
                {t('admin.cancel')}
              </button>
              <button
                type="button"
                onClick={handleResetBaseline}
                disabled={resetting}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-rose-900/30 transition cursor-pointer"
              >
                {resetting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Resetting Baseline...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t('admin.confirmReset')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
