import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space, weight } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { StepButton } from './SmallButtons'

export default {
  title: 'Atoms/Step Button',
}

// Real SRD content — reference data is preloaded by catalog.tsx.
const chassis = SalvageUnionReference.Chassis.all()[0]
const structure = chassis?.structurePoints ?? 10

const STACK = { display: 'flex', flexDirection: 'column', gap: space[20] } satisfies CSSProperties

const PAIR = {
  alignItems: 'flex-start',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[12],
} satisfies CSSProperties

const IN_CONTEXT = { alignItems: 'center', display: 'flex', gap: space[8] } satisfies CSSProperties

const VALUE = {
  color: color.ink,
  fontFamily: font.body,
  fontSize: fontSize.lede,
  fontVariantNumeric: 'tabular-nums',
  fontWeight: weight.bold,
} satisfies CSSProperties

/**
 * `StepButton` — the 24×24 stat stepper (−/+) that flanks a StatBlock value.
 * Enabled pair + in-context pair around a real chassis SP value + disabled pair
 * (at a min/max bound).
 */
export const Default: Story = () => (
  <div style={STACK}>
    <div>
      <Caption>enabled −/+ pair</Caption>
      <div style={PAIR}>
        <StepButton aria-label="Decrease Structure">–</StepButton>
        <StepButton aria-label="Increase Structure">+</StepButton>
      </div>
    </div>
    <div>
      <Caption>in context (SP {structure})</Caption>
      <div style={IN_CONTEXT}>
        <StepButton aria-label="Decrease Structure">–</StepButton>
        <span style={VALUE}>{structure}</span>
        <StepButton aria-label="Increase Structure">+</StepButton>
      </div>
    </div>
    <div>
      <Caption>disabled at bound</Caption>
      <div style={PAIR}>
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
