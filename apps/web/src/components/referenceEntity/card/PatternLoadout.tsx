import type { CSSProperties, ElementType } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { getReferenceEntityName } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import { Slab } from '../../atoms/Slab'
import { SlabSection } from '../../containers/SlabSection'
import { TokenGrid } from '../../containers/TokenGrid'
import { Entity } from '../../entity/Entity'
import type { Down } from './cardChrome'
import { conditionOf } from './cardChrome'
import { cardKey } from './cardHelpers'
import type { NestedCardHost } from './NestedCards'
import type { ReferenceCardEntity } from './referenceEntityCardTypes'
import type { DroneLoadout, NestedGroup } from './resolveNestedEntities'

/** The loadout grid's static half; its column count is `.su-pattern-loadout`. */
const gridStyle = {
  display: 'grid',
  columnGap: space[12],
  rowGap: space[6],
} satisfies CSSProperties

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

/** One drone a block apart from the next: its parts end before the next one's Token. */
const dronesStyle = { gap: space[12] } satisfies CSSProperties

/** A drone's Token and, under it, its parts. */
const droneStyle = {
  display: 'flex',
  minWidth: 0,
  flexDirection: 'column',
  gap: space[4],
} satisfies CSSProperties

/**
 * A pattern's LOADOUT — its Systems and Modules groups SIDE BY SIDE, each a
 * Slab over its contentful Tokens in a masonry grid (see `LoadoutToken`). Its
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
    <div className="su-pattern-loadout" style={gridStyle}>
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
              of anonymous links. Each Token runs the column's width, its TL
              cell at the right edge (`.su-entity-token-list`). */}
          <TokenGrid label={`${owner ? `${owner} ` : ''}${group.label} installed`}>
            {group.entities.map((item, itemIndex) => (
              <li key={cardKey(item, itemIndex)}>
                <LoadoutToken data={item} hostDown={hostDown} />
              </li>
            ))}
          </TokenGrid>
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
 * them, then each drone's Token under the name the pattern gives it ("Shield
 * Drone"), and right beneath it that drone's own Systems then Modules, two Tokens a line
 * with no Slab of their own (each Token wears its kind). They sit after the
 * drone's Token, never inside it: a Token nests nothing (E6).
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
      <Slab label="Drones" as={sectionAs} />
      <ul
        aria-label={`${owner ? `${owner} ` : ''}Drones installed`}
        className="su-entity-token-list"
        style={dronesStyle}
      >
        {drones.map((info, index) => {
          const parts = [...info.systems, ...info.modules]
          const name = info.instanceName ?? getReferenceEntityName(info.drone) ?? 'Drone'
          return (
            <li key={cardKey(info.drone, index)} style={droneStyle}>
              <LoadoutToken data={info.drone} title={info.instanceName} hostDown={hostDown} />
              {parts.length > 0 && (
                <ul
                  aria-label={`${name} loadout`}
                  className="su-entity-token-list su-entity-token-list--two-up"
                >
                  {parts.map((part, partIndex) => (
                    <li key={cardKey(part, partIndex)}>
                      <LoadoutToken data={part} hostDown={hostDown} />
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
 * `LoadoutToken` — one installed system/module in a pattern's loadout, on its
 * card and its Page alike: a CONTENTFUL Token (N3; owner's call, 2026-10-20:
 * "all of em, contentful tokens"), its head (`[kind] name [TL | n]`) and then
 * its text, in the loadout's masonry grid (`TokenGrid`). The part's tone reads
 * at a glance; the Token opens its Page and Peeks its whole card.
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

function LoadoutToken({
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
      form="token"
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
 * A pattern PAGE's loadout, under its chassis ability: each group (Systems,
 * Modules) a solid Slab over its parts, each a contentful Token in a masonry
 * grid (`LoadoutToken`, owner's call, 2026-10-20), as a mech's sheet draws
 * them. Multiples repeat, as on the card's loadout.
 */
export function PatternLoadoutRows({
  groups,
  as: sectionAs,
  host,
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
      {groups.map((group) => (
        <SlabSection as={sectionAs} title={group.label} page key={group.label}>
          <TokenGrid label={`${group.label} installed`}>
            {group.entities.map((item, index) => (
              <li key={cardKey(item, index)}>
                <LoadoutToken data={item} hostDown={host.isDown} />
              </li>
            ))}
          </TokenGrid>
        </SlabSection>
      ))}
    </div>
  )
}
