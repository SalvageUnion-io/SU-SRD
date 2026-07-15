import type { ReactNode } from 'react'

type FilterRowProps = {
  label: string
  children: ReactNode
  gap?: string
}

export function FilterRow({ label, children, gap = 'gap-1' }: FilterRowProps) {
  return (
    <div className="flex flex-col items-center gap-1 sm:flex-row sm:items-center">
      <span className="font-mono text-label font-bold uppercase tracking-wider text-su-black/40 sm:w-[4.5rem] sm:shrink-0 sm:text-right">
        {label}
      </span>
      <div className={`flex flex-wrap justify-center ${gap} sm:justify-start`}>{children}</div>
    </div>
  )
}
