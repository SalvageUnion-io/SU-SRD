import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { StepButton } from './SmallButtons'

export default {
  title: 'Atoms/Step Button',
}

// Real SRD content — reference data is preloaded by .ladle/components.tsx.
const chassis = SalvageUnionReference.Chassis.all()[0]
const structure = chassis?.structurePoints ?? 10

/**
 * `StepButton` — the 24×24 stat stepper (−/+) that flanks a StatBlock value.
 * Enabled pair + in-context pair around a real chassis SP value + disabled pair
 * (at a min/max bound).
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-5">
    <div>
      <Caption>enabled −/+ pair</Caption>
      <div className="flex flex-wrap items-start gap-3">
        <StepButton aria-label="Decrease Structure">–</StepButton>
        <StepButton aria-label="Increase Structure">+</StepButton>
      </div>
    </div>
    <div>
      <Caption>in context (SP {structure})</Caption>
      <div className="flex items-center gap-2">
        <StepButton aria-label="Decrease Structure">–</StepButton>
        <span className="font-body text-lede font-bold tabular-nums text-ink">{structure}</span>
        <StepButton aria-label="Increase Structure">+</StepButton>
      </div>
    </div>
    <div>
      <Caption>disabled at bound</Caption>
      <div className="flex flex-wrap items-start gap-3">
        <StepButton aria-label="Decrease Structure" disabled>
          –
        </StepButton>
        <StepButton aria-label="Increase Structure" disabled>
          +
        </StepButton>
      </div>
    </div>
  </div>
)
