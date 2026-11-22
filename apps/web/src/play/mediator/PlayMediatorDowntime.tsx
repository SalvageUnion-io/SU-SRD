/**
 * PlayMediatorDowntime — the Mediator's centre column while Downtime runs
 * (play.md §10): the ten guide steps as the
 * player's track (`PlayDowntimeTrack`, a step a press away), then the current
 * step as one box (level 1) with each seat as a full-width Mini saying
 * whether they are done (level 2), and its way through (`DowntimeStepNav`:
 * Back, End Downtime and Next); then **Upkeep** and **Gather Cantina
 * Rumours**, a list of Minis one a line (ruleset §1.3: Play's lists are
 * Minis), Pay in Upkeep's chip group and what it came to its contentful
 * body. With a Nanite
 * Processing Bay, **Process Nanites** joins them, live in the Craft step
 * (`processDowntimeNanites`).
 *
 * Moving on is said to the table (the room's Feed line, r5 A3); a jump past
 * more than one step asks first, and what the table passed over this visit
 * (a step jumped over, one left with a seat still working) is listed under
 * the step (`passed`).
 *
 * Next stops at the
 * last step, and ending before it asks first, because ending and beginning
 * again resets the upkeep and a mis-tap could charge the crew twice
 * (ADR-007). Upkeep is paid once per Downtime, in Upkeep & Upgrade only (the
 * server refuses it in any other step): the claim, then the Scrap drawn from
 * the crawler's pool (`payDowntimeUpkeep`, as the player's step box pays it).
 */

import {
  CRAFT_STEP_NAME,
  currentDowntimeStep,
  isTallyStep,
  isUpkeepStep,
  UPKEEP_STEP_NAME,
} from 'game-domain/rules/downtime'
import { scrapCount } from 'game-domain/rules/tallyScrap'
import { useState } from 'react'
import { crawlerUpkeepCost } from 'salvageunion-reference/rules'
import { ConfirmDialog } from '../../components/app'
import { Badge, Button, Entity, rollForTable, Slab, Stat, TitledBox } from '../../components/index'
import { rollD20 } from '../../lib/dice'
import { unitRowModel } from '../../lib/units/unitModel'
import { playCopy } from '../../messages/play'
import { mediatorCopy } from '../../messages/play-mediator'
import { useUnits } from '../../replica/units'
import { DowntimeStepNav } from '../DowntimeStepNav'
import { PlayDowntimeActionRow } from '../PlayDowntimeActionRow'
import { PlayDowntimeTrack } from '../PlayDowntimeTrack'
import { carriedScrap } from '../playDowntime.model'
import { playLineModel } from '../playLine.model'
import { naniteStatus, processDowntimeNanites } from '../playNanites.model'
import { reportingRoll } from '../playRolls.model'
import { payDowntimeUpkeep, upkeepShort } from '../playUpkeep.model'
import type { PlayActions } from '../usePlayActions'
import { doneOf, seatDone } from './mediatorTable.model'
import type { PlayMediator } from './usePlayMediator'

const UPKEEP = playLineModel({ name: 'Upkeep', key: 'upkeep' })
const NANITES = playLineModel({ name: mediatorCopy('processNanites'), key: 'nanites' })

type PlayMediatorDowntimeProps = {
  mediator: PlayMediator
  /** The dice the rumour rolls (a test injects its own). */
  rollFor?: typeof rollForTable
}

export function PlayMediatorDowntime({
  mediator,
  rollFor: baseRoll = rollForTable,
}: PlayMediatorDowntimeProps) {
  const store = useUnits()
  const { downtime, seats, canWrite, crawler } = mediator
  const [confirmEnd, setConfirmEnd] = useState(false)
  // A jump past more than one step, waiting on its confirm; and what moving on passed over.
  const [jumpTo, setJumpTo] = useState<number | null>(null)
  const [passed, setPassed] = useState<readonly string[]>([])
  const [upkeepNote, setUpkeepNote] = useState<string | null>(null)
  const [naniteNote, setNaniteNote] = useState<string | null>(null)
  const { steps, index: idx, step, count, last } = currentDowntimeStep(downtime.downtime.stepIndex)
  const { completedBy, upkeepSpent } = downtime.downtime
  const { done, of } = doneOf(seats, completedBy)
  const upkeepStep = isUpkeepStep(idx)
  const unit = crawler?.crawler ?? null
  // A pool too small pays nothing and is never marked Paid (r4 A7).
  const short = unit === null || upkeepSpent ? 0 : upkeepShort(unit)
  const upkeepCost = crawlerUpkeepCost(unit?.techLevel ?? 1, unit?.type)
  const off = !canWrite
  const nanites = naniteStatus(unit)
  const craftStep = step?.name === CRAFT_STEP_NAME
  const working = seats.filter((seat) => !seatDone(seat, completedBy)).map((s) => s.name)
  // Tally Salvage: each seat's carried Scrap and whether it is in, and the totals (r6 D1).
  const tally = isTallyStep(idx)
  const moved = new Set(downtime.downtime.scrapMoved ?? [])
  const carriedBy = (pilotId: string, mechId: string | null) =>
    carriedScrap(
      store.get('pilot', pilotId) ?? null,
      mechId === null ? null : (store.get('mech', mechId) ?? null)
    )?.count ?? 0
  const stillCarried = tally
    ? seats.reduce((sum, seat) => sum + carriedBy(seat.pilotId, seat.mech?.id ?? null), 0)
    : 0
  const inPool = scrapCount({
    1: unit?.scrapPool?.tl1,
    2: unit?.scrapPool?.tl2,
    3: unit?.scrapPool?.tl3,
    4: unit?.scrapPool?.tl4,
    5: unit?.scrapPool?.tl5,
    6: unit?.scrapPool?.tl6,
  })

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

  /** Move to `to`, noting what is passed over: the steps jumped, and this one with a seat still working. */
  function moveTo(to: number, move: () => void) {
    if (to > idx) {
      const here = `${idx + 1} ${step?.name ?? ''}`.trim()
      const jumped = steps.slice(idx + 1, to).map((s, i) => `${idx + 2 + i} ${s.name}`)
      setPassed((was) => [
        ...was,
        ...(working.length > 0
          ? [mediatorCopy('leftWorking', { step: here, who: working.join(', ') })]
          : []),
        ...jumped,
      ])
    }
    move()
  }

  /** The track's press: one step either way at once, a jump past more after its confirm. */
  function onStep(to: number) {
    const setStep = downtime.setStep
    if (setStep === null) return
    if (to - idx > 1) setJumpTo(to)
    else moveTo(to, () => setStep(to))
  }

  /**
   * Under the other D1 ruling (`DOWNTIME_RULINGS.scrapMove`), Next from Tally
   * Salvage moves every pilot's carried Scrap; `moveScrap` is null otherwise.
   */
  function sweepScrap() {
    const move = downtime.moveScrap
    if (!tally || move === null || unit === null) return
    for (const seat of seats) {
      if (moved.has(seat.pilotId) || carriedBy(seat.pilotId, seat.mech?.id ?? null) === 0) continue
      void move({ pilotId: seat.pilotId, mechId: seat.mech?.id ?? null, crawlerId: unit.id })
    }
  }

  async function pay() {
    setUpkeepNote(await payDowntimeUpkeep({ crawler: unit, store, claim: downtime.claim }))
  }

  async function processNanites() {
    setNaniteNote(
      await processDowntimeNanites({
        crawler: unit,
        store,
        rollD20,
        label: CRAFT_STEP_NAME,
        claim: downtime.claim,
      })
    )
  }

  return (
    <>
      <Slab as="h2" label={mediatorCopy('downtimeStepOf', { value: idx + 1, count })} flush />
      <PlayDowntimeTrack
        steps={steps}
        current={idx}
        onStep={downtime.setStep === null ? null : onStep}
        canWrite={canWrite}
      />
      {step && (
        <TitledBox
          as="section"
          title={step.name}
          number={String(idx + 1)}
          chips={
            <Badge shape="stamp" surface="inverse" size="mini">
              {mediatorCopy('ofDone', { done, of })}
            </Badge>
          }
        >
          <ul className="su-entity-mini-list" aria-label={mediatorCopy('whoIsDone')}>
            {seats.map((seat) => {
              const isDone = seatDone(seat, completedBy)
              const carried = (s: typeof seat) => carriedBy(s.pilotId, s.mech?.id ?? null)
              return (
                <li key={seat.pilotId}>
                  <Entity
                    size="mini"
                    context="roster"
                    model={unitRowModel({ kind: 'pilot', name: seat.name })}
                    // Where they are in the step, a state chip of the Mini's
                    // own Size, never loose words (C3, C8).
                    state={
                      <>
                        <Stat
                          label={
                            isDone
                              ? mediatorCopy('done')
                              : seat.present
                                ? mediatorCopy('working')
                                : mediatorCopy('away')
                          }
                          size="mini"
                        />
                        {tally && moved.has(seat.pilotId) && (
                          <Stat label={mediatorCopy('scrapMoved')} size="mini" />
                        )}
                        {tally && !moved.has(seat.pilotId) && carried(seat) > 0 && (
                          <Stat
                            label={mediatorCopy('scrapCarried')}
                            value={String(carried(seat))}
                            size="mini"
                          />
                        )}
                      </>
                    }
                  />
                </li>
              )
            })}
          </ul>
          {tally && (
            <p className="su-play-resolve__note">
              {mediatorCopy('scrapTotals', { pool: inPool, carried: stillCarried })}
            </p>
          )}
          {/* The Mediator may always move on; the note names who has not finished (r6 D2). */}
          {working.length > 0 && (
            <p className="su-play-resolve__note">
              {mediatorCopy('notFinished', { who: working.join(', ') })}
            </p>
          )}
          {passed.length > 0 && (
            <p className="su-play-resolve__note">
              {mediatorCopy('passedOver', { steps: passed.join(', ') })}
            </p>
          )}
          <div className="su-play-dt-controls">
            <DowntimeStepNav
              step={idx}
              count={count}
              off={off}
              onBack={downtime.setStep === null ? null : () => downtime.setStep?.(idx - 1)}
              onEnd={last ? downtime.end : () => setConfirmEnd(true)}
              onAdvance={() => {
                sweepScrap()
                moveTo(idx + 1, downtime.advance)
              }}
              endEarly
            />
          </div>
        </TitledBox>
      )}
      <ul
        className="su-entity-mini-list"
        aria-label={mediatorCopy('downtimeForTheTable')}
        data-play-list=""
      >
        <li className="su-play-act" data-action-key="upkeep">
          <Entity
            size="mini"
            context="play"
            model={UPKEEP}
            state={
              <Stat
                size="mini"
                label={mediatorCopy('scrap', { downtimeUpkeepScrap: upkeepCost })}
                value={unit === null ? undefined : `T${unit.techLevel}`}
              />
            }
            {...(short > 0
              ? { uses: <Stat size="mini" label={playCopy('shortBy', { short })} /> }
              : {})}
            controls={
              upkeepSpent ? (
                <Stat size="mini" label={mediatorCopy('paid')} />
              ) : (
                <Button
                  size="mini"
                  disabled={off || !upkeepStep || unit === null || short > 0}
                  title={
                    upkeepStep
                      ? undefined
                      : mediatorCopy('upkeepIsPaidInThe', { upkeepStepName: UPKEEP_STEP_NAME })
                  }
                  onClick={() => void pay()}
                >
                  {/* What it will take, said on the button (r4 A7). */}
                  {playCopy('payScrap', { scrap: upkeepCost })}
                </Button>
              )
            }
            {...(upkeepNote || short > 0
              ? {
                  body: {
                    text: false,
                    children: (
                      <p className="su-play-resolve__note" aria-live="polite">
                        {upkeepNote ?? playCopy('unpaidUpkeepCite')}
                      </p>
                    ),
                  },
                }
              : {})}
          />
        </li>
        {nanites.present && (
          <li className="su-play-act" data-action-key="nanites">
            <Entity
              size="mini"
              context="play"
              model={NANITES}
              state={
                <Stat
                  size="mini"
                  label={mediatorCopy('inertPiles')}
                  value={String(nanites.inert)}
                />
              }
              controls={
                <Button
                  size="mini"
                  disabled={off || !craftStep || !nanites.operational || nanites.inert === 0}
                  title={
                    !nanites.operational
                      ? mediatorCopy('naniteBayDamaged')
                      : craftStep
                        ? undefined
                        : mediatorCopy('nanitesAreProcessedInThe', {
                            craftStepName: CRAFT_STEP_NAME,
                          })
                  }
                  onClick={() => void processNanites()}
                >
                  {mediatorCopy('process')}
                </Button>
              }
              {...(naniteNote
                ? {
                    body: {
                      text: false,
                      children: (
                        <p className="su-play-resolve__note" aria-live="polite">
                          {naniteNote}
                        </p>
                      ),
                    },
                  }
                : {})}
            />
          </li>
        )}
        <PlayDowntimeActionRow
          id="rumours"
          name={mediatorCopy('gatherCantinaRumours')}
          pilot={null}
          crawler={unit}
          rollFor={rollFor}
          need={null}
          canWrite={canWrite}
        />
      </ul>
      <ConfirmDialog
        open={jumpTo !== null}
        onOpenChange={(open) => {
          if (!open) setJumpTo(null)
        }}
        title={mediatorCopy('jumpToStepAsk', {
          step: `${(jumpTo ?? 0) + 1} ${steps[jumpTo ?? 0]?.name ?? ''}`.trim(),
        })}
        body={mediatorCopy('jumpToStepBody', { from: idx + 2, to: jumpTo ?? 0 })}
        confirmLabel={mediatorCopy('jumpToStep')}
        onConfirm={() => {
          const to = jumpTo
          if (to !== null && downtime.setStep !== null) moveTo(to, () => downtime.setStep?.(to))
        }}
      />
      <ConfirmDialog
        open={confirmEnd}
        onOpenChange={setConfirmEnd}
        tone="danger"
        title={mediatorCopy('endDowntimeEarly')}
        body={
          <>
            <span>{mediatorCopy('theTableIsOnStep2', { value: idx + 1, count })}</span>
            <span>
              {mediatorCopy('beginningAgainStartsFromThe', { upkeepStepName: UPKEEP_STEP_NAME })}
            </span>
          </>
        }
        confirmLabel={mediatorCopy('endDowntime')}
        onConfirm={() => {
          downtime.end()
        }}
      />
    </>
  )
}
