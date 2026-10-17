import { cn } from '../../lib/cn'

type ToneStripProps = {
  /** The strip's colour: a colour token value (`var(--color-…)`, a chapter's band colour). */
  color: string
  /** Placement from the host (a grid area). */
  className?: string
}

/**
 * TONE STRIP — the 8px colour band that opens a section from above (ruleset
 * §3.10: colour rides in top bands, never a left rail), framed in chrome ink
 * on three sides so the section's own rule closes it. Decorative: hidden from
 * assistive tech, as the heading under it names the section.
 */
export function ToneStrip({ color, className }: ToneStripProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('su-tone-strip', className)}
      style={{ backgroundColor: color }}
    />
  )
}
