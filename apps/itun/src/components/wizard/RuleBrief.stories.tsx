import type { CSSVarStyle } from 'component-lib'
import type { Story } from 'component-lib/stories/harness'
import { Caption } from 'component-lib/stories/harness'
import { RuleBrief } from './RuleBrief'

export default { title: 'Compositions/Rule Brief' }

const MECH_TONE: CSSVarStyle = {
  '--tone': 'var(--color-mech)',
  '--tone-deep': 'var(--color-sheet-mech-deep)',
}

/** The "THE RULE" callout every wizard step opens with — composes SheetSectionCard. */
export const Default: Story = () => (
  <div style={MECH_TONE} className="flex flex-col gap-3">
    <Caption>The wizard step's rule callout — rule text on paper, citation in the footer.</Caption>
    <RuleBrief
      rule="A Mech's Chassis sets its Structure Points, Energy Points, Heat Capacity, and its System and Module slots. Pick a Chassis before fitting any systems."
      cite="Core Book · p.94"
    />
  </div>
)
