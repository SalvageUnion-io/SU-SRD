import type { AppBarNavItem, NavDrawerItem } from 'component-lib'
import { AppBar, Badge, NavDrawer } from 'component-lib'
import type { ElementType, ReactNode } from 'react'
import { SRD_SITE_URL } from 'salvageunion-reference'

/**
 * AppHeader — the ITUN builder's masthead (app-local config over the shared
 * `AppBar`): the "In the Union Now" brand, ITUN's nav (About / Changelog +
 * outbound Discord / SRD cross-links), the "Buy the game" button, and
 * app-supplied `actions` after it (ITUN's Games and account menus). Below `lg` the nav
 * collapses into the shared `NavDrawer`, with `mobileActions` beside the
 * hamburger and `drawerExtra` inside the drawer.
 *
 * One row, with no sub-header: the account cluster that used to sit on a
 * second row beneath the nav is now those menus.
 *
 * No search, either. ITUN's reference search is a floating button in the
 * bottom-right corner (`Fab`, wired in ITUN's `GlobalSearch.tsx`), so this
 * preset fills nothing into `AppBar`'s `search` slot. That slot stays on
 * `AppBar`, where the SRD site's `SiteHeader` mounts its top-of-page search.
 *
 * The three slots stay content-agnostic, so this file knows nothing about
 * accounts, Convex or Games. ITUN fills them (`src/components/account/
 * HeaderAccount.tsx`).
 *
 * There is no Encounter entry. A standalone `/encounter` tray existed, was
 * dropped from the nav on the understanding that the Mediator sheet would
 * absorb it, and then sat unreachable — no link anywhere in the app — until it
 * was deleted. GM opposition now lives on the Mediator sheet's NPC tray, backed
 * by Convex (`api.mediator.*`), not at a top-level destination.
 *
 * Router-agnostic: internal links route through the injected `LinkComponent`
 * (ITUN passes its router-aware AppLink; defaults to a plain anchor).
 */

const DESKTOP_NAV: AppBarNavItem[] = [
  { label: 'About', href: '/about' },
  { label: 'Changelog', href: '/changelog' },
  { label: 'Discord ↗', href: `${SRD_SITE_URL}/discord/`, external: true },
  { label: 'SRD ↗', href: SRD_SITE_URL, external: true },
]

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

const DRAWER_NAV: NavDrawerItem[] = [
  { label: 'About', href: '/about' },
  { label: 'Changelog', href: '/changelog' },
  { label: 'Discord ↗', href: `${SRD_SITE_URL}/discord/`, external: true },
  { label: 'SalvageUnion.io SRD ↗', href: SRD_SITE_URL, external: true },
  {
    label: 'Buy the game',
    href: 'https://leyline.press/collections/salvage-union',
    external: true,
  },
]

type AppHeaderProps = {
  /** Link component for internal routes. Defaults to a plain anchor; ITUN passes AppLink. */
  LinkComponent?: ElementType
  /** Desktop controls after "Buy the game" — ITUN's Games and account menus. */
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
  actions,
  mobileActions,
  drawerExtra,
}: AppHeaderProps) {
  return (
    <AppBar
      wordmark="IN THE UNION NOW"
      badge="Beta"
      eyebrow="A Salvage Union Character Manager"
      brandShrink
      LinkComponent={LinkComponent}
      navItems={DESKTOP_NAV}
      buyHref="https://leyline.press/collections/salvage-union"
      buyLabel="Buy the game"
      actions={actions}
      mobile={
        <>
          {mobileActions}
          <NavDrawer
            brand={ITUN_DRAWER_BRAND}
            navItems={DRAWER_NAV}
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
