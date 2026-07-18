/**
 * DashboardGauge — the Active Item / dial instrument readout. A thin wrapper over
 * `component-lib`'s `VitalGauge` in its single-row `compact` + `instrument`
 * surface mode: the segmented-bar rendering now lives in the shared primitive
 * (one implementation for the sheet AND the dashboard), and this component only
 * maps the dashboard's tone palette onto the gauge's `--tone` vars.
 *
 * The instrument palette (`--pc-*`) keeps the dashboard's current dark look;
 * bringing it into full aesthetic match with the light sheet is a later flip of
 * these tone vars (or dropping `surface="instrument"`), not a re-implementation.
 */

import type { CSSProperties } from 'react'
import { VitalGauge } from 'component-lib'

export type GaugeTone = 'mech' | 'pilot' | 'crawler'

const TONES: Record<GaugeTone, [string, string]> = {
  mech: ['var(--pc-mech)', 'var(--pc-mech-deep)'],
  pilot: ['var(--pc-pilot)', 'var(--pc-pilot-deep)'],
  crawler: ['var(--pc-crawler)', 'var(--pc-crawler-deep)'],
}

type DashboardGaugeProps = {
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
      surface="instrument"
      readOnly
      label={label}
      value={value}
      max={max}
      danger={danger}
      style={{ '--tone': t, '--tone-deep': td } as CSSProperties}
    />
  )
}
