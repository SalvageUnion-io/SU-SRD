/**
 * DowntimeMinor — the Game's Downtime on the Mediator Dashboard (board M1;
 * docs/architecture/mediator-dashboard.md Q7).
 *
 * Not running: what starting it does, and **Begin Downtime**. Running: "Step 2
 * of 10 · Upkeep & Upgrade", how many of the crew are done with the step,
 * **Pay upkeep** in the Upkeep & Upgrade step only (the server enforces it
 * too), **Next step** and **End**.
 *
 * The steps are the guide's ten (Workshop Manual p.227–228), not the board's
 * five. Begin and Next are non-destructive phase moves and need no confirm;
 * ending before the last step asks first, because ending and beginning again
 * resets `upkeepSpent` and a mis-tap could charge the crew's upkeep twice
 * (ADR-007). Starting it moves every player's Crawler to their Major slot
 * (ADR-038 §5); nothing here builds that.
 *
 * Presentational: the Dashboard hands in the state and the writes. Every
 * control is disabled, never hidden, while the table cannot be written.
 */

import { Button, ConfirmDialog, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { DOWNTIME_UPKEEP_SCRAP, isUpkeepStep, UPKEEP_STEP_NAME } from '../../lib/rules/downtime'
import { BODY, bandTop, HEADING, MUTED, NUMBERS } from './mediatorStyles'

const { color, space, weight } = tokens

export type DowntimeReading = {
  running: boolean
  stepIndex: number | null
  /** How many members marked the current step done. */
  done: number
  upkeepSpent: boolean
}

export type DowntimeWrites = {
  begin: () => Promise<unknown>
  advance: () => Promise<unknown>
  end: () => Promise<unknown>
  spendUpkeep: () => Promise<unknown>
}

const ACTIONS: CSSProperties = {
  marginTop: 'auto',
  display: 'flex',
  flexDirection: 'column',
  gap: space[6],
}

const PAIR: CSSProperties = { display: 'flex', gap: space[6] }

const GROW: CSSProperties = { flex: 1 }

const STEP: CSSProperties = { ...BODY, ...NUMBERS, fontWeight: weight.bold }

export function DowntimeMinor({
  downtime,
  steps,
  members,
  upkeepTl,
  canWrite,
  writes,
  onFailure,
}: {
  downtime: DowntimeReading
  /** The guide's step names, in order. */
  steps: readonly string[]
  /** How many members the "N of M done" counts against. */
  members: number
  /** The crawler's tech level, for "5 TL1 scrap"; null with no crawler. */
  upkeepTl: number | null
  canWrite: boolean
  writes: DowntimeWrites
  /** A write the server refused: the caller says why. */
  onFailure: (err: unknown) => void
}) {
  const [confirmEnd, setConfirmEnd] = useState(false)
  const run = (write: () => Promise<unknown>) => () => void write().catch(onFailure)
  const panel = { ...bandTop(color.crawler), height: '100%' }
  const index = downtime.stepIndex ?? 0
  const last = index >= steps.length - 1
  const upkeepStep = isUpkeepStep(downtime.stepIndex)

  return (
    <section aria-labelledby="mediator-downtime" style={panel}>
      <h2 id="mediator-downtime" style={HEADING}>
        Downtime
      </h2>
      {!downtime.running ? (
        <>
          <p style={MUTED}>
            Not running. Starting it moves every player&rsquo;s Crawler to their Major slot.
          </p>
          <div style={ACTIONS}>
            <Button variant="primary" size="full" disabled={!canWrite} onClick={run(writes.begin)}>
              Begin Downtime
            </Button>
          </div>
        </>
      ) : (
        <>
          <p style={STEP}>
            Step {index + 1} of {steps.length}
            {steps[index] ? ` · ${steps[index]}` : ''}
          </p>
          <p style={{ ...MUTED, ...NUMBERS }}>
            {downtime.done} of {members} done
            {upkeepStep
              ? downtime.upkeepSpent
                ? ' · upkeep paid'
                : ` · upkeep due: ${DOWNTIME_UPKEEP_SCRAP}${upkeepTl === null ? '' : ` TL${upkeepTl}`} scrap`
              : ''}
          </p>
          <div style={ACTIONS}>
            {upkeepStep && (
              <Button
                variant="default"
                size="compact"
                disabled={!canWrite || downtime.upkeepSpent}
                onClick={run(writes.spendUpkeep)}
              >
                {downtime.upkeepSpent ? 'Upkeep paid' : 'Pay upkeep'}
              </Button>
            )}
            <div style={PAIR}>
              <Button
                variant="primary"
                size="compact"
                style={GROW}
                disabled={!canWrite || last}
                title={last ? 'This is the last step' : undefined}
                onClick={run(writes.advance)}
              >
                Next step
              </Button>
              <Button
                variant="ghost"
                size="compact"
                disabled={!canWrite}
                onClick={last ? run(writes.end) : () => setConfirmEnd(true)}
              >
                End
              </Button>
            </div>
          </div>
          <ConfirmDialog
            open={confirmEnd}
            onOpenChange={setConfirmEnd}
            tone="danger"
            title="End Downtime early?"
            body={
              <>
                <span>
                  The table is on step {index + 1} of {steps.length}. Everyone goes back to their
                  seat.
                </span>
                <span>
                  Beginning again starts from the first step, and upkeep is due again in{' '}
                  {UPKEEP_STEP_NAME}.
                </span>
              </>
            }
            confirmLabel="End Downtime"
            onConfirm={async () => {
              await writes.end()
            }}
          />
        </>
      )}
    </section>
  )
}
