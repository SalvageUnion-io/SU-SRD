import type { Story } from '@ladle/react'
import { Caption } from '../../stories/_harness'
import { Badge } from '../chrome/Badge'
import { Btn } from '../chrome/Btn'
import { SheetSectionCard } from './SheetSectionCard'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Sheet Section Card' }

// Themes via --tone / --tone-deep (pilot orange), the same route the live sheets use.
const PILOT_TONE = {
  '--tone': 'var(--su-orange, #ef894f)',
  '--tone-deep': 'var(--su-orange-dark, #a85222)',
} as React.CSSProperties

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
        <Btn variant="ghost" size="xs">
          Edit
        </Btn>
      }
      source="Salvage Union · Pilot Abilities"
    >
      <p className="m-0 font-body text-sm leading-relaxed text-ink">
        Entity cards nest inside this body untouched — the card only frames the region.
      </p>
    </SheetSectionCard>
  </div>
)
