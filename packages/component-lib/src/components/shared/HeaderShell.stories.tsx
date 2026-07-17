import type { Story } from '@ladle/react'
import { HeaderShell } from './HeaderShell'
import { Badge } from '../chrome/Badge'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/Site/Header Shell',
}

/**
 * The shared brand chrome both SU surfaces build on — SU cargo mark + font-cond
 * wordmark (+ optional accent / badge) + eyebrow, with a right-side `children`
 * actions slot. Shown as the SRD reference site and the ITUN builder configure
 * it. (Pending approval — not yet promoted to a canonical group.)
 */
export const Default: Story = () => (
  <div className="flex flex-col gap-6">
    <HeaderShell
      homeHref="/"
      wordmark="SalvageUnion"
      wordmarkAccent=".io"
      eyebrow="The Salvage Union Reference"
    >
      <nav className="ml-auto flex items-center gap-4 font-cond text-sm font-bold uppercase tracking-caps">
        <span className="text-su-paper">Chassis</span>
        <span className="text-su-paper">Systems</span>
        <span className="text-su-orange">Builder</span>
      </nav>
    </HeaderShell>

    <HeaderShell
      homeHref="/"
      wordmark="In the Union Now"
      badge="Beta"
      eyebrow="A Salvage Union Character Manager"
      brandShrink
    >
      <div className="ml-auto flex items-center gap-3">
        <Badge>Encounter</Badge>
        <Badge surface="ghost">Search</Badge>
      </div>
    </HeaderShell>
  </div>
)
