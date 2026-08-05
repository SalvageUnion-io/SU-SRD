import type { NavDrawerItem } from 'component-lib'
import { Badge, NavDrawer } from 'component-lib'
import { NAV_CATALOG } from '../../generated/navCatalog'
import { ITUN_URL } from '../../lib/constants'
import { IslandErrorBoundary } from './IslandErrorBoundary'
import { SearchIsland } from './SearchIsland'

type SchemaLink = {
  id: string
  displayName: string
  catalogBg: string
  catalogLabel?: string
  href?: string
}

type SchemaCategory = {
  label: string
  schemas: SchemaLink[]
}

/**
 * Both props are optional and neither is passed by the SSG.
 *
 * Serialized island props on the Astro baseline totalled 18.7 MB across 1,039
 * pages, of which this island alone was 17.3 MB — the same 16.6 KB catalog blob
 * inlined into every single page. The catalog now ships ONCE, inside this
 * island's own chunk, as the build-time-frozen `NAV_CATALOG`
 * (see `ssg/genNavCatalog.ts`), and `currentPath` comes from
 * `location.pathname`.
 *
 * They stay accepted because passing them is still meaningful — tests supply
 * fixtures, and a caller that already knows the active path can skip the
 * `location` read. Nothing in the SSG does.
 */
type MobileNavIslandProps = {
  categories?: SchemaCategory[]
  currentPath?: string
}

const SRD_BRAND = (
  <a href="/">
    <span className="inline-flex shrink-0 cursor-pointer border border-ink">
      {/* `text-xl` sits above the stamp ladder's top rung (`full` = `text-sm`),
          so the wordmark keeps an explicit font-size override. */}
      <Badge shape="stamp" size="full" className="px-1 py-0.5 text-xl tracking-tight">
        Salvage Union
      </Badge>
      {/* `ring-0`: the outer span draws the ink frame. */}
      <Badge
        shape="stamp"
        size="full"
        surface="inverse"
        className="px-1 py-0.5 text-xl tracking-tight ring-0"
      >
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
  const resolvedCategories = categories ?? (NAV_CATALOG as unknown as SchemaCategory[])
  const path = currentPath ?? (typeof location === 'undefined' ? '/' : location.pathname)
  const isActive = (candidate: string) => path.startsWith(candidate)

  const navItems: NavDrawerItem[] = [
    { label: 'ABOUT', href: '/about/', active: isActive('/about') },
    { label: 'CHANGELOG', href: '/changelog/', active: isActive('/changelog') },
    { label: 'DISCORD', href: '/discord/', active: isActive('/discord') },
    { label: 'BUILDER ↗', href: ITUN_URL, external: true },
    {
      label: 'BUY THE GAME',
      href: 'https://leyline.press/collections/salvage-union',
      external: true,
    },
  ]

  return (
    <NavDrawer
      brand={SRD_BRAND}
      categories={resolvedCategories}
      search={<SearchIsland />}
      navItems={navItems}
    />
  )
}

/**
 * Wrapped, like its sibling `SearchIsland`. All three of these hydrate together
 * inside `TopNavigation.astro`, and only the first was protected — so a render
 * error in the mobile search or the mobile nav took the header with it, which
 * is exactly the blank-page failure `IslandErrorBoundary` exists to contain.
 * The boundary also reports through `captureException`, so a crash here is now
 * visible in production rather than only to the person it happened to.
 */
export function MobileNavIsland(props: Parameters<typeof MobileNavIslandBody>[0]) {
  return (
    <IslandErrorBoundary>
      <MobileNavIslandBody {...props} />
    </IslandErrorBoundary>
  )
}
