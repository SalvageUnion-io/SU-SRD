/**
 * Wizard draft persistence (audit item 3).
 *
 * All wizard form state lived in plain useState, so a refresh, back-nav,
 * PWA autoUpdate reload, or mis-tap silently destroyed a multi-step build.
 * Drafts now mirror to sessionStorage on every change and restore on mount.
 *
 * sessionStorage (not localStorage) is deliberate: drafts are a
 * crash/refresh safety net for the CURRENT session, not long-lived state —
 * they expire with the tab, never sync across tabs, and cannot go stale for
 * weeks. The serialized form is a plain `lib/wizard/*FormState.ts` object.
 *
 * Storage failures (quota, disabled storage) degrade silently to the old
 * behavior — drafts are best-effort, never load-bearing.
 */

import { useEffect, useMemo, useRef } from 'react'

const PREFIX = 'itun-wizard-draft'

export type WizardKind = 'pilot' | 'mech' | 'crawler'

/** Draft slot: one per kind for creates, one per entity for edits. */
export function wizardDraftKey(kind: WizardKind, entityId?: string): string {
  return entityId ? `${PREFIX}:${kind}:edit:${entityId}` : `${PREFIX}:${kind}:new`
}

/** Read a stored draft; null when absent or unparseable (corrupt → cleared). */
export function readWizardDraft<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  } catch {
    try {
      sessionStorage.removeItem(key)
    } catch {
      /* storage unavailable — nothing to clear */
    }
    return null
  }
}

/** Drop a draft — call on successful submit or a confirmed cancel. */
export function clearWizardDraft(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

/**
 * Mirrors `form` into sessionStorage whenever it differs from `baseline`
 * (the pristine initial state) and returns that dirty flag. A form that
 * reverts to pristine keeps its stored draft — cheaper to reason about, and
 * clearWizardDraft() runs on every exit path anyway.
 */
export function useWizardDraftSync<T>(key: string, form: T, baseline: T): boolean {
  // Serialize once per change; forms are small flat objects (< 1 KB).
  const serialized = useMemo(() => JSON.stringify(form), [form])
  const baselineSerialized = useMemo(() => JSON.stringify(baseline), [baseline])
  const dirty = serialized !== baselineSerialized

  // Skip the initial mount write: restoring a draft already counts as dirty,
  // and re-writing the identical payload is wasted churn.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      if (!dirty) return
    }
    if (!dirty) return
    try {
      sessionStorage.setItem(key, serialized)
    } catch {
      /* quota/unavailable — draft protection degrades silently */
    }
  }, [key, serialized, dirty])

  return dirty
}
