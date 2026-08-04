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

import type { CSSVarStyle } from '../../styles/cssVars'
import type { ProvenanceLine } from '../stat/StatProvenance'
import { VitalGauge } from '../stat/VitalGauge'

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
   * The value this max would derive to without a Free-Edit pin. Supplying it
   * flags the max as overridden. Must be the DERIVED value, not `max` — the
   * gauge treats `overriddenFrom === max` as "not overridden".
   */
  derivedMax?: number
}

export function DashboardGauge({
  label,
  value,
  max,
  tone = 'mech',
  danger,
  provenance,
  derivedMax,
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
      overriddenFrom={derivedMax}
      style={toneStyle}
    />
  )
}
