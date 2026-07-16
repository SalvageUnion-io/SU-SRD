import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Panel, Row, Empty } from '../../components/chrome/Panel'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Panel',
}

// Real SRD content — reference data is preloaded by .ladle/components.tsx.
const chassis = SalvageUnionReference.Chassis.all()[0]
const system = SalvageUnionReference.Systems.all()[0]
const crawler = SalvageUnionReference.Crawlers.all()[0]
const chassisName = chassis?.name ?? 'Chassis'
const techLevel = chassis?.techLevel ?? 1
const salvageValue = chassis?.salvageValue ?? 5
const systemName = system?.name ?? 'System'
const systemTechLevel = system?.techLevel ?? 1
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

/** `Panel` — the ink/soft-bordered list frame, its `Row` list item, and the
 *  `Empty` placeholder for a zero-state. */
export const Default: Story = () => (
  <div className="bg-paper p-4">
    <div className="flex flex-col gap-6">
      <Cluster label="Panel (ink border) with Rows">
        <Panel className="p-2">
          <div className="flex flex-col gap-2">
            <Row name={chassisName} meta={`Chassis · TL${techLevel} · SV ${salvageValue}`} />
            <Row
              name={systemName}
              meta={`System · TL${systemTechLevel}`}
              actions={
                <span className="font-cond text-xs font-bold uppercase text-rust">Details</span>
              }
            />
          </div>
        </Panel>
      </Cluster>
      <Cluster label="Panel (soft border)">
        <Panel soft className="p-2">
          <div className="flex flex-col gap-2">
            <Row name={crawlerName} meta="Union Crawler" />
          </div>
        </Panel>
      </Cluster>
      <Cluster label="Empty — message only">
        <Empty message="No systems installed yet." />
      </Cluster>
      <Cluster label="Empty — with icon + CTA">
        <Empty message="No modules mounted." icon={<span className="text-xl text-rust">◇</span>}>
          <span className="font-cond text-xs font-bold uppercase text-rust">+ Add module</span>
        </Empty>
      </Cluster>
    </div>
  </div>
)
