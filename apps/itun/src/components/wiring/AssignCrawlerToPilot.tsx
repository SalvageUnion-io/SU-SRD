/**
 * AssignCrawlerToPilot — button that opens a crawler selector dialog, then
 * creates a pilot-to-crawler SoftLink on confirm.
 *
 * Symmetric to AssignPilotToMech: the pilot is the `from` end and the
 * selected crawler is the `to` end (link type: 'pilot-to-crawler'). Dialog UI
 * is an inline ModalShell with a radio list (the SelectorDialog grammar,
 * absorbed per ruleset §6).
 *
 * Props:
 *   pilotId     — id of the pilot being assigned to a crawler
 *   store       — injectable store for testability (omit in production)
 *   onAssigned  — optional callback fired after the link is created
 *   className   — optional class override for the trigger button
 */

import { Button, FieldError, ModalShell, Radio } from 'component-lib'
import { useState } from 'react'
import { useCrawlers } from '../../hooks/queries'
import type { Crawler } from '../../lib/schemas/crawler'
import { cn } from '../../lib/utils'
import type { SoftLinkStore } from './useSoftLinks'
import { useSoftLinks } from './useSoftLinks'

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
  const zustandCrawlers = useCrawlers()
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
        size="compact"
        onClick={openDialog}
        className={cn(className)}
        aria-label="Assign crawler to pilot"
      >
        Assign Crawler
      </Button>

      <ModalShell
        open={open}
        onOpenChange={(next) => {
          if (!next) closeDialog()
        }}
        title="Assign Pilot to Crawler"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4 bg-paper p-5">
          {crawlers.length === 0 ? (
            <p className="font-body text-sm text-wk-muted">
              No crawlers found. Create a crawler first.
            </p>
          ) : (
            <div className="space-y-2">
              {crawlers.map((crawler) => (
                <Radio
                  key={crawler.id}
                  name="crawler-select"
                  value={crawler.id}
                  checked={selectedCrawlerId === crawler.id}
                  onChange={() => setSelectedCrawlerId(crawler.id)}
                  label={crawler.name}
                  description={crawler.techLevel}
                />
              ))}
            </div>
          )}

          {error && <FieldError>{error}</FieldError>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="compact" onClick={closeDialog} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="compact"
              onClick={() => void handleConfirm()}
              disabled={pending || crawlers.length === 0}
              aria-label="Confirm crawler assignment"
            >
              {pending ? 'Assigning…' : 'Assign'}
            </Button>
          </div>
        </div>
      </ModalShell>
    </>
  )
}
