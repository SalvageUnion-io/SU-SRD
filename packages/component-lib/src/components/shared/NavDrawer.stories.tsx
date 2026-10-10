import { useEffect, useRef } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { Story } from '../../stories/_harness'
import type { NavDrawerCategory } from './NavDrawer'
import { NavDrawer } from './NavDrawer'
import { SearchField } from './SearchField'

export default {
  title: 'Compositions/Shell/Nav Drawer',
}

const SrdBrand = () => (
  <span className="inline-flex shrink-0 border border-ink font-cond text-xl font-bold uppercase leading-none tracking-caps-tight">
    <span className="bg-ink px-1 py-0.5 text-paper">Salvage Union</span>
    <span className="bg-paper px-1 py-0.5 text-ink">SRD</span>
  </span>
)

// The SRD's chapters, with real entry counts (reference data is preloaded by
// catalog.tsx). The SRD builds the full set from its chapter map.
const CATEGORIES: NavDrawerCategory[] = [
  {
    label: 'Mech Workshop',
    schemas: [
      { id: 'chassis', displayName: 'Chassis', count: SalvageUnionReference.Chassis.all().length },
      { id: 'systems', displayName: 'Systems', count: SalvageUnionReference.Systems.all().length },
      { id: 'modules', displayName: 'Modules', count: SalvageUnionReference.Modules.all().length },
    ],
  },
  {
    label: 'Rules & Reference',
    schemas: [
      { id: 'guides', displayName: 'Guides', count: SalvageUnionReference.Guides.all().length },
      {
        id: 'roll-tables',
        displayName: 'Roll Tables',
        count: SalvageUnionReference.RollTables.all().length,
      },
      { id: 'traits', displayName: 'Traits', count: SalvageUnionReference.Traits.all().length },
    ],
  },
]

/**
 * The unified mobile nav drawer, shown opened in its richest (SRD) form —
 * brand + search + the index (a section stamp over compact rows with their
 * counts, board 08) + primary nav links (the page you are on is ink). The
 * ITUN builder uses the same component with just `navItems` (no categories or
 * search) and a narrower panel.
 *
 * The drawer opens itself on mount by clicking its own hamburger trigger —
 * the same path a user takes — because the apps pass no open prop.
 */
export const Default: Story = () => {
  const frameRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    frameRef.current?.querySelector<HTMLButtonElement>('[aria-label="Open menu"]')?.click()
  }, [])
  return (
    <div ref={frameRef}>
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
      />
    </div>
  )
}

/**
 * ITUN's drawer (issue 1255): the primary nav, then About and Changelog as quiet
 * links at the drawer's foot rather than among the destinations.
 */
export const WithFoot: Story = () => {
  const frameRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    frameRef.current?.querySelector<HTMLButtonElement>('[aria-label="Open menu"]')?.click()
  }, [])
  return (
    <div ref={frameRef}>
      <NavDrawer
        brand={<SrdBrand />}
        navItems={[
          { label: 'Shelves', href: '/', active: true },
          { label: 'Starter Set', href: '/starter/' },
          { label: 'Discord', href: '/discord/', external: true },
        ]}
        footItems={[
          { label: 'About', href: '/about' },
          { label: 'Changelog', href: '/changelog' },
        ]}
        panelClassName="w-72"
      />
    </div>
  )
}
