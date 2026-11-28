import type { CSSProperties, ElementType } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { getReferenceEntityName, toEntityModel } from 'salvageunion-reference'
import { ITEM_COLUMNS, itemRows } from '../../../build/dash/itemRows'
import { space } from '../../../design/tokens'
import { resolveModule } from '../../../lib/rules/mechItems'
import { referenceEntityCopy } from '../../../messages/components-reference-entity'
import { Slab } from '../../atoms/Slab'
import { MiniGrid } from '../../containers/MiniGrid'
import { Entity } from '../../entity/Entity'
import { Ledger } from '../../entity/Ledger'
import type { Down } from './cardChrome'
import { conditionOf } from './cardChrome'
import { cardKey } from './cardHelpers'
import type { NestedCardHost } from './NestedCards'
import type { ReferenceCardEntity } from './referenceEntityCardTypes'
import type { DroneLoadout, NestedGroup } from './resolveNestedEntities'

/**
 * `minWidth: 0` is load-bearing: a grid item defaults to `min-width: auto`, so
 * a column refuses to shrink below its widest badge and the card's
 * `overflow-hidden` hard-clips it. "Electro-Magnetic Shield Projector" plus
 * its TL tail overruns a two-column track.
 */
const columnStyle = {
  display: 'flex',
  minWidth: 0,
  flexDirection: 'column',
  gap: space[6],
} satisfies CSSProperties

/** One drone a block apart from the next: its parts end before the next one's Mini. */
const dronesStyle = { gap: space[12] } satisfies CSSProperties

/** A drone's Mini and, under it, its parts. */
const droneStyle = {
  display: 'flex',
  minWidth: 0,
  flexDirection: 'column',
  gap: space[4],
} satisfies CSSProperties

/**
 * A pattern's LOADOUT — its Systems and Modules groups SIDE BY SIDE, each a
 * Slab over its contentful Minis in a masonry grid (see `LoadoutMini`). Its
 * DRONES, when it fields any, run the full width under both (`PatternDrones`).
 *
 * One block, not one per group, because the two columns only line up if a
 * single grid owns both: a pattern installs far more systems than modules
 * (Thunder Storm, six to two), so stacked groups left the modules row alone
 * on a line under a mostly-empty one. Single column below `sm` — two columns
 * on a phone would each be too narrow to hold a system name.
 *
 * NO float handling here, deliberately: a pattern card takes the ASIDE LEAD,
 * which drops the float entirely, so this always renders full width beneath
 * the lead row.
 */
export function PatternLoadout({
  groups,
  drones = [],
  sectionAs,
  hostDown,
  owner,
}: {
  groups: NestedGroup[]
  /** The drones the pattern fields, each with its own systems and modules. */
  drones?: DroneLoadout[]
  sectionAs: ElementType | undefined
  hostDown: Down
  /**
   * Whose loadout, prefixed to each list's name ("Hauler Systems installed"):
   * a page lists many patterns, and a bare "Systems installed" would not say
   * which one a list belongs to.
   */
  owner?: string
}) {
  return (
    <div className="su-grid su-pattern-loadout">
      {groups.map((group) => (
        <div
          key={group.label}
          // A VERTICAL RULE between the columns (`column + column`). On the
          // column itself rather than a third grid cell, so it spans whichever
          // column is taller (Systems usually far outruns Modules) instead of
          // standing at the height of an empty divider track. Absent on the
          // first column and below `sm`, where the groups stack and the rule
          // would sit across the flow rather than between two columns.
          className="su-pattern-loadout__column"
          style={columnStyle}
        >
          <Slab label={group.label} as={sectionAs} />
          {/* A real LIST: the loadout is a countable set of installed parts, so
              a screen reader should announce "list, 6 items" rather than a run
              of anonymous links. Each Mini runs the column's width, its TL
              cell at the right edge (`.su-entity-mini-list`). */}
          <MiniGrid label={`${owner ? `${owner} ` : ''}${group.label} installed`}>
            {group.entities.map((item, itemIndex) => (
              <li key={cardKey(item, itemIndex)}>
                <LoadoutMini data={item} hostDown={hostDown} />
              </li>
            ))}
          </MiniGrid>
        </div>
      ))}
      {drones.length > 0 && (
        <PatternDrones drones={drones} sectionAs={sectionAs} hostDown={hostDown} owner={owner} />
      )}
    </div>
  )
}

/**
 * A pattern's DRONES, spanning both loadout columns: one Slab over
 * them, then each drone's Mini under the name the pattern gives it ("Shield
 * Drone"), and right beneath it that drone's own Systems then Modules, two Minis a line
 * with no Slab of their own (each Mini wears its kind). They sit after the
 * drone's Mini, never inside it: a Mini nests nothing (E6).
 */
function PatternDrones({
  drones,
  sectionAs,
  hostDown,
  owner,
}: {
  drones: DroneLoadout[]
  sectionAs: ElementType | undefined
  hostDown: Down
  owner?: string
}) {
  return (
    <div className="su-pattern-loadout__drones" style={columnStyle}>
      <Slab label={referenceEntityCopy('drones')} as={sectionAs} />
      <ul
        aria-label={referenceEntityCopy('dronesInstalled', { value: owner ? `${owner} ` : '' })}
        className="su-entity-mini-list"
        style={dronesStyle}
      >
        {drones.map((info, index) => {
          const parts = [...info.systems, ...info.modules]
          const name = info.instanceName ?? getReferenceEntityName(info.drone) ?? 'Drone'
          return (
            <li key={cardKey(info.drone, index)} style={droneStyle}>
              <LoadoutMini data={info.drone} title={info.instanceName} hostDown={hostDown} />
              {parts.length > 0 && (
                <ul
                  aria-label={`${name} loadout`}
                  className="su-grid su-entity-mini-list su-entity-mini-list--two-up"
                >
                  {parts.map((part, partIndex) => (
                    <li key={cardKey(part, partIndex)}>
                      <LoadoutMini data={part} hostDown={hostDown} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * `LoadoutMini` — one installed system/module in a pattern's loadout, on its
 * card and its Page alike: a CONTENTFUL Mini (N3, R39), its head
 * (`[kind] name [TL | n]`) and then
 * its text, in the loadout's masonry grid (`MiniGrid`). The part's tone reads
 * at a glance; the Mini opens its Page and Peeks its whole card.
 *
 * MULTIPLES REPEAT. Six machine guns are six lines, matching the loadout the
 * pattern actually installs (and `resolvePatternGroups`, which emits one entry
 * per copy) — a "x6" count would compress the shape of the build out of a list
 * whose whole job is showing it.
 *
 * Where it goes is the SURFACE's (the SRD's route, the app's Page opener). Its accessible name is the entity's alone,
 * never the TL glued onto it. Under a host that is down it greys, as the
 * host's band does.
 */
const LINK = { kind: 'link' } as const

function LoadoutMini({
  data,
  title,
  hostDown,
}: {
  data: ReferenceCardEntity
  /** The name the pattern gives this part, over its stat block's ("Shield Drone"). */
  title?: string
  hostDown?: Down
}) {
  const condition = hostDown ? conditionOf(hostDown) : undefined
  const instance = {
    ...(title ? { title } : {}),
    ...(condition ? { condition } : {}),
  }
  return (
    <Entity
      size="mini"
      context="loadout"
      entity={data as RefMetaEntity}
      mode={LINK}
      {...(title || condition ? { instance } : {})}
      body={{}}
    />
  )
}

const LOADOUT_PAGE = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
} satisfies CSSProperties

/**
 * A pattern PAGE's loadout, under its chassis ability. * each group (Systems, Modules) is the mech sheet's own list (`Ledger`
 * over `itemRows`): a zebra line a part, its figures in the sheet's columns,
 * its rules opening in place under it. A part fitted more than once is one
 * line with its count ("FM-3 Flamethrower ×2"), as the loadout table over it
 * counts it: the same rules printed twice told a reader nothing (RR-15).
 */
export function PatternLoadoutRows({
  groups,
  as: sectionAs,
}: {
  groups: NestedGroup[]
  /** The groups' heading element on a page (`sectionHeadingLevel`). */
  as: ElementType | undefined
  /** The pattern Page, level 0: its parts are the level-1 cards it nests. */
  host: NestedCardHost
}) {
  if (groups.length === 0) return null
  return (
    <div className="su-entity-page__loadout" style={LOADOUT_PAGE}>
      {groups.map((group) => {
        const slugs = group.entities.map((item) => toEntityModel(item as RefMetaEntity).ref.slug)
        const modules = slugs.every((slug) => resolveModule(slug) !== null)
        const counts = new Map<string, number>()
        for (const slug of slugs) counts.set(slug, (counts.get(slug) ?? 0) + 1)
        const once = [...counts.keys()]
        const fitted = { systems: modules ? [] : once, modules: modules ? once : [] }
        const rows = itemRows(fitted, modules ? 'module' : 'system').map((row, index) => {
          const count = counts.get(once[index] ?? '') ?? 1
          return count > 1 && typeof row.name === 'string'
            ? { ...row, name: `${row.name} ×${count}` }
            : row
        })
        return (
          <Ledger
            open
            key={group.label}
            className="su-open--loadout"
            // A reference Page shows its whole self: every row's rules open (R43).
            whole
            title={group.label}
            as={sectionAs ?? 'h2'}
            columns={ITEM_COLUMNS}
            groups={[{ key: group.label, rows }]}
          />
        )
      })}
    </div>
  )
}
