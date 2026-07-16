import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'
import { Text } from '../../base/Text'
import { accentSurface } from '../referenceEntityHelpers'
import { NEWStatBox } from './NEWStatBox'
import type { StatItem } from '../../shared/statsBarTypes'

type NEWCardHeaderProps = {
  title: string
  /** Domain/tech-level/rust tone — a Tailwind bg class. */
  bg: string | undefined
  /** Raw CSS colour override (navy monster / rust action / dynamic per-source accent). */
  bgColor: string | undefined
  /** Title type-scale class from the DEPTH ladder (steps down per nesting level). */
  titleClass: string
  /** The full header stat cluster (all stats), clustered + wrapping top-right. */
  stats: StatItem[]
  /** Top-right flavor slot — white hint text (an ability's `description`), shown
   * when the entity has no numeric vitals occupying the axis. */
  rightContent?: ReactNode
  compact?: boolean
}

/**
 * NEWCardHeader — the unified card's HEADER band (the tone).
 *
 * Left: the title as the canonical black name-tab (`Text variant="pseudoheader"`
 * — ink block, paper text) that HUGS its text (`w-fit`, never full-width), sized
 * by the DEPTH ladder. Right: the header axis cluster — an optional cost node
 * (action AP box) then the headline `StatDisplay` boxes (`NEWStatBox`), wrapping;
 * or a `rightContent` flavor line (white ability hint) when the axis is free.
 */
export function NEWCardHeader({
  title,
  bg,
  bgColor,
  titleClass,
  stats,
  rightContent,
  compact = false,
}: NEWCardHeaderProps) {
  const accent = accentSurface(bg, bgColor)

  return (
    <div
      className={cn(
        'flex w-full min-w-0 items-center justify-between gap-4',
        compact ? 'gap-3 px-3 py-2' : 'px-4 py-3.5',
        accent.className
      )}
      style={accent.style}
    >
      <Text
        variant="pseudoheader"
        as="span"
        className={cn(
          // `self-center` overrides the pseudoheader variant's built-in
          // `self-start` so the name-tab truly centers against the band height.
          'w-fit self-center font-cond font-bold uppercase leading-none tracking-caps-tight',
          titleClass
        )}
      >
        {title}
      </Text>
      {(rightContent || stats.length > 0) && (
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          {rightContent}
          <NEWStatBox stats={stats} compact={compact} />
        </div>
      )}
    </div>
  )
}
