/**
 * AppHeader — ITUN's brand chrome (lifted from ITUN, pending review). It fills
 * the shared `HeaderShell` — the same container + brand lockup the SRD
 * reference site uses — with ITUN's own right-side actions, styled to match the
 * SRD site so the two read as siblings: nav links in the SRD `.nav-link`
 * treatment, a search box mirroring the SRD's search field, an outbound SRD
 * cross-link to the left of search, and a "Buy the game" button.
 *
 * Router-agnostic: internal nav links (brand/home, Encounter, About) render
 * through the injected `LinkComponent` (ITUN passes its router-aware AppLink;
 * defaults to a plain anchor), keeping the shared library free of a router
 * dependency.
 */

import type { ElementType } from 'react'
import { Search } from 'lucide-react'

import { HeaderShell } from './HeaderShell'
import { NavDrawer, type NavDrawerItem } from './NavDrawer'

/** ITUN's two-tone brand tag for the mobile drawer. */
const ITUN_DRAWER_BRAND = (
  <span className="inline-flex shrink-0 border border-ink font-cond text-sm font-bold uppercase leading-none tracking-tight">
    <span className="bg-ink px-1.5 py-1 text-paper">In the Union</span>
    <span className="bg-paper px-1.5 py-1 text-ink">Now</span>
  </span>
)

const ALPHA_BADGE = (
  <span className="ml-2 inline-block rounded bg-rust px-1.5 py-0.5 font-cond text-[11px] font-bold uppercase leading-none tracking-caps text-paper">
    Alpha
  </span>
)

const ITUN_NAV_ITEMS: NavDrawerItem[] = [
  { label: 'Encounter', href: '/encounter', badge: ALPHA_BADGE },
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

// SRD `.nav-link` treatment (apps/suref-web/src/styles/global.css), replicated
// as utilities so ITUN's links read identically to the reference site.
const NAV_LINK =
  'inline-flex shrink-0 items-center font-cond text-[15px] font-semibold uppercase tracking-caps-tight text-su-muted no-underline transition-colors hover:text-su-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange'

// SRD search-field treatment (SearchIsland's `.srd-search` box): bordered
// su-black, tight radius, paper ground, font-mono. It's a trigger button
// here (opens the GlobalSearch modal) dressed to match the SRD's inline field.
const SEARCH_BOX =
  'flex shrink-0 cursor-pointer items-center gap-2 rounded border border-su-black bg-paper px-3 py-[7px] font-mono text-[13px] text-su-grey-dark transition-colors hover:border-su-orange-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange lg:w-64'

// SRD `.btn.btn-active` + the buy-link modifiers from TopNavigation.astro.
const BUY_BUTTON =
  'inline-flex shrink-0 items-center rounded-md border border-su-orange-dark bg-su-orange-dark px-4 py-1.5 font-cond text-[13px] font-medium uppercase tracking-caps-snug text-paper no-underline transition-colors'

// Small "Alpha" pill — same rust treatment as HeaderShell's "Beta" badge,
// sized down to sit inline beside the Encounter nav link.
const ALPHA_TAG =
  'ml-1.5 inline-block rounded bg-rust px-1 py-0.5 font-cond text-[10px] font-bold uppercase leading-none tracking-caps text-su-paper'

type AppHeaderProps = {
  /** Opens the global reference search dialog (also bound to Cmd/Ctrl+K). */
  onSearchClick?: () => void
  /** Link component for internal routes. Defaults to a plain anchor; ITUN passes AppLink. */
  LinkComponent?: ElementType
}

export function AppHeader({ onSearchClick, LinkComponent = 'a' }: AppHeaderProps) {
  return (
    <HeaderShell
      homeHref="/"
      wordmark="IN THE UNION NOW"
      badge="Beta"
      eyebrow="A Salvage Union Character Manager"
      HomeLink={LinkComponent}
      brandShrink
    >
      {/* Right side: encounter link + outbound SRD cross-link (left of search) +
          search trigger + buy-the-game — mirroring the SRD header's right cluster.
          Below `lg` the nav links collapse into a hamburger drawer
          (AppHeaderMobileMenu) so the row never overflows on a phone; search
          stays inline as its own icon button. */}
      <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4 lg:gap-[26px]">
        <LinkComponent href="/encounter" className={`${NAV_LINK} hidden lg:inline-flex`}>
          Encounter
          <span className={ALPHA_TAG}>Alpha</span>
        </LinkComponent>
        <LinkComponent href="/about" className={`${NAV_LINK} hidden lg:inline-flex`}>
          About
        </LinkComponent>
        <LinkComponent href="/changelog" className={`${NAV_LINK} hidden lg:inline-flex`}>
          Changelog
        </LinkComponent>
        <a
          href="https://salvageunion.io/discord/"
          target="_blank"
          rel="noopener noreferrer"
          className={`${NAV_LINK} hidden lg:inline-flex`}
        >
          Discord&nbsp;&#8599;
        </a>
        <a
          href="https://salvageunion.io"
          target="_blank"
          rel="noopener noreferrer"
          className={`${NAV_LINK} hidden lg:inline-flex`}
        >
          SRD&nbsp;&#8599;
        </a>
        {onSearchClick && (
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
        )}
        <a
          href="https://leyline.press/collections/salvage-union"
          target="_blank"
          rel="noopener noreferrer"
          className={`${BUY_BUTTON} hidden lg:inline-flex`}
        >
          Buy the game
        </a>
        <div className="lg:hidden">
          <NavDrawer
            brand={ITUN_DRAWER_BRAND}
            navItems={ITUN_NAV_ITEMS}
            LinkComponent={LinkComponent}
            triggerClassName="p-1.5"
            panelClassName="w-72"
          />
        </div>
      </div>
    </HeaderShell>
  )
}
