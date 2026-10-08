/**
 * DowntimeWizard — the guided Union Crawler Downtime loop, shown on the ONE
 * light display surface while the Game's Downtime is running. Crawler-dominant:
 * pink chrome, and this wizard walks the 10-step Post-/Pre-Session procedure.
 *
 * The 10 steps are NOT hard-coded — they are driven from the real "Crawler
 * Downtime" Guide in the reference ORM (`SalvageUnionReference.Guides`, faithful
 * SRD p.227-228), one step at a time, rendered through the reused `Content` so it
 * matches the book verbatim, with the relevant SRD roll tables via `RollTable`.
 *
 * **The step is the Game's, not this device's** (plan D8, ADR-038 §5). It is
 * the `downtime` row's `stepIndex`, read through `useDowntime`, so every
 * member's Dashboard shows the same step and moves when the Mediator presses
 * Next step. The step track shows where the table is in the procedure; the
 * ready pips, one per member, fill from the row's `completedBy` as each presses
 * "I'm done". Only the Mediator moves the table on; a player cannot step ahead
 * alone. The Game hub's `DowntimePanel` reads and writes the same row.
 *
 * `DowntimeWizard` binds it to ITUN's state + rules: the read-only rules gate
 * readout (bay status / upkeep / trading) is computed from the crawler and the
 * pure rules modules. `DowntimeWizardFrame` is the presentational half. They
 * were split across component-lib and ITUN, with ITUN its only consumer; one
 * file since the component-lib boundary audit (PK-03).
 *
 * Restore WRITES (F5), to the pilot and the mech in the Minor slots. The wizard
 * used to render the guide and gates and write nothing at all, so Guided Play
 * described a rule it never applied.
 *
 * ADR-007 is satisfied without a confirm dialog here because Restore is
 * non-destructive by construction — `downtimeMechPatch` / `downtimePilotPatch`
 * only heal, repair and recharge, and both refuse to touch a Destroyed mech
 * (Downtime repairs Damaged, it never resurrects Destroyed). The explicit
 * button press IS the player's decision; there is no consequence to confirm.
 * Upkeep is the crawler's, so the Mediator pays it from the Crawler Major's
 * Upkeep bay (`CrawlerSlot.tsx`), once per Downtime.
 */

import { Badge, Button, Content, entityGuideToneColor, RollTable } from 'component-lib'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import type { SURefObjectGuideStep, SURefObjectTable } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import { bayGate, UPKEEP_SCRAP } from '../../lib/rules/crawlerEconomy'
import {
  allDowntimeSteps,
  downtimeMechPatch,
  downtimePilotPatch,
  mechBayStatus,
  medBayStatus,
} from '../../lib/rules/downtime'
import { runWrite } from '../../lib/runWrite'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { useEntityStore } from '../../stores/entityStore'
import { DASHBOARD_TXN } from '../../stores/surfaceProvenance'
import type { DowntimeHandle } from './useDowntime'

/** The guideType that identifies the Union Crawler Downtime procedure. */
const DOWNTIME_GUIDE_TYPE = 'downtime'

/** Fallback tone when the guide carries no `guideTone` (crawler ontology). */
const CRAWLER_TONE = 'var(--color-sheet-crawler-deep)'

/**
 * SRD roll tables associated with a Downtime step (keyed by the guide step's
 * name). The guide content describes the roll but does not link the table
 * entity, so this presentation glue resolves it for the reused RollTable.
 */
const STEP_ROLL_TABLE: Record<string, string> = {
  'Upkeep & Upgrade': 'Crawler Deterioration',
  Trade: 'Trading Bay',
}

/** The step track: one numbered marker per step, in a row. */
const TRACK: CSSProperties = {
  display: 'flex',
  gap: '4px',
  margin: 0,
  padding: 0,
  listStyle: 'none',
}

const MARK: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '2px 0',
  borderRadius: 'var(--radius-pip)',
  // Longhands: the current step thickens only the width, and React warns when
  // a rerender mixes a shorthand with its longhand.
  borderStyle: 'solid',
  borderColor: 'var(--color-sheet-crawler-deep)',
  borderWidth: 'var(--bw-chrome)',
  fontFamily: 'var(--font-cond)',
  fontWeight: 700,
  fontSize: 'var(--text-badge)',
  fontVariantNumeric: 'tabular-nums',
  textAlign: 'center',
}

/** A step the table has passed: filled. */
const MARK_PAST: CSSProperties = {
  ...MARK,
  background: 'var(--color-sheet-crawler-deep)',
  color: 'var(--color-paper)',
}

/** The step the table is on: a heavy outline. */
const MARK_NOW: CSSProperties = {
  ...MARK,
  borderWidth: 'var(--bw-rail)',
  background: 'var(--color-paper)',
  color: 'var(--color-ink)',
}

/** A step still to come: open. */
const MARK_NEXT: CSSProperties = { ...MARK, background: 'transparent', color: 'var(--color-ink)' }

/** The ready pips: who has finished this step. */
const READY: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '6px 12px',
  margin: 0,
  padding: 0,
  listStyle: 'none',
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-note)',
  color: 'var(--color-ink)',
}

const READY_ITEM: CSSProperties = { display: 'flex', alignItems: 'center', gap: '5px' }

const PIP: CSSProperties = {
  width: '10px',
  height: '10px',
  flexShrink: 0,
  borderRadius: 'var(--radius-full)',
  border: 'var(--bw-chrome) solid var(--color-ink)',
}

/** Done is a fill AND a ✓ in the label, never colour alone. */
const PIP_DONE: CSSProperties = { ...PIP, background: 'var(--color-status-ok)' }

const PIP_WAITING: CSSProperties = { ...PIP, background: 'transparent' }

const CONTROL: CSSProperties = { flex: 1 }

/** One member's ready pip. */
export type ReadyPip = { userId: string; name: string; done: boolean }

type DowntimeWizardFrameProps = {
  /** The step the Game is on (clamped to the guide's range). */
  stepIndex: number
  /** One pip per member, filled once they have finished this step. */
  ready: readonly ReadyPip[]
  /** Whether the viewer has marked this step done. */
  doneByMe: boolean
  /** "I'm done" and its undo. */
  onDone: (done: boolean) => void
  /** Mediator only: move the whole table to the next step. Absent for a player. */
  onNext?: () => void
  /** App-computed read-only rules readout for a step (crawler + rules modules). */
  renderStepGate?: (step: SURefObjectGuideStep) => ReactNode
}

/**
 * The presentational half: the step, the ready pips and the writes are the
 * caller's, and the rules gate readout is injected via `renderStepGate`.
 * Exported for the Ladle story, which drives it with the real guide and local
 * state instead of the Game's row.
 */
export function DowntimeWizardFrame({
  stepIndex,
  ready,
  doneByMe,
  onDone,
  onNext,
  renderStepGate,
}: DowntimeWizardFrameProps) {
  const guide = SalvageUnionReference.Guides.find((g) => g.guideType === DOWNTIME_GUIDE_TYPE)
  const steps = guide?.steps ?? []
  if (steps.length === 0) {
    return <div className="pc-display-note">Downtime procedure not in the reference set.</div>
  }

  const idx = Math.min(Math.max(stepIndex, 0), steps.length - 1)
  const step = steps[idx]
  if (!step) {
    return <div className="pc-display-note">Downtime procedure not in the reference set.</div>
  }

  // Phase = the most recent section label at or before the current step (the
  // guide sets `section` only on the first step of each phase).
  let phase = 'Downtime'
  for (let i = 0; i <= idx; i++) {
    const sec = steps[i]?.section
    if (sec) phase = sec
  }

  const headerBg = (guide ? entityGuideToneColor(guide) : undefined) ?? CRAWLER_TONE
  const tableName = STEP_ROLL_TABLE[step.name]
  const table = tableName
    ? (SalvageUnionReference.RollTables.getByName(tableName) as SURefObjectTable | undefined)
    : undefined
  const doneCount = ready.filter((r) => r.done).length

  return (
    <div className="pc-display-scroll">
      <div className="pc-dt">
        <div className="pc-dt-head">
          <Badge
            shape="stamp"
            className="px-[9px] py-[5px] text-caption text-paper"
            style={{ backgroundColor: headerBg }}
          >
            {phase}
          </Badge>
          <span className="pc-dt-count">
            Step {idx + 1} / {steps.length}
          </span>
        </div>

        <ol style={TRACK} aria-label="Downtime steps">
          {steps.map((s, i) => (
            <li
              key={s.name}
              style={i < idx ? MARK_PAST : i === idx ? MARK_NOW : MARK_NEXT}
              title={s.name}
              aria-label={`Step ${i + 1}: ${s.name}${i < idx ? ', done' : ''}`}
              aria-current={i === idx ? 'step' : undefined}
            >
              {i + 1}
            </li>
          ))}
        </ol>

        <h3 className="pc-dt-step-name" style={{ borderColor: headerBg }}>
          {step.name}
        </h3>
        {step.content && step.content.length > 0 && (
          <Content body={step.content} headerBg={headerBg} />
        )}

        {renderStepGate?.(step)}

        {table && (
          <div className="pc-dt-table">
            <RollTable table={table} tableName={tableName} size="compact" showCommand />
          </div>
        )}

        {ready.length > 0 ? (
          <ul style={READY} aria-label={`Done with this step: ${doneCount} of ${ready.length}`}>
            {ready.map((r) => (
              <li key={r.userId} style={READY_ITEM}>
                <span style={r.done ? PIP_DONE : PIP_WAITING} aria-hidden="true" />
                {r.done ? `✓ ${r.name}` : r.name}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="pc-dt-note">
          {onNext
            ? 'You move the table on. Each player marks the step done when they are.'
            : 'The Mediator moves the table on. Mark the step done when you are.'}
        </p>

        <div className="pc-dt-controls">
          <Button
            size="compact"
            variant={doneByMe ? 'ghost' : 'primary'}
            style={CONTROL}
            onClick={() => onDone(!doneByMe)}
            aria-pressed={doneByMe}
          >
            {doneByMe ? '✓ Done' : "I'm done"}
          </Button>
          {onNext ? (
            <Button
              size="compact"
              style={CONTROL}
              onClick={() => onNext()}
              disabled={idx === steps.length - 1}
            >
              Next step ›
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}

type DowntimeWizardProps = {
  crawler: Crawler | null
  /** The mech and pilot Restore acts on: the two Minors. Absent = nothing to restore. */
  mech?: Mech | null
  pilot?: Pilot | null
  /** The Game's Downtime (`useDowntime`): the step, who is done, and the writes. */
  downtime: DowntimeHandle
  /** The viewer is the Mediator, who moves the table on (plan §8 A1). */
  mediator: boolean
  /** The signed-in viewer (`account.me`), whose pip "I'm done" fills. */
  viewerId: string | null
  store?: typeof useEntityStore
}

/** Read-only gate readout for the steps whose effects the rules modules gate. */
function StepGate({
  step,
  crawler,
  upkeepSpent,
}: {
  step: SURefObjectGuideStep
  crawler: Crawler
  upkeepSpent: boolean
}) {
  if (step.name === 'Restore your Mech & Pilot') {
    const mechBay = mechBayStatus(crawler)
    const medBay = medBayStatus(crawler)
    return (
      <ul className="pc-dt-gate">
        <li>
          Mech Bay:{' '}
          {mechBay.operational
            ? 'operational — SP/EP/Heat restore, damaged items repair'
            : 'blocked — no restore or repair this Downtime'}
        </li>
        <li>
          Med Bay:{' '}
          {medBay.operational
            ? `operational — HP heals${medBay.healsMajor ? ', Minor + Major Injuries heal' : medBay.healsMinor ? ', Minor Injuries heal' : ''}`
            : 'blocked — no HP or injury healing (AP still rests to full)'}
        </li>
      </ul>
    )
  }
  if (step.name === 'Upkeep & Upgrade') {
    return (
      <ul className="pc-dt-gate">
        <li>Upkeep is {UPKEEP_SCRAP}× the crawler's Tech Level in Scrap this Downtime.</li>
        <li>
          {upkeepSpent
            ? 'Upkeep is paid for this Downtime.'
            : 'Upkeep is outstanding. The Mediator pays it from the Crawler’s Upkeep bay.'}
        </li>
        <li>Unpaid Upkeep forces a roll on the Crawler Deterioration table (below).</li>
      </ul>
    )
  }
  if (step.name === 'Trade') {
    const trading = bayGate(crawler, 'Trading Bay')
    return (
      <ul className="pc-dt-gate">
        <li>
          Trading Bay:{' '}
          {trading.operational
            ? 'operational — roll availability, then trade Scrap at fixed rates'
            : trading.present
              ? 'damaged — Scrap trading and the availability roll are blocked'
              : 'not installed — no Trading Bay availability this Downtime'}
        </li>
      </ul>
    )
  }
  return null
}

export function DowntimeWizard({
  crawler,
  mech,
  pilot,
  downtime,
  mediator,
  viewerId,
  store = useEntityStore,
}: DowntimeWizardProps) {
  const storeState = store()
  const [restored, setRestored] = useState<string | null>(null)
  const { stepIndex, completedBy, members, upkeepSpent } = downtime.downtime
  const done = new Set(completedBy.map((c) => c.userId))
  const ready: ReadyPip[] = members.map((m) => ({
    userId: m.userId,
    name: m.displayName,
    done: done.has(m.userId),
  }))

  /**
   * Apply the Restore step to the mech and pilot.
   *
   * Reads the FRESHEST records so a rapid second press cannot restore against a
   * stale copy, and writes each half only when the rules produced a change —
   * an empty patch would log a change that changed nothing.
   */
  function restore(): void {
    if (!crawler) return
    const steps = allDowntimeSteps()
    const crawlerTl = Number((crawler.techLevel ?? '').replace(/\D/g, '')) || 1
    const applied: string[] = []

    if (mech) {
      const fresh = storeState.get('mech', mech.id) ?? mech
      const patch = downtimeMechPatch(fresh, crawlerTl, steps, mechBayStatus(crawler))
      if (Object.keys(patch).length > 0) {
        runWrite(() => storeState.update('mech', mech.id, patch, DASHBOARD_TXN))
        applied.push(fresh.name)
      }
    }
    if (pilot) {
      const fresh = storeState.get('pilot', pilot.id) ?? pilot
      const patch = downtimePilotPatch(
        fresh,
        medBayStatus(crawler),
        steps,
        resolveEffectiveCrawlerLevel(fresh, crawler)
      )
      if (Object.keys(patch).length > 0) {
        runWrite(() => storeState.update('pilot', pilot.id, patch, DASHBOARD_TXN))
        applied.push(fresh.name)
      }
    }

    setRestored(
      applied.length > 0
        ? `Restored ${applied.join(' and ')}.`
        : 'Nothing to restore — everything is already at full.'
    )
  }

  return (
    <DowntimeWizardFrame
      stepIndex={stepIndex ?? 0}
      ready={ready}
      doneByMe={viewerId !== null && done.has(viewerId)}
      onDone={downtime.markDone}
      onNext={mediator ? downtime.advance : undefined}
      renderStepGate={
        crawler
          ? (step) => (
              <>
                <StepGate step={step} crawler={crawler} upkeepSpent={upkeepSpent} />
                {step.name === 'Restore your Mech & Pilot' && (mech || pilot) ? (
                  <div className="pc-dt-gate">
                    <Button type="button" onClick={restore}>
                      Apply Restore
                    </Button>
                    {restored ? <p className="pc-dt-note">{restored}</p> : null}
                  </div>
                ) : null}
              </>
            )
          : undefined
      }
    />
  )
}
