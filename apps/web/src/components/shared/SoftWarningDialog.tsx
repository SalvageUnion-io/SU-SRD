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
import { color, space } from '../../design/tokens'
import { sharedCopy } from '../../messages/components-shared'
import { Text } from '../atoms/Text'
import { Banner, Button, DialogActions, ModalShell } from '../index'

const BODY = {
  backgroundColor: color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: space[16],
  padding: space[20],
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
      title={sharedCopy('checkThisEdit')}
      subtitle={subtitle}
      description={sharedCopy('advisoryRuleWarningsForThis')}
      width="narrow"
    >
      <div style={BODY}>
        <Text variant="note">{sharedCopy('thisEditIsLegalTo')}</Text>
        <Banner warnings={warnings} />
        <DialogActions>
          <Button variant="ghost" size="compact" onClick={onCancel}>
            {sharedCopy('cancel')}
          </Button>
          <Button variant="primary" size="compact" onClick={onSaveAnyway}>
            {sharedCopy('saveAnyway')}
          </Button>
        </DialogActions>
      </div>
    </ModalShell>
  )
}
