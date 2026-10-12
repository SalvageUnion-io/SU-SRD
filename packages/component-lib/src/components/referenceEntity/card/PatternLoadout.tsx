import type { ElementType } from 'react'
import type { SURefEntity, SURefMetaEntity } from 'salvageunion-reference'
import { Entity } from '../../../entity/Entity'
import { cn } from '../../../utils/cn'
import { Slab } from '../../chrome/Slab'
import { useEntityHref } from '../entityHrefContext'
import { cardKey } from './cardHelpers'
import type { ReferenceCardEntity } from './referenceEntityCardTypes'
import type { NestedGroup } from './resolveNestedEntities'

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
}: {
  groups: NestedGroup[]
  sectionAs: ElementType | undefined
  hostDown: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-2">
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
            aria-label={`${group.label} installed`}
            className="flex list-none flex-wrap items-start gap-1.5"
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
