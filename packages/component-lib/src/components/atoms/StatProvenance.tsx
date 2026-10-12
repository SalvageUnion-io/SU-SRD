import { Popover } from '@base-ui/react/popover'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { color, fontSize, space, weight } from '../../design/tokens'
import { capsLabel } from './capsLabel'
import { FOCUS_RING } from './interaction'

/**
 * One line of a derived value's provenance.
 *
 * `kind` drives the treatment, not the arithmetic — the caller has already done
 * the maths and hands us a ledger to render:
 *
 *   `base`         the rules baseline (chassis stat, tech-level SP, a constant)
 *   `contribution` a rules-sourced addend (an installed item, type bonus,
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

/** The popup: ink, with the medium lift shadow. */
const POPUP: CSSProperties = {
  backgroundColor: color.ink,
  borderRadius: '0.375rem',
  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', // design-tokens-ignore: the medium lift shadow, neutral black
  color: color.paper,
  maxWidth: '22rem',
  minWidth: '15rem',
  paddingBlock: space[10],
  paddingInline: space[12],
  zIndex: 50,
}

const TITLE: CSSProperties = { marginBottom: space[6], opacity: 0.6 }

const LEDGER: CSSProperties = {
  fontSize: fontSize.caption,
  fontVariantNumeric: 'tabular-nums',
  listStyle: 'none',
  margin: 0,
  padding: 0,
}

const ROW: CSSProperties = {
  alignItems: 'baseline',
  display: 'flex',
  gap: space[16],
  justifyContent: 'space-between',
  paddingBottom: space[2],
  paddingTop: space[2],
}

/** The rule over a subtotal: `mt-1.5 border-t border-paper-30 pt-1.5`. */
const RULED: CSSProperties = {
  borderTop: `1px solid ${color.paper30}`,
  marginTop: space[6],
  paddingTop: space[6],
}

const DETAIL: CSSProperties = { fontSize: fontSize.note, marginLeft: space[4], opacity: 0.6 }

const TRIGGER_CLASS = `su-stat-provenance__trigger ${FOCUS_RING}`

function rowStyle(kind: ProvenanceLineKind): CSSProperties {
  if (kind === 'derived') return { ...ROW, ...RULED }
  if (kind === 'override') return { ...ROW, color: color.caution, fontWeight: weight.semibold }
  return ROW
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
        // The dotted underline is `.su-stat-provenance__trigger` (callers
        // restyle it through `className`). `FOCUS_RING` was the three classes
        // spelled out by hand; imported so the ring can never drift.
        className={[TRIGGER_CLASS, className].filter(Boolean).join(' ')}
        aria-label={`${statLabel}: how this is derived`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" sideOffset={6}>
          <Popover.Popup
            style={POPUP}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
          >
            <Popover.Title
              className={capsLabel({ size: 'badge', weight: 'inherit', tracking: 'caps' })}
              style={TITLE}
            >
              {statLabel} · how this is derived
            </Popover.Title>
            <ul style={LEDGER}>
              {/* Keyed by CONTENT, not by array index. kind+label alone can
                  collide (two +1 bonuses of the same source type); including
                  detail and amount disambiguates those without keying on
                  position. Two lines
                  identical in all four fields render interchangeably, so a
                  collision there is harmless. */}
              {lines.map((line) => (
                <li
                  key={`${line.kind}-${line.label}-${line.detail ?? ''}-${line.amount}`}
                  style={rowStyle(line.kind)}
                >
                  <span>
                    {line.label}
                    {line.detail ? <span style={DETAIL}>{line.detail}</span> : null}
                  </span>
                  <span
                    style={{
                      fontWeight: weight.semibold,
                      ...(line.amount < 0 ? { color: color.statusBad } : {}),
                    }}
                  >
                    {line.kind === 'base' || line.kind === 'derived' || line.kind === 'override'
                      ? line.amount
                      : signed(line.amount)}
                  </span>
                </li>
              ))}
              <li style={{ ...ROW, ...RULED, fontWeight: weight.semibold, paddingBottom: 0 }}>
                <span>Showing</span>
                <span>
                  {total}
                  {overridden ? ' *' : ''}
                </span>
              </li>
            </ul>
            <Popover.Arrow style={{ fill: color.ink }} />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
