/**
 * SheetHeader — top bar for the sheet view.
 *
 * Displays the entity name, a composition-mode badge, and a nav-back link
 * to the dashboard. Read-only.
 */

import { buttonVariants } from '../ui/buttonVariants'
import { cn } from '../../lib/utils'

export type CompositionMode = 'pilot-only' | 'mech-only' | 'crawler-only' | 'wired'

const MODE_LABELS: Record<CompositionMode, string> = {
  'pilot-only': 'Pilot',
  'mech-only': 'Mech',
  'crawler-only': 'Crawler',
  wired: 'Wired',
}

const MODE_COLORS: Record<CompositionMode, string> = {
  'pilot-only': 'bg-blue-600 text-white',
  'mech-only': 'bg-orange-600 text-white',
  'crawler-only': 'bg-purple-600 text-white',
  wired: 'bg-green-700 text-white',
}

type SheetHeaderProps = {
  name: string
  mode: CompositionMode
}

export function SheetHeader({ name, mode }: SheetHeaderProps) {
  return (
    <header className="flex flex-col gap-2 border-b border-border pb-4 mb-6 sm:flex-row sm:items-center sm:gap-4">
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

      <h1 className="flex-1 text-xl font-bold sm:text-2xl sm:truncate">{name}</h1>

      <span
        aria-label={`Composition mode: ${MODE_LABELS[mode]}`}
        className={`self-start shrink-0 rounded px-2 py-0.5 text-xs font-semibold sm:self-auto ${MODE_COLORS[mode]}`}
      >
        {MODE_LABELS[mode]}
      </span>
    </header>
  )
}
