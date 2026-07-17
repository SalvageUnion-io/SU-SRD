import type { Story } from '@ladle/react'
import { SectionCard } from './SectionCard'
import { Badge } from '../chrome/Badge'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/ITUN/Section Card',
}

/**
 * ITUN's black-header card (lifted from the app, pending approval). Two variants:
 * `panel` (default) frames self-contained tool panels — 2px ink frame, caps
 * title, muted hint; `card` frames tracked-entity insets — chrome frame, a raw
 * composed title (tag + name), hint pushed to the bar's right edge.
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-6">
    <SectionCard variant="panel" title="Salvage" hint="3 items">
      <p className="m-0 font-body text-sm text-ink-2">
        Roll on the Salvage Table when you break down a Mech for parts.
      </p>
    </SectionCard>

    <SectionCard
      variant="card"
      title={
        <>
          <Badge shape="stamp">Crew</Badge>
          <span className="font-cond text-lede font-bold uppercase text-paper">Ace</span>
        </>
      }
      hint={<Badge surface="ghost">Greaser</Badge>}
    >
      <p className="m-0 font-body text-sm text-ink-2">A crawler-bay crew lead — 4 HP.</p>
    </SectionCard>
  </div>
)
