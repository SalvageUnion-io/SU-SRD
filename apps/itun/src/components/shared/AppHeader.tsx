import type { NavDrawerItem } from 'component-lib'
import { AppBar, Badge, NavDrawer } from 'component-lib'
import type { ElementType, ReactNode } from 'react'
import { SRD_SITE_URL } from 'salvageunion-reference'

/**
 * AppHeader — ITUN's preset of the shared Union bar (`AppBar`, ruleset §3.11):
 * the compact 48px bar on the **Build** side of the switcher, with ITUN's nav
 * inline — Shelves · Games · Starter Set — then the search slot and the
 * app-supplied `actions` (the account menu) at the end. Below `lg` the nav
 * collapses into the shared `NavDrawer`, with `mobileSearch` and
 * `mobileActions` beside the hamburger and `drawerExtra` inside the drawer.
 *
 * About and Changelog are not destinations in the nav: they sit at the
 * drawer's foot (issue 1255), and in the account menu on a desktop.
 *
 * The switcher replaces the old "SRD ↗" link: the reference is the other tab
 * of the same bar, not an off-site destination.
 *
 * "Games" is the app's own control (`games`), a menu rather than a link — there
 * is no Games page; picking one sets what the Shelves hub shows — so it takes
 * its place in the nav as a slot.
 *
 * Search is a slot pair: `search` (the desktop "Search · ⌘K" trigger, in the
 * bar from `lg`) and `mobileSearch` (the phone's icon button, in the mobile
 * cluster before the account). Both are ITUN's `GlobalSearch`; there is no
 * floating search button.
 *
 * The slots stay content-agnostic, so this file knows nothing about accounts,
 * Convex or Games. ITUN fills them (`src/components/account/HeaderAccount.tsx`).
 *
 * There is no Encounter entry. GM opposition lives on the Mediator sheet's NPC
 * tray, backed by Convex (`api.mediator.*`), not at a top-level destination.
 *
 * Router-agnostic: internal links route through the injected `LinkComponent`
 * (ITUN passes its router-aware AppLink; defaults to a plain anchor), and
 * `pathname` marks the page you are on.
 */

const BUY_HREF = 'https://leyline.press/collections/salvage-union'

/** ITUN's two-tone brand tag for the mobile drawer. */
const ITUN_DRAWER_BRAND = (
  <span className="inline-flex shrink-0 border border-ink">
    <Badge shape="stamp" size="full" className="px-1.5">
      In the Union
    </Badge>
    {/* `ring-0`: the outer span draws the ink frame, so the inverse plate's own
        ring would double the seam. */}
    <Badge shape="stamp" size="full" surface="inverse" className="px-1.5 ring-0">
      Now
    </Badge>
  </span>
)

type AppHeaderProps = {
  /** Link component for internal routes. Defaults to a plain anchor; ITUN passes AppLink. */
  LinkComponent?: ElementType
  /** The current route, to mark "you are here" in the nav. */
  pathname?: string
  /** The nav's Games control (ITUN's Games menu), between Shelves and Starter Set. */
  games?: ReactNode
  /** Desktop search trigger, before the account control. */
  search?: ReactNode
  /** Phone search icon button, beside the hamburger below `lg`. */
  mobileSearch?: ReactNode
  /** Desktop controls at the bar's end — ITUN's account menu or sign-in. */
  actions?: ReactNode
  /** Mobile controls beside the hamburger, below `lg` — ITUN's avatar-only account menu. */
  mobileActions?: ReactNode
  /**
   * Controls at the top of the mobile drawer — ITUN's Games list and sign-in,
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
    { label: 'Shelves', href: '/', active: onShelves },
    { label: 'Starter Set', href: '/starter/', active: onStarterSet },
    { label: 'Discord', href: `${SRD_SITE_URL}/discord/`, external: true },
    { label: 'Buy the game', href: BUY_HREF, external: true },
  ]

  const drawerFoot: NavDrawerItem[] = [
    { label: 'About', href: '/about', active: pathname.startsWith('/about') },
    { label: 'Changelog', href: '/changelog', active: pathname.startsWith('/changelog') },
  ]

  return (
    <AppBar
      product="build"
      referenceHref={SRD_SITE_URL}
      buildHref="/"
      density="compact"
      LinkComponent={LinkComponent}
      navItems={[
        { label: 'Shelves', href: '/', active: onShelves },
        ...(games ? [{ id: 'games', node: games }] : []),
        { label: 'Starter Set', href: '/starter/', active: onStarterSet },
      ]}
      search={search}
      actions={actions}
      mobile={
        <>
          {mobileSearch}
          {mobileActions}
          <NavDrawer
            brand={ITUN_DRAWER_BRAND}
            navItems={drawerNav}
            footItems={drawerFoot}
            extra={drawerExtra}
            LinkComponent={LinkComponent}
            triggerClassName="p-1.5"
            panelClassName="w-72"
          />
        </>
      }
    />
  )
}
