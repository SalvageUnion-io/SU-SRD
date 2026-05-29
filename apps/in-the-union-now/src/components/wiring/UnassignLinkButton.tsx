/**
 * UnassignLinkButton — confirm dialog → entityStore.delete('softLink', linkId).
 *
 * Surfaces copy explaining that removing the link does NOT delete either
 * endpoint entity. The dialog is intentionally minimal (inline confirm, not
 * a full modal) to avoid a separate dependency.
 *
 * Props:
 *   linkId      — id of the SoftLink to remove
 *   store       — injectable store for testability (omit in production)
 *   onUnassigned — optional callback fired after the link is removed
 *   label       — button label (default: "Unassign")
 *   className   — optional class override for the trigger button
 */

import { useRef, useState } from 'react'

import { useEntityStore } from '../../stores/entityStore'
import { useDialogA11y } from '../shared/useDialogA11y'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

/** Minimal store slice needed by UnassignLinkButton. */
export type UnassignStore = {
  delete: (type: 'softLink', id: string) => Promise<void>
}

type UnassignLinkButtonProps = {
  linkId: string
  /** Inject to avoid Zustand global in tests. */
  store?: UnassignStore
  onUnassigned?: () => void
  label?: string
  className?: string
}

export function UnassignLinkButton({
  linkId,
  store,
  onUnassigned,
  label = 'Unassign',
  className,
}: UnassignLinkButtonProps) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openConfirm() {
    setError(null)
    setOpen(true)
  }

  function closeConfirm() {
    setOpen(false)
    setError(null)
  }

  async function handleConfirm() {
    setPending(true)
    setError(null)
    try {
      const s = store ?? useEntityStore.getState()
      await s.delete('softLink', linkId)
      setOpen(false)
      onUnassigned?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove link.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={openConfirm}
        className={cn('text-destructive hover:text-destructive', className)}
        aria-label={`${label} — remove soft link`}
      >
        {label}
      </Button>

      {open && (
        <UnassignConfirmDialog
          error={error}
          pending={pending}
          onConfirm={handleConfirm}
          onClose={closeConfirm}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Dialog sub-component (mounted only when open, so useDialogA11y runs once)
// ---------------------------------------------------------------------------

type UnassignConfirmDialogProps = {
  error: string | null
  pending: boolean
  onConfirm: () => Promise<void>
  onClose: () => void
}

function UnassignConfirmDialog({ error, pending, onConfirm, onClose }: UnassignConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogA11y({ ref: dialogRef, onClose })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unassign-confirm-title"
        className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg"
      >
        <h2 id="unassign-confirm-title" className="mb-2 text-base font-semibold">
          Remove assignment?
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          This only removes the link between the entities &mdash; it does <strong>not</strong>{' '}
          delete either the pilot, mech, or crawler.
        </p>

        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => void onConfirm()}
            disabled={pending}
            aria-label="Confirm unassign"
          >
            {pending ? 'Removing…' : 'Remove link'}
          </Button>
        </div>
      </div>
    </div>
  )
}
