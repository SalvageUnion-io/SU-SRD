/**
 * DowntimeWizard — the guided Union Crawler Downtime loop, shown on the ONE
 * light display surface while the Dashboard is in the `'downtime'` mount state.
 * Crawler-dominant: pink chrome, and this wizard walks the 10-step Post-/Pre-
 * Session procedure.
 *
 * The 10 steps are NOT hard-coded — they are driven from the real "Crawler
 * Downtime" Guide in the reference ORM (`SalvageUnionReference.Guides`, faithful
 * SRD p.227-228), one step at a time, rendered through the reused `Content` so it
 * matches the book verbatim, with the relevant SRD roll tables via `RollTable`.
 *
 * Presentational: step navigation + the per-step "Mark Complete" flag are owned
 * by the caller (the app holds them in `playStateStore`); the read-only rules
 * gate readout is injected via `renderStepGate` (it needs the crawler + the
 * app's rules modules). Read-mostly — destructive economy writes happen on the
 * live sheet, never here.
 */

import type { ReactNode } from 'react'
import type { SURefObjectGuideStep, SURefObjectTable } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { cn } from '../../utils/cn'
import { Badge } from '../chrome/Badge'
import { Button } from '../chrome/Button'
import { Content } from '../referenceEntity/Content'
import { RollTable } from '../shared/RollTable'

/** The guideType that identifies the Union Crawler Downtime procedure. */
const DOWNTIME_GUIDE_TYPE = 'downtime'

/** Fallback tone when the guide carries no `guideColor` (crawler ontology). */
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

export type DowntimeWizardProps = {
  /** Current step index (clamped to the guide's range). Caller-owned. */
  stepIndex: number
  onStepChange: (index: number) => void
  /** Per-step "complete" flags, keyed by step index. */
  doneMap: Record<number, boolean>
  onToggleDone: (index: number) => void
  /** App-computed read-only rules readout for a step (crawler + rules modules). */
  renderStepGate?: (step: SURefObjectGuideStep) => ReactNode
}

export function DowntimeWizard({
  stepIndex,
  onStepChange,
  doneMap,
  onToggleDone,
  renderStepGate,
}: DowntimeWizardProps) {
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

  const done = doneMap[idx] ?? false
  const headerBg = guide?.guideColor ?? CRAWLER_TONE
  const tableName = STEP_ROLL_TABLE[step.name]
  const table = tableName
    ? (SalvageUnionReference.RollTables.getByName(tableName) as SURefObjectTable | undefined)
    : undefined

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

        <p className="pc-dt-note">
          Guidance only — Downtime economy writes (Upkeep, Restore, Crafting) are applied on the
          live sheet.
        </p>

        <div className="pc-dt-controls">
          <Button
            size="compact"
            className="flex-1"
            onClick={() => onStepChange(idx - 1)}
            disabled={idx === 0}
          >
            ‹ Prev
          </Button>
          <Button
            size="compact"
            className={cn('flex-1', done && 'bg-status-ok')}
            onClick={() => onToggleDone(idx)}
            aria-pressed={done}
          >
            {done ? '✓ Complete' : 'Mark Complete'}
          </Button>
          <Button
            size="compact"
            className="flex-1"
            onClick={() => onStepChange(idx + 1)}
            disabled={idx === steps.length - 1}
          >
            Next ›
          </Button>
        </div>
      </div>
    </div>
  )
}
