import type { CSSProperties, ReactNode } from 'react'
import { Stat, tokens } from '../index'

/** What a lot row reads off a lot: a cargo lot, or a view of one. */
type LotFacts = {
  name: string
  units: number
  tl?: number
  kind?: string
  qty?: number
}

const ROW = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  columnGap: tokens.space[8],
  rowGap: tokens.space[4],
  paddingBlock: tokens.space[6],
} satisfies CSSProperties

/** The name wraps, never "…" (EDL E18). */
const NAME = {
  flex: '1 1 8rem',
  minWidth: 0,
  overflowWrap: 'anywhere',
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  fontWeight: tokens.weight.semibold,
  lineHeight: 'calc(1.25 / 0.875)',
  color: tokens.color.ink,
} satisfies CSSProperties

const CHIPS = {
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: tokens.space[4],
} satisfies CSSProperties

const ACTIONS = {
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: tokens.space[4],
  marginLeft: 'auto',
} satisfies CSSProperties

/**
 * CargoLotRow — one cargo lot, drawn the one way wherever a hold lists it (the
 * mech and crawler Holds, a partner's hold):
 * the lot's name as plain text, then its facts as label-first chips —
 * `UNITS | 3`, `TL | 2` where the lot has a Tech Level, and `QTY | 6` for a
 * bulk lot whose count is not its units — then the host's buttons. A lot is
 * not an SRD entity, so this is not an Entity form; colour stays out of it (no
 * rail, no stamp, ruleset §3.2 / §3.10), and rows are parted by a hairline
 * (`.su-cargo-lot`).
 */
export function CargoLotRow({ lot, children }: { lot: LotFacts; children?: ReactNode }) {
  const qty = lot.kind === 'bulk' && lot.qty !== undefined && lot.qty !== lot.units ? lot.qty : null
  return (
    <li className="su-cargo-lot" style={ROW}>
      <span style={NAME}>{lot.name}</span>
      <span style={CHIPS}>
        <Stat orientation="horizontal" size="compact" label="Units" value={lot.units} />
        {lot.tl !== undefined && (
          <Stat orientation="horizontal" size="compact" label="TL" value={lot.tl} />
        )}
        {qty !== null && <Stat orientation="horizontal" size="compact" label="Qty" value={qty} />}
      </span>
      {children && <span style={ACTIONS}>{children}</span>}
    </li>
  )
}
