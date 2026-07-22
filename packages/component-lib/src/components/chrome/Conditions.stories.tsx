import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { Conditions, ConditionChip } from './Conditions'

export default {
  title: 'Atoms/Conditions',
}

/** Gauge-story caption: names the variant / prop above each cluster. */
function Label({ children }: { children: string }) {
  return (
    <div className="mb-1.5 font-cond text-label uppercase tracking-caps text-wk-muted">
      {children}
    </div>
  )
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
  <div className="bg-paper p-4">
    <div className="flex flex-col gap-6">
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
      <div>
        <Label>ConditionChip states</Label>
        <div className="flex flex-wrap items-start gap-3">
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
