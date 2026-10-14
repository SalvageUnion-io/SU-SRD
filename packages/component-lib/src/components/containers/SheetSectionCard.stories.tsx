import { color, font, fontSize, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import type { CSSVarStyle } from '../../styles/cssVars'
import { Badge } from '../atoms/Badge'
import { SheetSectionCard } from './SheetSectionCard'

export default { title: 'Containers/Sheet Section Card' }

// Themes via --tone / --tone-deep (pilot orange), the same route the live sheets use.
const PILOT_TONE: CSSVarStyle = {
  '--tone': 'var(--color-pilot)',
  '--tone-deep': 'var(--color-sheet-pilot-deep)',
}

const STACK = { display: 'flex', flexDirection: 'column', gap: space[12] } satisfies CSSVarStyle

/** The poster section frame — accent header band, deep-tone left rule, footer. */
export const Default: Story = () => (
  <div style={{ ...PILOT_TONE, ...STACK }}>
    <Caption>Accent-framed section: black title stamp + count, paper body, source footer.</Caption>
    <SheetSectionCard
      title="Class Abilities"
      count={<Badge surface="outline">3</Badge>}
      source="Salvage Union · Pilot Abilities"
    >
      <p
        style={{
          margin: 0,
          fontFamily: font.body,
          fontSize: fontSize.sm,
          lineHeight: 1.625,
          color: color.ink,
        }}
      >
        Entity cards nest inside this body untouched — the card only frames the region.
      </p>
    </SheetSectionCard>
  </div>
)
