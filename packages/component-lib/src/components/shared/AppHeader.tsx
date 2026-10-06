import { Search } from 'lucide-react'
import type { ElementType, ReactNode } from 'react'
import { SRD_SITE_URL } from 'salvageunion-reference'
import { Badge } from '../chrome/Badge'
import { FOCUS_RING } from '../chrome/interaction'
import type { AppBarNavItem } from './AppBar'
import { AppBar } from './AppBar'
import type { NavDrawerItem } from './NavDrawer'
import { NavDrawer } from './NavDrawer'

/**
 * AppHeader — the ITUN builder's masthead (app-local config over the shared
 * `AppBar`): the "In the Union Now" brand, ITUN's nav (About / Changelog +
 * outbound Discord / SRD cross-links), a search-trigger button that opens the
 * global reference dialog, the "Buy the game" button, and app-supplied
 * `actions` after it (ITUN's Games and account menus). Below `lg` the nav
 * collapses into the shared `NavDrawer`, with `mobileActions` beside the
 * hamburger and `drawerExtra` inside the drawer.
 *
 * One row, with no sub-header: the account cluster that used to sit on a
 * second row beneath the nav is now those menus.
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

// SRD search-field treatment, matching the shared SearchField chrome exactly so
// the trigger button reads as the same search bar.
const SEARCH_BOX = `flex shrink-0 cursor-pointer items-center gap-2 rounded border border-ink bg-paper px-3 py-[7px] font-body text-caption text-wk-muted transition-colors hover:border-rust ${FOCUS_RING} lg:w-64`

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
  /** Opens the global reference search dialog (also bound to Cmd/Ctrl+K). */
  onSearchClick?: () => void
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
  onSearchClick,
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
      search={
        onSearchClick && (
          <button
            type="button"
            onClick={onSearchClick}
            aria-label="Search the SRD"
            aria-keyshortcuts="Meta+K Control+K"
            className={SEARCH_BOX}
          >
            <Search className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
            <span className="hidden sm:inline">Search…</span>
          </button>
        )
      }
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
