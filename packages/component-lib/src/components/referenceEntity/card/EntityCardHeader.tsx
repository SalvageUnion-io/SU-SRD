import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'
import { accentSurface } from '../referenceEntityHelpers'
import { EntityCardStatBox } from './EntityCardStatBox'
import type { StatItem } from '../../shared/statsBarTypes'

type EntityCardHeaderProps = {
  title: string
  /** Domain/tech-level/rust tone — a Tailwind bg class. */
  bg: string | undefined
  /** Raw CSS colour override (navy monster / rust action / dynamic per-source accent). */
  bgColor: string | undefined
  /** Title type-scale class from the DEPTH ladder (steps down per nesting level). */
  titleClass: string
  /** On-tone text colour class for the title, which sits directly on the header
   * band (`text-ink` / `text-paper` — resolved against the band tone). */
  titleTextClass?: string
  /** Write layer: a full replacement node for the title (overrides the name-tab). */
  titleSlot?: ReactNode
  /** SEO: render the name-tab as an `h1` (item pages) instead of the default `span`. */
  titleAs?: 'span' | 'h1'
  /** The full header stat cluster (all stats), clustered + wrapping top-right. */
  stats: StatItem[]
  /** Top-right flavor slot — white hint text (an ability's `description`), shown
   * when the entity has no numeric vitals occupying the axis. */
  rightContent?: ReactNode
  /** Listing mode: header stats render as horizontal cells (up to ~2 rows). */
  listing?: boolean
  compact?: boolean
}

/** Title column beside flavour PROSE. Base = its own content width, so a name
 * that fits beside the description's ask keeps its single line; `shrink-[20]`
 * makes it absorb the overflow past that. No `min-w-0` (min-content floor — it
 * wraps at spaces, never mid-word) and a loose ceiling that won't clamp that
 * floor. The full rationale + measurements live in the width-allocation comment
 * below; this is shared so the compact and full rows can't drift apart. */
const TITLE_VS_PROSE = 'max-w-[75%] shrink-[20]'
/** Description column: asks for 55% of the band, grows past it when the title
 * doesn't need its share, and yields below it when the title's longest word
 * demands the room. */
const PROSE_COLUMN = 'flex-[1_1_55%]'

/**
 * EntityCardHeader — the unified card's HEADER band (the tone).
 *
 * Left: the title as PLAIN on-tone text (the badge treatment — no ink name-tab
 * block) that HUGS its text (`w-fit`, never full-width), sized by the DEPTH
 * ladder and coloured by `titleTextClass` to read against the band. Right: the
 * header axis cluster — an optional cost node (action AP box) then the headline
 * `Stat` boxes (`EntityCardStatBox`), wrapping; or a `rightContent` flavor line
 * (white ability hint) when the axis is free.
 */
export function EntityCardHeader({
  title,
  bg,
  bgColor,
  titleClass,
  titleTextClass = 'text-ink',
  titleSlot,
  titleAs,
  stats,
  rightContent,
  listing = false,
  compact = false,
}: EntityCardHeaderProps) {
  const accent = accentSurface(bg, bgColor)

  const TitleTag = titleAs ?? 'span'
  const titleNode = titleSlot ?? (
    <TitleTag
      className={cn(
        // The title sits directly on the tone (badge treatment — no ink block).
        // `self-center` keeps it centered against the band height; it always sits
        // LEFT (its row uses justify-between); self-* is cross-axis only.
        // `break-words` guarantees even an unbreakable long token wraps rather
        // than running under the stat cluster.
        'w-fit self-center break-words font-cond font-bold uppercase leading-none tracking-caps-tight',
        titleTextClass,
        titleClass
      )}
    >
      {title}
    </TitleTag>
  )
  const statsNode =
    stats.length > 0 ? <EntityCardStatBox stats={stats} compact={compact || listing} /> : null

  // WIDTH ALLOCATION — who yields depends on WHAT occupies the right side.
  // This rule has regressed in three directions (title under the stats, title
  // wrapping beside an empty right side, title starved to one letter per line
  // by flavour prose); EntityCardHeader.test.tsx pins all of them.
  // - EMPTY → the title owns the full row. Reserving ~40% for a cluster that
  //   isn't there forced needless wraps ("Coolant Flush" on two lines).
  // - STAT CLUSTER only → stats are bounded, so they RESERVE their content
  //   width and the title yields into the remainder (the original
  //   title-overlapping-the-stats fix — kept).
  // - FLAVOUR PROSE → the description ASKS for 55% (`flex-[1_1_55%]`) and the
  //   title yields into what's left, but only once it has to. The title's flex
  //   base is its own content width, so while it fits in the remaining ~45% it
  //   is untouched and keeps its single line; past that the shrink factor (20×
  //   the description's) makes it absorb essentially all the overflow, wrapping
  //   down toward its longest word instead of holding a share it isn't filling.
  //
  //   That last part is the fix. A name too long for one line used to sit at
  //   the flat 60% cap and wrap INSIDE it, so "Mass Field Maintenance" showed
  //   two lines of title, four of description, and a ~110px dead channel down
  //   the middle. Measured in-browser over the Engineer + Fabricator trees at
  //   1440/768/390: the two worst cards drop from 4 description lines to 2–3,
  //   total header height falls 680px→648px, and every title that already fit
  //   on one line still does.
  //
  //   55% is a safe ask because a description is never short — across the 100
  //   abilities that carry one the minimum is 34 characters (median 67), which
  //   wants more than half the band at every card width.
  //
  //   Two details are load-bearing, both learned by measuring:
  //   · The title has NO `min-w-0`, so its automatic minimum is min-content and
  //     it can be squeezed to one word per line but never INTO one. Without it
  //     `break-words` splits names mid-word ("ENGINEERIN / G EXPERTISE").
  //   · The 75% ceiling is deliberately loose. `max-width` also clamps that
  //     min-content floor, so the old 60% cap re-introduced mid-word breaks on
  //     narrow cards — at 768px it split "Engineerin|g" and "Maintenan|ce"
  //     before this change too. The description's ask, not the ceiling, is what
  //     bounds the title in practice.
  //   · The ask is a BASIS, not a `min-width`: a hard floor cannot yield to
  //     that min-content floor, and the two together overflow the card on
  //     narrow screens.
  const hasProse = !!rightContent
  const hasRight = !!(rightContent || statsNode)

  // COMPACT: the title + flavor/stat cluster share ONE row and split the width
  // dynamically — the cluster never wraps beneath the title, each side wraps
  // WITHIN its own space. Against a bounded STAT cluster the title takes up to
  // 60% and the cluster (flex-1, basis 0 — so it can never starve the title)
  // takes the rest; against PROSE the description asks for 55% and the title
  // yields (see the rule above); with nothing beside it the title takes the
  // full row.
  if (compact) {
    return (
      <div
        className={cn(
          // items-center so the (usually one-line) title centers vertically
          // against a taller wrapped flavor/stat cluster.
          'flex w-full min-w-0 items-center gap-3 px-3 py-1.5',
          accent.className
        )}
        style={accent.style}
      >
        <div
          className={cn(
            hasProse ? TITLE_VS_PROSE : hasRight ? 'min-w-0 max-w-[60%]' : 'min-w-0 flex-1'
          )}
        >
          {titleNode}
        </div>
        {hasRight && (
          <div
            className={cn(
              'flex min-w-0 flex-wrap items-center justify-end gap-2',
              hasProse ? PROSE_COLUMN : 'flex-1'
            )}
          >
            {rightContent}
            {statsNode}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex w-full min-w-0 items-center justify-between gap-4 px-3 py-3',
        accent.className
      )}
      style={accent.style}
    >
      {/* Stats-only (or empty) right side: the title is the FLEXIBLE side — it
          grows into the free space and wraps within it, yielding first so it can
          never run under the stats. With PROSE on the right the title keeps its
          content width while it fits beside the description's 55% ask, and
          yields past that — see the rule above. */}
      <div className={cn(hasProse ? TITLE_VS_PROSE : 'min-w-0 flex-1')}>{titleNode}</div>
      {hasRight && (
        // Stats-only: the cluster reserves its own width (it doesn't grow, and
        // holds content size until the title is fully collapsed) and wraps
        // internally, so it is never overlapped and never clipped off the card
        // edge. With prose it asks for 55% and grows past it when the title
        // doesn't need its share.
        <div
          className={cn(
            'flex min-w-0 flex-wrap items-center justify-end gap-2',
            hasProse && PROSE_COLUMN
          )}
        >
          {rightContent}
          {statsNode}
        </div>
      )}
    </div>
  )
}
