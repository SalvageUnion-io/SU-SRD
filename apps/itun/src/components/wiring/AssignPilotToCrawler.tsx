/**
 * AssignPilotToCrawler — button that opens a pilot selector dialog, then
 * creates a pilot-to-crawler SoftLink on confirm.
 *
 * ## Why this exists when AssignCrawlerToPilot already does
 *
 * They are the same link drawn from opposite ends, and only one of the two ends
 * had a control. From a pilot you could pick a crawler; from a crawler you could
 * only ever **create a new pilot** — the rails offered `+ Create` and nothing
 * else. So the ordinary thing a player wants to do at a table, put an existing
 * character aboard the crew's crawler, had no path from the crawler at all.
 *
 * Mechs used to reach a bay only through their pilot, so this was also the
 * only way to dock one. Since ADR-037 a mech docks by its own `mech-to-crawler`
 * link and adding a pilot to the crew brings nobody else aboard.
 *
 * The direction is fixed by the schema, not by which button you pressed: the
 * pilot is always the `from` end. The write goes through `assignLink`, which
 * moves the pilot off any crawler they crewed before — a pilot crews one.
 *
 * Props:
 *   crawlerId   — id of the crawler being crewed
 *   store       — injectable store for testability (omit in production)
 *   onAssigned  — optional callback fired after the link is created
 *   className   — optional class override for the trigger button
 */

import { Button, cn, FieldError, ModalShell, Radio } from 'component-lib'
import { useState } from 'react'
import { usePilots } from '../../hooks/entities'
import { assignLink } from '../../lib/links/assignLink'
import type { Pilot } from '../../lib/schemas/pilot'
import { useEntityStore } from '../../stores/entityStore'
import type { SoftLinkStore } from './useSoftLinks'

/**
 * Extended injectable store that also exposes pilot listing.
 *
 * Named for the crew rather than the pilot because `AssignPilotToMech` already
 * exports an `AssignPilotStore`, and a test that reached for both would have
 * had to rename one at the import site.
 */
export type AssignCrewStore = SoftLinkStore & {
  pilots: Pilot[]
}

type AssignPilotToCrawlerProps = {
  crawlerId: string
  /** Inject to avoid Zustand global in tests. */
  store?: AssignCrewStore
  onAssigned?: () => void
  className?: string
}

export function AssignPilotToCrawler({
  crawlerId,
  store,
  onAssigned,
  className,
}: AssignPilotToCrawlerProps) {
  const [open, setOpen] = useState(false)
  const [selectedPilotId, setSelectedPilotId] = useState<string>('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Subscribe to pilots from the real store when not injected.
  const zustandPilots = usePilots()
  const pilots: Pilot[] = store ? store.pilots : zustandPilots

  /*
   * Already-crewed pilots are filtered out rather than shown and refused.
   * Re-drawing a link that exists is harmless (the mirror is idempotent by
   * endpoints), but offering it implies something would happen, and a list of
   * mostly-inert options is how a picker stops being readable.
   */
  // Always call the hook (Rules of Hooks); prefer the injected snapshot when
  // there is one, exactly as `useSoftLinks` does.
  const subscribedLinks = useEntityStore((s) => s.softLinks)
  const links = store ? store.softLinks : subscribedLinks
  const crewed = new Set(
    links
      .filter((l) => l.type === 'pilot-to-crawler' && l.to.id === crawlerId)
      .map((l) => l.from.id)
  )
  const available = pilots.filter((p) => !crewed.has(p.id))

  function openDialog() {
    setSelectedPilotId('')
    setError(null)
    setOpen(true)
  }

  function closeDialog() {
    setOpen(false)
    setError(null)
  }

  async function handleConfirm() {
    if (!selectedPilotId) {
      setError('Please select a pilot.')
      return
    }
    setPending(true)
    setError(null)
    try {
      // Not through `useSoftLinks`: that hook binds its `from` end at render
      // time, and the `from` end here is the pilot the player just picked.
      const s: SoftLinkStore = store ?? useEntityStore.getState()
      await assignLink(
        { type: 'pilot', id: selectedPilotId },
        { type: 'crawler', id: crawlerId },
        s
      )
      setOpen(false)
      onAssigned?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add that pilot to the crew.')
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
        aria-label="Add an existing pilot to this crawler's crew"
      >
        + Add Crew
      </Button>

      <ModalShell
        open={open}
        onOpenChange={(next) => {
          if (!next) closeDialog()
        }}
        title="Add Pilot to Crew"
        maxWidth="max-w-md"
      >
        <div className="flex flex-col gap-4 bg-paper p-5">
          {available.length === 0 ? (
            <p className="font-body text-sm text-wk-muted">
              {pilots.length === 0
                ? 'No pilots yet. Create one first, then bring them aboard.'
                : 'Every pilot you have is already crewing this crawler.'}
            </p>
          ) : (
            <div className="space-y-2">
              {available.map((pilot) => (
                <Radio
                  key={pilot.id}
                  name="pilot-select"
                  value={pilot.id}
                  checked={selectedPilotId === pilot.id}
                  onChange={() => setSelectedPilotId(pilot.id)}
                  label={pilot.name}
                  description={pilot.callsign}
                />
              ))}
            </div>
          )}

          {/* Said where the question arises: a pilot crews one crawler, so
              picking one already aboard another moves them here. */}
          <p className="font-body text-xs text-wk-muted">
            A pilot crews one crawler — adding one already aboard another moves them here.
          </p>

          {error && <FieldError>{error}</FieldError>}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="compact" onClick={closeDialog} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="compact"
              onClick={() => void handleConfirm()}
              disabled={pending || available.length === 0}
              aria-label="Confirm crew assignment"
            >
              {pending ? 'Adding…' : 'Add to Crew'}
            </Button>
          </div>
        </div>
      </ModalShell>
    </>
  )
}
