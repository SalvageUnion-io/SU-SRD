import type { Story } from '@ladle/react'
import { NavDrawer } from './NavDrawer'
import { SearchField } from './SearchField'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Shell/Nav Drawer',
}

const SrdBrand = () => (
  <span className="inline-flex shrink-0 border border-ink font-cond text-xl font-bold uppercase leading-none tracking-caps-tight">
    <span className="bg-ink px-1 py-0.5 text-paper">Salvage Union</span>
    <span className="bg-paper px-1 py-0.5 text-ink">SRD</span>
  </span>
)

const CATEGORIES = [
  {
    label: 'Mechs',
    schemas: [
      { id: 'chassis', displayName: 'Chassis', catalogBg: 'var(--color-mech)' },
      { id: 'systems', displayName: 'Systems', catalogBg: 'var(--color-su-green-dark)' },
    ],
  },
  {
    label: 'Reference',
    schemas: [
      {
        id: 'traits',
        displayName: 'Traits',
        catalogBg: 'var(--color-ink)',
        catalogLabel: 'var(--color-su-orange-dark)',
      },
    ],
  },
]

/**
 * The unified mobile nav drawer, shown opened in its richest (SRD) form —
 * brand + search + catalog categories + primary nav links (active = rust). The
 * ITUN builder uses the same component with just `navItems` (no categories or
 * search) and a narrower panel.
 */
export const Default: Story = () => (
  <NavDrawer
    brand={<SrdBrand />}
    categories={CATEGORIES}
    search={<SearchField placeholder="Search…" aria-label="Search the SRD" />}
    navItems={[
      { label: 'ABOUT', href: '/about/', active: true },
      { label: 'CHANGELOG', href: '/changelog/' },
      { label: 'DISCORD', href: '/discord/' },
      { label: 'BUILDER ↗', href: 'https://intheunionnow.com', external: true },
      {
        label: 'BUY THE GAME',
        href: 'https://leyline.press/collections/salvage-union',
        external: true,
      },
    ]}
    defaultOpen
  />
)
