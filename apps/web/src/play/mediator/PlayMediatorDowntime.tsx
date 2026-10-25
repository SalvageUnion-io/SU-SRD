/**
 * PlayMediatorDowntime — the Mediator's centre column while Downtime runs
 * (play.md §10): the ten guide steps as the
 * player's track (`PlayDowntimeTrack`, a step a press away), then the current
 * step as one box (level 1) with each seat as a full-width Mini saying
 * whether they are done (level 2), and its way through (`DowntimeStepNav`:
 * Back, End Downtime and Next); then **Upkeep** and **Gather Cantina
 * Rumours**, a list of Minis one a line (ruleset §1.3: Play's lists are
 * Minis), Pay in Upkeep's chip group and what it came to its contentful
 * body. Between them, once the crew has a faction deal (the Game page's
 * Factions), **Deal income**: a Scrap of the crawler's Tech Level per deal,
 * collected beside Upkeep in the same step and once per Downtime
 * (`ledger.collectIncome`, Reclamation of the Wastes p.7). With a Nanite
 * Processing Bay, **Process Nanites** joins them, live in the Craft step
 * (`processDowntimeNanites`).
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
  DOWNTIME_UPKEEP_SCRAP,
  isUpkeepStep,
  UPKEEP_STEP_NAME,
} from 'game-domain/rules/downtime'
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
} from '../../components/index'
import { rollD20 } from '../../lib/dice'
import { unitRowModel } from '../../lib/units/unitModel'
import { mediatorCopy } from '../../messages/play-mediator'
import { useEntityStore } from '../../stores/entityStore'
import { DowntimeStepNav } from '../DowntimeStepNav'
import { PlayDowntimeActionRow } from '../PlayDowntimeActionRow'
import { PlayDowntimeTrack } from '../PlayDowntimeTrack'
import { crawlerTl } from '../playDowntime.model'
import { playLineModel } from '../playLine.model'
import { naniteStatus, processDowntimeNanites } from '../playNanites.model'
import { recordPlayChange, reportingRoll } from '../playRolls.model'
import { payDowntimeUpkeep } from '../playUpkeep.model'
import type { PlayActions } from '../usePlayActions'
import { doneOf, seatDone } from './mediatorTable.model'
import type { PlayMediator } from './usePlayMediator'

const UPKEEP = playLineModel({ name: 'Upkeep', key: 'upkeep' })
const INCOME = playLineModel({ name: mediatorCopy('dealIncome'), key: 'deal-income' })
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
  const store = useEntityStore()
  const { downtime, seats, canWrite, crawler, income } = mediator
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [upkeepNote, setUpkeepNote] = useState<string | null>(null)
  const [incomeNote, setIncomeNote] = useState<string | null>(null)
  const [naniteNote, setNaniteNote] = useState<string | null>(null)
  const { steps, index: idx, step, count, last } = currentDowntimeStep(downtime.downtime.stepIndex)
  const { completedBy, upkeepSpent } = downtime.downtime
  const { done, of } = doneOf(seats, completedBy)
  const upkeepStep = isUpkeepStep(idx)
  const unit = crawler?.crawler ?? null
  const off = !canWrite
  const nanites = naniteStatus(unit)
  const craftStep = step?.name === CRAFT_STEP_NAME

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

  async function collect() {
    try {
      const paid = await income.collect()
      setIncomeNote(
        paid === null
          ? mediatorCopy('incomeAlreadyCollected')
          : mediatorCopy('collectedInto', {
              scrap: paid.scrap,
              tl: paid.tl,
              crawler: paid.crawlerName ?? mediatorCopy('theCrawler'),
            })
      )
    } catch (err) {
      mediator.onFailure(err)
    }
  }

  function processNanites() {
    const said = processDowntimeNanites({ crawler: unit, store, rollD20 })
    if (said) recordPlayChange(`${CRAFT_STEP_NAME} · ${said}`)
    setNaniteNote(said)
  }

  return (
    <>
      <Slab as="h2" label={mediatorCopy('downtimeStepOf', { value: idx + 1, count })} />
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
              {mediatorCopy('ofDone', { done, of })}
            </Badge>
          }
        >
          <ul className="su-entity-mini-list" aria-label={mediatorCopy('whoIsDone')}>
            {seats.map((seat) => {
              const isDone = seatDone(seat, completedBy)
              return (
                <li key={seat.pilotId}>
                  <Entity
                    size="mini"
                    context="roster"
                    model={unitRowModel({ kind: 'pilot', name: seat.name })}
                    // Where they are in the step, a state chip of the Mini's
                    // own Size, never loose words (C3, C8).
                    state={
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
                    }
                  />
                </li>
              )
            })}
          </ul>
          <div className="su-play-dt-controls">
            <DowntimeStepNav
              step={idx}
              count={count}
              off={off}
              onBack={downtime.setStep === null ? null : () => downtime.setStep?.(idx - 1)}
              onEnd={last ? downtime.end : () => setConfirmEnd(true)}
              onAdvance={downtime.advance}
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
                label={mediatorCopy('scrap', { downtimeUpkeepScrap: DOWNTIME_UPKEEP_SCRAP })}
                value={unit === null ? undefined : `T${crawlerTl(unit)}`}
              />
            }
            controls={
              upkeepSpent ? (
                <Stat size="mini" label={mediatorCopy('paid')} />
              ) : (
                <Button
                  size="mini"
                  disabled={off || !upkeepStep || unit === null}
                  title={
                    upkeepStep
                      ? undefined
                      : mediatorCopy('upkeepIsPaidInThe', { upkeepStepName: UPKEEP_STEP_NAME })
                  }
                  onClick={() => void pay()}
                >
                  {mediatorCopy('pay')}
                </Button>
              )
            }
            {...(upkeepNote
              ? {
                  body: {
                    text: false,
                    children: (
                      <p className="su-play-resolve__note" aria-live="polite">
                        {upkeepNote}
                      </p>
                    ),
                  },
                }
              : {})}
          />
        </li>
        {/* The crew's faction deals (the Game page's Factions): offered only once there is one. */}
        {(income.deals > 0 || income.collected) && (
          <li className="su-play-act" data-action-key="deal-income">
            <Entity
              size="mini"
              context="play"
              model={INCOME}
              state={
                <Stat
                  size="mini"
                  label={mediatorCopy('dealScrap', { deals: income.deals })}
                  value={unit === null ? undefined : `T${crawlerTl(unit)}`}
                />
              }
              controls={
                income.collected ? (
                  <Stat size="mini" label={mediatorCopy('collected')} />
                ) : (
                  <Button
                    size="mini"
                    disabled={off || !upkeepStep || unit === null}
                    title={
                      upkeepStep
                        ? undefined
                        : mediatorCopy('incomeIsCollectedInThe', {
                            upkeepStepName: UPKEEP_STEP_NAME,
                          })
                    }
                    onClick={() => void collect()}
                  >
                    {mediatorCopy('collect')}
                  </Button>
                )
              }
              {...(incomeNote
                ? {
                    body: {
                      text: false,
                      children: (
                        <p className="su-play-resolve__note" aria-live="polite">
                          {incomeNote}
                        </p>
                      ),
                    },
                  }
                : {})}
            />
          </li>
        )}
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
                  onClick={processNanites}
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
