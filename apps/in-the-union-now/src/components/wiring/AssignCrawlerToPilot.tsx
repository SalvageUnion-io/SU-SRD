/**
 * AssignCrawlerToPilot — button that opens a crawler selector dialog, then
 * creates a pilot-to-crawler SoftLink on confirm.
 *
 * Symmetric to AssignPilotToMech: the pilot is the `from` end and the
 * selected crawler is the `to` end (link type: 'pilot-to-crawler'). Dialog UI
 * is the shared SelectorDialog (ModalShell-based).
 *
 * Props:
 *   pilotId     — id of the pilot being assigned to a crawler
 *   store       — injectable store for testability (omit in production)
 *   onAssigned  — optional callback fired after the link is created
 *   className   — optional class override for the trigger button
 */

import { useState } from 'react'
import { Btn } from 'component-lib'

import { useCrawlers } from '../../hooks/queries'
import type { Crawler } from '../../lib/schemas/crawler'
import type { SoftLinkStore } from './useSoftLinks'
import { useSoftLinks } from './useSoftLinks'
import { SelectorDialog } from '../shared/SelectorDialog'
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
      <Btn
        size="sm"
        onClick={openDialog}
        className={cn(className)}
        aria-label="Assign crawler to pilot"
      >
        Assign Crawler
      </Btn>

      <SelectorDialog
        open={open}
        title="Assign Pilot to Crawler"
        radioGroupName="crawler-select"
        options={crawlers.map((crawler) => ({
          id: crawler.id,
          label: crawler.name,
          sublabel: crawler.techLevel,
        }))}
        emptyMessage="No crawlers found. Create a crawler first."
        selectedId={selectedCrawlerId}
        onSelect={setSelectedCrawlerId}
        confirmAriaLabel="Confirm crawler assignment"
        pending={pending}
        error={error}
        onConfirm={() => void handleConfirm()}
        onClose={closeDialog}
      />
    </>
  )
}
