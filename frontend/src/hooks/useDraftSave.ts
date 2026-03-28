'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Business } from '@/lib/types';

type Visibility = 'friends' | '2hop' | 'private';

export interface DraftData {
  business: Business | null;
  rating: number;
  body: string;
  promptAnswers: Record<string, string>;
  pros: string[];
  cons: string[];
  visibility: Visibility;
  timestamp: number;
}

const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const AUTOSAVE_INTERVAL_MS = 5000;

function getDraftKey(businessId: string | undefined): string {
  return businessId ? `review-draft-${businessId}` : 'review-draft-new';
}

function loadDraft(key: string): DraftData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const draft: DraftData = JSON.parse(raw);
    if (Date.now() - draft.timestamp > DRAFT_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function saveDraft(key: string, data: Omit<DraftData, 'timestamp'>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify({ ...data, timestamp: Date.now() }));
  } catch {
    // Storage quota exceeded — fail silently
  }
}

function clearDraft(key: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(key);
}

interface UseDraftSaveOptions {
  business: Business | null;
  rating: number;
  body: string;
  promptAnswers: Record<string, string>;
  pros: string[];
  cons: string[];
  visibility: Visibility;
}

interface UseDraftSaveReturn {
  hasDraft: boolean;
  resumeDraft: () => DraftData | null;
  discardDraft: () => void;
  clearOnSubmit: () => void;
}

export function useDraftSave(opts: UseDraftSaveOptions): UseDraftSaveReturn {
  const key = getDraftKey(opts.business?.id);
  const prevKeyRef = useRef<string>(key);

  // Track if there's a pending draft (checked once on mount per business)
  const [hasDraft, setHasDraft] = useState<boolean>(() => {
    const draft = loadDraft(key);
    return draft !== null;
  });

  // Re-check draft when business changes (new key)
  useEffect(() => {
    const newKey = getDraftKey(opts.business?.id);
    if (newKey !== prevKeyRef.current) {
      prevKeyRef.current = newKey;
      setHasDraft(loadDraft(newKey) !== null);
    }
  }, [opts.business?.id]);

  // Autosave every 5 seconds
  useEffect(() => {
    const id = setInterval(() => {
      const currentKey = getDraftKey(opts.business?.id);
      // Only save if there's meaningful content
      const hasContent =
        opts.business !== null ||
        opts.rating > 0 ||
        opts.body.trim().length > 0 ||
        Object.values(opts.promptAnswers).some((v) => v.trim().length > 0) ||
        opts.pros.some(Boolean) ||
        opts.cons.some(Boolean);

      if (hasContent) {
        saveDraft(currentKey, {
          business: opts.business,
          rating: opts.rating,
          body: opts.body,
          promptAnswers: opts.promptAnswers,
          pros: opts.pros,
          cons: opts.cons,
          visibility: opts.visibility,
        });
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [opts.business, opts.rating, opts.body, opts.promptAnswers, opts.pros, opts.cons, opts.visibility]);

  const resumeDraft = useCallback((): DraftData | null => {
    const currentKey = getDraftKey(opts.business?.id);
    const draft = loadDraft(currentKey);
    if (draft) setHasDraft(false);
    return draft;
  }, [opts.business?.id]);

  const discardDraft = useCallback(() => {
    const currentKey = getDraftKey(opts.business?.id);
    clearDraft(currentKey);
    setHasDraft(false);
  }, [opts.business?.id]);

  const clearOnSubmit = useCallback(() => {
    const currentKey = getDraftKey(opts.business?.id);
    clearDraft(currentKey);
    setHasDraft(false);
  }, [opts.business?.id]);

  return { hasDraft, resumeDraft, discardDraft, clearOnSubmit };
}
