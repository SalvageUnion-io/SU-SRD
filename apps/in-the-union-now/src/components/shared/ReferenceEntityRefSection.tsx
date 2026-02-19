import type { ReactNode } from 'react'
import { SectionSeparator } from 'suref-react'

type ReferenceEntityRefSectionProps = {
  label: string
  compact?: boolean
  grid?: boolean
  children: ReactNode
}

export function ReferenceEntityRefSection({
  label,
  compact,
  grid,
  children,
}: ReferenceEntityRefSectionProps) {
  const gap = compact ? 'gap-1.5' : 'gap-2'
  const mt = compact ? 'mt-1.5' : 'mt-2'
  const gridClass = grid
    ? `${mt} grid grid-cols-1 lg:grid-cols-2 ${gap}`
    : `${mt} flex flex-col ${gap}`

  return (
    <div>
      <SectionSeparator label={label} compact={compact} />
      <div className={gridClass}>{children}</div>
    </div>
  )
}
