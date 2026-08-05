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
 * global reference dialog, the "Buy the game" button, and an optional
 * app-supplied utility row (ITUN's account cluster) on a second row beneath.
 * Below `lg` the nav collapses into the shared `NavDrawer`.
 *
 * The Encounter tray is deliberately absent from the nav: it is reached through
 * the Mediator sheet now, not as a top-level destination.
 *
 * Router-agnostic: internal links route through the injected `LinkComponent`
 * (ITUN passes its router-aware AppLink; defaults to a plain anchor).
 */

// SRD search-field treatment, matching the shared SearchField chrome exactly so
// the trigger button reads as the same search bar.
const SEARCH_BOX = `flex shrink-0 cursor-pointer items-center gap-2 rounded border border-ink bg-paper px-3 py-[7px] font-body text-caption text-ink-2 transition-colors hover:border-rust ${FOCUS_RING} lg:w-64`

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
  /**
   * App-owned controls rendered on a second row under the nav — ITUN passes its
   * account cluster (Games / Account / sign in-out), which used to sit in a
   * separate strip above the masthead.
   */
  utilityRow?: ReactNode
}

export function AppHeader({ onSearchClick, LinkComponent = 'a', utilityRow }: AppHeaderProps) {
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
      utilityRow={utilityRow}
      mobile={
        <NavDrawer
          brand={ITUN_DRAWER_BRAND}
          navItems={DRAWER_NAV}
          LinkComponent={LinkComponent}
          triggerClassName="p-1.5"
          panelClassName="w-72"
        />
      }
    />
  )
}
