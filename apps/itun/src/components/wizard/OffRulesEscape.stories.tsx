import { tokens } from 'component-lib'
import type { Story } from 'component-lib/stories/harness'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { OffRulesEscape } from './OffRulesEscape'

const FRAME: CSSProperties = { display: 'flex', flexDirection: 'column', gap: tokens.space[12] }

const INK_GROUND: CSSProperties = {
  backgroundColor: tokens.color.ink,
  borderRadius: '0.25rem',
  padding: `${tokens.space[12]} ${tokens.space[16]}`,
  width: 'fit-content',
}

export default { title: 'Compositions/Off Rules Escape' }

/**
 * The in-wizard exit to the Free-Edit Live Sheet — a dotted-underline text
 * button shown in the WizShell action pill while a gate is blocking. Rendered
 * on ink here (its `text-paper/70` treatment) as it sits in the tone pill.
 */
export const Default: Story = () => (
  <div style={FRAME}>
    <Caption>
      Subordinate escape hatch — shown only while a legality gate is blocking the build.
    </Caption>
    <div style={INK_GROUND}>
      <OffRulesEscape onEscape={() => {}} />
    </div>
  </div>
)
