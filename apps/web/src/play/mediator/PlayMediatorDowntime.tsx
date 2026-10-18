/**
 * PlayMediatorDowntime — the Mediator's centre column while Downtime runs
 * (play.md §10, wireframe mediator-downtime): the ten guide steps as the
 * player's track (`PlayDowntimeTrack`, a step a press away), then the current
 * step as one box (level 1) with each seat as a full-width Token saying
 * whether they are done (level 2), and **Back**, **End Downtime** and
 * **Advance ›**; then **Upkeep** and **Gather Cantina Rumours** as rows.
 *
 * Advance stops at the
 * last step, and ending before it asks first, because ending and beginning
 * again resets the upkeep and a mis-tap could charge the crew twice
 * (ADR-007). Upkeep is paid once per Downtime, in Upkeep & Upgrade only (the
 * server refuses it in any other step): the claim, then the Scrap drawn from
 * the crawler's pool (`payDowntimeUpkeep`, as the player's step box pays it).
 */

import {
  DOWNTIME_UPKEEP_SCRAP,
  downtimeGuideSteps,
  isUpkeepStep,
  UPKEEP_STEP_NAME,
} from 'game-domain/rules/downtime'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import {
  Badge,
  Button,
  ConfirmDialog,
  Entity,
  rollForTable,
  Slab,
  Stat,
  TitledBox,
  tokens,
} from '../../components/index'
import { unitRowModel } from '../../lib/units/unitModel'
import { useEntityStore } from '../../stores/entityStore'
import { PlayDowntimeActionRow } from '../PlayDowntimeActionRow'
import { PlayDowntimeTrack } from '../PlayDowntimeTrack'
import { crawlerTl } from '../playDowntime.model'
import { reportingRoll } from '../playRolls.model'
import { payDowntimeUpkeep } from '../playUpkeep.model'
import type { PlayActions } from '../usePlayActions'
import { doneOf, seatDone } from './mediatorTable.model'
import type { PlayMediator } from './usePlayMediator'

/** Full ink: it sits on the pilot Token's hue, where ink75 falls below 4.5:1. */
const STATE = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.note,
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const SPACER = { flex: '1 1 0%' } satisfies CSSProperties

type PlayMediatorDowntimeProps = {
  mediator: PlayMediator
  /** The dice the rumour rolls (a test injects its own). */
  rollFor?: typeof rollForTable
}

export function PlayMediatorDowntime({
  mediator,
  rollFor: baseRoll = rollForTable,
}: PlayMediatorDowntimeProps) {
  const store = useEntityStore()
  const { downtime, seats, canWrite, crawler } = mediator
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [upkeepNote, setUpkeepNote] = useState<string | null>(null)
  const steps = downtimeGuideSteps()
  const count = steps.length
  const idx = Math.min(Math.max(downtime.downtime.stepIndex ?? 0, 0), Math.max(count - 1, 0))
  const step = steps[idx]
  const last = idx >= count - 1
  const { completedBy, upkeepSpent } = downtime.downtime
  const { done, of } = doneOf(seats, completedBy)
  const upkeepStep = isUpkeepStep(idx)
  const unit = crawler?.crawler ?? null
  const off = !canWrite

  const rollFor: PlayActions['rollFor'] = async (tableName, label, options) =>
    reportingRoll(
      await baseRoll(
        tableName,
        options?.plainD20s === undefined ? undefined : { plainD20s: options.plainD20s }
      ),
      tableName,
      () => {
        const said = options?.outcome?.()
        return said === undefined ? { label } : { label, outcome: said }
      }
    )

  async function pay() {
    setUpkeepNote(
      await payDowntimeUpkeep({ crawler: unit, store, spendUpkeep: downtime.spendUpkeep })
    )
  }

  return (
    <>
      <Slab as="h2" label={`Downtime · Step ${idx + 1} of ${count}`} />
      <PlayDowntimeTrack
        steps={steps}
        current={idx}
        onStep={downtime.setStep}
        canWrite={canWrite}
      />
      {step && (
        <TitledBox
          as="section"
          title={step.name}
          number={String(idx + 1)}
          chips={
            <Badge shape="stamp" surface="inverse" size="mini">
              {done} of {of} done
            </Badge>
          }
        >
          <ul className="su-entity-token-list" aria-label="Who is done">
            {seats.map((seat) => {
              const isDone = seatDone(seat, completedBy)
              return (
                <li key={seat.pilotId}>
                  <Entity
                    form="token"
                    context="roster"
                    model={unitRowModel({ kind: 'pilot', name: seat.name })}
                    trailing={
                      isDone ? (
                        <Stat label="Done" size="mini" />
                      ) : (
                        <span style={STATE}>{seat.present ? 'working' : 'away'}</span>
                      )
                    }
                  />
                </li>
              )
            })}
          </ul>
          <div className="su-play-dt-controls">
            <Button
              size="compact"
              variant="ghost"
              disabled={off || idx === 0 || downtime.setStep === null}
              onClick={() => downtime.setStep?.(idx - 1)}
            >
              ‹ Back
            </Button>
            <span style={SPACER} />
            <Button
              size="compact"
              disabled={off}
              onClick={last ? downtime.end : () => setConfirmEnd(true)}
            >
              End Downtime
            </Button>
            <Button
              size="compact"
              variant="ink"
              disabled={off || last}
              title={last ? 'This is the last step' : undefined}
              onClick={downtime.advance}
            >
              Advance ›
            </Button>
          </div>
        </TitledBox>
      )}
      <ul className="su-play-act-list" aria-label="Downtime for the table">
        <li className="su-play-act" data-action-key="upkeep">
          <TitledBox
            title="Upkeep"
            as="div"
            chips={
              <Stat
                orientation="horizontal"
                size="compact"
                label={`${DOWNTIME_UPKEEP_SCRAP} Scrap`}
                value={unit === null ? undefined : `T${crawlerTl(unit)}`}
              />
            }
            controls={
              upkeepSpent ? (
                <span className="su-play-act__state">Paid</span>
              ) : (
                <Button
                  size="mini"
                  disabled={off || !upkeepStep || unit === null}
                  title={upkeepStep ? undefined : `Upkeep is paid in the ${UPKEEP_STEP_NAME} step`}
                  onClick={() => void pay()}
                >
                  Pay
                </Button>
              )
            }
          >
            {upkeepNote && (
              <p className="su-play-resolve__note" aria-live="polite">
                {upkeepNote}
              </p>
            )}
          </TitledBox>
        </li>
        <PlayDowntimeActionRow
          id="rumours"
          name="Gather Cantina Rumours"
          pilot={null}
          crawler={unit}
          rollFor={rollFor}
          need={null}
          canWrite={canWrite}
        />
      </ul>
      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        tone="danger"
        title="End Downtime early?"
        body={
          <>
            <span>
              The table is on step {idx + 1} of {count}. Everyone goes back to their seat.
            </span>
            <span>
              Beginning again starts from the first step, and upkeep is due again in{' '}
              {UPKEEP_STEP_NAME}.
            </span>
          </>
        }
        confirmLabel="End Downtime"
        onConfirm={() => {
          downtime.end()
        }}
      />
    </>
  )
}
