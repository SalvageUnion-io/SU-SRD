import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Text } from '../components/base/Text'
import { Btn } from '../components/chrome/Btn'
import { Conditions } from '../components/chrome/Conditions'
import { Field, Input } from '../components/chrome/Field'
import { Empty, Panel, Row } from '../components/chrome/Panel'
import { Chip, Pill } from '../components/chrome/Pill'
import { Sel } from '../components/chrome/Sel'
import { Slab } from '../components/chrome/Slab'
import { MiniBtn, StepBtn } from '../components/chrome/SmallButtons'
import { StatusBadge } from '../components/chrome/StatusBadge'
import { Tag } from '../components/chrome/Tag'
import { DisplayCard } from '../components/shared/DisplayCard'
import { FilterChip } from '../components/shared/FilterChip'
import { RollTable } from '../components/shared/RollTable'
import { StatDisplay } from '../components/shared/StatDisplay'
import { VitalGauge } from '../components/stat/VitalGauge'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Primitive Sheet',
}

/* ── module-local helpers (NOT stories) ─────────────────────────────────── */

/** One labelled group cell: an ink Stamp header over a cluster of primitives. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <Text as="span" variant="pseudoheader">
        {title}
      </Text>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  )
}

const noop = () => {}

/* ── real SRD content (reference data preloaded by .ladle/components.tsx) ── */

const chassis = SalvageUnionReference.Chassis.all()[0]
const chassisName = chassis?.name ?? 'Chassis'
const sp = chassis?.structurePoints ?? 12
const ep = chassis?.energyPoints ?? 4
const heat = chassis?.heatCapacity ?? 6
const systemSlots = chassis?.systemSlots ?? 16
const tl = chassis?.techLevel ?? 1
const sv = chassis?.salvageValue ?? 7

const weaponAction = SalvageUnionReference.Actions.all()[0]
const rangeLabel = weaponAction?.range?.[0] ?? 'Close'

const systemName = SalvageUnionReference.Systems.all()[0]?.name ?? 'System'
const className = SalvageUnionReference.Classes.all()[0]?.name ?? 'Engineer'
const traitName = SalvageUnionReference.Traits.all()[0]?.name ?? 'armour'

// Real condition-style keywords for the Conditions strip.
const knownKeywords = new Set(SalvageUnionReference.Keywords.all().map((k) => k.name))
const conditions = ['prone', 'blind'].filter((c) => knownKeywords.has(c))
const conditionsForDisplay = conditions.length > 0 ? conditions : ['prone', 'blind']

// Real roll table (same access pattern as RollTable.stories), with a fallback.
const rollTableEntity = SalvageUnionReference.RollTables.all()[0]
const realTable = rollTableEntity && 'table' in rollTableEntity ? rollTableEntity.table : undefined
const fallbackTable = {
  type: 'standard' as const,
  '20': 'Critical Success: double effect',
  '11-19': 'Hit: standard effect',
  '6-10': 'Glancing: half effect',
  '2-5': 'Miss: no effect',
  '1': 'Critical Failure: jam',
}

/* ── the single at-a-glance sheet ───────────────────────────────────────── */

export const Sheet: Story = () => (
  <div className="bg-paper p-6 text-ink">
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-6">
      {/* 1. Type & Stamp */}
      <Group title="Type & Stamp">
        <Text as="span" variant="pseudoheader">
          {chassisName}
        </Text>
        <span className="inline-block bg-ink p-2">
          <Text as="span" variant="pseudoheaderInverse">
            {className}
          </Text>
        </span>
      </Group>

      {/* 2. Stats */}
      <Group title="Stats">
        <StatDisplay label="SP" value={sp} />
        <StatDisplay label="EP" value={Math.ceil(ep * 0.75)} max={ep} dots tone="hp" />
        <StatDisplay label="RANGE" value={rangeLabel} orientation="horizontal" />
        <StatDisplay orientation="horizontal" label="Class" value={className} />
        <StatDisplay orientation="horizontal" label="SV" value={sv} />
        <StatDisplay
          label="HEAT"
          value={Math.ceil(heat / 2)}
          max={heat}
          dots
          tone="heat"
          orientation="horizontal"
        />
        <StatDisplay label="SP" value={Math.ceil(sp * 0.5)} max={sp} mode="edit" onChange={noop} />
        <div className="sheet--pilot w-full max-w-[220px]">
          <VitalGauge label="SP" value={Math.ceil(sp * 0.6)} max={sp} readOnly />
        </div>
      </Group>

      {/* 3. Badges */}
      <Group title="Badges">
        <Pill>Tech {tl}</Pill>
        <Pill tone="pilot">pilot</Pill>
        <Pill tone="mech" rounded>
          mech
        </Pill>
        <Chip value={sp}>SP</Chip>
        <Tag label={traitName} />
        <StatusBadge status="damaged" />
      </Group>

      {/* 4. Buttons */}
      <Group title="Buttons">
        <Btn variant="primary">Primary</Btn>
        <Btn variant="default">Secondary</Btn>
        <Btn variant="ghost">Ghost</Btn>
        <Btn variant="danger">Danger</Btn>
        <Sel selected onToggle={noop} ariaLabel={systemName}>
          <span className="block w-44 rounded-[4px] border-chrome border-ink bg-paper px-3 py-2 font-body text-[13px]">
            {systemName}
          </span>
        </Sel>
        <FilterChip label={traitName} active onClick={noop} />
        <div className="flex items-center gap-2">
          <StepBtn aria-label="Decrease">–</StepBtn>
          <StepBtn aria-label="Increase">+</StepBtn>
        </div>
        <MiniBtn>⇄ Swap</MiniBtn>
      </Group>

      {/* 5. Chrome */}
      <Group title="Chrome">
        <div className="w-full">
          <Slab label="Systems" count={String(systemSlots)} />
        </div>
        <Panel className="w-full p-2">
          <div className="flex flex-col gap-2">
            <Row name={chassisName} meta={`Chassis · TL${tl} · SV ${sv}`} />
            <Empty message="No systems installed yet." />
          </div>
        </Panel>
        <Conditions conditions={conditionsForDisplay} onRemove={noop} onAdd={noop} />
        <Field label="Chassis" htmlFor="ps-chassis">
          <Input id="ps-chassis" defaultValue={chassisName} />
        </Field>
      </Group>

      {/* 6. Containers */}
      <Group title="Containers">
        <div className="w-full">
          <DisplayCard
            compact
            headerBg="bg-su-green"
            headerContent={
              <Text as="span" variant="pseudoheader">
                {systemName}
              </Text>
            }
          >
            <div className="p-2 text-sm">Compact DisplayCard body.</div>
          </DisplayCard>
        </div>
        <div className="w-full">
          <RollTable
            table={realTable ?? fallbackTable}
            compact
            tableName={rollTableEntity?.name ?? 'Core Mechanic'}
          />
        </div>
        <div className="w-full rounded-[3px] border-chrome border-dashed border-ink/40 p-2 font-mono text-[11px] text-ink-2">
          Tooltip · Modal · Toaster — portal/interaction primitives; verify live (not statically
          rendered).
        </div>
      </Group>
    </div>
  </div>
)
