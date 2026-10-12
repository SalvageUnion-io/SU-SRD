import type { CSSProperties, ElementType } from 'react'
import type { SURefEntity, SURefMetaEntity } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import { Entity } from '../../../entity/Entity'
import { cn } from '../../../utils/cn'
import { Slab } from '../../chrome/Slab'
import { useEntityHref } from '../entityHrefContext'
import { cardKey } from './cardHelpers'
import type { ReferenceCardEntity } from './referenceEntityCardTypes'
import type { NestedGroup } from './resolveNestedEntities'

/** `fill`: the list stacks its Tokens and stretches each across the column. */
const FILL_LIST: CSSProperties = { alignItems: 'stretch', flexDirection: 'column' }

/**
 * A pattern's LOADOUT — its Systems and Modules groups SIDE BY SIDE, each a
 * dashed Slab over a wrap of shortform badges (see `LoadoutBadge`).
 *
 * One block, not one per group, because the two columns only line up if a
 * single grid owns both: a pattern installs far more systems than modules
 * (Thunder Storm, six to two), so stacked groups left the modules row alone
 * on a line under a mostly-empty one. Single column below `sm` — two columns
 * of badges on a phone would each be too narrow to hold a system name.
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
   * One Token a line, each the column's full width (`.su-pattern-loadout--fill`):
   * a pattern's card in its host's list on a page, where the card spans the
   * page and a wrap of short Tokens would leave each column ragged.
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
      className={cn(
        'grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-2',
        fill && 'su-pattern-loadout--fill'
      )}
    >
      {groups.map((group, index) => (
        <div
          key={group.label}
          className={cn(
            // `min-w-0` is load-bearing: a grid item defaults to `min-width:
            // auto`, so a column refuses to shrink below its widest badge and
            // the card's `overflow-hidden` hard-clips it. "Electro-Magnetic
            // Shield Projector" plus its TL tail overruns a two-column track.
            'flex min-w-0 flex-col gap-1.5',
            // A VERTICAL RULE between the columns. On the column itself rather
            // than a third grid cell, so it spans whichever column is taller
            // (Systems usually far outruns Modules) instead of standing at the
            // height of an empty divider track. Suppressed on the first column
            // and below `sm`, where the groups stack and the rule would sit
            // across the flow rather than between two columns.
            index > 0 && 'sm:border-l-chrome sm:border-ink/20 sm:pl-3'
          )}
        >
          <Slab variant="dashed" label={group.label} as={sectionAs} />
          {/* A real LIST: the loadout is a countable set of installed parts, so
              a screen reader should announce "list, 6 items" rather than a run
              of anonymous links. `list-none` keeps the markers off. */}
          <ul
            aria-label={`${owner ? `${owner} ` : ''}${group.label} installed`}
            className="flex list-none flex-wrap items-start gap-1.5"
            style={fill ? FILL_LIST : undefined}
          >
            {group.entities.map((item, itemIndex) => (
              <li key={cardKey(item, itemIndex)} className="min-w-0">
                <LoadoutBadge data={item} hostDown={hostDown} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/**
 * `LoadoutBadge` — one installed system/module in a pattern's loadout: a
 * TOKEN (E3), in link mode to that entity's page.
 *
 * A pattern is a BUILD LIST, not rules to read: its systems and modules are
 * ordinary catalogue entities whose full text lives on their own pages, and
 * printing all of it inline made the loadout the longest thing on the page
 * while burying what the pattern itself says — Atlas's Thunder Storm expanded
 * to six identical, full-length .50 Cal Machine Gun cards. The shortform badge
 * gives the build at a glance and one click through to any entry.
 *
 * The Token is the entity form for many on a line, NOT a hand-assembled chip:
 * it carries the entity's own tone and its one fact (TL), so the tone and
 * tech-level read survive the compression for free.
 *
 * MULTIPLES REPEAT. Six machine guns are six badges, matching the loadout the
 * pattern actually installs (and `resolvePatternGroups`, which emits one entry
 * per copy) — a "×6" count would compress the shape of the build out of a row
 * whose whole job is showing it.
 *
 * A real `<a>`, for the same reasons as `PatternListRow`: middle-click, hover
 * preview, crawlable. With no `EntityHrefProvider` above it the Token renders
 * inert rather than linking nowhere.
 */
export function LoadoutBadge({
  data,
  hostDown,
}: {
  data: ReferenceCardEntity
  hostDown?: boolean
}) {
  const href = useEntityHref(data as SURefEntity)
  return (
    <Entity
      form="token"
      entity={data as SURefMetaEntity}
      // The Token's own accessible name is the entity's: never the tail glued
      // onto it (".50 Cal Machine Gun TL 1", six times over on Thunder Storm).
      mode={href ? { kind: 'link', href } : { kind: 'read' }}
      {...(hostDown ? { instance: { condition: 'damaged' as const } } : {})}
    />
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
 * solid Slab with its count over a grid of ROWS, one form up from the card's
 * Tokens. On its own page the build is the subject, so each part shows its
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
