import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Slab } from '../../components/chrome/Slab'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Slab',
}

// Real SRD content — reference data is preloaded by .ladle/components.tsx.
const chassis = SalvageUnionReference.Chassis.all()[0]
const systemSlots = chassis?.systemSlots ?? 6
const moduleSlots = chassis?.moduleSlots ?? 2
const cargoCapacity = chassis?.cargoCapacity ?? 6

function Cluster({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 font-cond text-label uppercase tracking-caps text-wk-muted">
        {label}
      </div>
      {children}
    </div>
  )
}

/** `Slab` — the section separator: dashed (default) or solid (poster `.sect`),
 *  with an optional count and trailing actions. */
export const Default: Story = () => (
  <div className="bg-paper p-4">
    <div className="flex flex-col gap-6">
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
          actions={<span className="font-cond text-xs font-bold uppercase text-rust">+ Add</span>}
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
          actions={<span className="font-cond text-xs font-bold uppercase text-rust">Edit</span>}
        />
      </Cluster>
    </div>
  </div>
)
