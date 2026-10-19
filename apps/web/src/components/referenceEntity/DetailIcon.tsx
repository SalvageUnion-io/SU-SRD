import { SquareArrowUpRight } from 'lucide-react'
import { color, iconSize } from '../../design/tokens'

/**
 * Paper by default; a caller's `className` takes over the colour entirely.
 * Drawn on a Mini control (`ControlButtons`), so a Mini glyph.
 */
export function DetailIcon({ className }: { className?: string }) {
  return (
    <SquareArrowUpRight
      size={iconSize.mini}
      className={className}
      style={className === undefined ? { color: color.paper } : undefined}
      aria-hidden="true"
    />
  )
}
