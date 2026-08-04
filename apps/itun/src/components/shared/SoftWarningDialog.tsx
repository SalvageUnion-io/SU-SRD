/**
 * SoftWarningDialog — the confirm-and-proceed dialog for advisory rule
 * violations surfaced at save time (REQ-012, ADR-021).
 *
 * Soft warnings NEVER block: the Live Sheet is a free / override surface, so
 * this dialog only ever asks. "Save anyway" persists the previewed patch;
 * cancelling discards it. It is not rendered at all when an edit is clean —
 * `useSoftWarnings.preview()` returns an empty array and the caller saves
 * straight through, so the flow is invisible unless something is wrong.
 *
 * Built on the shared `ModalShell` (never a hand-rolled dialog) and `Banner`,
 * which already owns the per-severity ('info' | 'warn') state tokens — no
 * colour is chosen here.
 */

import { Banner, Button, ModalShell } from 'component-lib'
import type { SoftWarning } from '../../lib/rules/types'

type SoftWarningDialogProps = {
  open: boolean
  /** The advisory rows, straight from `useSoftWarnings().warnings`. */
  warnings: SoftWarning[]
  /** What the pending edit is, e.g. "Remove Engineering Expertise". */
  subtitle?: string
  /** Discard the pending edit — wire to `fixIt()`. */
  onCancel: () => void
  /** Persist the pending edit regardless — wire to `saveAnyway()`. */
  onSaveAnyway: () => void
}

export function SoftWarningDialog({
  open,
  warnings,
  subtitle,
  onCancel,
  onSaveAnyway,
}: SoftWarningDialogProps) {
  return (
    <ModalShell
      open={open && warnings.length > 0}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
      title="Check this edit?"
      subtitle={subtitle}
      description="Advisory rule warnings for this edit. Saving is always allowed."
      maxWidth="max-w-lg"
    >
      <div className="flex flex-col gap-4 bg-paper p-5">
        <p className="m-0 font-body text-sm text-wk-muted">
          This edit is legal to make — the rules just flag it. Save anyway, or go back and change
          it.
        </p>
        <Banner warnings={warnings} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="compact" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="compact" onClick={onSaveAnyway}>
            Save anyway
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
