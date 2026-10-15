import type { NavDrawerItem } from 'component-lib'
import { AppBar, Badge, NavDrawer } from 'component-lib'
import { borderWidth, color } from 'component-lib/design/tokens'
import { PRODUCT } from 'component-lib/product'
import type { CSSProperties, ElementType, ReactNode } from 'react'
import { MARK_SRC } from '../../lib/appUrl'
import { DOC_PAGES } from '../../lib/docPages'
import { SRD_ORIGIN } from '../../lib/srdOrigin'

/**
 * AppHeader — the Cantina's preset of the shared Union bar (`AppBar`, ruleset §3.11):
 * the one Union bar, on the **Build** side of the switcher, with the Cantina's nav
 * inline — Shelves · Games · Starter Set — then the search slot, "Buy the
 * game" (from 80rem, where the row has room for it beside the nav) and the
 * app-supplied `actions` (the account menu) at the end: the SRD's bar, plus
 * the account. Below `lg` the nav
 * collapses into the shared `NavDrawer`, with `mobileSearch` and
 * `mobileActions` beside the hamburger and `drawerExtra` inside the drawer.
 *
 * About and Changelog are not destinations in the nav: they sit at the
 * drawer's foot, in the account menu on a signed-in desktop, and
 * in the page foot on every page (`SiteFooter`). The bar never carries them,
 * signed in or out (board 09's bar has neither).
 *
 * The switcher replaces the old "SRD ↗" link: the reference is the other tab
 * of the same bar, not an off-site destination. The drawer's Discord entry is
 * the SRD's `/discord` page, so it opens in this tab too; only "Buy the game"
 * leaves the site, in a new one.
 *
 * "Games" is the app's own control (`games`), a menu rather than a link — there
 * is no Games page; picking one sets what the Shelves hub shows — so it takes
 * its place in the nav as a slot.
 *
 * Search is a slot pair: `search` (the desktop search field, in the
 * bar from `lg`) and `mobileSearch` (the phone's icon button, in the mobile
 * cluster before the account). Both are the Cantina's `GlobalSearch`; there is no
 * floating search button.
 *
 * The slots stay content-agnostic, so this file knows nothing about accounts,
 * Convex or Games. The Cantina fills them (`src/components/account/HeaderAccount.tsx`).
 *
 * There is no Encounter entry. GM opposition lives on the Mediator sheet's NPC
 * tray, backed by Convex (`api.mediator.*`), not at a top-level destination.
 *
 * Router-agnostic: internal links route through the injected `LinkComponent`
 * (The Cantina passes its router-aware AppLink; defaults to a plain anchor), and
 * `pathname` marks the page you are on.
 */

const BUY_HREF = 'https://leyline.press/collections/salvage-union'

const BRAND_FRAME = {
  borderColor: color.ink,
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
  display: 'inline-flex',
  flexShrink: 0,
} satisfies CSSProperties

// Narrower than the full rung's 8px inline padding.
const BRAND_PLATE = { paddingInline: '6px' } satisfies CSSProperties

// No inset ring: the outer span draws the ink frame, so the inverse plate's
// own ring would double the seam.
const BRAND_PLATE_INVERSE = { ...BRAND_PLATE, boxShadow: 'none' } satisfies CSSProperties

/** The product name in two plates: all but its last word, then the last word inverse. */
const BRAND_SPLIT = PRODUCT.name.lastIndexOf(' ')

/** The Cantina's two-tone brand tag for the mobile drawer. */
const CANTINA_DRAWER_BRAND = (
  <span style={BRAND_FRAME}>
    <Badge shape="stamp" size="full" style={BRAND_PLATE}>
      {PRODUCT.name.slice(0, BRAND_SPLIT)}
    </Badge>
    <Badge shape="stamp" size="full" surface="inverse" style={BRAND_PLATE_INVERSE}>
      {PRODUCT.name.slice(BRAND_SPLIT + 1)}
    </Badge>
  </span>
)

type AppHeaderProps = {
  /** Link component for internal routes. Defaults to a plain anchor; the Cantina passes AppLink. */
  LinkComponent?: ElementType
  /** The current route, to mark "you are here" in the nav. */
  pathname?: string
  /** The nav's Games control (The Cantina's Games menu), between Shelves and Starter Set. */
  games?: ReactNode
  /** Desktop search trigger, before the account control. */
  search?: ReactNode
  /** Phone search icon button, beside the hamburger below `lg`. */
  mobileSearch?: ReactNode
  /** Desktop controls at the bar's end — the Cantina's account menu or sign-in. */
  actions?: ReactNode
  /** Mobile controls beside the hamburger, below `lg` — the Cantina's avatar-only account menu. */
  mobileActions?: ReactNode
  /**
   * Controls at the top of the mobile drawer — the Cantina's Games list and sign-in,
   * which do not fit the mobile header row. Handed `close` to dismiss the drawer.
   */
  drawerExtra?: (close: () => void) => ReactNode
}

export function AppHeader({
  LinkComponent = 'a',
  pathname = '',
  games,
  search,
  mobileSearch,
  actions,
  mobileActions,
  drawerExtra,
}: AppHeaderProps) {
  const onShelves = pathname === '/'
  const onStarterSet = pathname.startsWith('/starter')

  const drawerNav: NavDrawerItem[] = [
    { label: 'Hangar', href: '/', active: onShelves },
    { label: 'Starter Set', href: '/starter/', active: onStarterSet },
    DOC_PAGES.discord,
    { label: 'Buy the game', href: BUY_HREF, external: true },
  ]

  // The shared doc pages, on the SRD (`docPages.ts`).
  const aboutLinks: NavDrawerItem[] = [DOC_PAGES.about, DOC_PAGES.changelog, DOC_PAGES.api]

  return (
    <AppBar
      product="build"
      referenceHref={SRD_ORIGIN}
      buildHref="/"
      LinkComponent={LinkComponent}
      markSrc={MARK_SRC}
      navItems={[
        { label: 'Hangar', href: '/', active: onShelves },
        ...(games ? [{ id: 'games', node: games }] : []),
        { label: 'Starter Set', href: '/starter/', active: onStarterSet },
      ]}
      search={search}
      buyHref={BUY_HREF}
      actions={actions}
      mobile={
        <>
          {mobileSearch}
          {mobileActions}
          <NavDrawer
            brand={CANTINA_DRAWER_BRAND}
            navItems={drawerNav}
            footItems={aboutLinks}
            extra={drawerExtra}
            LinkComponent={LinkComponent}
            // NavDrawer takes classes, not styles, here: its own padding and
            // width are stylesheet rules these override (`styles/screens.css`).
            triggerClassName="su-app-header__drawer-trigger"
            panelClassName="su-app-header__drawer-panel"
          />
        </>
      }
    />
  )
}
