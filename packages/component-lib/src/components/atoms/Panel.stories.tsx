import type { CSSProperties, ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Panel, Row } from './Panel'

export default {
  title: 'Atoms/Panel',
}

// Real SRD content — reference data is preloaded by catalog.tsx.
const chassis = SalvageUnionReference.Chassis.all()[0]
const system = SalvageUnionReference.Systems.all()[0]
const crawler = SalvageUnionReference.Crawlers.all()[0]
const chassisName = chassis?.name ?? 'Chassis'
const techLevel = chassis?.techLevel ?? 1
const salvageValue = chassis?.salvageValue ?? 5
const systemName = system?.name ?? 'System'
const systemTechLevel = system?.techLevel ?? 1
const crawlerName = crawler?.name ?? 'Crawler'

/** The gauge caption above each cluster. */
const CLUSTER_LABEL = {
  color: color.wkMuted,
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  letterSpacing: tracking.caps,
  marginBottom: space[6],
  textTransform: 'uppercase',
} satisfies CSSProperties

/** A stand-in caps action for the `actions` slot. */
const ACTION = {
  color: color.ink,
  fontFamily: font.cond,
  fontSize: fontSize.xs,
  fontWeight: weight.bold,
  lineHeight: 'calc(1 / 0.75)',
  textTransform: 'uppercase',
} satisfies CSSProperties

const FRAME = { backgroundColor: color.paper, padding: space[16] } satisfies CSSProperties

const STACK = { display: 'flex', flexDirection: 'column', gap: space[24] } satisfies CSSProperties

/** The rows' stack, padded inside the panel's frame. */
const ROWS = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  padding: space[8],
} satisfies CSSProperties

function Cluster({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={CLUSTER_LABEL}>{label}</div>
      {children}
    </div>
  )
}

/** `Panel` — the ink/soft-bordered list frame and its `Row` list item.
 *  (The zero-state placeholder is `EmptyState variant="quiet"`.) */
export const Default: Story = () => (
  <div style={FRAME}>
    <div style={STACK}>
      <Cluster label="Panel (ink border) with Rows">
        <Panel>
          <div style={ROWS}>
            <Row name={chassisName} meta={`Chassis · TL${techLevel} · SV ${salvageValue}`} />
            <Row
              name={systemName}
              meta={`System · TL${systemTechLevel}`}
              actions={<span style={ACTION}>Details</span>}
            />
          </div>
        </Panel>
      </Cluster>
      <Cluster label="Panel (soft border)">
        <Panel soft>
          <div style={ROWS}>
            <Row name={crawlerName} meta="Union Crawler" />
          </div>
        </Panel>
      </Cluster>
    </div>
  </div>
)
