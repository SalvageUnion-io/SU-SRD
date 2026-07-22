import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { SectionHeader } from './SectionHeader'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Section Header',
}

// Real SRD content — reference data is preloaded by .ladle/components.tsx.
const chassis = SalvageUnionReference.Chassis.all()[0]

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

/** `SectionHeader` — the centered "rule / LABEL / rule" catalog band. */
export const Default: Story = () => (
  <div className="flex flex-col gap-6">
    <Cluster label="catalog category">
      <SectionHeader label="Mech Chassis" />
    </Cluster>
    <Cluster label="another category">
      <SectionHeader label="Systems & Modules" />
    </Cluster>
    <Cluster label="driven by real data">
      <SectionHeader label={chassis?.name ?? 'Chassis'} />
    </Cluster>
  </div>
)
