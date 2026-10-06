/**
 * DashboardGauge — the Active Item / dial instrument readout. A thin, presentational
 * wrapper over `VitalGauge` at its single-row `compact` rung: the
 * segmented-bar rendering lives in the shared primitive (one gauge for the sheet AND
 * the dashboard), and this only maps the dashboard's ontology tones onto the gauge's
 * `--tone` vars.
 *
 * Maps the dashboard's ontology tones onto the gauge's `--tone` vars using the
 * canonical `--color-*` tokens directly. Renders on the warm-paper cockpit scope
 * (`.pc-root`, DashboardCanvas) via the shared `sheet` surface — the same paper
 * gauge the live sheet uses. No app/data coupling.
 */

import type { CSSVarStyle, ProvenanceLine, VitalGaugeBreakdown } from 'component-lib'
import { VitalGauge } from 'component-lib'

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
   * enforces (ADR-021), so the instrument carries this too — it used to discard
   * the gauge's override/provenance props entirely.
   */
  provenance?: ProvenanceLine[]
  /**
   * The stat's breakdown — its `overridden` flag decides the override marker,
   * exactly as on the Live Sheet (VitalGauge reads the flag; it never compares
   * numbers).
   */
  breakdown?: VitalGaugeBreakdown
}

export function DashboardGauge({
  label,
  value,
  max,
  tone = 'mech',
  danger,
  provenance,
  breakdown,
}: DashboardGaugeProps) {
  const [t, td] = TONES[tone]
  const toneStyle: CSSVarStyle = { '--tone': t, '--tone-deep': td }
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
