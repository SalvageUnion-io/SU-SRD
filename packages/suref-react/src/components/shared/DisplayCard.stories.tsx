import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { DisplayCard } from './DisplayCard'
import type { CardFootMeta, DisplayCardTab } from './DisplayCard'
import { Text } from '../base/Text'
import { Badge } from '../chrome/Badge'
import { Btn } from '../chrome/Btn'
import { StepBtn } from '../chrome/SmallButtons'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/DisplayCard',
}

// Real chassis content so header/body/foot read like a shipped card.
const chassis = SalvageUnionReference.Chassis.all()[0]
const name = chassis?.name ?? 'Mule'
const tl = chassis?.techLevel ?? 3
const sv = chassis?.salvageValue ?? 8
const sp = chassis?.structurePoints ?? 12
const cargo = chassis?.cargoCapacity ?? 16

const header = (
  <Text variant="pseudoheader" as="span">
    {name}
  </Text>
)

const body = (
  <div className="p-3">
    <Text as="p" className="text-sm text-ink-2">
      Structure {sp} · Cargo {cargo} · Tech Level {tl}
    </Text>
  </div>
)

const footMeta = [
  { label: 'TL', value: tl },
  { label: 'SV', value: sv },
]

function Gallery({ rule, children }: { rule: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 bg-paper p-5 font-mono text-ink">
      <p className="max-w-2xl text-xs leading-relaxed text-ink-2">{rule}</p>
      <div className="flex flex-wrap items-start gap-6">{children}</div>
    </div>
  )
}

function Cell({
  label,
  width = 'w-[360px]',
  children,
}: {
  label: string
  width?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={width}>{children}</div>
      <code className="text-nano text-ink-2">{label}</code>
    </div>
  )
}

/** Density + interactivity: full → compact → listing (header-only) → disabled. */
export const Densities: Story = () => (
  <Gallery rule="Two booleans span the density range: compact (reduced spacing) and listing (header-only clickable row). disabled dims the whole card.">
    <Cell label="default">
      <DisplayCard headerBg="bg-su-green" headerContent={header} footMeta={footMeta}>
        {body}
      </DisplayCard>
    </Cell>
    <Cell label="compact">
      <DisplayCard headerBg="bg-su-green" headerContent={header} compact>
        {body}
      </DisplayCard>
    </Cell>
    <Cell label="listing">
      <DisplayCard headerBg="bg-su-green" headerContent={header} listing>
        {body}
      </DisplayCard>
    </Cell>
    <Cell label="compact listing">
      <DisplayCard headerBg="bg-su-green" headerContent={header} compact listing>
        {body}
      </DisplayCard>
    </Cell>
    <Cell label="disabled">
      <DisplayCard headerBg="bg-su-green" headerContent={header} disabled>
        {body}
      </DisplayCard>
    </Cell>
  </Gallery>
)

/** Condition status: intact → damaged → destroyed (the warm state treatment). */
export const Status: Story = () => (
  <Gallery rule="status drives the condition treatment — intact is pristine; damaged/destroyed apply the warm brick-red state overlay (a treatment, never a second hue).">
    <Cell label='status="intact"'>
      <DisplayCard headerBg="bg-su-green" headerContent={header} status="intact">
        {body}
      </DisplayCard>
    </Cell>
    <Cell label='status="damaged"'>
      <DisplayCard headerBg="bg-su-green" headerContent={header} status="damaged">
        {body}
      </DisplayCard>
    </Cell>
    <Cell label='status="destroyed"'>
      <DisplayCard headerBg="bg-su-green" headerContent={header} status="destroyed">
        {body}
      </DisplayCard>
    </Cell>
  </Gallery>
)

const tabs: DisplayCardTab[] = [
  {
    key: 'stats',
    label: 'Stats',
    content: (
      <div className="p-3 text-sm text-ink-2">
        Structure {sp} · Cargo {cargo}
      </div>
    ),
  },
  {
    key: 'notes',
    label: 'Notes',
    content: <div className="p-3 text-sm text-ink-2">Field notes.</div>,
  },
]

/** Composed features: tabs, foot actions + meta, a header label badge, sticky header. */
export const Features: Story = () => (
  <Gallery rule="Feature slots layer onto the same shell: tabs, footActions + footMeta, a header label + labelBadge, and a stickyHeader (scroll to see it stick).">
    <Cell label="tabs" width="w-[380px]">
      <DisplayCard headerBg="bg-su-blue" headerContent={header} tabs={tabs}>
        {body}
      </DisplayCard>
    </Cell>
    <Cell label="footActions + footMeta" width="w-[380px]">
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={header}
        footActions={
          <button type="button" className="rounded-badge border border-ink px-2 py-1 text-xs">
            Repair
          </button>
        }
        footMeta={[{ label: 'AP Cost', value: 1 }]}
      >
        {body}
      </DisplayCard>
    </Cell>
    <Cell label="label + labelBadge">
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={header}
        label="Tech Level"
        labelBadge={String(tl)}
      >
        {body}
      </DisplayCard>
    </Cell>
    <Cell label="stickyHeader (scroll)" width="w-[380px]">
      <div className="h-[240px] overflow-y-auto border border-ink/20">
        <DisplayCard headerBg="bg-su-blue" headerContent={header} stickyHeader>
          <div className="flex flex-col gap-3 p-3">
            {Array.from({ length: 8 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static demo lines identified by index
              <Text as="p" className="text-sm text-ink-2" key={i}>
                Loadout row {i + 1}.
              </Text>
            ))}
          </div>
        </DisplayCard>
      </div>
    </Cell>
  </Gallery>
)

// A real installed mech system so the action-economy foot reads like ITUN's
// MechItemCard (EP/heat/uses come off this entity in the app).
const system = SalvageUnionReference.Systems.all()[0]
const systemName = system?.name ?? '.50 Cal Machine Gun'
const systemSlots = system?.slotsRequired ?? 2

const installedBody = (
  <div className="p-3">
    <Text as="p" className="font-cond text-caption font-bold uppercase tracking-wide text-ink-2">
      Installed System
    </Text>
  </div>
)

// EP.0 / SLOTS.2 — the inline label/value meta folded into the foot band.
const installedFootMeta: CardFootMeta[] = [
  { label: 'EP', value: 0 },
  { label: 'Slots', value: systemSlots },
]

/** The uses stepper as MechItemCard renders it: ± StepBtns bracketing "Uses n/max". */
function UsesStepper({ max }: { max: number }) {
  const [remaining, setRemaining] = useState(max)
  return (
    <span className="inline-flex items-center gap-1.5">
      <StepBtn
        aria-label={`Decrease ${systemName} uses`}
        disabled={remaining <= 0}
        onClick={() => setRemaining((n) => n - 1)}
      >
        &ndash;
      </StepBtn>
      <span className="min-w-[4.5rem] text-center font-cond text-badge font-bold uppercase leading-none tabular-nums text-ink">
        Uses {remaining}/{max}
      </span>
      <StepBtn
        aria-label={`Increase ${systemName} uses`}
        disabled={remaining >= max}
        onClick={() => setRemaining((n) => n + 1)}
      >
        +
      </StepBtn>
    </span>
  )
}

/**
 * Action-economy foot: the folded MechItemCard preset. A compact installed-system
 * card carries its condition Badge, EP/Slots footMeta, and a footActions band —
 * Use (rust, the one action color) + a uses stepper, with a rust Repair on the
 * damaged variant. Rust appears ONLY on Use/Repair; everything else stays paper/ink.
 */
export const ActionEconomyFoot: Story = () => (
  <Gallery rule="The action-economy foot (folded ItemCard preset): footMeta cites EP/Slots, footActions folds Use + a uses stepper into the band. Rust is reserved for the action verbs — Use and Repair — never chrome; condition is a tone Badge, not a second hue.">
    <Cell label="intact" width="w-[400px]">
      <DisplayCard
        compact
        headerBg="bg-su-green"
        headerContent={
          <span className="flex min-w-0 items-center gap-2">
            <Text variant="pseudoheader" as="span">
              {systemName}
            </Text>
            <Badge surface="tone" tone="ok">
              Intact
            </Badge>
          </span>
        }
        footMeta={installedFootMeta}
        footActions={
          <>
            <Btn size="sm" variant="primary" aria-label={`Use ${systemName}`}>
              Use
            </Btn>
            <UsesStepper max={3} />
          </>
        }
      >
        {installedBody}
      </DisplayCard>
    </Cell>
    <Cell label="damaged" width="w-[400px]">
      <DisplayCard
        compact
        headerBg="bg-su-green"
        headerContent={
          <span className="flex min-w-0 items-center gap-2">
            <Text variant="pseudoheader" as="span">
              {systemName}
            </Text>
            <Badge surface="tone" tone="warn">
              Damaged
            </Badge>
          </span>
        }
        footMeta={installedFootMeta}
        footActions={
          <>
            <Btn size="sm" variant="primary" aria-label={`Use ${systemName}`}>
              Use
            </Btn>
            <UsesStepper max={3} />
            <Btn size="sm" variant="primary" aria-label={`Repair ${systemName}`}>
              Repair · 2 Scrap
            </Btn>
          </>
        }
      >
        {installedBody}
      </DisplayCard>
    </Cell>
  </Gallery>
)
