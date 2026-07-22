import type { ElementType, ReactNode } from 'react'
import { cn } from '../../utils/cn'

type SectionHeaderProps = {
  /** The centered label, e.g. a catalog category name. */
  label: ReactNode
  /**
   * Heading element for the label. Defaults to `h2` — the catalog-group role it
   * was promoted from. Pass `as="span"` for a purely presentational band.
   */
  as?: ElementType
  className?: string
}

/**
 * SectionHeader — the centered "rule / LABEL / rule" band: a rust condensed-caps
 * label flanked by two faint 1px leader rules. Promoted from srd's per-app
 * `.catalog-header` + `.catalog-group-title`. Distinct from `Slab`, which is a
 * left-aligned label with a single trailing rule.
 */
export function SectionHeader({ label, as: Tag = 'h2', className }: SectionHeaderProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span aria-hidden="true" className="h-px flex-1 bg-wk-faint" />
      <Tag className="whitespace-nowrap font-cond text-caption font-bold uppercase leading-none tracking-caps-wide text-rust">
        {label}
      </Tag>
      <span aria-hidden="true" className="h-px flex-1 bg-wk-faint" />
    </div>
  )
}
