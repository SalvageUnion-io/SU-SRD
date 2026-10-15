import { SquareArrowUpRight } from 'lucide-react'
import { color } from '../../design/tokens'

/** Paper by default; a caller's `className` takes over the colour entirely. */
export function DetailIcon({ className }: { className?: string }) {
  return (
    <SquareArrowUpRight
      size={14}
      className={className}
      style={className === undefined ? { color: color.paper } : undefined}
      aria-hidden="true"
    />
  )
}
