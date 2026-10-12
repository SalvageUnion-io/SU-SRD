import type { NavDrawerCategory, NavDrawerItem } from 'component-lib'
import { Badge, NavDrawer } from 'component-lib'
import { borderWidth, color, fontSize, space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { NAV_CATALOG } from '../../generated/navCatalog'
import { IslandErrorBoundary } from './IslandErrorBoundary'
import { SearchIsland } from './SearchIsland'

/**
 * Both props are optional and neither is passed by the SSG.
 *
 * Passing the catalog as a prop would inline the same 16.6 KB blob into every
 * one of ~1,039 pages (17.3 MB in total). It ships ONCE instead, inside this
 * island's own chunk, as the build-time-frozen `NAV_CATALOG`
 * (see `ssg/genNavCatalog.ts`), and `currentPath` comes from
 * `location.pathname`.
 *
 * They stay accepted because passing them is still meaningful — tests supply
 * fixtures, and a caller that already knows the active path can skip the
 * `location` read. Nothing in the SSG does.
 */
type MobileNavIslandProps = {
  categories?: readonly NavDrawerCategory[]
  currentPath?: string
}

/** The wordmark's frame: one ink rule around both stamps. */
const BRAND_FRAME = {
  borderColor: color.ink,
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
  cursor: 'pointer',
  display: 'inline-flex',
  flexShrink: 0,
} satisfies CSSProperties

// 1.25rem sits above the stamp ladder's top rung (`full` = 0.875rem), so the
// wordmark keeps an explicit size over the rung, inline over its class.
const BRAND_STAMP = {
  fontSize: fontSize.xl,
  letterSpacing: '-0.025em',
  lineHeight: 'calc(1.75 / 1.25)',
  paddingBlock: space[2],
  paddingInline: space[4],
} satisfies CSSProperties

// No inset ring: the frame above draws the ink rule.
const BRAND_STAMP_INVERSE = { ...BRAND_STAMP, boxShadow: 'none' } satisfies CSSProperties

const SRD_BRAND = (
  <a href="/">
    <span style={BRAND_FRAME}>
      <Badge shape="stamp" size="full" style={BRAND_STAMP}>
        Salvage Union
      </Badge>
      <Badge shape="stamp" size="full" surface="inverse" style={BRAND_STAMP_INVERSE}>
        SRD
      </Badge>
    </span>
  </a>
)

/**
 * Hydrates the shared NavDrawer for the SRD top nav, wiring in the site's live
 * SearchIsland combobox, the schema-catalog tiles, and the secondary nav. The
 * drawer chrome lives in component-lib; this island supplies the SRD-specific
 * data + search behaviour.
 */
function MobileNavIslandBody({ categories, currentPath }: MobileNavIslandProps) {
  // NO reference-ORM access here, deliberately, and it took two wrong turns to
  // get here. Calling `buildCatalogSections()` at runtime needs game data: with
  // `useGameData()` (which defaults to `'all'`) the drawer waited on the whole
  // ~1.4 MB corpus, and narrowing it to the two schemas the catalog reads still
  // pulled `guides-*.js` + `catalog-categories-*.js` onto EVERY page — which
  // `e2e/bundle-budget.e2e.ts` forbids on leaf-schema pages, and which is the
  // 17.3 MB of HTML coming back as network requests.
  //
  // `NAV_CATALOG` is that same catalog computed at build time and frozen into
  // this island's chunk (~13 KB of source, one shared copy). Instant, no ORM,
  // no preload, nothing per-page. This is what DESIGN.md meant by "islands
  // import their own static data in their own chunk".
  const resolvedCategories = categories ?? NAV_CATALOG
  const path = currentPath ?? (typeof location === 'undefined' ? '/' : location.pathname)
  const isActive = (candidate: string) => path.startsWith(candidate)

  const navItems: NavDrawerItem[] = [
    { label: 'ABOUT', href: '/about/', active: isActive('/about') },
    { label: 'CHANGELOG', href: '/changelog/', active: isActive('/changelog') },
    { label: 'DISCORD', href: '/discord/', active: isActive('/discord') },
    { label: 'API', href: '/api/', active: isActive('/api') },
    {
      label: 'BUY THE GAME',
      href: 'https://leyline.press/collections/salvage-union',
      external: true,
    },
  ]

  return (
    <NavDrawer
      brand={SRD_BRAND}
      categories={[...resolvedCategories]}
      search={<SearchIsland />}
      navItems={navItems}
    />
  )
}

/**
 * Wrapped, like its siblings `SearchIsland` and the other mobile island. All
 * three mount together inside `TopNavigation`, so an unwrapped render error in
 * one takes the header with it — the blank-page failure `IslandErrorBoundary`
 * exists to contain. The boundary also reports through `captureException`, so a
 * crash here is visible in production.
 */
export function MobileNavIsland(props: Parameters<typeof MobileNavIslandBody>[0]) {
  return (
    <IslandErrorBoundary>
      <MobileNavIslandBody {...props} />
    </IslandErrorBoundary>
  )
}
