/**
 * CockpitGauge — the bespoke DARK instrument readout for the Active Item and
 * (later) the dial. A horizontal segmented bar: label stamp, one flex row of
 * segments (filled up to `value` in the tone colour, empty recessed), and the
 * value/max numeral.
 *
 * Deliberately NOT `suref-react`'s VitalGauge: that gauge is light-themed
 * (ink text, paper segments) for the sheet/display. The cockpit instruments are
 * bespoke and dark (proposed ADR-017/018); VitalGauge is reused in the light
 * display surface instead (Phase 4). Read-only here — Phase 2 is read-mostly.
 */

import type { CSSProperties } from 'react'

export type GaugeTone = 'mech' | 'pilot' | 'crawler'

const TONES: Record<GaugeTone, [string, string]> = {
  mech: ['var(--pc-mech)', 'var(--pc-mech-deep)'],
  pilot: ['var(--pc-pilot)', 'var(--pc-pilot-deep)'],
  crawler: ['var(--pc-crawler)', 'var(--pc-crawler-deep)'],
}

type CockpitGaugeProps = {
  label: string
  value: number
  max: number
  tone?: GaugeTone
  /** First 0-based segment index that reads as danger (redline) when filled. */
  danger?: number
}

export function CockpitGauge({ label, value, max, tone = 'mech', danger }: CockpitGaugeProps) {
  const total = Math.max(max, value, 0)
  const [t, td] = TONES[tone]
  const segs = []
  for (let i = 0; i < total; i++) {
    const filled = i < value
    const isDanger = danger !== undefined && i >= danger
    let cls = 'pc-seg'
    if (filled) cls += isDanger ? ' danger' : ' on'
    segs.push(<span key={i} className={cls} />)
  }
  const style = { '--pc-gtone': t, '--pc-gtone-deep': td } as CSSProperties
  return (
    <div className="pc-gauge" style={style} role="img" aria-label={`${label} ${value} of ${max}`}>
      <span className="pc-gauge-lab">{label}</span>
      <div className="pc-gauge-track">{segs}</div>
      <span className="pc-gauge-num">
        {value}/{max}
      </span>
    </div>
  )
}
