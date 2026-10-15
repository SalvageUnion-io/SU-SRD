import type { NavDrawerItem } from 'component-lib'
import { Badge, buttonVariants, NavDrawer } from 'component-lib'
import { readAccountHint } from 'component-lib/accountHint'
import { borderWidth, color, fontSize, space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { NAV_CATALOG } from '../../generated/navCatalog'
import { browserStorage, SIGN_IN_HREF } from '../../lib/accountBar'
import { IslandErrorBoundary } from './IslandErrorBoundary'
import { SearchIsland } from './SearchIsland'

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
 *
 * Zero props by design (ssg/DESIGN.md rule 7): a catalog prop would inline
 * ~16.6 KB into each of ~1,039 pages (17.3 MB), so the catalog ships once as
 * the build-time `NAV_CATALOG` and the path is read from `location.pathname`.
 */
function MobileNavIslandBody() {
  // NO reference-ORM access here: building the catalog at runtime would pull
  // `guides-*.js` + `catalog-categories-*.js` onto every page, which
  // `e2e/bundle-budget.e2e.ts` forbids. `NAV_CATALOG` is that catalog frozen
  // into this island's chunk at build time.
  const path = typeof location === 'undefined' ? '/' : location.pathname
  const isActive = (candidate: string) => path.startsWith(candidate)

  const navItems: NavDrawerItem[] = [
    { label: 'About', href: '/about/', active: isActive('/about') },
    { label: 'Changelog', href: '/changelog/', active: isActive('/changelog') },
    { label: 'Discord', href: '/discord/', active: isActive('/discord') },
    { label: 'API', href: '/api/', active: isActive('/api') },
    {
      label: 'Buy the game',
      href: 'https://leyline.press/collections/salvage-union',
      external: true,
    },
  ]

  // Signed out, Sign in tops the drawer, as in The Cantina's; signed in, the
  // avatar menu beside the hamburger is the account.
  const signedOut = readAccountHint(browserStorage()) === null

  return (
    <NavDrawer
      brand={SRD_BRAND}
      categories={[...NAV_CATALOG]}
      search={<SearchIsland />}
      navItems={navItems}
      extra={
        signedOut
          ? () => (
              <a
                href={SIGN_IN_HREF}
                className={buttonVariants({ variant: 'primary', size: 'compact' })}
              >
                Sign in with Discord
              </a>
            )
          : undefined
      }
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
export function MobileNavIsland() {
  return (
    <IslandErrorBoundary>
      <MobileNavIslandBody />
    </IslandErrorBoundary>
  )
}
