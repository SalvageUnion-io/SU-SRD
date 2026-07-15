import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Conditions, ConditionChip } from '../../components/chrome/Conditions'
import { Field, Input } from '../../components/chrome/Field'
import { OptRow } from '../../components/chrome/OptRow'
import { Panel, Row, Empty } from '../../components/chrome/Panel'
import { PickCard } from '../../components/chrome/PickCard'
import { Chip } from '../../components/chrome/Pill'
import { Slab } from '../../components/chrome/Slab'
import { Stepper } from '../../components/chrome/Stepper'
import { TreeSep } from '../../components/chrome/TreeSep'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Chrome',
}

// Real SRD content — reference data is preloaded by .ladle/components.tsx.
const chassis = SalvageUnionReference.Chassis.all()[0]
const system = SalvageUnionReference.Systems.all()[0]
const crawler = SalvageUnionReference.Crawlers.all()[0]
const classes = SalvageUnionReference.Classes.all()

const chassisName = chassis?.name ?? 'Chassis'
const techLevel = chassis?.techLevel ?? 1
const salvageValue = chassis?.salvageValue ?? 5
const systemSlots = chassis?.systemSlots ?? 6
const moduleSlots = chassis?.moduleSlots ?? 2
const cargoCapacity = chassis?.cargoCapacity ?? 6
const systemName = system?.name ?? 'System'
const systemTechLevel = system?.techLevel ?? 1
const crawlerName = crawler?.name ?? 'Crawler'

/** First paragraph of an entity's `content` block, for descriptive copy. */
function firstParagraph(content: unknown): string {
  if (Array.isArray(content)) {
    const first = content[0]
    if (first && typeof first === 'object' && 'value' in first) {
      const value = (first as { value: unknown }).value
      if (typeof value === 'string') return value
    }
  }
  return ''
}

const classA = classes[0]
const classB = classes[1]
const classAName = classA?.name ?? 'Engineer'
const classBName = classB?.name ?? 'Hacker'
const classADesc = firstParagraph(classA?.content)
const classBDesc = firstParagraph(classB?.content)
const chassisDesc = firstParagraph(chassis?.content)

// The `.all()` static return is a schema union that doesn't surface the
// class-only tree fields; read them through a narrow typed view (no `any`).
type ClassTrees = { coreTrees?: string[]; advancedTree?: string }
const classTrees = classA as unknown as ClassTrees | undefined
// Real ability-tree names off the first class (e.g. Mechanical Knowledge / Forging / …).
const coreTrees: string[] = classTrees?.coreTrees?.length
  ? classTrees.coreTrees
  : ['Mechanical Knowledge', 'Forging', 'Mech-Tech']
const advancedTreeName = classTrees?.advancedTree ?? 'Advanced Engineer'

/** Gauge-story caption: names the variant / prop above each cluster. */
function Label({ children }: { children: string }) {
  return (
    <div className="mb-1.5 font-cond text-[10px] uppercase tracking-caps text-wk-muted">
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

/**
 * `Stepper` — the vertical wizard nav rail. Zero-padded numbers, done steps in
 * ink, active step bold with the inset rust bar. Static (no nav) vs clickable
 * back-nav.
 */
export const Steppers: Story = () => {
  const steps = ['Class', 'Chassis', 'Systems', 'Modules', 'Cargo', 'Review']
  return (
    <div className="bg-paper p-4">
      <div className="flex flex-wrap gap-8">
        <Cluster label="active mid-wizard (static)">
          <Stepper steps={steps} active={2} className="w-48" />
        </Cluster>
        <Cluster label="clickable back-nav (onStepClick)">
          <Stepper steps={steps} active={3} onStepClick={() => {}} className="w-48" />
        </Cluster>
      </div>
    </div>
  )
}

/**
 * `OptRow` — the wizard master-detail list row: 44px art slot, uppercase name,
 * clamped description. Inactive vs active (white bg + inset rust bar + caret).
 */
export const OptRows: Story = () => (
  <div className="bg-paper p-4">
    <div className="max-w-md">
      <Cluster label="a pick list (one row active)">
        <OptRow name={classAName} desc={classADesc} active onClick={() => {}} />
        <OptRow name={classBName} desc={classBDesc} onClick={() => {}} />
      </Cluster>
    </div>
  </div>
)

/**
 * `PickCard` — the Class/Chassis/Crawler selection card (app chrome, NOT an
 * entity card). Unselected vs selected (3px rust ring + "Selected" chip), with
 * Chip stat row + footer.
 */
export const PickCards: Story = () => (
  <div className="bg-paper p-4">
    <Cluster label="unselected vs selected">
      <div className="flex flex-wrap items-start gap-4">
        <PickCard
          name={chassisName}
          className="w-64"
          chips={
            <>
              <Chip>{`TL${techLevel}`}</Chip>
              <Chip>{`SV ${salvageValue}`}</Chip>
              <Chip>{`${systemSlots} Sys`}</Chip>
            </>
          }
          foot={
            <span className="font-cond text-xs font-bold uppercase text-wk-muted">Chassis</span>
          }
          onSelect={() => {}}
        >
          {chassisDesc}
        </PickCard>
        <PickCard
          name={classAName}
          className="w-64"
          selected
          chips={coreTrees.map((tree) => <Chip key={tree}>{tree}</Chip>)}
          foot={<span className="font-cond text-xs font-bold uppercase text-wk-muted">Class</span>}
          onSelect={() => {}}
        >
          {classADesc}
        </PickCard>
      </div>
    </Cluster>
  </div>
)

/**
 * `TreeSep` — the ability-tree section header: flanking rules around a solid
 * tree-name Tag + a ghost suffix Tag. Fed real class core-tree names.
 */
export const TreeSeps: Story = () => (
  <div className="bg-paper p-4">
    <div className="flex flex-col gap-5">
      {coreTrees.map((tree) => (
        <Cluster key={tree} label="core tree separator">
          <TreeSep name={tree} />
        </Cluster>
      ))}
      <Cluster label="custom suffix">
        <TreeSep name={advancedTreeName} suffix="Advanced" />
      </Cluster>
    </div>
  </div>
)
