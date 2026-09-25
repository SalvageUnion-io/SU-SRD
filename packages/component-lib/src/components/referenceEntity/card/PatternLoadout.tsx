import type { ElementType } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { getReferenceEntityName } from 'salvageunion-reference'
import { cn } from '../../../utils/cn'
import { FOCUS_RING } from '../../chrome/interaction'
import { Slab } from '../../chrome/Slab'
import { useEntityHref } from '../entityHrefContext'
import { cardKey } from './cardHelpers'
import type { NestedCard, ReferenceCardEntity } from './referenceEntityCardTypes'
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
 * the lead row. (An earlier revision took a `flat` argument and documented how
 * the grid would sit beside the floated artwork. Once patterns moved below the
 * fold that state became unreachable — `flat` is `hasAnchor && !asideLead`,
 * and a pattern's `asideLead` is gated on the same artwork — so the parameter
 * was dead and the comment described a layout that can no longer happen.)
 */
export function PatternLoadout({
  groups,
  sectionAs,
  hostDown,
  NestedCard,
}: {
  groups: NestedGroup[]
  sectionAs: ElementType | undefined
  hostDown: boolean
  NestedCard: NestedCard
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
                <LoadoutBadge data={item} hostDown={hostDown} NestedCard={NestedCard} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/**
 * `LoadoutBadge` — one installed system/module in a pattern's loadout, rendered
 * as the card's own SHORTFORM token (`size="small" extent="head"`) and linking
 * to that entity's page.
 *
 * A pattern is a BUILD LIST, not rules to read: its systems and modules are
 * ordinary catalogue entities whose full text lives on their own pages, and
 * printing all of it inline made the loadout the longest thing on the page
 * while burying what the pattern itself says — Atlas's Thunder Storm expanded
 * to six identical, full-length .50 Cal Machine Gun cards. The shortform badge
 * gives the build at a glance and one click through to any entry.
 *
 * The badge is the card at its smallest rung, NOT a hand-assembled chip: it
 * carries the entity's own tone band and classification tail, so the tone and
 * tech-level read survive the compression for free.
 *
 * MULTIPLES REPEAT. Six machine guns are six badges, matching the loadout the
 * pattern actually installs (and `resolvePatternGroups`, which emits one entry
 * per copy) — a "×6" count would compress the shape of the build out of a row
 * whose whole job is showing it.
 *
 * A real `<a>`, for the same reasons as `PatternListRow`: middle-click, hover
 * preview, crawlable. With no `EntityHrefProvider` above it the badge renders
 * inert rather than linking nowhere.
 */
function LoadoutBadge({
  data,
  hostDown,
  NestedCard,
}: {
  data: ReferenceCardEntity
  hostDown?: boolean
  NestedCard: NestedCard
}) {
  const href = useEntityHref(data as SURefEntity)
  const badge = (
    <NestedCard
      data={data}
      size="small"
      extent="head"
      depth={1}
      hostDown={hostDown}
      cardClickable={!!href}
    />
  )
  if (!href) return badge
  return (
    // An explicit accessible name, for the same reason `PatternListRow` carries
    // one: without it the anchor's name is scraped from the badge's contents and
    // reads ".50 Cal Machine Gun TL 1" — the tech-level tail glued onto the name,
    // six identical times over on Thunder Storm.
    <a
      href={href}
      aria-label={getReferenceEntityName(data)}
      className={cn('block rounded-card', FOCUS_RING)}
    >
      {badge}
    </a>
  )
}
