import React, { useEffect, useState } from 'react';
import { Cloud, Check, RefreshCw, AlertCircle } from 'lucide-react';

export const CloudSyncIndicator: React.FC = () => {
  const [syncStatus, setSyncStatus] = useState<'synced' | 'saving' | 'offline' | 'error'>('synced');
  const [lastVersion, setLastVersion] = useState<number>(0);
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    const handleStatus = (e: any) => {
      const detail = e.detail;
      if (detail?.status) {
        setSyncStatus(detail.status);
      }
      if (detail?.version) {
        setLastVersion(detail.version);
      }
    };

    window.addEventListener('aq:cloud-sync-status', handleStatus);
    return () => window.removeEventListener('aq:cloud-sync-status', handleStatus);
  }, []);

  const handleManualSync = () => {
    setIsRotating(true);
    setSyncStatus('saving');
    window.dispatchEvent(new CustomEvent('aq:request-cloud-sync'));
    setTimeout(() => {
      setIsRotating(false);
    }, 1000);
  };

  return (
    <button
      onClick={handleManualSync}
      title={`Cloud Database: PostgreSQL Online (Version #${lastVersion || 1}). Click to force sync.`}
      className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold transition-all border shadow-sm ${
        syncStatus === 'saving' || isRotating
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
          : syncStatus === 'offline' || syncStatus === 'error'
          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
      }`}
    >
      {syncStatus === 'saving' || isRotating ? (
        <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />
      ) : syncStatus === 'offline' || syncStatus === 'error' ? (
        <AlertCircle className="w-3 h-3 text-rose-500" />
      ) : (
        <Cloud className="w-3 h-3 text-emerald-500" />
      )}
      <span className="tracking-tight uppercase">
        {syncStatus === 'saving' || isRotating
          ? 'Saving...'
          : syncStatus === 'offline'
          ? 'Offline Cache'
          : 'Cloud Synced'}
      </span>
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
    </button>
  );
};
