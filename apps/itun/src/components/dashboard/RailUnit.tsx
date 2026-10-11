/**
 * RailUnit — the pilot or the mech on the rail during Downtime (board D3,
 * issue 1255). The Crawler takes the whole unit row, because every Downtime
 * step acts on it; the pilot and the mech stay one press away as a compact
 * link with their pips, which opens their full controls over the display (the
 * ⤢ overlay), since Restore, Customise your Mech and Train your Pilot need them.
 *
 * A reading with `pips` draws its track as fixed-size pips; the rest are
 * `[label | value]` cells.
 */

import { Badge, Stat, tokens } from 'component-lib'
import type { CSSProperties } from 'react'
import type { SlotKind } from './slotLayout'

export type RailReading = { label: string; value: number; max?: number; pips?: boolean }

const TONE: Record<SlotKind, string> = {
  pilot: tokens.color.pilot,
  mech: tokens.color.mech,
  crawler: tokens.color.crawler,
}

const BUTTON = {
  alignItems: 'center',
  background: 'transparent',
  border: 0,
  color: tokens.color.ink,
  cursor: 'pointer',
  display: 'flex',
  gap: tokens.space[6],
  padding: `${tokens.space[2]} ${tokens.space[4]}`,
} satisfies CSSProperties

const SWATCH = {
  borderColor: tokens.color.ink,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.hairline,
  display: 'inline-block',
  flexShrink: 0,
  height: '22px',
  width: '12px',
} satisfies CSSProperties

const LABEL = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.lede,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.capsTight,
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

const TRACK = { display: 'inline-flex', gap: '2px' } satisfies CSSProperties

const PIP = {
  borderColor: tokens.color.ink,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.hairline,
  display: 'inline-block',
  height: '12px',
  width: '6px',
} satisfies CSSProperties

const VALUE = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontVariantNumeric: 'tabular-nums',
  fontWeight: tokens.weight.bold,
} satisfies CSSProperties

const READING = {
  alignItems: 'center',
  display: 'inline-flex',
  gap: tokens.space[4],
} satisfies CSSProperties

function Reading({ reading, tone }: { reading: RailReading; tone: string }) {
  const shown = reading.max === undefined ? `${reading.value}` : `${reading.value}/${reading.max}`
  if (!reading.pips || reading.max === undefined) {
    return <Stat label={reading.label} value={shown} orientation="horizontal" size="mini" />
  }
  return (
    <span style={READING}>
      <Badge shape="stamp" size="mini">
        {reading.label}
      </Badge>
      <span style={TRACK} aria-hidden="true">
        {Array.from({ length: reading.max }, (_, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: a pip is its position
            key={i}
            style={{ ...PIP, backgroundColor: i < reading.value ? tone : tokens.color.paper }}
          />
        ))}
      </span>
      <span style={VALUE}>{shown}</span>
    </span>
  )
}

type RailUnitProps = {
  kind: SlotKind
  /** What the unit is called on the rail: "Pilot", or the mech's name. */
  label: string
  readings: RailReading[]
  /** Open its full controls; the trigger is where focus returns. */
  onOpen: (trigger: HTMLButtonElement) => void
}

export function RailUnit({ kind, label, readings, onOpen }: RailUnitProps) {
  const summary = readings
    .map((r) =>
      r.max === undefined ? `${r.label} ${r.value}` : `${r.label} ${r.value} of ${r.max}`
    )
    .join(', ')
  return (
    <button
      type="button"
      className="su-focus-ring"
      style={BUTTON}
      aria-label={`Open ${label}: ${summary}`}
      onClick={(event) => onOpen(event.currentTarget)}
    >
      <span aria-hidden="true" style={{ ...SWATCH, backgroundColor: TONE[kind] }} />
      <span style={LABEL}>{label}</span>
      {readings.map((reading) => (
        <Reading key={reading.label} reading={reading} tone={TONE[kind]} />
      ))}
    </button>
  )
}
