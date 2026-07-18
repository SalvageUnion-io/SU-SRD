/**
 * Legacy "before" capture — ITUN Dashboard `DashboardGauge` (Phase 2).
 *
 * Reproduces the bespoke DARK segmented instrument bar from
 * apps/in-the-union-now/src/components/dashboard/DashboardGauge.tsx VERBATIM —
 * same `.pc-gauge*` / `.pc-seg*` markup and the `--pc-gtone` custom-property
 * plumbing, styled by the co-located CSS slice (NOT Tailwind). It is
 * deliberately NOT component-lib's VitalGauge: that gauge is light-themed for
 * the sheet; this one is dark for the Dashboard instruments. The gauge is a
 * generic label/value/max instrument — the readouts here use the real SU vital
 * vocabulary (SP / Heat / HP / AP) and ontology tones (mech / pilot / crawler)
 * exactly as `dialItems` feeds it, anchored to real reference entities.
 * L1 reconciliation: freeze the "before", do not refactor onto VitalGauge.
 */

import type { Story } from '@ladle/react'
import type { CSSProperties, ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../_harness'
import './LegacyDashboardGauge.css'

// Real Dashboard gauge tones (from DashboardGauge.tsx).
type GaugeTone = 'mech' | 'pilot' | 'crawler'

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

// Verbatim reproduction of DashboardGauge.tsx.
function DashboardGauge({ label, value, max, tone = 'mech', danger }: DashboardGaugeProps) {
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

/** Dark instrument frame that stands in for the Dashboard's dark ground. */
function Stack({ children }: { children: ReactNode }) {
  return (
    <div
      className="pc-root"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 380,
        padding: 12,
        borderRadius: 5,
        background: 'var(--pc-ground)',
      }}
    >
      {children}
    </div>
  )
}

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/PC Dashboard Gauge' }

export const Default: Story = () => {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  if (!chassis) return <Caption>Chassis fixture missing</Caption>

  return (
    <div style={{ maxWidth: 420 }}>
      <Caption>
        ITUN Dashboard dark segmented gauge (DashboardGauge) — a bespoke dark instrument, NOT
        component-lib's light VitalGauge. Real SU vitals (SP / Heat / HP / AP) and ontology tones
        (mech / pilot / crawler), the same readouts the dial cells show for {chassis.name}.
      </Caption>
      <Stack>
        {/* Mech gauges — the Active Item's SP + Heat (Heat redlines at max-2). */}
        <DashboardGauge label="SP" value={12} max={15} tone="mech" />
        <DashboardGauge label="Heat" value={5} max={6} tone="mech" danger={4} />
        {/* Pilot gauges — HP + a fully-spent AP. */}
        <DashboardGauge label="HP" value={8} max={10} tone="pilot" />
        <DashboardGauge label="AP" value={0} max={5} tone="pilot" />
        {/* Crawler gauge — a fully-charged SP bar. */}
        <DashboardGauge label="SP" value={20} max={20} tone="crawler" />
      </Stack>
    </div>
  )
}
