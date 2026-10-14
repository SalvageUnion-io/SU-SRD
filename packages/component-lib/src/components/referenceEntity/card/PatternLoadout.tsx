import type { CSSProperties, ElementType } from 'react'
import type { SURefEntity, SURefMetaEntity } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import { Entity } from '../../../entity/Entity'
import { cn } from '../../../utils/cn'
import { Slab } from '../../atoms/Slab'
import { useEntityHref } from '../entityHrefContext'
import type { Down } from './cardChrome'
import { conditionOf } from './cardChrome'
import { cardKey } from './cardHelpers'
import type { ReferenceCardEntity } from './referenceEntityCardTypes'
import type { NestedGroup } from './resolveNestedEntities'

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

/**
 * A pattern's LOADOUT — its Systems and Modules groups SIDE BY SIDE, each a
 * dashed Slab over one full-width Token a line (see `LoadoutToken`).
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
  sectionAs,
  hostDown,
  owner,
}: {
  groups: NestedGroup[]
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
      {groups.map((group, index) => (
        <div
          key={group.label}
          // A VERTICAL RULE between the columns (`--ruled`). On the column
          // itself rather than a third grid cell, so it spans whichever column
          // is taller (Systems usually far outruns Modules) instead of standing
          // at the height of an empty divider track. Suppressed on the first
          // column and below `sm`, where the groups stack and the rule would
          // sit across the flow rather than between two columns.
          className={cn(index > 0 && 'su-pattern-loadout__column--ruled')}
          style={columnStyle}
        >
          <Slab variant="dashed" label={group.label} as={sectionAs} />
          {/* A real LIST: the loadout is a countable set of installed parts, so
              a screen reader should announce "list, 6 items" rather than a run
              of anonymous links. Each Token runs the column's width, its TL
              cell at the right edge (`.su-entity-token-list`). */}
          <ul
            aria-label={`${owner ? `${owner} ` : ''}${group.label} installed`}
            className="su-entity-token-list"
          >
            {group.entities.map((item, itemIndex) => (
              <li key={cardKey(item, itemIndex)}>
                <LoadoutToken data={item} hostDown={hostDown} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/**
 * `LoadoutToken` — one installed system/module in a pattern's loadout: a
 * TOKEN (`[kind] name [TL | n]`) running the list's full width, one part a
 * line (entity display language, "Which form, where"). The part's tone reads
 * at a glance; the Token opens its Page and Peeks its whole card; its name
 * wraps, never clipped (E18).
 *
 * A pattern is a BUILD LIST, not rules to read: its systems and modules are
 * ordinary catalogue entities whose full text lives on their own pages, so the
 * loadout names them rather than printing every card in full.
 *
 * MULTIPLES REPEAT. Six machine guns are six lines, matching the loadout the
 * pattern actually installs (and `resolvePatternGroups`, which emits one entry
 * per copy) — a "x6" count would compress the shape of the build out of a list
 * whose whole job is showing it.
 *
 * Where it goes is the host's route (`useEntityHref`), else the SURFACE's (the
 * SRD's route, ITUN's Page opener). Its accessible name is the entity's alone,
 * never the TL glued onto it. Under a host that is down it greys, as the
 * host's band does.
 */
export function LoadoutToken({ data, hostDown }: { data: ReferenceCardEntity; hostDown?: Down }) {
  const href = useEntityHref(data as SURefEntity)
  return (
    <Entity
      form="token"
      entity={data as SURefMetaEntity}
      mode={href ? { kind: 'link', href } : { kind: 'link' }}
      {...(hostDown ? { instance: { condition: conditionOf(hostDown) } } : {})}
    />
  )
}

const LOADOUT_PAGE: CSSProperties = { display: 'flex', flexDirection: 'column', gap: space[16] }

const LOADOUT_GROUP: CSSProperties = { display: 'flex', flexDirection: 'column', gap: space[8] }

/**
 * A pattern PAGE's loadout, under its chassis ability: each group (Systems,
 * Modules) a solid Slab over one full-width Token a line, as on the pattern's
 * card (`LoadoutToken`): each opens its page and Peeks its whole card.
 */
export function PatternLoadoutRows({
  groups,
  as: sectionAs,
  hostDown,
}: {
  groups: NestedGroup[]
  /** The groups' heading element on a page (`sectionHeadingLevel`). */
  as: ElementType | undefined
  hostDown: Down
}) {
  if (groups.length === 0) return null
  return (
    <div className="su-entity-page__loadout" style={LOADOUT_PAGE}>
      {groups.map((group) => (
        <section key={group.label} style={LOADOUT_GROUP}>
          <Slab variant="solid" as={sectionAs} label={group.label} />
          <ul aria-label={`${group.label} installed`} className="su-entity-token-list">
            {group.entities.map((item, index) => (
              <li key={cardKey(item, index)}>
                <LoadoutToken data={item} hostDown={hostDown} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
