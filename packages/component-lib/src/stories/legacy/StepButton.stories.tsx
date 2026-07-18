import type { Story } from '@ladle/react'
import { StepButton } from '../../components/chrome/SmallButtons'
import { Caption } from '../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Step Button' }

/**
 * StepButton — the 24×24 −/+ stat stepper that flanks a StatBlock value
 * (design-spec §2.10 `stepbtn`). Stays h-6 w-6 on desktop, grows to the 44px
 * tap minimum below `sm`. The accessible name comes from the caller's
 * `aria-label`; here it flanks a mech's Structure Points readout.
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>Legacy · Step Button — the −/+ stat stepper flanking a value</Caption>

    <div className="flex items-center gap-2">
      <StepButton aria-label="Decrease Structure Points">–</StepButton>
      <span className="min-w-8 text-center font-body text-lede font-bold text-ink">12</span>
      <StepButton aria-label="Increase Structure Points">+</StepButton>
    </div>

    <Caption>Disabled (at the floor / ceiling of the stat)</Caption>
    <div className="flex items-center gap-2">
      <StepButton aria-label="Decrease Structure Points" disabled>
        –
      </StepButton>
      <span className="min-w-8 text-center font-body text-lede font-bold text-wk-muted">0</span>
      <StepButton aria-label="Increase Structure Points" disabled>
        +
      </StepButton>
    </div>
  </div>
)
