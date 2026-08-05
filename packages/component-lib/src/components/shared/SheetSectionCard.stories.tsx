import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import type { CSSVarStyle } from '../../styles/cssVars'
import { Badge } from '../chrome/Badge'
import { Button } from '../chrome/Button'
import { SheetSectionCard } from './SheetSectionCard'

export default { title: 'Containers/Sheet Section Card' }

// Themes via --tone / --tone-deep (pilot orange), the same route the live sheets use.
const PILOT_TONE: CSSVarStyle = {
  '--tone': 'var(--color-pilot)',
  '--tone-deep': 'var(--color-rust)',
}

/** The poster section frame — accent header band, deep-tone left rule, footer. */
export const Default: Story = () => (
  <div className="flex flex-col gap-3" style={PILOT_TONE}>
    <Caption>
      Accent-framed section: black title stamp + count, controls, paper body, source footer.
    </Caption>
    <SheetSectionCard
      title="Class Abilities"
      count={<Badge surface="outline">3</Badge>}
      controls={
        <Button variant="ghost" size="mini">
          Edit
        </Button>
      }
      source="Salvage Union · Pilot Abilities"
    >
      <p className="m-0 font-body text-sm leading-relaxed text-ink">
        Entity cards nest inside this body untouched — the card only frames the region.
      </p>
    </SheetSectionCard>
  </div>
)
