/**
 * DowntimeTrack — the table's Downtime on a Game's own page (board M2;
 * docs/architecture/mediator-dashboard.md Q7). Every member sees it; the
 * Mediator runs it.
 *
 * The track is the guide's ten steps (Workshop Manual p.227–228,
 * `guides.json` "Crawler Downtime") as a 5 × 2 grid, not the board's five
 * boxes. The current step has an ink frame and the word NOW; before Downtime
 * begins, the first step reads NEXT. Under it, the upkeep due —
 * `DOWNTIME_UPKEEP_SCRAP` (5) Scrap of the crawler's tech level — and what the
 * crawler holds of it.
 *
 * The Mediator gets **Begin Downtime**, then **Next step**, **Pay upkeep** in
 * the Upkeep & Upgrade step only (the server enforces that too) and **End**,
 * which asks first before the last step: ending and beginning again resets
 * `upkeepSpent`, so a mis-tap could charge the crew twice (ADR-007). Every
 * member marks their own step done, which is what tells the Mediator the
 * table can move on; completion is per step, so the list empties on every
 * advance. It reads and writes the same `downtime` row every open Dashboard
 * follows (`useDowntime`).
 */

import { Button, ConfirmDialog, tokens } from 'component-lib'
import { useMutation, useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useConnection } from '../../lib/connection/connectionContext'
import {
  DOWNTIME_UPKEEP_SCRAP,
  downtimeStepNames,
  isUpkeepStep,
  UPKEEP_STEP_NAME,
} from '../../lib/rules/downtime'
import type { CrawlerReading } from '../mediator/crawlerReading'
import { failureMessage } from '../shared/useConfirm'
import { HubSection } from './HubSection'
import { HUB_COPY } from './hubStyles'

const { borderWidth, color, font, fontSize, radius, space, tracking, weight } = tokens

const GRID: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
  gap: space[6],
}

// Longhands only, so the NOW cell swaps values rather than mixing a shorthand
// with its longhands across renders.
const CELL: CSSProperties = {
  minWidth: 0,
  minHeight: '4.5rem',
  display: 'flex',
  flexDirection: 'column',
  gap: space[2],
  padding: `${space[8]} ${space[8]}`,
  borderStyle: 'dashed',
  borderWidth: borderWidth.chrome,
  borderColor: color.ink35,
  borderRadius: radius.card,
  background: 'transparent',
}

const CELL_NOW: CSSProperties = {
  ...CELL,
  borderStyle: 'solid',
  borderWidth: borderWidth.pill,
  borderColor: color.ink,
  background: color.paper,
}

const NUMBER: CSSProperties = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.badge,
  letterSpacing: tracking.caps,
  textTransform: 'uppercase',
  color: color.ink75,
}

/** The step the table is on: ink, the "here" state (ruleset §3.1 keeps rust for action). */
const NOW: CSSProperties = { ...NUMBER, color: color.ink }

const NAME: CSSProperties = {
  fontFamily: font.body,
  fontSize: fontSize.caption,
  fontWeight: weight.medium,
  lineHeight: 1.3,
  color: color.ink,
  overflowWrap: 'anywhere',
}

const ROW: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[8],
}

const NOTE: CSSProperties = { ...HUB_COPY, fontSize: fontSize.caption }

export function DowntimeTrack({
  gameId,
  mediator,
  crawler,
}: {
  gameId: Id<'games'>
  /** The viewer runs it: the phase controls and Upkeep are theirs. */
  mediator: boolean
  crawler: CrawlerReading | null
}) {
  const state = useQuery(api.downtime.state, { gameId })
  const begin = useMutation(api.downtime.begin)
  const advance = useMutation(api.downtime.advance)
  const end = useMutation(api.downtime.end)
  const markStepDone = useMutation(api.downtime.markStepDone)
  const spendUpkeep = useMutation(api.downtime.spendUpkeep)
  const { canWrite } = useConnection()
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const steps = downtimeStepNames()
  const running = state?.running ?? false
  const index = state?.stepIndex ?? null
  const last = index !== null && index >= steps.length - 1
  const upkeepStep = isUpkeepStep(index)

  const run = (write: () => Promise<unknown>) => () => {
    setError(null)
    void write().catch((err: unknown) =>
      setError(failureMessage(err, 'That did not reach the table. Try again.'))
    )
  }

  const upkeep =
    crawler === null
      ? `Upkeep: ${DOWNTIME_UPKEEP_SCRAP} scrap of the crawler's tech level.`
      : `Upkeep due: ${DOWNTIME_UPKEEP_SCRAP} TL${crawler.techLevel ?? 1} scrap. The crawler has ${crawler.scrapAtTl}.`

  return (
    <HubSection
      id="downtime-heading"
      title="Downtime"
      aside={
        mediator
          ? 'You run it; players see it on their dashboards'
          : 'The Mediator runs it; you see it on your Dashboard'
      }
    >
      <ol style={GRID} aria-label="Downtime steps">
        {steps.map((name, i) => {
          const now = running && i === index
          const next = !running && i === 0
          return (
            <li key={name} style={now ? CELL_NOW : CELL} aria-current={now ? 'step' : undefined}>
              <span style={now || next ? NOW : NUMBER}>{now ? 'Now' : next ? 'Next' : i + 1}</span>
              <span style={NAME}>{name}</span>
            </li>
          )
        })}
      </ol>

      {state === undefined ? null : running ? (
        <>
          <p style={NOTE}>
            Step {(index ?? 0) + 1} of {steps.length}.{' '}
            {state.completedBy.length === 0
              ? 'Nobody has finished it yet.'
              : `Finished: ${state.completedBy.map((c) => c.displayName).join(', ')}.`}{' '}
            {upkeepStep ? (state.upkeepSpent ? 'Upkeep paid.' : upkeep) : null}
          </p>
          <div style={ROW}>
            <Button
              variant="default"
              size="compact"
              disabled={!canWrite}
              onClick={run(() => markStepDone({ gameId, done: true }))}
            >
              I&rsquo;m done with this step
            </Button>
            <Button
              variant="ghost"
              size="compact"
              disabled={!canWrite}
              onClick={run(() => markStepDone({ gameId, done: false }))}
            >
              Not yet
            </Button>
          </div>
          {mediator && (
            <div style={ROW}>
              <Button
                variant="primary"
                size="compact"
                disabled={!canWrite || last}
                onClick={run(() => advance({ gameId }))}
              >
                Next step
              </Button>
              <Button
                variant="default"
                size="compact"
                disabled={!canWrite || state.upkeepSpent || !upkeepStep}
                title={upkeepStep ? undefined : `Upkeep is paid in the ${UPKEEP_STEP_NAME} step`}
                onClick={run(() => spendUpkeep({ gameId }))}
              >
                Pay upkeep
              </Button>
              <Button
                variant="ghost"
                size="compact"
                disabled={!canWrite}
                onClick={last ? run(() => end({ gameId })) : () => setConfirmEnd(true)}
              >
                End Downtime
              </Button>
            </div>
          )}
        </>
      ) : (
        <div style={ROW}>
          {mediator && (
            <Button
              variant="primary"
              size="compact"
              disabled={!canWrite}
              onClick={run(() => begin({ gameId }))}
            >
              Begin Downtime
            </Button>
          )}
          <p style={NOTE}>{upkeep}</p>
        </div>
      )}
      {error !== null && (
        <p role="alert" style={{ ...NOTE, color: color.ink }}>
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        tone="danger"
        title="End Downtime early?"
        body={`The table is on step ${(index ?? 0) + 1} of ${steps.length}. Everyone goes back to their seat, and beginning again starts from the first step, with upkeep due again.`}
        confirmLabel="End Downtime"
        onConfirm={async () => {
          await end({ gameId })
        }}
      />
    </HubSection>
  )
}
