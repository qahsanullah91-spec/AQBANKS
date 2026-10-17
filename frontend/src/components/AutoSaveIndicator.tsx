import React from 'react';
import { Check, Clock, Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { AutoSaveStatus } from '../utils/useAutoSave';

interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
  lastSaved: Date | null;
  className?: string;
}

export const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({
  status,
  lastSaved,
  className = ''
}) => {
  const formatTime = (d: Date) => {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono transition-all duration-200 ${className}`}>
      {status === 'saving' && (
        <span className="flex items-center gap-1 text-amber-400 font-semibold animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>Saving draft...</span>
        </span>
      )}

      {status === 'saved' && (
        <span className="flex items-center gap-1 text-emerald-400 font-medium">
          <Check className="w-3 h-3 text-emerald-400" />
          <span>Draft saved {lastSaved ? `(${formatTime(lastSaved)})` : ''}</span>
        </span>
      )}

      {status === 'idle' && lastSaved && (
        <span className="flex items-center gap-1 text-slate-400">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>Draft saved {formatTime(lastSaved)}</span>
        </span>
      )}
    </div>
  );
};

interface DraftRecoveryBannerProps {
  timestamp: string | null;
  onRestore?: () => void;
  onDiscard: () => void;
  className?: string;
}

export const DraftRecoveryBanner: React.FC<DraftRecoveryBannerProps> = ({
  timestamp,
  onRestore,
  onDiscard,
  className = ''
}) => {
  if (!timestamp) return null;

  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric'
  });

  return (
    <div className={`p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 text-xs flex flex-wrap items-center justify-between gap-2 animate-fadeIn ${className}`}>
      <div className="flex items-center gap-2 min-w-0">
        <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
        <span className="truncate">
          {onRestore ? 'Unsaved draft available from ' : 'Restored unsaved draft from '}
          <strong className="text-white font-mono">{formattedTime}</strong>
        </span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {onRestore && (
          <button
            type="button"
            onClick={onRestore}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] shadow-sm transition"
          >
            <Sparkles className="w-3 h-3" /> Restore Draft
          </button>
        )}
        <button
          type="button"
          onClick={onDiscard}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-900/40 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-800 border border-cyan-700/50 text-[11px] font-semibold transition"
        >
          <RotateCcw className="w-3 h-3" /> Discard
        </button>
      </div>
    </div>
  );
};
