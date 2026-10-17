import { useState, useEffect, useRef, useCallback } from 'react';

export type AutoSaveStatus = 'idle' | 'saving' | 'saved';

export interface DraftMetadata<T> {
  data: T;
  timestamp: string;
}

export function useAutoSave<T>(
  storageKey: string,
  currentData: T,
  debounceMs: number = 800,
  isEnabled: boolean = true
) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState<boolean>(false);
  const [draftTimestamp, setDraftTimestamp] = useState<string | null>(null);
  const isFirstRender = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if draft exists in localStorage on initial mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftMetadata<T>;
        if (parsed && parsed.data) {
          setHasDraft(true);
          setDraftTimestamp(parsed.timestamp);
          setLastSaved(new Date(parsed.timestamp));
        }
      }
    } catch (e) {
      console.warn('Failed to parse draft from localStorage', e);
    }
  }, [storageKey]);

  // Debounced auto-save effect
  useEffect(() => {
    if (!isEnabled) return;

    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setStatus('saving');

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      try {
        const now = new Date();
        const payload: DraftMetadata<T> = {
          data: currentData,
          timestamp: now.toISOString()
        };
        localStorage.setItem(storageKey, JSON.stringify(payload));
        setStatus('saved');
        setLastSaved(now);
        setHasDraft(true);
        setDraftTimestamp(now.toISOString());
      } catch (e) {
        console.error('AutoSave failed to write to localStorage', e);
        setStatus('idle');
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [currentData, storageKey, debounceMs, isEnabled]);

  const getSavedDraft = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftMetadata<T>;
        return parsed.data;
      }
    } catch (e) {
      console.warn('Failed to retrieve draft', e);
    }
    return null;
  }, [storageKey]);

  const discardDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setDraftTimestamp(null);
      setLastSaved(null);
      setStatus('idle');
    } catch (e) {
      console.warn('Failed to discard draft', e);
    }
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
      setHasDraft(false);
      setDraftTimestamp(null);
      setStatus('idle');
    } catch (e) {
      console.warn('Failed to clear draft', e);
    }
  }, [storageKey]);

  return {
    status,
    lastSaved,
    hasDraft,
    draftTimestamp,
    getSavedDraft,
    discardDraft,
    clearDraft
  };
}
