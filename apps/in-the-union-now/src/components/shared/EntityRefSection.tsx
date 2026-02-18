import type { ReactNode } from 'react'
import { SectionSeparator } from 'suref-react'

type EntityRefSectionProps = {
  label: string
  children: ReactNode
}

export function EntityRefSection({ label, children }: EntityRefSectionProps) {
  return (
    <div>
      <SectionSeparator label={label} fontSize="text-sm" />
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </div>
  )
}
