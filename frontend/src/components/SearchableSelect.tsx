import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, Search } from 'lucide-react';

export interface SearchableSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  /** Optional prominent action row pinned at the bottom (e.g. "Add New Client…") */
  actionItem?: { label: string; onSelect: () => void };
  className?: string;
}

/**
 * Themed, searchable dropdown rendered through a portal so it never gets
 * clipped by parent `overflow` containers (modals, tables, etc.). Replaces
 * native <select> elements whose option lists can't be styled.
 */
export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matches found',
  disabled = false,
  actionItem,
  className = ''
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [dropStyle, setDropStyle] = useState<{ top: number; left: number; width: number; maxHeight: number }>({
    top: 0,
    left: 0,
    width: 0,
    maxHeight: 280
  });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o =>
      o.label.toLowerCase().includes(q) || (o.description || '').toLowerCase().includes(q)
    );
  }, [options, query]);

  const updatePosition = () => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(300, openUp ? spaceAbove : spaceBelow));
    setDropStyle({
      top: openUp ? rect.top - Math.min(maxHeight, spaceAbove) - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      maxHeight
    });
  };

  useLayoutEffect(() => {
    if (open) {
      updatePosition();
      // focus search after portal paint
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleReposition = () => updatePosition();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setHighlight(0);
    }
  }, [open]);

  const commit = (val: string) => {
    onChange(val);
    setOpen(false);
  };

  const handleListKey = (e: React.KeyboardEvent) => {
    const rows = filtered.length + (actionItem ? 1 : 0);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => (rows === 0 ? 0 : (h + 1) % rows));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => (rows === 0 ? 0 : (h - 1 + rows) % rows));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (actionItem && highlight === filtered.length) {
        actionItem.onSelect();
        setOpen(false);
      } else if (filtered[highlight]) {
        commit(filtered[highlight].value);
      }
    }
  };

  // Keep the highlighted row in view
  useEffect(() => {
    const list = listRef.current;
    if (!list || !open) return;
    const el = list.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2.5 min-h-[44px] text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500 hover:border-emerald-400/60 dark:hover:border-slate-700 transition text-left ${disabled ? 'opacity-60 cursor-not-allowed' : ''} ${className}`}
      >
        <span className={`truncate min-w-0 ${selected ? '' : 'text-slate-400 dark:text-slate-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && createPortal(
        <div
          ref={listRef}
          onKeyDown={handleListKey}
          style={{
            position: 'fixed',
            top: dropStyle.top,
            left: dropStyle.left,
            width: Math.max(dropStyle.width, 240),
            maxHeight: dropStyle.maxHeight
          }}
          className="z-[100] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden"
        >
          <div className="relative shrink-0 border-b border-slate-200 dark:border-slate-800">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent pl-9 pr-3 py-2.5 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
            />
          </div>

          <div className="overflow-y-auto flex-1 py-1">
            {filtered.length === 0 && !actionItem && (
              <div className="px-3 py-4 text-xs text-slate-400 text-center">{emptyMessage}</div>
            )}
            {filtered.map((o, idx) => {
              const isActive = idx === highlight;
              const isSelected = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  data-idx={idx}
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => commit(o.value)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs transition text-left ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/60'
                      : 'bg-transparent'
                  }`}
                >
                  <span className="min-w-0">
                    <span className={`block truncate font-medium ${isSelected ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-900 dark:text-slate-200'}`}>
                      {o.label}
                    </span>
                    {o.description && (
                      <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{o.description}</span>
                    )}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                </button>
              );
            })}
            {filtered.length === 0 && actionItem && (
              <div className="px-3 py-2 text-xs text-slate-400 text-center">{emptyMessage}</div>
            )}

            {actionItem && (
              <button
                type="button"
                data-idx={filtered.length}
                onMouseEnter={() => setHighlight(filtered.length)}
                onClick={() => {
                  actionItem.onSelect();
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2.5 mt-1 border-t border-slate-200 dark:border-slate-800 text-xs font-bold transition text-left ${
                  highlight === filtered.length
                    ? 'bg-emerald-600 text-white'
                    : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="truncate">{actionItem.label}</span>
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
