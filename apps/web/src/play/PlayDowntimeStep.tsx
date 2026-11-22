import { crawlerTechLevelOf } from 'game-domain/crawlerLevel'
/**
 * PlayDowntimeStep — the current Downtime step as one level-1 box (play.md §6): the step's name, who moves the table on, and exactly what
 * the step will apply (`playDowntime.model.ts`), each line untickable
 * (ADR-007), then Skip and Apply & mark done.
 *
 *  - **In a Game** the step is the Game's: the Mediator advances it
 *    ("Mediator advances · 2 of 4 done"), a player is done once they take the
 *    step (applied, skipped or marked done) and has no Next step.
 *  - **Solo** the player runs it ("You run it"): Apply & mark done, then Next
 *    step (the last step ends Downtime).
 *
 * Either way the step is one batch with stable ids (`markStepDone`, ADR-063
 * §6) carrying what it applies to the pilot and the mech's share, so the
 * mech is never repaired twice for one step. A taken step
 * never offers Apply or Skip again, so a reload or the Mediator's Back never
 * applies a step twice (Train's +1 TP). The step is per pilot: a member
 * running two pilots takes it for each, and is done once both have. A taken
 * step lists the changes it made ("TP 0→1"), kept as they were applied, never
 * the plan for a next time; after a reload it says Done and lists none.
 *
 * Upkeep is paid once per Downtime: its draw is the run's one Upkeep op
 * (`claim`), so a second press changes nothing. Process Nanites (the Craft
 * step, with a Nanite Processing Bay) goes to whoever pays Upkeep, and is the
 * run's one Nanites op the same way (`processDowntimeNanites`).
 * Restore never confirms: its patches only heal, repair and recharge, and
 * refuse a Destroyed mech: nothing destructive, so nothing to confirm (ADR-007).
 *
 * End Downtime with a step walked past unapplied (`skippedSteps`) lists them
 * and asks "End anyway" or "Go back" (r4 A6).
 *
 * What it applies lands on the Feed as a change (`recordPlayChange`).
 * Inside the box, the lines are plain content (labels and Stat chips), never
 * a box of their own (play.md §12).
 */

import { downtimeMechPatch, downtimePilotPatch, isSeatFreeStep } from 'game-domain/rules/downtime'
import { useId, useState } from 'react'
import type { RefObjectGuideStep } from 'salvageunion-reference'
import { ConfirmDialog } from '../components/app'
import {
  Badge,
  Button,
  Checkbox,
  Content,
  capsLabel,
  cn,
  SELECT_DIM,
  Stat,
  TitledBox,
} from '../components/index'
import { rollD20 } from '../lib/dice'
import { playCopy } from '../messages/play'
import { DowntimeStepNav } from './DowntimeStepNav'
import type { PlanLine } from './playDowntime.model'
import {
  healAgainPatch,
  mechBayOf,
  medBayOf,
  restoreAgainLine,
  restoreLead,
  skippedSteps,
  stepNames,
  stepPlan,
  stepsFor,
} from './playDowntime.model'
import { processDowntimeNanites } from './playNanites.model'
import { recordPlayChange } from './playRolls.model'
import { payDowntimeUpkeep } from './playUpkeep.model'
import type { Play } from './situation.model'
import { makeCrawlerHref } from './units.model'
import type { PlayActions } from './usePlayActions'

/** A line's title is a caps label; its weight is the `strong`'s. */
const LINE_LABEL = cn('su-play-dt-line__label', capsLabel({ weight: 'inherit' }))

/** The caption over the step's quoted text where the step's own line says otherwise (r6 D7). */
const GENERAL_RULE = capsLabel()

type PlayDowntimeStepProps = {
  play: Play
  actions: PlayActions
  step: RefObjectGuideStep
  stepIndex: number
  stepCount: number
  /** Every step of the Downtime, for End Downtime's list of the skipped ones. */
  steps: readonly RefObjectGuideStep[]
}

export function PlayDowntimeStep({
  play,
  actions,
  step,
  stepIndex,
  stepCount,
  steps,
}: PlayDowntimeStepProps) {
  const { downtime } = play
  const inGame = play.target.gameId !== null
  const { pilot, mech, crawler, store } = actions
  const canPay = !downtime.locked
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set())
  const [claimedHere, setClaimedHere] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  // The changes this step made, as they read when it applied them.
  const [applied, setApplied] = useState<readonly PlanLine[]>([])

  const planInput = {
    stepName: step.name,
    pilot,
    mech,
    crawler,
    pilotCrawlerTl: actions.crawlerTechLevel,
    upkeep: { spent: downtime.downtime.upkeepSpent, canPay },
  }
  const plan = stepPlan(planInput)
  const applicable = plan.filter((line) => line.skippable)
  // Why a hurt pilot cannot heal, said first, with its page (r6 D7).
  const lead = restoreLead(planInput)
  // A Game's step with nothing for this seat counts as done for it (r6 D2).
  const seatFree = inGame && isSeatFreeStep(stepIndex)
  const members = downtime.downtime.members
  const doneCount = downtime.downtime.completedBy.filter((m) =>
    members.some((member) => member.userId === m.userId)
  ).length
  // This pilot's step is taken (applied, skipped or marked done): never offered again this Downtime.
  const claimed = claimedHere || (downtime.doneSteps?.includes(stepIndex) ?? false)
  // Taken, a line that states a change (`steps`) is the one made; a line that
  // reads a state (Upkeep, Nanites) stays live.
  // Restore taken with no Med Bay: why the HP stays, and solo, once a crawler
  // has one, the healing as a second run of the same step (r5 A12).
  const [healedAgain, setHealedAgain] = useState(false)
  const again = claimed && !healedAgain ? restoreAgainLine(planInput) : null
  const canHealAgain = again?.skippable === true && !inGame && downtime.healAgain !== null
  const shown = claimed
    ? [
        ...plan.filter((line) => line.steps.length === 0),
        ...applied.filter((line) => again === null || line.key !== 'pilot'),
        ...(again !== null && (canHealAgain || !again.skippable) ? [again] : []),
      ]
    : plan
  const off = !play.canWrite
  // End Downtime with steps walked past unapplied asks first (r4 A6), as
  // leaving mid-way does (`useSituationMoves`).
  const [ending, setEnding] = useState<readonly number[] | null>(null)
  function end() {
    const skipped = skippedSteps({
      steps,
      upTo: stepIndex,
      // This step, taken a moment ago, may not have been read back yet.
      taken: [...(downtime.doneSteps ?? []), ...(claimed ? [stepIndex] : [])],
      pilot,
      mech,
      crawler,
      pilotCrawlerTl: actions.crawlerTechLevel,
      upkeep: { spent: downtime.downtime.upkeepSpent, canPay },
    })
    if (pilot === null || skipped.length === 0) play.endDowntime()
    else setEnding(skipped)
  }

  function toggle(key: string) {
    const next = new Set(unticked)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setUnticked(next)
  }

  /**
   * Take the step for this pilot, with what it applies to them and their
   * mech (one batch). False when it was already done (another tab, before a
   * reload, before a Back) or the write was refused: apply nothing
   * more.
   */
  async function take(
    pilotPatch: Record<string, unknown>,
    mechShare?: { id: string; patch: Record<string, unknown> }
  ): Promise<boolean> {
    if (downtime.markStepDone === null) return false
    const ok = await downtime.markStepDone(stepIndex, pilotPatch, mechShare)
    if (ok) setClaimedHere(true)
    else setNote(playCopy('stepAlreadyDone'))
    return ok
  }

  /** Skip the step, or mark one with nothing to apply done: the step op, applying nothing. */
  async function skip() {
    await take({})
  }

  /** The Med Bay's healing, for a Restore taken before there was one: its own op, once. */
  async function healAgain() {
    if (pilot === null || downtime.healAgain === null) return
    const fresh = store.get('pilot', pilot.id) ?? pilot
    const patch = healAgainPatch(fresh, crawler, actions.crawlerTechLevel)
    const ok = await downtime.healAgain(stepIndex, patch)
    setHealedAgain(true)
    if (ok) recordPlayChange(`${step.name} · ${fresh.name}`)
    setNote(playCopy(ok ? 'appliedTo' : 'stepAlreadyDone', { what: fresh.name }))
  }

  /** Pay this Downtime's Upkeep (`payDowntimeUpkeep`). */
  function payTheUpkeep(): Promise<string | null> {
    return payDowntimeUpkeep({ crawler, store, claim: downtime.claim })
  }

  async function apply() {
    const steps = stepsFor(plan, unticked)
    const applied: string[] = []
    const freshPilot = pilot ? (store.get('pilot', pilot.id) ?? pilot) : null
    const pilotPatch = freshPilot
      ? downtimePilotPatch(freshPilot, medBayOf(crawler), steps, actions.crawlerTechLevel)
      : {}
    const freshMech = mech ? (store.get('mech', mech.id) ?? mech) : null
    const mechPatch = freshMech
      ? downtimeMechPatch(
          freshMech,
          freshPilot?.abilities,
          crawlerTechLevelOf(crawler),
          steps,
          mechBayOf(crawler)
        )
      : {}
    const mechShare =
      freshMech && Object.keys(mechPatch).length > 0
        ? { id: freshMech.id, patch: mechPatch }
        : undefined
    if (!(await take(pilotPatch, mechShare))) return
    setApplied(plan.filter((l) => l.steps.length > 0 && l.skippable && !unticked.has(l.key)))
    if (freshMech && mechShare) applied.push(freshMech.name)
    if (freshPilot && Object.keys(pilotPatch).length > 0) applied.push(freshPilot.name)
    // What was applied lands on the Feed as a change (play.md §8).
    if (applied.length > 0) recordPlayChange(`${step.name} · ${applied.join(', ')}`)
    const upkeep = plan.find((l) => l.key === 'upkeep' && l.skippable && !unticked.has(l.key))
    const paid = upkeep ? await payTheUpkeep() : null
    const nanites = plan.find((l) => l.key === 'nanites' && l.skippable && !unticked.has(l.key))
    const processed = nanites
      ? await processDowntimeNanites({
          crawler,
          store,
          rollD20,
          label: step.name,
          claim: downtime.claim,
        })
      : null
    setNote(
      [
        applied.length > 0 ? playCopy('appliedTo', { what: applied.join(' and ') }) : null,
        paid,
        processed,
      ]
        .filter(Boolean)
        .join(' ') || playCopy('nothingToApply')
    )
  }

  const chip = inGame ? (
    <Badge shape="stamp" surface="inverse" size="mini">
      {playCopy('mediatorAdvancesOfDone', { doneCount, count: members.length })}
    </Badge>
  ) : (
    <Badge shape="stamp" surface="inverse" size="mini">
      {playCopy('youRunIt')}
    </Badge>
  )

  return (
    <TitledBox title={step.name} as="section" chips={chip}>
      {lead && <p className="su-play-act__need">{lead}</p>}
      {shown.length > 0 ? (
        <>
          {/* The ticks the words promise: said only where a line has one (r6 D2). */}
          {!claimed && applicable.length > 0 && (
            <p className="su-play-resolve__note">{playCopy('appliesEachLineCanBe')}</p>
          )}
          <ul className="su-play-dt-lines" aria-label={playCopy(claimed ? 'applied' : 'willApply')}>
            {shown.map((line) => (
              <PlanLineItem
                key={line.key}
                line={line}
                ticked={!unticked.has(line.key)}
                onToggle={() => toggle(line.key)}
                disabled={claimed}
                crawlerHref={inGame ? null : makeCrawlerHref(pilot?.id ?? null)}
              />
            ))}
          </ul>
        </>
      ) : step.content && step.content.length > 0 ? (
        <>
          {lead && <p className={GENERAL_RULE}>{playCopy('generalRule')}</p>}
          <Content body={step.content} grouped />
        </>
      ) : null}
      {note && (
        <p className="su-play-resolve__note" aria-live="polite">
          {note}
        </p>
      )}
      <div className="su-play-dt-controls">
        {claimed ? (
          <>
            <span className="su-play-act__state">{playCopy('done')}</span>
            {canHealAgain && (
              <Button size="compact" onClick={() => void healAgain()} disabled={off}>
                {playCopy('healAtTheMedBay')}
              </Button>
            )}
          </>
        ) : applicable.length > 0 ? (
          <>
            <Button size="compact" onClick={() => void skip()} disabled={off}>
              {playCopy('skip')}
            </Button>
            <Button size="compact" variant="primary" onClick={() => void apply()} disabled={off}>
              {playCopy('applyMarkDone')}
            </Button>
          </>
        ) : seatFree ? (
          <span className="su-play-act__state">{playCopy('nothingForYourSeat')}</span>
        ) : inGame ? (
          <Button size="compact" onClick={() => void skip()} disabled={off}>
            {playCopy('markDone')}
          </Button>
        ) : null}
        {!downtime.locked && (
          <DowntimeStepNav
            step={stepIndex}
            count={stepCount}
            off={off}
            onEnd={end}
            onAdvance={downtime.advance}
          />
        )}
      </div>
      <ConfirmDialog
        open={ending !== null}
        onOpenChange={(open) => {
          if (!open) setEnding(null)
        }}
        title={playCopy('endDowntime2')}
        body={playCopy('endDowntimeSkipped', { steps: stepNames(steps, ending ?? []) })}
        confirmLabel={playCopy('endAnyway')}
        cancelLabel={playCopy('goBack')}
        onConfirm={() => {
          setEnding(null)
          play.endDowntime()
        }}
      />
    </TitledBox>
  )
}

function PlanLineItem({
  line,
  ticked,
  onToggle,
  disabled,
  crawlerHref,
}: {
  line: PlanLine
  ticked: boolean
  onToggle: () => void
  disabled: boolean
  /** Solo, where a line that needs a Union Crawler links to making one. */
  crawlerHref: string | null
}) {
  const id = useId()
  return (
    // An unticked line wears select mode's one dim (hard rule R15).
    <li className={cn('su-play-dt-line', line.skippable && !ticked && SELECT_DIM)}>
      {line.skippable ? (
        // The check is named by the title beside it, never a hand-rolled <label> (R16).
        <span className={LINE_LABEL}>
          <Checkbox
            id={id}
            checked={ticked}
            onChange={onToggle}
            disabled={disabled}
            aria-labelledby={`${id}-title`}
            hitArea
          />
          <strong id={`${id}-title`}>{line.title}</strong>
        </span>
      ) : (
        <strong className={LINE_LABEL}>{line.title}</strong>
      )}
      {line.blocked ? (
        <span className="su-play-act__need">{line.blocked}</span>
      ) : (
        <span className="su-play-dt-line__chips">
          {line.chips.map((chip) => (
            <Stat key={chip.label} size="mini" label={chip.label} value={chip.value} />
          ))}
        </span>
      )}
      {line.note && <span className="su-play-act__need">{line.note}</span>}
      {line.needsCrawler && crawlerHref !== null && (
        <Button size="mini" href={crawlerHref}>
          {playCopy('makeAUnionCrawler')}
        </Button>
      )}
    </li>
  )
}
