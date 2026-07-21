/**
 * SheetRailParts — the rail chip CTA and the rail's stat LINE.
 *
 * The rail's vitals and status derivations are pure functions and live in
 * `railStats.ts`. Each reading renders through the canonical `Stat`
 * (`orientation="horizontal" surface="plain"` — the running-text material,
 * ruleset §3.7); rail stats stay running text, never `VitalGauge`/`BayStatus`
 * pips (redesign gap G10).
 */

import { Fragment } from 'react'
import { Stat } from 'component-lib'

import { cn } from '../../lib/utils'
import { AppLink } from '../shared/AppLink'
import type { RailStat } from './railStats'

/**
 * The rail's vitals LINE: `SP 9/13 · EP 6/11 · Heat 4/12`.
 *
 * Every `label | value` reading is a `Stat`. What is left over is what a LINE
 * owns rather than a cell: the ` · ` join between readings, and any trailing
 * annotation ("Intact" in "Bays 4/5 Intact"), printed after the Stat so it
 * stays outside the bold reading. Both stay at the call site deliberately —
 * neither is a property of a stat, and `Stat` has no list anatomy to hang them
 * on. This is the only surface in either app that joins stats as prose; if a
 * second one appears, that is when the join earns a shared home.
 */
export function RailStatLine({ items }: { items: RailStat[] }) {
  return (
    <span>
      {items.map((item, index) => (
        <Fragment key={item.label}>
          {index > 0 && ' · '}
          <Stat
            orientation="horizontal"
            surface="plain"
            label={item.label}
            value={item.value}
            max={item.max}
          />
          {item.suffix ? ` ${item.suffix}` : null}
        </Fragment>
      ))}
    </span>
  )
}

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
