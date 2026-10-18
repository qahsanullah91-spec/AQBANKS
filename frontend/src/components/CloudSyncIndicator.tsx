import React, { useEffect, useState } from 'react';
import { Cloud, Check, RefreshCw, AlertCircle, Database, CheckCircle2 } from 'lucide-react';

export const CloudSyncIndicator: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'offline' | 'error'>('synced');
  const [lastVersion, setLastVersion] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<number>(Date.now());
  const [timeAgo, setTimeAgo] = useState<string>('just now');
  const [isRotating, setIsRotating] = useState(false);
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const handleStatus = (e: any) => {
      const detail = e.detail;
      if (detail?.status) {
        setSyncStatus(detail.status);
        if (detail.status === 'synced') {
          setLastSyncTime(Date.now());
          setTimeAgo('just now');
          if (detail.source === 'local') {
            setShowToast(true);
            setTimeout(() => setShowToast(false), 2500);
          }
        }
      }
      if (detail?.version) {
        setLastVersion(detail.version);
      }
    };

    window.addEventListener('aq:cloud-sync-status', handleStatus);
    return () => window.removeEventListener('aq:cloud-sync-status', handleStatus);
  }, []);

  // Update relative time every 10 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - lastSyncTime) / 1000);
      if (elapsedSec < 30) {
        setTimeAgo('just now');
      } else if (elapsedSec < 60) {
        setTimeAgo('<1m ago');
      } else {
        const mins = Math.floor(elapsedSec / 60);
        setTimeAgo(`${mins}m ago`);
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [lastSyncTime]);

  const handleManualSync = () => {
    setIsRotating(true);
    setSyncStatus('saving');
    window.dispatchEvent(new CustomEvent('aq:request-cloud-sync'));
    setTimeout(() => {
      setIsRotating(false);
    }, 800);
  };

  return (
    <>
      {/* Real-time Save Confirmation Toast */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-emerald-950/90 text-emerald-300 border border-emerald-500/40 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-mono font-medium">Changes Saved Online (PostgreSQL)</span>
        </div>
      )}

      {/* Header Indicator Button */}
      <button
        onClick={handleManualSync}
        title={`PostgreSQL Cloud Database • Version #${lastVersion || 1} • Last synced ${timeAgo}. Click to synchronize immediately.`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold transition-all border shadow-sm ${
          syncStatus === 'saving' || isRotating
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
            : syncStatus === 'offline' || syncStatus === 'error'
            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20 active:scale-95'
        }`}
      >
        {syncStatus === 'saving' || isRotating ? (
          <RefreshCw className="w-3 h-3 animate-spin text-amber-500 shrink-0" />
        ) : syncStatus === 'offline' || syncStatus === 'error' ? (
          <AlertCircle className="w-3 h-3 text-rose-500 shrink-0" />
        ) : (
          <Cloud className="w-3 h-3 text-emerald-500 shrink-0" />
        )}
        <span className="tracking-tight uppercase hidden sm:inline">
          {syncStatus === 'saving' || isRotating
            ? 'Saving...'
            : syncStatus === 'offline'
            ? 'Offline'
            : 'Cloud Synced'}
        </span>
        {syncStatus === 'synced' && !isRotating && (
          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-normal hidden lg:inline">
            • {timeAgo}
          </span>
        )}
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
      </button>
    </>
  );
};
