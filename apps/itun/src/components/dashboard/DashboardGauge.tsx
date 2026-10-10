/**
 * DashboardGauge — the Major and Minor slots' instrument readout. A thin, presentational
 * wrapper over `VitalGauge` at its single-row `compact` rung: the
 * segmented-bar rendering lives in the shared primitive (one gauge for the sheet AND
 * the dashboard), and this only maps the dashboard's ontology tones onto the gauge's
 * `--tone` vars.
 *
 * The phone form (ADR-043, board D4) reads the same gauge in two more forms,
 * chosen by `variant`:
 *
 *  - `numeral` — a framed value cell, the label stamp under a big `9/9`: the
 *    pools a phone tab leads with (SP and EP, HP and AP). No track.
 *  - `track` — `VitalGauge`'s `full` rung, with the Cap as its sub-label: the
 *    one gauge whose redline matters at a glance (Heat).
 *
 * Variants of this gauge, never a third gauge (dashboard.md §10.4).
 *
 * Maps the dashboard's ontology tones onto the gauge's `--tone` vars using the
 * canonical `--color-*` tokens directly. Renders on the warm-paper cockpit scope
 * (`.pc-root`, DashboardCanvas) via the shared `sheet` surface — the same paper
 * gauge the live sheet uses. No app/data coupling.
 */

import type { CSSVarStyle, ProvenanceLine, VitalGaugeBreakdown } from 'component-lib'
import { Badge, VitalGauge } from 'component-lib'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  weight,
} from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'

export type GaugeTone = 'mech' | 'pilot' | 'crawler'

const TONES: Record<GaugeTone, [string, string]> = {
  mech: ['var(--color-mech)', 'var(--color-sheet-mech-deep)'],
  pilot: ['var(--color-pilot)', 'var(--color-sheet-pilot-deep)'],
  crawler: ['var(--color-crawler)', 'var(--color-sheet-crawler-deep)'],
}

export type DashboardGaugeProps = {
  label: string
  value: number
  max: number
  tone?: GaugeTone
  /** First 0-based segment index that reads as danger (redline) when filled. */
  danger?: number
  /**
   * Ledger explaining how `max` was derived (ADR-029). Guided Play teaches as it
   * enforces (ADR-021), so the instrument carries this too.
   */
  provenance?: ProvenanceLine[]
  /**
   * The stat's breakdown — its `overridden` flag decides the override marker,
   * exactly as on the Live Sheet (VitalGauge reads the flag; it never compares
   * numbers).
   */
  breakdown?: VitalGaugeBreakdown
  /** `bar` (default, the canvas), or the phone's `numeral` cell and `track`. */
  variant?: 'bar' | 'numeral' | 'track'
}

/** The numeral cell: a paper value cell with an ink frame (ruleset §7.1). */
const CELL: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'space-between',
  gap: space[8],
  minWidth: 0,
  padding: `${space[10]} ${space[12]}`,
  background: color.paper,
  border: `${borderWidth.chrome} solid ${color.ink}`,
  borderRadius: radius.badge,
}

const STAMP: CSSProperties = { fontSize: fontSize.caption, lineHeight: 1.4 }

const NUMERAL: CSSProperties = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.displayLg,
  lineHeight: 1,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
  color: color.ink,
}

const OVER: CSSProperties = { ...NUMERAL, color: color.statusBad }

const MAX: CSSProperties = { fontSize: fontSize.readout, color: color.ink75 }

export function DashboardGauge({
  label,
  value,
  max,
  tone = 'mech',
  danger,
  provenance,
  breakdown,
  variant = 'bar',
}: DashboardGaugeProps) {
  const [t, td] = TONES[tone]
  const toneStyle: CSSVarStyle = { '--tone': t, '--tone-deep': td }
  if (variant === 'numeral') {
    const shown = Math.max(0, value)
    return (
      <div role="img" aria-label={`${label} ${shown} of ${max}`} style={CELL}>
        <Badge shape="stamp" style={STAMP}>
          {label}
        </Badge>
        <span style={shown > max ? OVER : NUMERAL}>
          {shown}
          <span style={MAX}>/{max}</span>
        </span>
      </div>
    )
  }
  if (variant === 'track') {
    return (
      <VitalGauge
        surface="sheet"
        readOnly
        label={label}
        subLabel={`Cap ${max}`}
        value={value}
        max={max}
        danger={danger}
        provenance={provenance}
        breakdown={breakdown}
        style={toneStyle}
      />
    )
  }
  return (
    <VitalGauge
      size="compact"
      surface="sheet"
      readOnly
      label={label}
      value={value}
      max={max}
      danger={danger}
      provenance={provenance}
      breakdown={breakdown}
      style={toneStyle}
    />
  )
}
