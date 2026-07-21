import type { ReactNode } from 'react'
import { Badge } from '../../chrome/Badge'
import { cn } from '../../../utils/cn'

type SectionSeparatorProps = {
  label: string
  value?: string
  fontSize?: string
  compact?: boolean
  children?: ReactNode
}

export function SectionSeparator({
  label,
  value,
  fontSize,
  compact,
  children,
}: SectionSeparatorProps) {
  const resolvedFontSize = fontSize ?? (compact ? 'text-base' : 'text-lg')
  return (
    <div className="relative flex items-center gap-3">
      <div className="flex-1 border-t border-dashed border-wk-faint" aria-hidden="true" />
      <span className="inline-flex shrink-0 border border-ink">
        {/*
         * `block self-start` keeps each half hugging its own content instead of
         * stretching to the taller sibling; `leading-none` must trail the font
         * size, which otherwise reinstates its own line-height. `font-semibold`
         * is a deliberate downgrade from the stamp's `font-bold` — the separator
         * caption reads lighter than a card header.
         */}
        <Badge
          shape="stamp"
          size="mini"
          className={cn(resolvedFontSize, 'block self-start font-semibold leading-none')}
        >
          {label}
        </Badge>
        {value !== undefined && (
          <Badge
            shape="stamp"
            size="mini"
            surface="inverse"
            // `ring-0`: the outer span already draws the ink border, so the
            // inverse plate's own ring would double the seam.
            className={cn(resolvedFontSize, 'block self-start font-semibold leading-none ring-0')}
          >
            {value}
          </Badge>
        )}
      </span>
      <div className="flex-1 border-t border-dashed border-wk-faint" aria-hidden="true" />
      {children && (
        <div className="absolute right-0 flex shrink-0 items-center bg-paper pl-3">{children}</div>
      )}
    </div>
  )
}
