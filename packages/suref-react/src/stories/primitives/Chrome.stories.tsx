import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { Conditions, ConditionChip } from '../../components/chrome/Conditions'
import { Field, Input } from '../../components/chrome/Field'
import { Empty, Panel, Row } from '../../components/chrome/Panel'
import { Slab } from '../../components/chrome/Slab'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Primitives/Chrome',
}

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
        <Slab label="Systems" count="2" />
      </Cluster>
      <Cluster label="dashed — with rich count">
        <Slab label="Cargo" count="3 lots · 5/6 slots" />
      </Cluster>
      <Cluster label="dashed — with actions">
        <Slab
          label="Modules"
          count="4"
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
            <Row name="Iron Mongrel" meta="Chassis · TL3 · SV 8" />
            <Row
              name="Wrench"
              meta={'"Wrench" · Engineer · ↳ Iron Fist'}
              actions={
                <span className="font-cond text-xs font-bold uppercase text-rust">Sheet</span>
              }
            />
          </div>
        </Panel>
      </Cluster>
      <Cluster label="Panel (soft border)">
        <Panel soft className="p-2">
          <div className="flex flex-col gap-2">
            <Row name="Scrap Hauler" meta="Crawler · 6 bays" />
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
          conditions={['Overheated', 'Restrained', 'Blinded']}
          onRemove={() => {}}
          onAdd={() => {}}
        />
      </Cluster>
      <Cluster label="Conditions — read-only (no remove, no add)">
        <Conditions conditions={['Impaired', 'Prone']} />
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
        <Field label="Pilot Name" htmlFor="pilot-name">
          <Input id="pilot-name" placeholder="e.g. Wrench" defaultValue="Wrench" />
        </Field>
      </Cluster>
      <Cluster label="Field — required (rust asterisk)">
        <Field label="Callsign" required htmlFor="callsign">
          <Input id="callsign" placeholder="Required" />
        </Field>
      </Cluster>
      <Cluster label="Input — standalone variants">
        <div className="flex flex-col gap-3">
          <Input placeholder="Empty with placeholder" />
          <Input defaultValue="Filled value" />
          <Input disabled defaultValue="Disabled" />
        </div>
      </Cluster>
    </div>
  </div>
)
