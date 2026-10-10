import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { CORE_ROLL_BANDS } from 'salvageunion-reference/rules'
import { InstrumentStage } from './_dashboardStage'
import { ResolvePanel } from './ResolvePanel'

export default { title: 'Compositions/Dashboard/Resolve Panel' }

const STACK: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 16 }

const FRAME: CSSProperties = { height: 520, borderRadius: 'var(--radius-panel)' }

const ignore = () => {}

/**
 * The Resolve tab mid-resolve: a real SRD action as its full reference card,
 * activated and rolled to a Tough Choice, with Push offered (a mech action).
 * This is what a reload restores from the seat.
 */
export const Default = () => {
  const action = SalvageUnionReference.Actions.all()[0]
  const tough = CORE_ROLL_BANDS.tough
  return (
    <div style={STACK}>
      <Caption>Resolve tab — activated and rolled; Push and Apply offered.</Caption>
      <InstrumentStage width={560}>
        <div className="pc-display-light" style={FRAME}>
          {action ? (
            <ResolvePanel
              view={{
                kind: 'resolve',
                onBack: ignore,
                costLabel: '2 EP · +1 Heat',
                currency: 'EP',
                entity: action,
                controls: {
                  activateLabel: 'Activated',
                  activateDisabled: true,
                  onActivate: ignore,
                  activated: true,
                  onRoll: ignore,
                  push: { disabled: false, pushed: false, onPush: ignore },
                  applyLabel: 'Apply',
                  applyDisabled: false,
                  onApply: ignore,
                  onClear: ignore,
                },
                roll: {
                  roll: 8,
                  band: 'tough',
                  bandRange: tough.range,
                  destructive: false,
                  bandLabel: tough.label,
                  bandSummary: tough.summary,
                },
                pushLog: null,
                applied: false,
                applyRouted: false,
              }}
            />
          ) : null}
        </div>
      </InstrumentStage>
    </div>
  )
}

/** Nothing chosen yet: the tab says where to choose. */
export const Idle = () => (
  <div style={STACK}>
    <Caption>Resolve tab with no action chosen.</Caption>
    <InstrumentStage width={560}>
      <div className="pc-display-light" style={FRAME}>
        <ResolvePanel
          view={{ kind: 'idle', text: 'Choose an action from the deck to resolve it here.' }}
        />
      </div>
    </InstrumentStage>
  </div>
)
