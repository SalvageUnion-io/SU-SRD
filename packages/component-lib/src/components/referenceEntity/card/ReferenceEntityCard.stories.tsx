import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from './ReferenceEntityCard'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Reference Entity Card',
}

/**
 * Real SRD entity lookup with a first-entry fallback (data drift safety) —
 * throws instead of silently rendering `undefined` if a schema is ever empty.
 */
function pick<T>(list: T[], predicate: (item: T) => boolean, schemaName: string): T {
  const found = list.find(predicate) ?? list[0]
  if (!found) throw new Error(`NEW/Reference Entity Card story: no ${schemaName} entities loaded`)
  return found
}

// Real SRD entities — one per schema in the brief. Each falls back to the
// schema's first entry if the named lookup ever comes up empty (data drift), so
// the story never renders blank.
const ability = pick(
  SalvageUnionReference.Abilities.all(),
  (a) => a.name === 'Auto-Turret',
  'ability'
)
const system = pick(
  SalvageUnionReference.Systems.all(),
  (s) => s.name === 'Salvaging Drill',
  'system'
)
const chassis = pick(
  SalvageUnionReference.Chassis.all(),
  (c) => c.name === 'Little Sestra',
  'chassis'
)
const bioTitan = pick(
  SalvageUnionReference.BioTitans.all(),
  (b) => b.name === 'Scylla',
  'bio-titan'
)
const crawler = pick(
  SalvageUnionReference.Crawlers.all(),
  (c) => c.name === 'Engineering',
  'crawler'
)
const equipment = pick(
  SalvageUnionReference.Equipment.all(),
  (e) => e.name === 'Grenade',
  'equipment'
)
// A real crawler bay (schema `crawler-bays`) — Command Bay has content + a crew NPC.
const crawlerBay = pick(
  SalvageUnionReference.CrawlerBays.all(),
  (b) => b.name === 'Command Bay',
  'crawler bay'
)

// One of Little Sestra's patterns — drives the PATTERN rendering (chassis-name
// stampseal + the systems/modules loadout).
const surveyorPattern = pick(
  chassis.patterns ?? [],
  (pat) => pat.name === 'Surveyor Pattern',
  'Little Sestra pattern'
)

/** One entity rendered as the canonical card. */
function One({ entity }: { entity: SURefEntity }): ReactNode {
  return (
    <div className="flex flex-col gap-4 bg-paper p-4">
      <ReferenceEntityCard data={entity} />
    </div>
  )
}

export const AbilityCard: Story = () => <One entity={ability} />
export const SystemCard: Story = () => <One entity={system} />
export const ChassisCard: Story = () => <One entity={chassis} />
export const BioTitanCard: Story = () => <One entity={bioTitan} />
export const CrawlerCard: Story = () => <One entity={crawler} />
export const EquipmentCard: Story = () => <One entity={equipment} />
export const CrawlerBayCard: Story = () => <One entity={crawlerBay} />

export const Gallery: Story = () => (
  <div className="flex flex-col gap-10 bg-paper p-4">
    {[ability, system, chassis, bioTitan, crawler, equipment, crawlerBay].map((entity) => (
      <ReferenceEntityCard key={('id' in entity && entity.id) || entity.name} data={entity} />
    ))}
  </div>
)

/**
 * CATALOG — the SRD index tile. Compact, artwork + description ONLY: no nested
 * entities, actions, choices, patterns or roll tables, so a listing page reads
 * uniformly whatever each entity happens to carry. Compare against Gallery
 * above: the chassis drops its pattern list, the crawler bay drops its choice.
 */
export const Catalog: Story = () => (
  <div className="grid gap-4 bg-paper p-4 md:grid-cols-2">
    {[ability, system, chassis, bioTitan, crawler, equipment, crawlerBay].map((entity) => (
      <ReferenceEntityCard
        key={('id' in entity && entity.id) || entity.name}
        data={entity}
        size="catalog"
      />
    ))}
  </div>
)

/**
 * PATTERN rendering — the pattern is the subject: the chassis name ("Little
 * Sestra") rides the seam as a stampseal, and the pattern's systems + modules
 * render as nested compact cards. Distinct from the basic ChassisCard above,
 * which shows the overview (ability + a pattern LIST).
 */
export const PatternCard: Story = () => (
  <div className="flex flex-col gap-4 bg-paper p-4">
    <code className="font-mono text-nano text-ink-2">
      {chassis.name} · {surveyorPattern.name}
    </code>
    <ReferenceEntityCard data={chassis} pattern={surveyorPattern} />
  </div>
)
