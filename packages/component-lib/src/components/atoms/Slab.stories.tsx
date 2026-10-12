import type { CSSProperties, ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Slab } from './Slab'

export default {
  title: 'Atoms/Slab',
}

// Real SRD content — reference data is preloaded by catalog.tsx.
const chassis = SalvageUnionReference.Chassis.all()[0]
const systemSlots = chassis?.systemSlots ?? 6
const moduleSlots = chassis?.moduleSlots ?? 2
const cargoCapacity = chassis?.cargoCapacity ?? 6

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

function Cluster({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={CLUSTER_LABEL}>{label}</div>
      {children}
    </div>
  )
}

/** `Slab` — the section separator: dashed (default) or solid (poster `.sect`),
 *  with an optional count and trailing actions. */
export const Default: Story = () => (
  <div style={FRAME}>
    <div style={STACK}>
      <Cluster label="dashed (default) — label only">
        <Slab label="Systems" />
      </Cluster>
      <Cluster label="dashed — with count">
        <Slab label="Systems" count={`${systemSlots}`} />
      </Cluster>
      <Cluster label="dashed — with rich count">
        <Slab label="Cargo" count={`0 lots · 0/${cargoCapacity} slots`} />
      </Cluster>
      <Cluster label="dashed — with actions">
        <Slab
          label="Modules"
          count={`${moduleSlots}`}
          actions={<span style={ACTION}>+ Add</span>}
        />
      </Cluster>
      <Cluster label="solid (poster .sect) — label only">
        <Slab variant="solid" label="Salvage" />
      </Cluster>
      <Cluster label="solid — with count + actions">
        <Slab
          variant="solid"
          label="Salvage"
          count="5 items"
          actions={<span style={ACTION}>Edit</span>}
        />
      </Cluster>
      <Cluster label="solid — count beside the stamp (ITUN Shelves, board S1)">
        <Slab
          variant="solid"
          label="Mechs"
          count="2"
          countAt="label"
          actions={<span style={ACTION}>+ New mech</span>}
        />
      </Cluster>
    </div>
  </div>
)
