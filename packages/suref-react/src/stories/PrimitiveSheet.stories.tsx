import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
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

/** Static demo roll table (mirrors the RollTable story's fallback fixture). */
const demoTable = {
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
          Ink Stamp
        </Text>
        <span className="inline-block bg-ink p-2">
          <Text as="span" variant="pseudoheaderInverse">
            Inverse Stamp
          </Text>
        </span>
      </Group>

      {/* 2. Stats */}
      <Group title="Stats">
        <StatDisplay label="SP" value={8} />
        <StatDisplay label="HP" value={4} max={6} dots tone="hp" />
        <StatDisplay label="RANGE" value="Close" orientation="horizontal" />
        <StatDisplay label="HEAT" value={3} max={6} dots tone="heat" orientation="horizontal" />
        <StatDisplay label="EP" value={3} max={6} mode="edit" onChange={noop} />
        <div className="sheet--pilot w-full max-w-[220px]">
          <VitalGauge label="HP" value={4} max={6} readOnly />
        </div>
      </Group>

      {/* 3. Badges */}
      <Group title="Badges">
        <Pill>Tech 3</Pill>
        <Pill tone="pilot">pilot</Pill>
        <Pill tone="mech" rounded>
          mech
        </Pill>
        <Chip value={12}>HP</Chip>
        <Tag label="Passive" />
        <StatusBadge status="damaged" />
        <StatDisplay orientation="horizontal" label="Class" value="Roughneck" />
        <StatDisplay orientation="horizontal" label="SV" value={4} />
      </Group>

      {/* 4. Buttons */}
      <Group title="Buttons">
        <Btn variant="primary">Primary</Btn>
        <Btn variant="default">Secondary</Btn>
        <Btn variant="ghost">Ghost</Btn>
        <Btn variant="danger">Danger</Btn>
        <Sel selected onToggle={noop} ariaLabel="Selected">
          <span className="block w-44 rounded-[4px] border-chrome border-ink bg-paper px-3 py-2 font-body text-[13px]">
            Selected item
          </span>
        </Sel>
        <FilterChip label="Facet" active onClick={noop} />
        <div className="flex items-center gap-2">
          <StepBtn aria-label="Decrease">–</StepBtn>
          <StepBtn aria-label="Increase">+</StepBtn>
        </div>
        <MiniBtn>⇄ Swap</MiniBtn>
      </Group>

      {/* 5. Chrome */}
      <Group title="Chrome">
        <div className="w-full">
          <Slab label="Systems" count="2" />
        </div>
        <Panel className="w-full p-2">
          <div className="flex flex-col gap-2">
            <Row name="Iron Mongrel" meta="Chassis · TL3 · SV 8" />
            <Empty message="No systems installed yet." />
          </div>
        </Panel>
        <Conditions conditions={['Overheated', 'Prone']} onRemove={noop} onAdd={noop} />
        <Field label="Callsign" htmlFor="ps-callsign">
          <Input id="ps-callsign" defaultValue="Wrench" />
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
                Sample Card
              </Text>
            }
          >
            <div className="p-2 text-sm">Compact DisplayCard body.</div>
          </DisplayCard>
        </div>
        <div className="w-full">
          <RollTable table={demoTable} compact />
        </div>
        <div className="w-full rounded-[3px] border-chrome border-dashed border-ink/40 p-2 font-mono text-[11px] text-ink-2">
          Tooltip · Modal · Toaster — portal/interaction primitives; verify live (not statically
          rendered).
        </div>
      </Group>
    </div>
  </div>
)
