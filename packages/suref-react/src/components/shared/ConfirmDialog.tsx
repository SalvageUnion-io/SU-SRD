/**
 * ConfirmDialog — a standard confirmation dialog (lifted from ITUN, pending
 * review).
 *
 * A thin wrapper over `ModalShell` (base-ui Dialog: portal, focus trap,
 * Escape/backdrop dismiss) so every confirm flow shares one shell, one
 * backdrop, and one max-width instead of hand-rolling `role="dialog"`.
 *
 * `danger` switches the header to rust and the confirm button to the danger
 * variant for destructive actions (delete, unassign).
 */

import type { ReactNode } from 'react'
import { Btn } from '../chrome/Btn'
import { ModalShell } from './ModalShell'

type ConfirmDialogProps = {
  open: boolean
  title: string
  /** Body copy rendered above the action row. */
  children?: ReactNode
  confirmLabel: string
  /** Label shown on the confirm button while `pending` (defaults to confirmLabel). */
  pendingLabel?: string
  cancelLabel?: string
  /** Rust header + danger confirm button for destructive actions. */
  danger?: boolean
  pending?: boolean
  error?: string | null
  confirmAriaLabel?: string
  confirmDisabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  pendingLabel,
  cancelLabel = 'Cancel',
  danger = false,
  pending = false,
  error = null,
  confirmAriaLabel,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <ModalShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onCancel()
      }}
      title={title}
      headerBg={danger ? 'bg-su-rust' : 'bg-su-orange'}
      maxWidth="max-w-md"
      align="center"
    >
      <div className="flex flex-col gap-4 bg-paper p-5">
        {children && <div className="font-body text-sm text-wk-muted">{children}</div>}

        {error && (
          <p className="font-body text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Btn variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </Btn>
          <Btn
            variant={danger ? 'danger' : 'primary'}
            size="sm"
            onClick={onConfirm}
            disabled={pending || confirmDisabled}
            aria-label={confirmAriaLabel}
          >
            {pending ? (pendingLabel ?? confirmLabel) : confirmLabel}
          </Btn>
        </div>
      </div>
    </ModalShell>
  )
}
