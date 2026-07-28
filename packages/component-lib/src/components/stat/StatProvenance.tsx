import { useState } from 'react'
import { Popover } from '@base-ui/react/popover'

import { cn } from '../../utils/cn'

/**
 * One line of a derived value's provenance.
 *
 * `kind` drives the treatment, not the arithmetic — the caller has already done
 * the maths and hands us a ledger to render:
 *
 *   `base`         the rules baseline (chassis stat, tech-level SP, a constant)
 *   `contribution` a rules-sourced addend (installed statBonus, type bonus,
 *                  an injury penalty — negative amounts are contributions too)
 *   `adjustment`   the player's hand-entered manual adjustment
 *   `derived`      the subtotal of everything above
 *   `override`     an absolute Free-Edit pin, which REPLACES the subtotal
 */
export type ProvenanceLineKind = 'base' | 'contribution' | 'adjustment' | 'derived' | 'override'

export type ProvenanceLine = {
  kind: ProvenanceLineKind
  /** What produced this line, e.g. 'Atlas chassis', 'Heat Sink ×2', 'Beefcake'. */
  label: string
  /** Optional qualifier, e.g. 'base', '×2 installed', 'pilot ability, TL 4'. */
  detail?: string
  /** Signed amount. Rendered with an explicit sign for addends. */
  amount: number
}

export type StatProvenanceProps = {
  /** Stat name, e.g. 'Max SP' — announced as the panel's title. */
  statLabel: string
  /** The ledger, in display order. */
  lines: ProvenanceLine[]
  /** What the surface actually shows (the pin when pinned, else the subtotal). */
  total: number
  /** True when an override pin is in effect. */
  overridden?: boolean
  /** The trigger — usually the max numeral. */
  children: React.ReactNode
  className?: string
}

function signed(n: number): string {
  return n < 0 ? `−${Math.abs(n)}` : `+${n}`
}

/**
 * StatProvenance — "how did this number get here?" for any derived value
 * (ADR-029).
 *
 * Opens on **click/tap, keyboard, and hover**. Hover alone is deliberately not
 * enough: a hover-only affordance is unreachable by keyboard and on touch, and
 * the max numeral is exactly the kind of small target a touch user needs this
 * for. Base UI's Popover supplies the accessible core (a real button trigger,
 * Escape to close, focus management, `aria-expanded`/`aria-controls`); the
 * hover open is layered on with controlled state, since Popover has no
 * `openOnHover` in this version.
 *
 * Purely presentational — the caller does the arithmetic and hands over a
 * ledger. An override is rendered as the FINAL line on top of the full
 * derivation rather than replacing it, so the revert target stays visible and
 * explained (ADR-022 amendment).
 */
export function StatProvenance({
  statLabel,
  lines,
  total,
  overridden = false,
  children,
  className,
}: StatProvenanceProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className={cn(
          'cursor-help border-b border-dotted border-current/40 focus-visible:outline-none',
          'focus-visible:ring-[3px] focus-visible:ring-rust/25',
          className
        )}
        aria-label={`${statLabel}: how this is derived`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" sideOffset={6}>
          <Popover.Popup
            className={cn(
              'z-50 min-w-[15rem] max-w-[22rem] rounded-md bg-ink px-3 py-2.5 text-paper shadow-md',
              'animate-in fade-in-0 zoom-in-95'
            )}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <Popover.Title
              className={cn('mb-1.5 font-cond text-label-lg uppercase tracking-caps opacity-60')}
            >
              {statLabel} · how this is derived
            </Popover.Title>
            <ul className="m-0 list-none p-0 text-caption tabular-nums">
              {lines.map((line, i) => (
                <li
                  key={`${line.kind}-${line.label}-${i}`}
                  className={cn(
                    'flex items-baseline justify-between gap-4 py-[2px]',
                    line.kind === 'derived' && 'mt-1.5 border-t border-paper/25 pt-1.5',
                    line.kind === 'override' && 'font-semibold text-caution'
                  )}
                >
                  <span>
                    {line.label}
                    {line.detail ? (
                      <span className="ml-1 text-note opacity-60">{line.detail}</span>
                    ) : null}
                  </span>
                  <span className={cn('font-semibold', line.amount < 0 && 'text-status-bad')}>
                    {line.kind === 'base' || line.kind === 'derived' || line.kind === 'override'
                      ? line.amount
                      : signed(line.amount)}
                  </span>
                </li>
              ))}
              <li className="mt-1.5 flex items-baseline justify-between gap-4 border-t border-paper/25 pt-1.5 font-semibold">
                <span>Showing</span>
                <span>
                  {total}
                  {overridden ? ' *' : ''}
                </span>
              </li>
            </ul>
            <Popover.Arrow className="fill-ink" />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
