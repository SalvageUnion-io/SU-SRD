import type { NavDrawerItem } from 'component-lib'
import { Badge, buildCatalogSections, NavDrawer } from 'component-lib'
import { ITUN_URL } from '../../lib/constants'
import { useGameData } from '../../lib/useGameData'
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
 * Both props are optional and both are **deliberately not passed** by the SSG.
 *
 * Serialized island props on the Astro baseline totalled 18.7 MB across 1,039
 * pages, of which this island alone was 17.3 MB — the same 16.6 KB catalog blob
 * inlined into every single page. `buildCatalogSections()` is a pure function
 * and `currentPath` is `location.pathname`, so the island computes both inside
 * its own chunk: one copy, shared by every page.
 *
 * They remain accepted so the (still-live) Astro `TopNavigation.astro` path and
 * the existing tests keep passing build-time values.
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
  // Only needed when the catalog was not supplied; the hook is unconditional
  // (rules of hooks) but `buildCatalogSections()` is only called once ready.
  //
  // The schema list is NARROW on purpose. This defaulted to `useGameData()`,
  // i.e. `'all'`, which made the nav drawer — pure chrome — wait on the entire
  // ~1.4 MB reference corpus before it could render a single category. Astro
  // passed `categories` in as a build-time prop, so it rendered instantly;
  // designing that prop out (the 17.3 MB win) must not buy the bytes back as
  // latency.
  //
  // `buildCatalogSections()` reads `getSchemaCatalog()` (static metadata, no
  // load), `CatalogCategories.all()`, and calls `findAllIn` for exactly ONE
  // schema — `guides`. That was measured by instrumenting `findAllIn`, not
  // inferred. If the catalog ever queries another schema, add it here; the
  // symptom of getting it wrong is an empty drawer, so keep it in step.
  const { ready } = useGameData({ schemas: ['catalog-categories', 'guides'] })
  const resolvedCategories =
    categories ?? (ready ? (buildCatalogSections() as SchemaCategory[]) : [])
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
