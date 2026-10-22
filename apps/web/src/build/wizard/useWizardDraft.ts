/**
 * useWizardDraft — a wizard's form, restored from its session draft and
 * mirrored back to it (`lib/wizard/wizardDraft.ts`).
 *
 * A stored draft (refresh, back-nav, PWA reload) wins over the baseline;
 * `useWizardFlow` clears it on submit and on a cancelled exit. A wizard with
 * creation rules passes `clamp`, the deterministic §5.3 clamp that resolves a
 * pre-enforcement draft to the starting rules: its removals are announced
 * once, by toast. `reapply` puts a deep-linked pick (`?class=`, `?chassis=`,
 * `?type=`, `lib/wizard/preselect.ts`) back over a restored draft; the
 * baseline carries the same pick, so following the link alone leaves nothing
 * to discard.
 */

import type { Dispatch, SetStateAction } from 'react'
import { useEffect, useRef, useState } from 'react'
import { toast } from '../../components/index'
import type { WizardKind } from '../../lib/wizard/wizardDraft'
import { readWizardDraft, useWizardDraftSync, wizardDraftKey } from '../../lib/wizard/wizardDraft'

type WizardDraftOptions<T> = {
  /** The pristine form: what a fresh wizard (or an empty draft) starts from. */
  baseline: T
  /** Resolve a restored draft to the starting rules, naming what it removed. */
  clamp?: (draft: T) => { form: T; removed: string[] }
  /** Re-apply the deep-linked pick over a restored draft. */
  reapply?: (form: T) => T
}

export type WizardDraft<T> = {
  form: T
  setForm: Dispatch<SetStateAction<T>>
  /** Whether the form differs from the baseline. */
  formDirty: boolean
  /** The draft's sessionStorage key, for `useWizardFlow` to clear. */
  draftKey: string
}

export function useWizardDraft<T>(
  kind: WizardKind,
  { baseline, clamp, reapply }: WizardDraftOptions<T>
): WizardDraft<T> {
  const draftKey = wizardDraftKey(kind)
  const clampRemovedRef = useRef<string[] | null>(null)
  const [form, setForm] = useState<T>(() => {
    const draft = readWizardDraft<T>(draftKey)
    if (!draft) return baseline
    let restored: T = draft
    if (clamp) {
      const { form: clamped, removed } = clamp(draft)
      if (removed.length > 0) clampRemovedRef.current = removed
      restored = clamped
    }
    return reapply ? reapply(restored) : restored
  })
  useEffect(() => {
    const removed = clampRemovedRef.current
    if (removed && removed.length > 0) {
      clampRemovedRef.current = null
      toast.info(`Draft trimmed to the starting rules — removed ${removed.join(', ')}.`)
    }
  }, [])
  const formDirty = useWizardDraftSync(draftKey, form, baseline)
  return { form, setForm, formDirty, draftKey }
}
