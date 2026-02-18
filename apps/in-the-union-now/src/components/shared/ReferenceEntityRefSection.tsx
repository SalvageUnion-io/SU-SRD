import type { ReactNode } from 'react'
import { SectionSeparator } from 'suref-react'

type ReferenceEntityRefSectionProps = {
  label: string
  children: ReactNode
}

export function ReferenceEntityRefSection({ label, children }: ReferenceEntityRefSectionProps) {
  return (
    <div>
      <SectionSeparator label={label} fontSize="text-sm" />
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </div>
  )
}
