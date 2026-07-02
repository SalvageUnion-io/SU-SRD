/**
 * AppHeader — ITUN's brand chrome, mirroring the SRD site's signature header
 * (apps/suref-web/src/components/TopNavigation.astro): su-ink-dark ground,
 * 3px su-orange-dark bottom border, SU mark, font-cond wordmark with a
 * tracked eyebrow, and a right-side link out to the SRD site.
 *
 * Rendered from the root layout on every route EXCEPT the live-sheet and
 * snapshot surfaces (/sheet/*, /s/*) — those are edge-to-edge play surfaces
 * whose sticky bar is their own chrome (see routes/__root.tsx).
 */

import { Search } from 'lucide-react'

import { AppLink } from './AppLink'

// Shortcut hint mirrors the platform convention (⌘K on Apple, Ctrl K elsewhere).
const IS_APPLE = typeof navigator !== 'undefined' && /Mac|iP(hone|ad|od)/.test(navigator.platform)

type AppHeaderProps = {
  /** Opens the global reference search dialog (also bound to Cmd/Ctrl+K). */
  onSearchClick?: () => void
}

export function AppHeader({ onSearchClick }: AppHeaderProps) {
  return (
    <header className="flex items-center gap-3 border-b-entity border-su-orange-dark bg-su-ink-dark px-4 py-2.5 sm:px-8 sm:py-3">
      {/* Brand: SU mark + ITUN wordmark (with the Beta pill) + eyebrow */}
      <AppLink href="/" className="flex min-w-0 shrink-0 items-center gap-3 no-underline">
        <img
          src="/logos/su-cargo-dark.svg"
          alt="Salvage Union"
          width={44}
          height={44}
          className="block size-10 shrink-0 rounded-lg sm:size-11"
        />
        <span className="flex min-w-0 flex-col">
          <span className="font-cond text-xl font-bold leading-none tracking-[0.005em] text-su-paper sm:text-2xl">
            ITUN
            <span className="ml-1.5 inline-block rounded bg-rust px-1.5 py-0.5 align-[0.3em] font-cond text-label font-bold uppercase leading-none tracking-caps-wide text-su-paper">
              Beta
            </span>
          </span>
          <span className="mt-1.5 whitespace-nowrap font-cond text-xs font-semibold uppercase leading-none tracking-[0.22em] text-su-orange">
            In The Union Now
          </span>
        </span>
      </AppLink>

      {/* Right side: encounter tray + search trigger + outbound SRD link */}
      <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
        <AppLink
          href="/encounter"
          className="shrink-0 font-cond text-sm font-semibold uppercase tracking-caps-snug text-su-paper no-underline transition-colors hover:text-su-orange"
        >
          Encounter
        </AppLink>
        {onSearchClick && (
          <button
            type="button"
            onClick={onSearchClick}
            aria-label="Search the SRD"
            aria-keyshortcuts="Meta+K Control+K"
            className="flex cursor-pointer items-center gap-1.5 rounded-[3px] border border-su-paper/40 px-2.5 py-1.5 font-cond text-sm font-semibold uppercase tracking-caps-snug text-su-paper transition-colors hover:border-su-orange hover:text-su-orange"
          >
            <Search className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
            <kbd
              aria-hidden="true"
              className="hidden rounded-[3px] border border-su-paper/40 px-1 py-0.5 font-mono text-label leading-none sm:inline"
            >
              {IS_APPLE ? '⌘K' : 'Ctrl K'}
            </kbd>
          </button>
        )}
        <a
          href="https://salvageunion.io"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 font-cond text-sm font-semibold uppercase tracking-caps-snug text-su-paper no-underline transition-colors hover:text-su-orange"
        >
          <span className="hidden sm:inline">SalvageUnion.io&nbsp;</span>SRD&nbsp;&#8599;
        </a>
      </div>
    </header>
  )
}
