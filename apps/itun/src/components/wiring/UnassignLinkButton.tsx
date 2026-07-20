/**
 * UnassignLinkButton — confirm dialog → entityStore.delete('softLink', linkId).
 *
 * Surfaces copy explaining that removing the link does NOT delete either
 * endpoint entity. Confirmation runs through an inline ModalShell.
 *
 * Props:
 *   linkId      — id of the SoftLink to remove
 *   store       — injectable store for testability (omit in production)
 *   onUnassigned — optional callback fired after the link is removed
 *   label       — button label (default: "Unassign")
 *   className   — optional class override for the trigger button
 */

import { useState } from 'react'
import { Button, ModalShell, FieldError } from 'component-lib'

import { useEntityStore } from '../../stores/entityStore'
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
        className={cn('text-danger hover:text-danger', className)}
        aria-label={`${label} — remove soft link`}
      >
        {label}
      </Button>

      <ModalShell
        open={open}
        onOpenChange={(next) => {
          if (!next) closeConfirm()
        }}
        title="Remove assignment?"
        tone="danger"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4 bg-paper p-5">
          <div className="font-body text-sm text-wk-muted">
            This only removes the link between the entities &mdash; it does <strong>not</strong>{' '}
            delete either the pilot, mech, or crawler.
          </div>
          {error && <FieldError>{error}</FieldError>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={closeConfirm} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void handleConfirm()}
              disabled={pending}
              aria-label="Confirm unassign"
            >
              {pending ? 'Removing…' : 'Remove link'}
            </Button>
          </div>
        </div>
      </ModalShell>
    </>
  )
}
