import type { CSSProperties } from 'react'
import { useEffect, useRef } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { borderWidth, color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import '../../stories/_stories.css'
import type { Story } from '../../stories/_harness'
import { SearchField } from '../atoms/SearchField'
import type { NavDrawerCategory } from './NavDrawer'
import { NavDrawer } from './NavDrawer'

export default {
  title: 'Compositions/Shell/Nav Drawer',
}

const BRAND = {
  border: `${borderWidth.hairline} solid ${color.ink}`,
  display: 'inline-flex',
  flexShrink: 0,
  fontFamily: font.cond,
  fontSize: fontSize.xl,
  fontWeight: weight.bold,
  letterSpacing: tracking.capsTight,
  lineHeight: 1,
  textTransform: 'uppercase',
} satisfies CSSProperties

const BRAND_PAD = `${space[2]} ${space[4]}`

const SrdBrand = () => (
  <span style={BRAND}>
    <span style={{ backgroundColor: color.ink, color: color.paper, padding: BRAND_PAD }}>
      Salvage Union
    </span>
    <span style={{ backgroundColor: color.paper, color: color.ink, padding: BRAND_PAD }}>SRD</span>
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
          { label: 'About', href: '/about/', active: true },
          { label: 'Changelog', href: '/changelog/' },
          { label: 'Discord', href: '/discord/' },
          { label: 'Builder ↗', href: 'https://salvageunion.io/build/', external: true },
          {
            label: 'Buy the game',
            href: 'https://leyline.press/collections/salvage-union',
            external: true,
          },
        ]}
      />
    </div>
  )
}

/**
 * ITUN's drawer: the primary nav, then About and Changelog as quiet
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
          { label: 'About', href: 'https://salvageunion.io/about/' },
          { label: 'Changelog', href: 'https://salvageunion.io/changelog/' },
        ]}
        panelClassName="su-story-nav-drawer-narrow"
      />
    </div>
  )
}
