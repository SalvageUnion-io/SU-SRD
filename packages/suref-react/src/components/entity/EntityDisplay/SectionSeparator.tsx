import type { ReactNode } from 'react'
import { Text } from '../../base/Text'
import { cn } from '../../../utils/cn'

type SectionSeparatorProps = {
  label: string
  fontSize?: string
  children?: ReactNode
}

export function SectionSeparator({ label, fontSize, children }: SectionSeparatorProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-su-grey-light" aria-hidden="true" />
      <Text variant="pseudoheader" className={cn(fontSize ?? 'text-lg')}>
        {label}
      </Text>
      {children}
      <div className="h-px flex-1 bg-su-grey-light" aria-hidden="true" />
    </div>
  )
}
