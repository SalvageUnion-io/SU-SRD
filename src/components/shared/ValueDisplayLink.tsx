import { ValueDisplay } from './ValueDisplay'
import { Link } from '@tanstack/react-router'

export function ValueDisplayLink({
  label,
  value,
  href,
  compact = false,
}: {
  label: string | number
  value?: string | number
  href: string
  compact?: boolean
}) {
  return (
    <Link to={href}>
      <ValueDisplay label={label} value={value} compact={compact} />
    </Link>
  )
}
