import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntityRow } from './EntityRow'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Entity Row',
}

// The mech row is a LIVE chassis fixture (name + pattern + TL/SP straight from
// the ORM). The pilot and crawler are player-build shapes — no reference entity
// backs a saved pilot/crawler instance — so they're named from real SU data
// (a real Class, a real Crawler type) with player-side vitals.
const mech = SalvageUnionReference.Chassis.all()[0]
const pilotClass = SalvageUnionReference.Classes.all()[0]
const crawlerType = SalvageUnionReference.Crawlers.all()[0]

/**
 * A roster column: three saved builds — a pilot, a mech, and a crawler — each a
 * header-only listing row keyed to its ontology tone. The mech reads live from
 * the first chassis fixture; the pilot/crawler are player builds named from a
 * real Class and Crawler type.
 */
export const Default: Story = () => (
  <div className="max-w-md bg-paper p-5">
    <ul className="flex list-none flex-col gap-2.5">
      <li>
        <EntityRow
          entityType="pilot"
          name="Ace"
          meta={pilotClass?.name ?? 'Pilot'}
          stats={[{ label: 'HP', value: 16 }]}
          sheetHref="#/pilot/ace"
          onDeleteClick={() => {}}
        />
      </li>
      <li>
        <EntityRow
          entityType="mech"
          name={`${mech?.name ?? 'Mule'} — ${mech?.patterns?.[0]?.name ?? 'Hauler Pattern'}`}
          stats={[
            { label: 'TL', value: mech?.techLevel ?? 1 },
            { label: 'SP', value: mech?.structurePoints ?? 12 },
          ]}
          sheetHref="#/mech/mule"
          onDeleteClick={() => {}}
        />
      </li>
      <li>
        <EntityRow
          entityType="crawler"
          name={crawlerType?.name ?? 'Union Crawler'}
          stats={[
            { label: 'TL', value: 1 },
            { label: 'SP', value: 20 },
          ]}
          sheetHref="#/crawler/hamlet"
          onDeleteClick={() => {}}
        />
      </li>
    </ul>
  </div>
)

/**
 * The `empty` variant — a dashed placeholder slot for an unfilled link. Keeps
 * the ontology tone wash + a black role tab and the default per-ontology
 * missing-entity glyph, over a helper message and optional create action.
 */
export const Empty: Story = () => (
  <div className="flex max-w-md flex-col gap-2.5 bg-paper p-5">
    <EntityRow
      empty
      entityType="mech"
      roleLabel="Assigned Mech"
      message="No mech assigned — build one to track its loadout and heat from here."
      actions={
        <a
          href="#/mech/new"
          className="rounded-card border-chrome border-ink bg-paper px-3 py-1 text-center font-body text-sm text-ink no-underline"
        >
          + Create
        </a>
      }
    />
    <EntityRow
      empty
      entityType="crawler"
      roleLabel="Home Crawler"
      message="No crawler linked — the assigned pilot's home crawler appears here."
    />
  </div>
)
