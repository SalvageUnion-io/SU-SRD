import type { ReactNode } from 'react'
import { cn } from '../../../utils/cn'

/** The hint's rendering — on the header band, in the band's own foreground. */
export function HeaderHint({
  text,
  onBandText,
  compact,
}: {
  text: string
  onBandText: string
  compact: boolean
}): ReactNode {
  return (
    <span
      className={cn(
        // Fill the header's right side and wrap across the band (no narrow cap),
        // so the description occupies the space instead of leaving a big gap.
        // `text-pretty` keeps the last line from stranding a single word
        // ("…in the / field.") once the column is width-balanced against the title.
        'min-w-0 flex-1 text-pretty text-right font-body italic leading-snug',
        // Same band-driven foreground as the title (entities/patterns white; the
        // light-faded ghosted/damaged bands go to ink by contrast).
        onBandText,
        compact ? 'text-sm' : 'text-base'
      )}
    >
      {text}
    </span>
  )
}
