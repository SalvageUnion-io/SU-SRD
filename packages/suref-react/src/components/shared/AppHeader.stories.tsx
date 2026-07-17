import type { Story } from '@ladle/react'
import { AppHeader } from './AppHeader'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/ITUN/App Header',
}

/**
 * ITUN's brand chrome (lifted from ITUN, pending review) — the shared
 * `HeaderShell` filled with ITUN's right-side cluster: Encounter/About nav, the
 * SRD cross-link, a search trigger, and "Buy the game". Below `lg` the nav
 * collapses into the hamburger drawer. Router-agnostic here: internal links
 * render through the default plain anchor (ITUN injects its router-aware
 * AppLink via `LinkComponent`).
 */
export const Default: Story = () => (
  <div className="-mx-4 -mt-4">
    <AppHeader onSearchClick={() => {}} />
  </div>
)
