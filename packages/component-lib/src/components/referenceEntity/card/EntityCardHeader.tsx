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
  /** Write layer: dim the header band (a de-emphasised / inactive header). */
  dim?: boolean
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
  dim = false,
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
        'w-fit shrink-0 self-center font-cond font-bold uppercase leading-none tracking-caps-tight',
        titleTextClass,
        titleClass
      )}
    >
      {title}
    </TitleTag>
  )
  const statsNode =
    stats.length > 0 ? <EntityCardStatBox stats={stats} compact={compact || listing} /> : null

  // COMPACT: the title + flavor/stat cluster ALWAYS share ONE row and split the
  // width dynamically — the cluster never wraps beneath the title, each side wraps
  // WITHIN its own space. The title takes up to 60% (favoured when both need the
  // room); the cluster takes the rest (≥40%). FULL: one row (firm gap).
  if (compact) {
    return (
      <div
        className={cn(
          // items-center so the (usually one-line) title centers vertically
          // against a taller wrapped flavor/stat cluster.
          'flex w-full min-w-0 items-center gap-3 px-3 py-1.5',
          dim && 'opacity-60',
          accent.className
        )}
        style={accent.style}
      >
        <div className="min-w-0 max-w-[60%]">{titleNode}</div>
        {(rightContent || statsNode) && (
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
        dim && 'opacity-60',
        accent.className
      )}
      style={accent.style}
    >
      {titleNode}
      {(rightContent || statsNode) && (
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          {rightContent}
          {statsNode}
        </div>
      )}
    </div>
  )
}
