/**
 * Wizard draft persistence.
 *
 * Wizard form state is plain useState, so on its own a refresh, back-nav, PWA
 * autoUpdate reload, or mis-tap would silently destroy a multi-step build.
 * Drafts mirror to the browser's storage on every change and restore on mount.
 *
 * Where (`DRAFT_SCOPE`, r6 F6): in this browser, in every tab, until the
 * build is saved or discarded (localStorage), so closing the tab or opening
 * the wizard in another keeps the build. It is never sent to the server, so a
 * signed-out draft saves nothing (ADR-034). The serialized form is a plain
 * `lib/wizard/*FormState.ts` object.
 *
 * Storage failures (quota, disabled storage) degrade silently to an unsaved
 * draft — drafts are best-effort, never load-bearing.
 */

import type { EntityKind } from 'game-domain/entityKinds'
import { useEffect, useMemo, useRef } from 'react'

const PREFIX = 'app-wizard-draft'

/**
 * The r6 F6 ruling, in its one place: `'browser'` keeps a draft in every tab
 * of this browser until it is saved or discarded (localStorage); `'tab'`
 * keeps it to this tab (sessionStorage), and step 1 says so (`tryNote`).
 */
export const DRAFT_SCOPE: 'browser' | 'tab' = 'browser'

/** The storage a draft is kept in, per `DRAFT_SCOPE`. */
export function draftStorage(): Storage {
  return DRAFT_SCOPE === 'browser' ? localStorage : sessionStorage
}

export type WizardKind = EntityKind

/**
 * Draft slot: one per wizard kind. The `:new` suffix is load-bearing — it is
 * the key drafts were always written under.
 */
export function wizardDraftKey(kind: WizardKind): string {
  return `${PREFIX}:${kind}:new`
}

/** Read a stored draft; null when absent or unparseable (corrupt → cleared). */
export function readWizardDraft<T>(key: string): T | null {
  try {
    const raw = draftStorage().getItem(key)
    if (raw === null) return null
    return JSON.parse(raw) as T
  } catch {
    // A corrupt or unreadable draft: drop it and start the wizard clean.
    try {
      draftStorage().removeItem(key)
    } catch {
      /* storage unavailable — nothing to clear */
    }
    return null
  }
}

/** Drop a draft — call on successful submit or a confirmed cancel. */
export function clearWizardDraft(key: string): void {
  try {
    draftStorage().removeItem(key)
    draftStorage().removeItem(`${key}:reached`)
    draftStorage().removeItem(`${key}:signIn`)
  } catch {
    /* storage unavailable — nothing to clear */
  }
}

/**
 * The furthest step a draft's wizard reached (its index), so a reload
 * reopens there, not at step 1; 0 when none is stored.
 */
export function readWizardReached(key: string): number {
  try {
    const n = Number.parseInt(draftStorage().getItem(`${key}:reached`) ?? '', 10)
    return Number.isFinite(n) && n > 0 ? n : 0
  } catch {
    return 0
  }
}

/** That Save asked for a sign-in over this draft, so the return can say what is left (r5 C14). */
export function markWizardSignIn(key: string): void {
  try {
    draftStorage().setItem(`${key}:signIn`, '1')
  } catch {
    /* unavailable — the return says nothing extra */
  }
}

/** Whether Save asked for a sign-in over this draft (`markWizardSignIn`). */
export function readWizardSignIn(key: string): boolean {
  try {
    return draftStorage().getItem(`${key}:signIn`) !== null
  } catch {
    return false
  }
}

/** Store the furthest step reached, beside the draft. */
export function writeWizardReached(key: string, index: number): void {
  try {
    draftStorage().setItem(`${key}:reached`, String(index))
  } catch {
    /* quota/unavailable — a reload starts at step 1 */
  }
}

/**
 * Mirrors `form` into the draft's storage whenever it differs from `baseline`
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
      draftStorage().setItem(key, serialized)
    } catch {
      /* quota/unavailable — draft protection degrades silently */
    }
  }, [key, serialized, dirty])

  return dirty
}
