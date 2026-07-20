import type { ElementType } from 'react'
import { Badge } from '../chrome/Badge'
import { Search } from 'lucide-react'
import { AppBar } from './AppBar'
import type { AppBarNavItem } from './AppBar'
import { NavDrawer } from './NavDrawer'
import type { NavDrawerItem } from './NavDrawer'

/**
 * AppHeader — the ITUN builder's masthead (app-local config over the shared
 * `AppBar`): the "In the Union Now" brand, ITUN's nav (Encounter / About +
 * outbound Discord / SRD cross-links), a search-trigger button that opens the
 * global reference dialog, and the "Buy the game" button. Below `lg` the nav
 * collapses into the shared `NavDrawer`.
 *
 * Router-agnostic: internal links route through the injected `LinkComponent`
 * (ITUN passes its router-aware AppLink; defaults to a plain anchor).
 */

// SRD search-field treatment, matching the shared SearchField chrome exactly so
// the trigger button reads as the same search bar.
const SEARCH_BOX =
  'flex shrink-0 cursor-pointer items-center gap-2 rounded border border-ink bg-paper px-3 py-[7px] font-body text-caption text-ink-2 transition-colors hover:border-su-orange-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange lg:w-64'

// Small "Alpha" pills — the shared stamp atom rather than two hand-rolled
// spans that differed only in size (px-1/text-label vs px-1.5/text-badge).
// `bg-rust` overrides only the stamp PLATE — geometry, face and tracking still
// come from the atom, so these can't drift from every other stamp again.
const DESKTOP_ALPHA = (
  <Badge shape="stamp" size="mini" className="ml-1.5 rounded bg-rust px-1 py-0.5">
    Alpha
  </Badge>
)
const DRAWER_ALPHA = (
  <Badge shape="stamp" className="ml-2 rounded bg-rust px-1.5 py-0.5">
    Alpha
  </Badge>
)

const DESKTOP_NAV: AppBarNavItem[] = [
  { label: 'Encounter', href: '/encounter', badge: DESKTOP_ALPHA },
  { label: 'About', href: '/about' },
  { label: 'Changelog', href: '/changelog' },
  { label: 'Discord ↗', href: 'https://salvageunion.io/discord/', external: true },
  { label: 'SRD ↗', href: 'https://salvageunion.io', external: true },
]

/** ITUN's two-tone brand tag for the mobile drawer. */
const ITUN_DRAWER_BRAND = (
  <span className="inline-flex shrink-0 border border-ink font-cond text-sm font-bold uppercase leading-none tracking-caps-tight">
    <span className="bg-ink px-1.5 py-1 text-paper">In the Union</span>
    <span className="bg-paper px-1.5 py-1 text-ink">Now</span>
  </span>
)

const DRAWER_NAV: NavDrawerItem[] = [
  { label: 'Encounter', href: '/encounter', badge: DRAWER_ALPHA },
  { label: 'About', href: '/about' },
  { label: 'Changelog', href: '/changelog' },
  { label: 'Discord ↗', href: 'https://salvageunion.io/discord/', external: true },
  { label: 'SalvageUnion.io SRD ↗', href: 'https://salvageunion.io', external: true },
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
}

export function AppHeader({ onSearchClick, LinkComponent = 'a' }: AppHeaderProps) {
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
