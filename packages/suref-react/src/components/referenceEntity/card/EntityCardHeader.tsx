import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'
import { Text } from '../../base/Text'
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
  /** Write layer: dim the header band (a de-emphasised / inactive header). */
  dim?: boolean
  compact?: boolean
}

/**
 * EntityCardHeader — the unified card's HEADER band (the tone).
 *
 * Left: the title as the canonical black name-tab (`Text variant="pseudoheader"`
 * — ink block, paper text) that HUGS its text (`w-fit`, never full-width), sized
 * by the DEPTH ladder. Right: the header axis cluster — an optional cost node
 * (action AP box) then the headline `Stat` boxes (`EntityCardStatBox`), wrapping;
 * or a `rightContent` flavor line (white ability hint) when the axis is free.
 */
export function EntityCardHeader({
  title,
  bg,
  bgColor,
  titleClass,
  titleSlot,
  titleAs,
  stats,
  rightContent,
  listing = false,
  dim = false,
  compact = false,
}: EntityCardHeaderProps) {
  const accent = accentSurface(bg, bgColor)

  return (
    <div
      className={cn(
        // A FIRM minimum gap between the title and the stat/hint cluster so
        // they can never collide, without being so wide the stats read detached.
        'flex w-full min-w-0 items-center justify-between gap-4',
        // px-3 (both sizes) so the title's left edge lines up with the seam
        // stamp + sub-header content (all at border 3px + px-3 = 15px).
        compact ? 'gap-3 px-3 py-1.5' : 'px-3 py-3',
        dim && 'opacity-60',
        accent.className
      )}
      style={accent.style}
    >
      {titleSlot ?? (
        <Text
          variant="pseudoheader"
          as={titleAs ?? 'span'}
          className={cn(
            // `self-center` overrides the pseudoheader variant's built-in
            // `self-start` so the name-tab truly centers against the band height.
            'w-fit shrink-0 self-center font-cond font-bold uppercase leading-none tracking-caps-tight',
            titleClass
          )}
        >
          {title}
        </Text>
      )}
      {(rightContent || stats.length > 0) && (
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          {rightContent}
          <EntityCardStatBox stats={stats} compact={compact || listing} />
        </div>
      )}
    </div>
  )
}
