import type { CSSProperties } from 'react'
import { space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Text } from './Text'

export default {
  title: 'Atoms/Text',
}

const PAGE = { display: 'flex', flexDirection: 'column', gap: space[24] } satisfies CSSProperties
const SPECIMEN = { display: 'flex', flexDirection: 'column', gap: space[8] } satisfies CSSProperties

/** Every Text variant on one page — default/body prose plus the hint + flavor asides. */
export const Default: Story = () => (
  <div style={PAGE}>
    <div style={SPECIMEN}>
      <Caption>variant="default" — Fira Code body face</Caption>
      <Text>
        Roll on the Core Mechanic Table with a d20; a 20 is a Nailed It, a 1 is a Cascade Failure.
      </Text>
    </div>

    <div style={SPECIMEN}>
      <Caption>variant="body" — reference prose / labelled values</Caption>
      <Text variant="body">
        The Iron Mongrel is a Tech Level 1 chassis with 10 Structure Points and 3 System Slots. It
        vents 1 Heat at the start of each turn.
      </Text>
    </div>

    <div style={SPECIMEN}>
      <Caption>variant="hint" — centered italic rules tip</Caption>
      <Text variant="hint">
        A Mech at 0 Structure Points is Destroyed — the Pilot must Bail Out or be caught in the
        wreck.
      </Text>
    </div>

    <div style={SPECIMEN}>
      <Caption>variant="flavor" — muted italic flavour text</Caption>
      <Text variant="flavor">
        Out past the Crawler's floodlights, the scrap fields stretch to the horizon — everything the
        old world left to rust.
      </Text>
    </div>

    <div style={SPECIMEN}>
      <Caption>
        no stamp variant — the square ink label is Badge shape=&quot;stamp&quot; (Atoms/Badge)
      </Caption>
      <Text variant="flavor">
        Text is the PROSE primitive. A label plate is a Badge; Text never renders one.
      </Text>
    </div>
  </div>
)
