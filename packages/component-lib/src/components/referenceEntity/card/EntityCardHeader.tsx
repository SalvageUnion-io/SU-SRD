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
  // - FLAVOUR PROSE → prose is arbitrary-length, so IT yields: letting it
  //   reserve content width drove the title to min-w-0 and stacked it one
  //   character per line. The title reserves (capped at 60%), the prose wraps
  //   into the rest.
  const hasProse = !!rightContent
  const hasRight = !!(rightContent || statsNode)

  // COMPACT: the title + flavor/stat cluster share ONE row and split the width
  // dynamically — the cluster never wraps beneath the title, each side wraps
  // WITHIN its own space. With right-side content the title takes up to 60%
  // and the cluster (flex-1, basis 0 — so it can never starve the title) takes
  // the rest; with nothing beside it the title takes the full row.
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
        <div className={cn('min-w-0', hasRight ? 'max-w-[60%]' : 'flex-1')}>{titleNode}</div>
        {hasRight && (
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
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
          never run under the stats. With PROSE on the right the roles flip: the
          title reserves its content width (capped at 60%, shrink-0 so no
          pathological cluster can squeeze it) and the prose yields. */}
      <div className={cn('min-w-0', hasProse ? 'max-w-[60%] shrink-0' : 'flex-1')}>{titleNode}</div>
      {hasRight && (
        // Stats-only: the cluster reserves its own width (it doesn't grow, and
        // holds content size until the title is fully collapsed) and wraps
        // internally, so it is never overlapped and never clipped off the card
        // edge. With prose the cluster is flex-1 (basis 0): it fills whatever
        // the title leaves and the prose wraps inside it.
        <div
          className={cn(
            'flex min-w-0 flex-wrap items-center justify-end gap-2',
            hasProse && 'flex-1'
          )}
        >
          {rightContent}
          {statsNode}
        </div>
      )}
    </div>
  )
}
