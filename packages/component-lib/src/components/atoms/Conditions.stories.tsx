import type { CSSProperties, ReactNode } from 'react'
import { color, font, fontSize, space, tracking } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { ConditionChip, Conditions } from './Conditions'

export default {
  title: 'Atoms/Conditions',
}

const LABEL = {
  color: color.wkMuted,
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  letterSpacing: tracking.caps,
  marginBottom: space[6],
  textTransform: 'uppercase',
} satisfies CSSProperties

const FRAME = { backgroundColor: color.paper, padding: space[16] } satisfies CSSProperties

const STACK = { display: 'flex', flexDirection: 'column', gap: space[24] } satisfies CSSProperties

const STATES = {
  alignItems: 'flex-start',
  display: 'flex',
  flexWrap: 'wrap',
  gap: space[12],
} satisfies CSSProperties

/** Gauge-story caption: names the variant / prop above each cluster. */
function Label({ children }: { children: string }) {
  return <div style={LABEL}>{children}</div>
}

function Cluster({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  )
}

export const Default: Story = () => (
  <div style={FRAME}>
    <div style={STACK}>
      <Cluster label="Conditions summary — chips with × + Add">
        <Conditions
          conditions={['Prone', 'Blind', 'Irradiated']}
          onRemove={() => {}}
          onAdd={() => {}}
        />
      </Cluster>
      <Cluster label="Conditions — read-only (no remove, no add)">
        <Conditions conditions={['Shutdown', 'Prone']} />
      </Cluster>
      <Cluster label="Quiet tone — the neutral rung a crawler NPC's facts row uses">
        <Conditions
          conditions={['Hates synths', 'Owes a debt']}
          tone="quiet"
          onRemove={() => {}}
          onAdd={() => {}}
          addLabel="Add Command Bay crew fact"
        />
      </Cluster>
      <div>
        <Label>ConditionChip states</Label>
        <div style={STATES}>
          <ConditionChip label="Active (default)" />
          <ConditionChip label="Inactive" active={false} />
          <ConditionChip label="Removable" onRemove={() => {}} />
          <ConditionChip label="Clickable" onClick={() => {}} />
          <ConditionChip label="Click + Remove" onClick={() => {}} onRemove={() => {}} />
          <ConditionChip label="Inactive clickable" active={false} onClick={() => {}} />
        </div>
      </div>
    </div>
  </div>
)
