import { Badge } from './Badge'
import { cn } from '../../utils/cn'

type TreeSepProps = {
  /** Tree name shown on the solid tag, e.g. 'Engineering' */
  name: string
  /** Ghost tag suffix label (default 'Tree') */
  suffix?: string
  className?: string
}

/**
 * Ability-tree section header (design-spec §2.10 TreeSep): two flex rules
 * flanking the solid tree-name tag + a ghost 'TREE' tag.
 */
export function TreeSep({ name, suffix = 'Tree', className }: TreeSepProps) {
  return (
    // biome-ignore lint/a11y/useFocusableInteractive: non-focusable separator is intentionally decorative, not an operable widget
    // biome-ignore lint/a11y/useAriaPropsForRole: aria-valuenow is only required for focusable separators; this one is static
    // biome-ignore lint/a11y/useSemanticElements: the divider must wrap the flanking rules and tree-name tags, which a void <hr> cannot contain
    <div className={cn('flex items-center gap-2', className)} role="separator">
      <span aria-hidden="true" className="h-[1.5px] flex-1 bg-[rgba(128,128,128,0.45)]" />
      <Badge>{name}</Badge>
      <Badge surface="ghost">{suffix}</Badge>
      <span aria-hidden="true" className="h-[1.5px] flex-1 bg-[rgba(128,128,128,0.45)]" />
    </div>
  )
}
