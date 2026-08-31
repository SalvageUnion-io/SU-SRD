/* Ported from packages/component-lib/src/components/shared/EntityRow.stories.tsx. */
import { EntityRow } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'

/**
 * A roster column: three saved builds — a pilot, a mech and a crawler — each a
 * header-only listing row keyed to its ontology tone. The mech reads live from
 * the first chassis fixture; the pilot and crawler are player builds (no
 * reference entity backs a saved instance) named from a real Class and Crawler
 * type.
 */
export function Roster() {
  const mech = SalvageUnionReference.Chassis.all()[0]
  const pilotClass = SalvageUnionReference.Classes.all()[0]
  const crawlerType = SalvageUnionReference.Crawlers.all()[0]
  return (
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
            name={`${mech?.name ?? 'Mule'} — ${mech?.patterns?.[0]?.name ?? 'Hauler'}`}
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
}

/**
 * The `game` ontology — a shared table, listed as a peer of the player builds.
 * Blue rail, and three toned badges instead of one: the Game's communal
 * crawler, its pilot count, its mech count. `meta` takes an array to carry them.
 */
export function Games() {
  const crawlerType = SalvageUnionReference.Crawlers.all()[0]
  return (
    <div className="max-w-md bg-paper p-5">
      <ul className="flex list-none flex-col gap-2.5">
        <li>
          <EntityRow
            entityType="game"
            name="Union Crawler #430"
            meta={[crawlerType?.name ?? 'Crawler', '4 Pilots', '3 Mechs']}
            metaLine="Mediator · started from the Starter Set"
            sheetHref="#/games/430"
          />
        </li>
        <li>
          <EntityRow
            entityType="game"
            name="Thursday Night Salvage"
            meta={['No crawler', '0 Pilots', '0 Mechs']}
            metaLine="Player · organized by Vex"
            sheetHref="#/games/thursday"
          />
        </li>
      </ul>
    </div>
  )
}

/**
 * The `empty` variant — a dashed placeholder for an unfilled link. Keeps the
 * ontology tone wash and a black role tab, over a helper message and an
 * optional create action.
 */
export function EmptySlots() {
  return (
    <div className="flex max-w-md flex-col gap-2.5 bg-paper p-5">
      <EntityRow
        empty
        entityType="game"
        roleLabel="Game"
        message="You are not in any games yet — start one, or join with a code."
      />
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
}
