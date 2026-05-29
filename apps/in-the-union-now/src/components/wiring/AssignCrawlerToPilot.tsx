/**
 * AssignCrawlerToPilot — button that opens a crawler selector dialog, then
 * creates a pilot-to-crawler SoftLink on confirm.
 *
 * Symmetric to AssignPilotToMech: the pilot is the `from` end and the
 * selected crawler is the `to` end (link type: 'pilot-to-crawler').
 *
 * Props:
 *   pilotId     — id of the pilot being assigned to a crawler
 *   store       — injectable store for testability (omit in production)
 *   onAssigned  — optional callback fired after the link is created
 *   className   — optional class override for the trigger button
 */

import { useRef, useState } from 'react'

import { useEntityStore } from '../../stores/entityStore'
import type { Crawler } from '../../lib/schemas/crawler'
import type { SoftLinkStore } from './useSoftLinks'
import { useSoftLinks } from './useSoftLinks'
import { useDialogA11y } from '../shared/useDialogA11y'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

/** Extended injectable store that also exposes crawler listing. */
export type AssignCrawlerStore = SoftLinkStore & {
  crawlers: Crawler[]
}

type AssignCrawlerToPilotProps = {
  pilotId: string
  /** Inject to avoid Zustand global in tests. */
  store?: AssignCrawlerStore
  onAssigned?: () => void
  className?: string
}

export function AssignCrawlerToPilot({
  pilotId,
  store,
  onAssigned,
  className,
}: AssignCrawlerToPilotProps) {
  const [open, setOpen] = useState(false)
  const [selectedCrawlerId, setSelectedCrawlerId] = useState<string>('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { assign } = useSoftLinks({ entityType: 'pilot', entityId: pilotId, store })

  // Subscribe to crawlers from real store when not injected
  const zustandCrawlers = useEntityStore((s) => s.crawlers)
  const crawlers: Crawler[] = store ? store.crawlers : zustandCrawlers

  function openDialog() {
    setSelectedCrawlerId('')
    setError(null)
    setOpen(true)
  }

  function closeDialog() {
    setOpen(false)
    setError(null)
  }

  async function handleConfirm() {
    if (!selectedCrawlerId) {
      setError('Please select a crawler.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await assign({ type: 'crawler', id: selectedCrawlerId })
      setOpen(false)
      onAssigned?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign crawler.')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={openDialog}
        className={cn(className)}
        aria-label="Assign crawler to pilot"
      >
        Assign Crawler
      </Button>

      {open && (
        <AssignCrawlerDialog
          crawlers={crawlers}
          selectedCrawlerId={selectedCrawlerId}
          setSelectedCrawlerId={setSelectedCrawlerId}
          error={error}
          pending={pending}
          onConfirm={handleConfirm}
          onClose={closeDialog}
        />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Dialog sub-component (mounted only when open, so useDialogA11y runs once)
// ---------------------------------------------------------------------------

type AssignCrawlerDialogProps = {
  crawlers: Crawler[]
  selectedCrawlerId: string
  setSelectedCrawlerId: (id: string) => void
  error: string | null
  pending: boolean
  onConfirm: () => Promise<void>
  onClose: () => void
}

function AssignCrawlerDialog({
  crawlers,
  selectedCrawlerId,
  setSelectedCrawlerId,
  error,
  pending,
  onConfirm,
  onClose,
}: AssignCrawlerDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialogA11y({ ref: dialogRef, onClose })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-crawler-title"
        className="w-full max-w-sm rounded-lg border bg-background p-6 shadow-lg"
      >
        <h2 id="assign-crawler-title" className="mb-4 text-base font-semibold">
          Assign Pilot to Crawler
        </h2>

        {crawlers.length === 0 ? (
          <p className="mb-4 text-sm text-muted-foreground">
            No crawlers found. Create a crawler first.
          </p>
        ) : (
          <div className="mb-4 space-y-2">
            {crawlers.map((crawler) => (
              <label
                key={crawler.id}
                className="flex cursor-pointer items-center gap-2 rounded border p-2 hover:bg-accent"
              >
                <input
                  type="radio"
                  name="crawler-select"
                  value={crawler.id}
                  checked={selectedCrawlerId === crawler.id}
                  onChange={() => setSelectedCrawlerId(crawler.id)}
                  className="accent-primary"
                />
                <span className="text-sm font-medium">{crawler.name}</span>
                <span className="text-xs text-muted-foreground">{crawler.techLevel}</span>
              </label>
            ))}
          </div>
        )}

        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => void onConfirm()}
            disabled={pending || crawlers.length === 0}
            aria-label="Confirm crawler assignment"
          >
            {pending ? 'Assigning…' : 'Assign'}
          </Button>
        </div>
      </div>
    </div>
  )
}
