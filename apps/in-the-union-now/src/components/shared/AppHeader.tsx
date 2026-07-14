/**
 * AppHeader — ITUN's brand chrome. It fills the shared HeaderShell
 * (packages/suref-react/.../HeaderShell.tsx) — the same container + brand
 * lockup the SRD reference site uses — with ITUN's own right-side actions,
 * styled to match the SRD site so the two read as siblings: nav links in the
 * SRD `.nav-link` treatment, a search box mirroring the SRD's search field,
 * an outbound SRD cross-link to the left of search, and a "Buy the game"
 * button (the SRD's `.btn.btn-active`).
 *
 * Rendered from the root layout on every route EXCEPT the live-sheet and
 * snapshot surfaces (/sheet/*, /s/*) — those are edge-to-edge play surfaces
 * whose sticky bar is their own chrome (see routes/__root.tsx).
 */

import { Search } from 'lucide-react'
import { HeaderShell } from 'suref-react'

import { AppLink } from './AppLink'
import { AppHeaderMobileMenu } from './AppHeaderMobileMenu'

// SRD `.nav-link` treatment (apps/suref-web/src/styles/global.css), replicated
// as utilities so ITUN's links read identically to the reference site.
const NAV_LINK =
  'inline-flex shrink-0 items-center font-cond text-[15px] font-semibold uppercase tracking-caps-tight text-su-muted no-underline transition-colors hover:text-su-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange'

// SRD search-field treatment (SearchIsland's `.srd-search` box): bordered
// su-black, tight radius, su-white ground, font-mono. It's a trigger button
// here (opens the GlobalSearch modal) dressed to match the SRD's inline field.
const SEARCH_BOX =
  'flex shrink-0 cursor-pointer items-center gap-2 rounded border border-su-black bg-su-white px-3 py-[7px] font-mono text-[13px] text-su-grey-dark transition-colors hover:border-su-orange-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-su-orange lg:w-64'

// SRD `.btn.btn-active` + the buy-link modifiers from TopNavigation.astro.
const BUY_BUTTON =
  'inline-flex shrink-0 items-center rounded-md border border-su-orange-dark bg-su-orange-dark px-4 py-1.5 font-cond text-[13px] font-medium uppercase tracking-caps-snug text-su-white no-underline transition-colors'

// Small "Alpha" pill — same rust treatment as HeaderShell's "Beta" badge,
// sized down to sit inline beside the Encounter nav link.
const ALPHA_TAG =
  'ml-1.5 inline-block rounded bg-rust px-1 py-0.5 font-cond text-[10px] font-bold uppercase leading-none tracking-caps text-su-paper'

type AppHeaderProps = {
  /** Opens the global reference search dialog (also bound to Cmd/Ctrl+K). */
  onSearchClick?: () => void
}

export function AppHeader({ onSearchClick }: AppHeaderProps) {
  return (
    <HeaderShell
      homeHref="/"
      wordmark="IN THE UNION NOW"
      badge="Beta"
      eyebrow="A Salvage Union Character Manager"
      HomeLink={AppLink}
      brandShrink
    >
      {/* Right side: encounter link + outbound SRD cross-link (left of search) +
          search trigger + buy-the-game — mirroring the SRD header's right cluster.
          Below `lg` the nav links collapse into a hamburger drawer
          (AppHeaderMobileMenu) so the row never overflows on a phone; search
          stays inline as its own icon button. */}
      <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4 lg:gap-[26px]">
        <AppLink href="/encounter" className={`${NAV_LINK} hidden lg:inline-flex`}>
          Encounter
          <span className={ALPHA_TAG}>Alpha</span>
        </AppLink>
        <AppLink href="/about" className={`${NAV_LINK} hidden lg:inline-flex`}>
          About
        </AppLink>
        <AppLink href="/changelog" className={`${NAV_LINK} hidden lg:inline-flex`}>
          Changelog
        </AppLink>
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
          <AppHeaderMobileMenu />
        </div>
      </div>
    </HeaderShell>
  )
}
