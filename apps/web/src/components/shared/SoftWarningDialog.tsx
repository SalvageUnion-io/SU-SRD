/**
 * SoftWarningDialog — the confirm-and-proceed dialog for advisory rule
 * violations surfaced at save time (ADR-021).
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

import type { CSSProperties } from 'react'
import type { SoftWarning } from 'salvageunion-reference/rules'
import { color, font, fontSize, space } from '../../design/tokens'
import { Banner, Button, ModalShell } from '../index'

const BODY = {
  backgroundColor: color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  padding: space[20],
} satisfies CSSProperties

const LEDE = {
  color: color.wkMuted,
  fontFamily: font.body,
  fontSize: fontSize.sm,
  lineHeight: '1.25rem',
  margin: 0,
} satisfies CSSProperties

const ACTIONS = {
  display: 'flex',
  gap: space[8],
  justifyContent: 'flex-end',
} satisfies CSSProperties

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
      maxWidth="su-soft-warning-dialog"
    >
      <div style={BODY}>
        <p style={LEDE}>
          This edit is legal to make — the rules just flag it. Save anyway, or go back and change
          it.
        </p>
        <Banner warnings={warnings} />
        <div style={ACTIONS}>
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
