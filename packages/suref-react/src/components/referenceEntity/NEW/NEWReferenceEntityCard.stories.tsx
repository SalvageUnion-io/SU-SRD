import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from '../ReferenceEntityDisplay/index'
import {
  EntityDetailLinkProvider,
  EntityHrefProvider,
} from '../ReferenceEntityDisplay/entityHrefContext'
import { NEWReferenceEntityCard } from './NEWReferenceEntityCard'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'NEW/Reference Entity Card',
}

/** OLD-vs-NEW view selector (a Ladle radio control on every story). */
type ViewMode = 'both' | 'old' | 'new'

const viewArgTypes = {
  view: { control: { type: 'radio' as const }, options: ['both', 'old', 'new'] as ViewMode[] },
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

// Real SRD entities driving the OLD-vs-NEW comparison — one per schema in the
// brief. Each falls back to the schema's first entry if the named lookup ever
// comes up empty (data drift), so the story never renders blank.
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

// One of Little Sestra's patterns — drives the PATTERN rendering (chassis-name
// stampseal + the systems/modules loadout).
const surveyorPattern = pick(
  chassis.patterns ?? [],
  (pat) => pat.name === 'Surveyor Pattern',
  'Little Sestra pattern'
)

/** The legacy `ReferenceEntityDisplay`, wired exactly like the suref-web island. */
function OldCard({ data }: { data: SURefEntity }): ReactNode {
  return (
    <EntityHrefProvider value={() => '#'}>
      <EntityDetailLinkProvider value={true}>
        <ReferenceEntityDisplay data={data} />
      </EntityDetailLinkProvider>
    </EntityHrefProvider>
  )
}

/**
 * `Compare` — one entity under the `view` control:
 * - `both` — legacy OLD stacked ABOVE the NEW card (the default comparison).
 * - `old`  — only the legacy `ReferenceEntityDisplay`.
 * - `new`  — only `NEWReferenceEntityCard`.
 */
function Compare({ entity, view }: { entity: SURefEntity; view: ViewMode }): ReactNode {
  return (
    <div className="flex flex-col gap-4 bg-paper p-4">
      {(view === 'both' || view === 'old') && (
        <div className="flex flex-col gap-1.5">
          <code className="font-mono text-nano text-ink-2">OLD</code>
          <OldCard data={entity} />
        </div>
      )}
      {(view === 'both' || view === 'new') && (
        <div className="flex flex-col gap-1.5">
          <code className="font-mono text-nano text-ink-2">NEW</code>
          <NEWReferenceEntityCard data={entity} />
        </div>
      )}
    </div>
  )
}

export const AbilityCard: Story<{ view: ViewMode }> = ({ view }) => (
  <Compare entity={ability} view={view} />
)
AbilityCard.args = { view: 'both' }
AbilityCard.argTypes = viewArgTypes

export const SystemCard: Story<{ view: ViewMode }> = ({ view }) => (
  <Compare entity={system} view={view} />
)
SystemCard.args = { view: 'both' }
SystemCard.argTypes = viewArgTypes

export const ChassisCard: Story<{ view: ViewMode }> = ({ view }) => (
  <Compare entity={chassis} view={view} />
)
ChassisCard.args = { view: 'both' }
ChassisCard.argTypes = viewArgTypes

export const BioTitanCard: Story<{ view: ViewMode }> = ({ view }) => (
  <Compare entity={bioTitan} view={view} />
)
BioTitanCard.args = { view: 'both' }
BioTitanCard.argTypes = viewArgTypes

export const CrawlerCard: Story<{ view: ViewMode }> = ({ view }) => (
  <Compare entity={crawler} view={view} />
)
CrawlerCard.args = { view: 'both' }
CrawlerCard.argTypes = viewArgTypes

export const EquipmentCard: Story<{ view: ViewMode }> = ({ view }) => (
  <Compare entity={equipment} view={view} />
)
EquipmentCard.args = { view: 'both' }
EquipmentCard.argTypes = viewArgTypes

export const Gallery: Story<{ view: ViewMode }> = ({ view }) => (
  <div className="flex flex-col gap-10">
    <Compare entity={ability} view={view} />
    <Compare entity={system} view={view} />
    <Compare entity={chassis} view={view} />
    <Compare entity={bioTitan} view={view} />
    <Compare entity={crawler} view={view} />
    <Compare entity={equipment} view={view} />
  </div>
)
Gallery.args = { view: 'both' }
Gallery.argTypes = viewArgTypes

/**
 * PATTERN rendering — the pattern is the subject: the chassis name ("Little
 * Sestra") rides the seam as a stampseal, and the pattern's systems + modules
 * render as nested compact cards. Distinct from the basic ChassisCard above,
 * which shows the overview (ability + a pattern LIST).
 */
export const PatternCard: Story = () => (
  <div className="flex flex-col gap-4 bg-paper p-4">
    <code className="font-mono text-nano text-ink-2">
      NEW — {chassis.name} · {surveyorPattern.name}
    </code>
    <NEWReferenceEntityCard data={chassis} pattern={surveyorPattern} />
  </div>
)
