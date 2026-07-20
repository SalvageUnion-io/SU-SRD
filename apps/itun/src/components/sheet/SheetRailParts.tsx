/**
 * SheetRailParts — the rail chip CTA.
 *
 * The rail's vitals and status derivations are pure functions and live in
 * `railStats.ts`; the inline "SP 9/13 · EP 6/11" rendering itself is the shared
 * `StatLine` atom. Rail stats are running text, never `VitalGauge`/`StatBlock`
 * pips (redesign gap G10).
 */

import { cn } from '../../lib/utils'
import { AppLink } from '../shared/AppLink'

/** Anchor CTA for rail empty slots ('+ Create'). */
export function RailCta({
  href,
  label,
  primary,
}: {
  href: string
  label: string
  primary?: boolean
}) {
  return (
    <AppLink
      href={href}
      className={cn(
        'rounded-[3px] border-chrome px-2.5 py-1.5 text-center font-body text-xs font-medium no-underline transition-colors duration-[120ms]',
        primary
          ? 'border-rust bg-rust text-paper hover:bg-rust-hi'
          : 'border-ink bg-paper text-ink hover:bg-wk-bg-2'
      )}
    >
      {label}
    </AppLink>
  )
}
