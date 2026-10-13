import type { CSSProperties, ElementType } from 'react'
import { useMemo } from 'react'
import type { SURefEntity, SURefMetaEntity } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import { Entity } from '../../../entity/Entity'
import { Mention } from '../../../entity/forms/Mention'
import { cn } from '../../../utils/cn'
import { Slab } from '../../atoms/Slab'
import { Stat } from '../../atoms/Stat'
import { useEntityHref } from '../entityHrefContext'
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
 * The book's plain list (Core Book p.101: a SYSTEMS / MODULES column of names):
 * one part a line, never a wrap of pills. Each line is a `.su-loadout-entry`,
 * which takes the 44px coarse-pointer floor.
 */
const entryListStyle = {
  display: 'flex',
  flexDirection: 'column',
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

/**
 * A pattern's LOADOUT — its Systems and Modules groups SIDE BY SIDE, each a
 * dashed Slab over the book's plain list of names (see `LoadoutMention`).
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
  fill = false,
  owner,
}: {
  groups: NestedGroup[]
  sectionAs: ElementType | undefined
  hostDown: boolean
  /**
   * Each line the column's full width, its TL badge at the right edge
   * (`.su-pattern-loadout--fill`): a pattern's card in its host's list on a
   * page, where the card spans the page and the badges are easier to scan in a
   * column of their own than ragged after each name.
   */
  fill?: boolean
  /**
   * Whose loadout, prefixed to each list's name ("Hauler Systems installed"):
   * a page lists many patterns, and a bare "Systems installed" would not say
   * which one a list belongs to.
   */
  owner?: string
}) {
  return (
    <div
      className={fill ? 'su-pattern-loadout su-pattern-loadout--fill' : 'su-pattern-loadout'}
      style={gridStyle}
    >
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
              of anonymous links. `listStyle: none` keeps the markers off. */}
          <ul
            aria-label={`${owner ? `${owner} ` : ''}${group.label} installed`}
            style={entryListStyle}
          >
            {group.entities.map((item, itemIndex) => (
              <li key={cardKey(item, itemIndex)} style={{ minWidth: 0 }}>
                <LoadoutMention data={item} hostDown={hostDown} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/**
 * `LoadoutMention` — one installed system/module in a pattern's loadout, as
 * the book prints it (Core Book p.101: a plain SYSTEMS / MODULES list of
 * names): a MENTION (E4) of the part, then its Tech Level in a framed Stat.
 *
 * A pattern is a BUILD LIST, not rules to read: its systems and modules are
 * ordinary catalogue entities whose full text lives on their own pages, and
 * printing all of it inline made the loadout the longest thing on the page
 * while burying what the pattern itself says — Atlas's Thunder Storm expanded
 * to six identical, full-length .50 Cal Machine Gun cards. The name gives the
 * build at a glance, the Peek the whole card, and one click its Page.
 *
 * NOT a Token: a chassis page prints every pattern's loadout, and nine
 * TL-toned pills a pattern painted the Mule's page a long block of saturated
 * blue under its green band. The part's tone stays where the part is the
 * subject — its own Row, Card and Page; here it is one line of ink, and the TL
 * reads from the framed `[TL | n]` cell, ink on paper whatever the tone.
 *
 * MULTIPLES REPEAT. Six machine guns are six lines, matching the loadout the
 * pattern actually installs (and `resolvePatternGroups`, which emits one entry
 * per copy) — a "×6" count would compress the shape of the build out of a list
 * whose whole job is showing it.
 *
 * Where the name goes is the SURFACE's (`Mention`): the SRD's route, ITUN's
 * Page opener, or an inert word that still Peeks. Its accessible name is the
 * entity's alone, never the TL glued onto it (".50 Cal Machine Gun TL 1", six
 * times over on Thunder Storm). Each line is `.su-loadout-entry`: 44px tall
 * under a coarse pointer, the name's hit area the line's full height.
 */
export function LoadoutMention({
  data,
  hostDown,
}: {
  data: ReferenceCardEntity
  hostDown?: boolean
}) {
  const model = useMemo(() => toEntityModel(data as SURefMetaEntity), [data])
  return (
    <span className="su-loadout-entry" data-down={hostDown || undefined}>
      <Mention entityRef={model.ref}>{model.title}</Mention>
      {model.techLevel != null && (
        <Stat orientation="horizontal" label="TL" value={String(model.techLevel)} size="mini" />
      )}
    </span>
  )
}

const LOADOUT_PAGE: CSSProperties = { display: 'flex', flexDirection: 'column', gap: space[16] }

const LOADOUT_GROUP: CSSProperties = { display: 'flex', flexDirection: 'column', gap: space[8] }

/** Rows two or three abreast as the column allows, every one of a group the same height. */
const LOADOUT_ROWS: CSSProperties = {
  display: 'grid',
  gap: space[8],
  gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))',
  listStyle: 'none',
  margin: 0,
  padding: 0,
}

/**
 * A pattern PAGE's loadout, under its stats: each group (Systems, Modules) a
 * solid Slab with its count over a grid of ROWS, where the card lists names.
 * On its own page the build is the subject, so each part shows its
 * head and facts, links to its page and Peeks its whole card (the Row's
 * `peek`). No art column: the page's hero is the pattern's.
 */
export function PatternLoadoutRows({
  groups,
  as: sectionAs,
  hostDown,
}: {
  groups: NestedGroup[]
  /** The groups' heading element on a page (`sectionHeadingLevel`). */
  as: ElementType | undefined
  hostDown: boolean
}) {
  if (groups.length === 0) return null
  return (
    <div className="su-entity-page__loadout" style={LOADOUT_PAGE}>
      {groups.map((group) => (
        <section key={group.label} style={LOADOUT_GROUP}>
          <Slab variant="solid" as={sectionAs} label={group.label} />
          <ul aria-label={`${group.label} installed`} data-entity-grid="" style={LOADOUT_ROWS}>
            {group.entities.map((item, index) => (
              <li key={cardKey(item, index)} style={{ minWidth: 0 }}>
                <LoadoutRow data={item} hostDown={hostDown} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function LoadoutRow({ data, hostDown }: { data: ReferenceCardEntity; hostDown: boolean }) {
  const href = useEntityHref(data as SURefEntity)
  return (
    <Entity
      form="row"
      entity={data as SURefMetaEntity}
      mode={href ? { kind: 'link', href } : { kind: 'read' }}
      omit={['art']}
      peek
      {...(hostDown ? { instance: { condition: 'damaged' as const } } : {})}
    />
  )
}
