/**
 * SheetHeader — top bar for the sheet view.
 *
 * Displays the entity name, a composition-mode badge, and a nav-back link
 * to the dashboard. Read-only.
 */

import { buttonVariants } from '../ui/buttonVariants'
import { cn } from '../../lib/utils'
import type { SheetAccent } from './sheetAccent'
import { SHEET_ACCENTS } from './sheetAccent'

export type CompositionMode = 'pilot-only' | 'mech-only' | 'crawler-only' | 'wired'

const MODE_LABELS: Record<CompositionMode, string> = {
  'pilot-only': 'Pilot',
  'mech-only': 'Mech',
  'crawler-only': 'Crawler',
  wired: 'Wired',
}

// Single-entity modes draw their badge fill from the same per-kind semantic
// accent map the rest of the sheet chrome uses, so the badge and band share one
// token source. `wired` is a distinct composite case with no single kind.
const MODE_COLORS: Record<CompositionMode, string> = {
  'pilot-only': `${SHEET_ACCENTS.pilot.bg} ${SHEET_ACCENTS.pilot.bgText}`,
  'mech-only': `${SHEET_ACCENTS.mech.bg} ${SHEET_ACCENTS.mech.bgText}`,
  'crawler-only': `${SHEET_ACCENTS.crawler.bg} ${SHEET_ACCENTS.crawler.bgText}`,
  wired: 'bg-su-green-dark text-su-white',
}

type SheetHeaderProps = {
  name: string
  mode: CompositionMode
  /**
   * Per-entity-kind accent (pilot/mech/crawler). When provided, the header
   * band's bottom border is tinted with the entity's semantic color so the
   * sheet reads as that kind. Purely visual; omit for a neutral border.
   */
  accent?: SheetAccent
}

export function SheetHeader({ name, mode, accent }: SheetHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-2 border-b-2 pb-4 mb-6 sm:flex-row sm:items-center sm:gap-4',
        accent ? accent.border : 'border-border'
      )}
    >
      <a
        href="/"
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'no-underline min-h-11 sm:min-h-9'
        )}
        aria-label="Back to dashboard"
      >
        &larr; Dashboard
      </a>

      <h1 className="flex-1 font-cond text-xl font-bold uppercase tracking-wide text-su-black sm:text-2xl sm:truncate">
        {name}
      </h1>

      <span
        aria-label={`Composition mode: ${MODE_LABELS[mode]}`}
        className={`self-start shrink-0 rounded border-2 border-su-black px-2 py-0.5 font-cond text-xs font-bold uppercase tracking-wide sm:self-auto ${MODE_COLORS[mode]}`}
      >
        {MODE_LABELS[mode]}
      </span>
    </header>
  )
}
