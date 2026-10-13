import type { CSSProperties, ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space, tracking } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Panel } from './Panel'

export default {
  title: 'Atoms/Panel',
}

// Real SRD content — reference data is preloaded by catalog.tsx.
const chassis = SalvageUnionReference.Chassis.all()[0]
const crawler = SalvageUnionReference.Crawlers.all()[0]
const chassisName = chassis?.name ?? 'Chassis'
const techLevel = chassis?.techLevel ?? 1
const salvageValue = chassis?.salvageValue ?? 5
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

const FRAME = { backgroundColor: color.paper, padding: space[16] } satisfies CSSProperties

const STACK = { display: 'flex', flexDirection: 'column', gap: space[24] } satisfies CSSProperties

/** The panel's content, padded inside its frame. */
const BODY = {
  color: color.ink,
  fontFamily: font.body,
  fontSize: fontSize.lede,
  padding: space[12],
} satisfies CSSProperties

function Cluster({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={CLUSTER_LABEL}>{label}</div>
      {children}
    </div>
  )
}

/** `Panel` — the ink/soft-bordered chrome frame.
 *  (The zero-state placeholder is `EmptyState variant="quiet"`.) */
export const Default: Story = () => (
  <div style={FRAME}>
    <div style={STACK}>
      <Cluster label="Panel (ink border)">
        <Panel>
          <div style={BODY}>{`${chassisName} · Chassis · TL${techLevel} · SV ${salvageValue}`}</div>
        </Panel>
      </Cluster>
      <Cluster label="Panel (soft border)">
        <Panel soft>
          <div style={BODY}>{`${crawlerName} · Union Crawler`}</div>
        </Panel>
      </Cluster>
    </div>
  </div>
)
