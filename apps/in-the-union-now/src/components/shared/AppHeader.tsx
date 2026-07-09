/**
 * AppHeader — ITUN's brand chrome. It fills the shared HeaderShell
 * (packages/suref-react/.../HeaderShell.tsx) — the same container + brand
 * lockup the SRD reference site uses — with ITUN's own right-side actions:
 * the encounter tray, the SRD search trigger, and an outbound link to the SRD.
 *
 * Rendered from the root layout on every route EXCEPT the live-sheet and
 * snapshot surfaces (/sheet/*, /s/*) — those are edge-to-edge play surfaces
 * whose sticky bar is their own chrome (see routes/__root.tsx).
 */

import { Search } from 'lucide-react'
import { HeaderShell } from 'suref-react'

import { AppLink } from './AppLink'

// Shortcut hint mirrors the platform convention (⌘K on Apple, Ctrl K elsewhere).
// Prefer the modern UA-Client-Hints platform; navigator.platform is the
// fallback for browsers without it (Safari/Firefox). Cosmetic-only either way.
const IS_APPLE =
  typeof navigator !== 'undefined' &&
  /Mac|iP(hone|ad|od)/.test(
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ??
      navigator.platform
  )

type AppHeaderProps = {
  /** Opens the global reference search dialog (also bound to Cmd/Ctrl+K). */
  onSearchClick?: () => void
}

export function AppHeader({ onSearchClick }: AppHeaderProps) {
  return (
    <HeaderShell
      homeHref="/"
      wordmark="ITUN"
      badge="Beta"
      eyebrow="In The Union Now"
      HomeLink={AppLink}
    >
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
          SRD&nbsp;&#8599;
        </a>
      </div>
    </HeaderShell>
  )
}
