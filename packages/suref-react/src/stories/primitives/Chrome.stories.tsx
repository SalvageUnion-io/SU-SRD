import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Conditions, ConditionChip } from '../../components/chrome/Conditions'
import { Field, Input } from '../../components/chrome/Field'
import { Empty, Panel, Row } from '../../components/chrome/Panel'
import { Slab } from '../../components/chrome/Slab'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Primitives/Chrome',
}

// Real SRD content — reference data is preloaded by .ladle/components.tsx.
const chassis = SalvageUnionReference.Chassis.all()[0]
const system = SalvageUnionReference.Systems.all()[0]
const crawler = SalvageUnionReference.Crawlers.all()[0]

const chassisName = chassis?.name ?? 'Chassis'
const techLevel = chassis?.techLevel ?? 1
const salvageValue = chassis?.salvageValue ?? 5
const systemSlots = chassis?.systemSlots ?? 6
const moduleSlots = chassis?.moduleSlots ?? 2
const cargoCapacity = chassis?.cargoCapacity ?? 6
const systemName = system?.name ?? 'System'
const systemTechLevel = system?.techLevel ?? 1
const crawlerName = crawler?.name ?? 'Crawler'

function Label({ children }: { children: string }) {
  return (
    <div className="mb-1.5 font-cond text-[11px] font-semibold uppercase tracking-caps-wide text-wk-muted">
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

export const Slabs: Story = () => (
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

export const Panels: Story = () => (
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

export const ConditionsRow: Story = () => (
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

export const Fields: Story = () => (
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
      <Cluster label="Input — standalone variants">
        <div className="flex flex-col gap-3">
          <Input placeholder={`e.g. ${systemName}`} />
          <Input defaultValue={chassisName} />
          <Input disabled defaultValue={crawlerName} />
        </div>
      </Cluster>
    </div>
  </div>
)
