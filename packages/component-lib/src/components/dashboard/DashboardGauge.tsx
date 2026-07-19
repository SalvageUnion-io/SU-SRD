/**
 * DashboardGauge — the Active Item / dial instrument readout. A thin, presentational
 * wrapper over `VitalGauge` in its single-row `compact` + `instrument` surface: the
 * segmented-bar rendering lives in the shared primitive (one gauge for the sheet AND
 * the dashboard), and this only maps the dashboard's ontology tones onto the gauge's
 * `--tone` vars.
 *
 * Maps the dashboard's ontology tones onto the gauge's `--tone` vars using the
 * canonical `--color-*` tokens directly. Renders on the warm-paper cockpit scope
 * (`.pc-root`, DashboardCanvas) via the shared `sheet` surface — the same paper
 * gauge the live sheet uses. No app/data coupling.
 */

import type { CSSProperties } from 'react'
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
}

export function DashboardGauge({ label, value, max, tone = 'mech', danger }: DashboardGaugeProps) {
  const [t, td] = TONES[tone]
  return (
    <VitalGauge
      compact
      surface="sheet"
      readOnly
      label={label}
      value={value}
      max={max}
      danger={danger}
      style={{ '--tone': t, '--tone-deep': td } as CSSProperties}
    />
  )
}
