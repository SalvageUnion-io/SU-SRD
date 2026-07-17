/**
 * UnassignLinkButton — confirm dialog → entityStore.delete('softLink', linkId).
 *
 * Surfaces copy explaining that removing the link does NOT delete either
 * endpoint entity. Confirmation runs through the shared ConfirmDialog
 * (ModalShell-based).
 *
 * Props:
 *   linkId      — id of the SoftLink to remove
 *   store       — injectable store for testability (omit in production)
 *   onUnassigned — optional callback fired after the link is removed
 *   label       — button label (default: "Unassign")
 *   className   — optional class override for the trigger button
 */

import { useState } from 'react'
import { Btn } from 'suref-react'

import { useEntityStore } from '../../stores/entityStore'
import { ConfirmDialog } from 'suref-react'
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
      <Btn
        variant="ghost"
        size="sm"
        onClick={openConfirm}
        className={cn('text-danger hover:text-danger', className)}
        aria-label={`${label} — remove soft link`}
      >
        {label}
      </Btn>

      <ConfirmDialog
        open={open}
        title="Remove assignment?"
        danger
        confirmLabel="Remove link"
        pendingLabel="Removing…"
        confirmAriaLabel="Confirm unassign"
        pending={pending}
        error={error}
        onConfirm={() => void handleConfirm()}
        onCancel={closeConfirm}
      >
        This only removes the link between the entities &mdash; it does <strong>not</strong> delete
        either the pilot, mech, or crawler.
      </ConfirmDialog>
    </>
  )
}
