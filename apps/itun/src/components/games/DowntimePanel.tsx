import { Button, Card, Text } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'

import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { PANEL_TITLE, PANEL_TONE, ROW, STAMP } from './gameChrome'

/**
 * Crew-wide Downtime (Phase 5).
 *
 * The panel every member sees; the phase controls only appear for the Mediator.
 *
 * What it is really for is the **who is still working** list. Before this, six
 * players ran six private Downtimes and reconciled verbally, and the Mediator's
 * only way to know whether the table could move on was to ask. Showing
 * completion per step turns that into a glance.
 *
 * Completion is per step, so this list emptying on every advance is correct
 * rather than a bug — a name persisting would mean "finished at some point",
 * which is the opposite of what the Mediator needs.
 *
 * Upkeep is shown as a single crew-level fact. It is spent once by whoever gets
 * there first, and the button disables for everybody after — the double-charge
 * being the thing that made per-player Downtime unworkable.
 */
export function DowntimePanel({ gameId }: { gameId: Id<'games'> }) {
  const state = useQuery(api.downtime.state, { gameId })
  const amMediator = useQuery(api.mediator.amMediator, { gameId })
  const begin = useMutation(api.downtime.begin)
  const advance = useMutation(api.downtime.advance)
  const end = useMutation(api.downtime.end)
  const markStepDone = useMutation(api.downtime.markStepDone)
  const spendUpkeep = useMutation(api.downtime.spendUpkeep)

  if (state === undefined) return null

  return (
    <Card headerBg={PANEL_TONE} headerContent={<span className={PANEL_TITLE}>Downtime</span>}>
      <div className="flex flex-col gap-3 p-4">
        {!state.running && (
          <>
            <Text variant="hint">
              Not running. The Mediator starts a Downtime when the crew is ready.
            </Text>
            {amMediator === true && (
              <div>
                <Button variant="primary" size="compact" onClick={() => void begin({ gameId })}>
                  Begin Downtime
                </Button>
              </div>
            )}
          </>
        )}

        {state.running && (
          <>
            <div className={ROW}>
              <Text as="span">Step {(state.stepIndex ?? 0) + 1}</Text>
              <Text as="span" variant="hint">
                {state.upkeepSpent ? 'Upkeep paid' : 'Upkeep outstanding'}
              </Text>
            </div>

            <div>
              <Text as="span" className={STAMP}>
                Finished this step
              </Text>
              {state.completedBy.length === 0 && <Text variant="hint">Nobody yet.</Text>}
              {state.completedBy.map((c) => (
                <div key={c.userId} className={ROW}>
                  <Text as="span">{c.displayName}</Text>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                size="compact"
                onClick={() => void markStepDone({ gameId, done: true })}
              >
                I'm done with this step
              </Button>
              <Button
                variant="ghost"
                size="compact"
                onClick={() => void markStepDone({ gameId, done: false })}
              >
                Not yet
              </Button>
              <Button
                variant="ghost"
                size="compact"
                disabled={state.upkeepSpent}
                onClick={() => void spendUpkeep({ gameId })}
              >
                Pay crawler upkeep
              </Button>
            </div>

            {amMediator === true && (
              <div className="flex gap-2">
                <Button variant="primary" size="compact" onClick={() => void advance({ gameId })}>
                  Next step
                </Button>
                <Button variant="danger" size="compact" onClick={() => void end({ gameId })}>
                  End Downtime
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  )
}
