/* Ported from packages/component-lib/src/components/dashboard/DowntimeWizard.stories.tsx. */
import { DowntimeWizard } from 'component-lib'
import { Caption, InstrumentStage } from '../preview-lib/harness'

/**
 * The guided Crawler Downtime loop, driven from the real "Crawler Downtime"
 * Guide in the ORM — real SRD content and roll tables, one step at a time.
 * Rendered as the light "document under glass" inside the dark instrument
 * stage. The rules-gate readout is app-injected and omitted here.
 */
export function FirstStep() {
  return (
    <div className="flex flex-col gap-4">
      <Caption>downtime wizard — the opening step</Caption>
      <InstrumentStage width={560} mount="crawler">
        <div
          className="pc-display-light"
          style={{ height: 520, borderRadius: 'var(--radius-panel)' }}
        >
          <DowntimeWizard
            stepIndex={0}
            onStepChange={() => {}}
            doneMap={{}}
            onToggleDone={() => {}}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}

/** A later step, with earlier ones marked complete. */
export function InProgress() {
  return (
    <div className="flex flex-col gap-4">
      <Caption>mid-loop — earlier steps marked complete</Caption>
      <InstrumentStage width={560} mount="crawler">
        <div
          className="pc-display-light"
          style={{ height: 520, borderRadius: 'var(--radius-panel)' }}
        >
          <DowntimeWizard
            stepIndex={2}
            onStepChange={() => {}}
            doneMap={{ 0: true, 1: true }}
            onToggleDone={() => {}}
          />
        </div>
      </InstrumentStage>
    </div>
  )
}
