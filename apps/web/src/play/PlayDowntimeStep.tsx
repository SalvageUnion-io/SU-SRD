/**
 * PlayDowntimeStep — the current Downtime step as one level-1 box (play.md §6): the step's name, who moves the table on, and exactly what
 * the step will apply (`playDowntime.model.ts`), each line untickable
 * (ADR-007), then Skip and Apply & mark done.
 *
 *  - **In a Game** the step is the Game's: the Mediator advances it
 *    ("Mediator advances · 2 of 4 done"), a player marks themselves done
 *    (`markDone`) and has no Next step. Undo unticks that "done" only.
 *  - **Solo** the player runs it ("You run it"): Apply & mark done, then Next
 *    step (the last step ends Downtime).
 *
 * Either way the step is one op on the pilot with a stable id
 * (`markStepDone`, ADR-063 §6) carrying what it applies to the pilot, and the
 * mech's share goes only when that op answers it was taken now. A taken step
 * never offers Apply or Skip again, so a reload, an Undo or the Mediator's
 * Back never applies a step twice (Train's +1 TP). A Game's "done" is per
 * member, the step per pilot: a member running two pilots applies it for each.
 *
 * Upkeep is spent once per Downtime: the claim (`spendUpkeep`) answers false
 * when it is already paid, and the Scrap is drawn only when it answers true.
 * Process Nanites (the Craft step, with a Nanite Processing Bay) goes to
 * whoever pays Upkeep, and spends the piles it rolls, so a second press finds
 * none (`processDowntimeNanites`).
 * Restore never confirms: its patches only heal, repair and recharge, and
 * refuse a Destroyed mech: nothing destructive, so nothing to confirm (ADR-007).
 *
 * What it applies lands on the Feed as a change (`recordPlayChange`).
 * Inside the box, the lines are plain content (labels and Stat chips), never
 * a box of their own (play.md §12).
 */

import { downtimeMechPatch, downtimePilotPatch } from 'game-domain/rules/downtime'
import { useId, useState } from 'react'
import type { RefObjectGuideStep } from 'salvageunion-reference'
import { capsLabel } from '../components/atoms/capsLabel'
import {
  Badge,
  Button,
  Checkbox,
  Content,
  cn,
  SELECT_DIM,
  Stat,
  TitledBox,
} from '../components/index'
import { useMe } from '../lib/account/accountApi'
import { rollD20 } from '../lib/dice'
import { runWrite } from '../lib/runWrite'
import { playCopy } from '../messages/play'
import { PLAY_TXN } from '../replica/provenance'
import { useViewerId } from '../replica/useTable'
import { DowntimeStepNav } from './DowntimeStepNav'
import type { PlanLine } from './playDowntime.model'
import { crawlerTl, mechBayOf, medBayOf, stepPlan, stepsFor } from './playDowntime.model'
import { processDowntimeNanites } from './playNanites.model'
import { recordPlayChange } from './playRolls.model'
import { payDowntimeUpkeep } from './playUpkeep.model'
import type { Play } from './situation.model'
import type { PlayActions } from './usePlayActions'

/** A line's title is a caps label; its weight is the `strong`'s. */
const LINE_LABEL = cn('su-play-dt-line__label', capsLabel({ weight: 'inherit' }))

type PlayDowntimeStepProps = {
  play: Play
  actions: PlayActions
  step: RefObjectGuideStep
  stepIndex: number
  stepCount: number
}

export function PlayDowntimeStep({
  play,
  actions,
  step,
  stepIndex,
  stepCount,
}: PlayDowntimeStepProps) {
  const { downtime } = play
  const inGame = play.target.gameId !== null
  const me = useMe(inGame)
  const viewer = useViewerId(me?._id ?? null)
  const { pilot, mech, crawler, store } = actions
  const canPay = !downtime.locked
  const [unticked, setUnticked] = useState<ReadonlySet<string>>(new Set())
  const [claimedHere, setClaimedHere] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const plan = stepPlan({
    stepName: step.name,
    pilot,
    mech,
    crawler,
    pilotCrawlerTl: actions.crawlerTechLevel,
    upkeep: { spent: downtime.downtime.upkeepSpent, canPay },
  })
  const applicable = plan.filter((line) => line.skippable)
  const members = downtime.downtime.members
  const doneCount = downtime.downtime.completedBy.length
  // This pilot's step is applied or skipped: never offered again this Downtime.
  const claimed = claimedHere || (downtime.doneSteps?.includes(stepIndex) ?? false)
  // In a Game, whether this member has said they are done (`completedBy`).
  const markedDone = inGame
    ? viewer !== null && downtime.downtime.completedBy.some((m) => m.userId === viewer)
    : claimed
  const off = !play.canWrite

  function toggle(key: string) {
    const next = new Set(unticked)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setUnticked(next)
  }

  function markDone() {
    downtime.markDone?.(true)
  }

  /**
   * Take the step for this pilot, with what it applies to them. False when it
   * was already done (another tab, before a reload, before an Undo or a Back)
   * or the write was refused: apply nothing more.
   */
  async function take(pilotPatch: Record<string, unknown>): Promise<boolean> {
    if (downtime.markStepDone === null) return false
    const ok = await downtime.markStepDone(stepIndex, pilotPatch)
    if (ok) setClaimedHere(true)
    else setNote('This step is already done this Downtime.')
    return ok
  }

  async function skip() {
    if (!(await take({}))) return
    markDone()
  }

  /** Pay this Downtime's Upkeep: claim it, then draw the Scrap (`payDowntimeUpkeep`). */
  function payTheUpkeep(): Promise<string | null> {
    return payDowntimeUpkeep({ crawler, store, spendUpkeep: downtime.spendUpkeep })
  }

  async function apply() {
    const steps = stepsFor(plan, unticked)
    const applied: string[] = []
    const freshPilot = pilot ? (store.get('pilot', pilot.id) ?? pilot) : null
    const pilotPatch = freshPilot
      ? downtimePilotPatch(freshPilot, medBayOf(crawler), steps, actions.crawlerTechLevel)
      : {}
    if (!(await take(pilotPatch))) return
    if (mech) {
      const fresh = store.get('mech', mech.id) ?? mech
      const patch = downtimeMechPatch(fresh, crawlerTl(crawler), steps, mechBayOf(crawler))
      if (Object.keys(patch).length > 0) {
        runWrite(() => store.update('mech', mech.id, patch, PLAY_TXN))
        applied.push(fresh.name)
      }
    }
    if (freshPilot && Object.keys(pilotPatch).length > 0) applied.push(freshPilot.name)
    // What was applied lands on the Feed as a change (play.md §8).
    if (applied.length > 0) recordPlayChange(`${step.name} · ${applied.join(', ')}`)
    const upkeep = plan.find((l) => l.key === 'upkeep' && l.skippable && !unticked.has(l.key))
    const paid = upkeep ? await payTheUpkeep() : null
    const nanites = plan.find((l) => l.key === 'nanites' && l.skippable && !unticked.has(l.key))
    const processed = nanites ? processDowntimeNanites({ crawler, store, rollD20 }) : null
    if (processed) recordPlayChange(`${step.name} · ${processed}`)
    setNote(
      [applied.length > 0 ? `Applied to ${applied.join(' and ')}.` : null, paid, processed]
        .filter(Boolean)
        .join(' ') || 'Nothing to apply.'
    )
    markDone()
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
      {plan.length > 0 ? (
        <>
          <p className="su-play-resolve__note">{playCopy('appliesEachLineCanBe')}</p>
          <ul className="su-play-dt-lines" aria-label={playCopy('willApply')}>
            {plan.map((line) => (
              <PlanLineItem
                key={line.key}
                line={line}
                ticked={!unticked.has(line.key)}
                onToggle={() => toggle(line.key)}
                disabled={claimed}
              />
            ))}
          </ul>
        </>
      ) : step.content && step.content.length > 0 ? (
        <Content body={step.content} grouped />
      ) : null}
      {note && (
        <p className="su-play-resolve__note" aria-live="polite">
          {note}
        </p>
      )}
      <div className="su-play-dt-controls">
        {markedDone && (claimed || applicable.length === 0) ? (
          <>
            <span className="su-play-act__state">{playCopy('done')}</span>
            {downtime.markDone && (
              <Button
                size="compact"
                variant="ghost"
                onClick={() => downtime.markDone?.(false)}
                disabled={off}
              >
                {playCopy('undo')}
              </Button>
            )}
          </>
        ) : claimed ? (
          <>
            <span className="su-play-act__state">{playCopy('applied')}</span>
            <Button size="compact" onClick={markDone} disabled={off}>
              {playCopy('markDone')}
            </Button>
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
        ) : inGame ? (
          <Button size="compact" onClick={markDone} disabled={off}>
            {playCopy('markDone')}
          </Button>
        ) : null}
        {!downtime.locked && (
          <DowntimeStepNav
            step={stepIndex}
            count={stepCount}
            off={off}
            onEnd={play.endDowntime}
            onAdvance={downtime.advance}
          />
        )}
      </div>
    </TitledBox>
  )
}

function PlanLineItem({
  line,
  ticked,
  onToggle,
  disabled,
}: {
  line: PlanLine
  ticked: boolean
  onToggle: () => void
  disabled: boolean
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
    </li>
  )
}
