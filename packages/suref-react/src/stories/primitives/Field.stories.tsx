import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Field, Input } from '../../components/chrome/Field'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Field',
}

// Real SRD content — reference data is preloaded by .ladle/components.tsx.
const chassis = SalvageUnionReference.Chassis.all()[0]
const system = SalvageUnionReference.Systems.all()[0]
const crawler = SalvageUnionReference.Crawlers.all()[0]
const chassisName = chassis?.name ?? 'Chassis'
const systemName = system?.name ?? 'System'
const crawlerName = crawler?.name ?? 'Crawler'

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

/** `Field` — the labelled form control (optional rust required-asterisk) wrapping
 *  its `Input`, plus the standalone `Input` states. */
export const Default: Story = () => (
  <div className="bg-paper p-4">
    <div className="flex flex-col gap-6">
      <Cluster label="Field + Input — basic">
        <Field label="Mech Name" htmlFor="mech-name">
          <Input id="mech-name" placeholder={`e.g. ${chassisName}`} defaultValue={chassisName} />
        </Field>
      </Cluster>
      <Cluster label="Field — required (rust asterisk)">
        <Field label="Callsign" required htmlFor="callsign">
          <Input id="callsign" placeholder="Required" />
        </Field>
      </Cluster>
      <Cluster label="Input — standalone variants (empty · filled · disabled)">
        <div className="flex flex-col gap-3">
          <Input placeholder={`e.g. ${systemName}`} />
          <Input defaultValue={chassisName} />
          <Input disabled defaultValue={crawlerName} />
        </div>
      </Cluster>
    </div>
  </div>
)
