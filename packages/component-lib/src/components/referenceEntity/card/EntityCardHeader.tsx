import type { ReactNode } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../../utils/cn'
import type { StatItem } from '../../shared/statsBarTypes'
import { accentSurface } from '../referenceEntityHelpers'
import { EntityCardStatBox } from './EntityCardStatBox'

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
  /**
   * The SAME cluster with short-form labels (TL / SV / SYS …), used when the
   * band measures too narrow to seat the vertical value boxes and the stats
   * fall back to the compact `[label | value]` cells. Omit and `stats` is
   * reused — correct for a caller whose labels are already short (sheet stats).
   */
  narrowStats?: StatItem[]
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

/** A vertical value box's footprint in the cluster: `w-12` (48px) + the 4px gap. */
const VALUE_BOX_WIDTH = 52
/** Room the title must keep beside the cluster before the boxes give way — the
 * band's horizontal padding plus roughly one word of name. */
const TITLE_RESERVE = 140
/** Re-widening must clear the threshold by this much before the boxes come
 * back, so a card sitting exactly on it can't oscillate between anatomies. */
const HYSTERESIS = 24

/**
 * Does the band have room for `statCount` vertical value boxes beside the title?
 *
 * A full card's stat cluster is a fixed-width block: 8 chassis stats want ~416px
 * before the name has any room at all, which a phone (or a narrow grid column)
 * does not have — the cluster used to be `shrink-0`, so it neither shrank nor
 * wrapped and simply ran off the card, over the header and out of the viewport.
 * The cluster now wraps, and on top of that the header measures itself and
 * swaps to the compact `[label | value]` cells — the same badge anatomy a
 * listing card already uses — which fit a phone at 2 rows instead of 3 stacks
 * of boxes.
 *
 * The wrap is the floor for every case this measurement declines to judge: an
 * unmeasurable band (below), no `ResizeObserver`, or a host that renders the
 * card without ever running an effect.
 *
 * That floor is load-bearing, not an edge case. srd renders most entity cards
 * to HTML at build time and ships no JS for them (only cards carrying a real
 * control keep an island), so on those pages the effect never runs at all and
 * the wrap IS what the reader gets. Treat it as the real layout and the
 * measurement as a progressive refinement for hosts that hydrate — ITUN, which
 * is client-only, and srd's interactive minority. Anything that must be legible
 * on a phone has to survive the wrap alone.
 *
 * Where the effect does run it is not a visible frame: `useLayoutEffect`
 * measures before paint, so the boxes never flash on a narrow card.
 *
 * Measured, not breakpointed, because "enough space" is a function of the CARD's
 * width and its stat COUNT, not the viewport: a 2-stat card is fine at 320px and
 * an 8-stat one is cramped in a 500px column on a desktop.
 *
 * A width of 0 (happy-dom, which performs no layout; a display:none ancestor)
 * is NOT a verdict — it leaves the boxes alone rather than reporting every card
 * as cramped.
 */
function useNarrowStats(statCount: number, enabled: boolean) {
  const bandRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)

  useLayoutEffect(() => {
    if (!enabled) {
      setNarrow(false)
      return
    }
    const band = bandRef.current
    if (!band || typeof ResizeObserver === 'undefined') return

    const measure = () => {
      const width = band.clientWidth
      if (!width) return
      const needed = statCount * VALUE_BOX_WIDTH + TITLE_RESERVE
      setNarrow((prev) => (prev ? width < needed + HYSTERESIS : width < needed))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(band)
    return () => observer.disconnect()
  }, [statCount, enabled])

  return { bandRef, narrow }
}

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
  narrowStats,
  rightContent,
  listing = false,
  compact = false,
}: EntityCardHeaderProps) {
  const accent = accentSurface(bg, bgColor)
  // A compact/listing card is ALREADY on the cells, so it needs no measuring.
  const compactStats = compact || listing
  const { bandRef, narrow } = useNarrowStats(stats.length, !compactStats && stats.length > 0)

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
  // On the compact cells → the short-form labels that anatomy is written for.
  // `listing` is included because it renders the cells too: a `size="large"`
  // + `extent="head"` card is NOT `compact`, so its `stats` carry the two-line
  // long form, and without this it would put "Structure / Points" inside a
  // shortform cell. (`compact` needs no clause — such a card's two lists are
  // the same list.)
  const clusterStats = narrow || listing ? (narrowStats ?? stats) : stats
  const statsNode =
    stats.length > 0 ? (
      <EntityCardStatBox stats={clusterStats} compact={compactStats || narrow} />
    ) : null

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
        ref={bandRef}
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
      ref={bandRef}
      className={cn(
        'flex w-full min-w-0 items-center justify-between gap-4 px-3 py-3',
        // NARROW — the two sides STACK (title row, then the cluster). Yielding
        // is a width negotiation, and at this width there is nothing left to
        // negotiate: a full card's title is `text-5xl`, so its min-content (one
        // word) is already most of a phone-width band and it painted straight
        // over the stats, which is the same collision the compact cells fix one
        // level down. Wrapping gives each side a whole row instead.
        //
        // Only WITHOUT prose. The prose rule owns both columns' widths (a 75%
        // ceiling on the title, a 55% basis on the description), and those beat
        // the stacking classes below — `max-w-[75%]` clamps `basis-full`, and a
        // non-auto basis beats `w-full`. So it would read as a stack rule that
        // silently does nothing; a card carrying BOTH prose and stats keeps the
        // prose allocation, which is what it did before this change.
        narrow && !hasProse && 'flex-wrap gap-y-2',
        accent.className
      )}
      style={accent.style}
    >
      {/* Stats-only (or empty) right side: the title is the FLEXIBLE side — it
          grows into the free space and wraps within it, yielding first so it can
          never run under the stats. With PROSE on the right the title keeps its
          content width while it fits beside the description's 55% ask, and
          yields past that — see the rule above. */}
      <div
        className={cn(
          hasProse ? TITLE_VS_PROSE : 'min-w-0 flex-1',
          // Stacked: the title takes the whole first row.
          narrow && !hasProse && 'basis-full'
        )}
      >
        {titleNode}
      </div>
      {hasRight && (
        // Stats-only: the cluster reserves its own width (it doesn't grow, and
        // holds content size until the title is fully collapsed) and wraps
        // internally, so it is never overlapped and never clipped off the card
        // edge. With prose it asks for 55% and grows past it when the title
        // doesn't need its share.
        <div
          className={cn(
            'flex min-w-0 flex-wrap items-center justify-end gap-2',
            hasProse && PROSE_COLUMN,
            // Stacked: the cluster owns the second row, still right-aligned.
            narrow && !hasProse && 'w-full'
          )}
        >
          {rightContent}
          {statsNode}
        </div>
      )}
    </div>
  )
}
