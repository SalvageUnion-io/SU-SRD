import { useCallback } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { isAbility } from 'salvageunion-reference'
import { EntityStats } from './EntityStats'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { cn } from '../../../utils/cn'
import type { getEntityFontSizes } from './entityDisplayTypes'
import type { EntityControl, EntityControlVariant } from './entityControlTypes'

const VARIANT_STYLES: Record<EntityControlVariant, string> = {
  primary: 'bg-su-black text-su-white hover:bg-su-grey-dark',
  danger: 'opacity-60 hover:bg-su-rust/80 hover:opacity-100',
  ghost: 'opacity-60 hover:bg-white/20 hover:opacity-100',
}

type EntityRightHeaderContentProps = {
  data: SURefEntity
  compact: boolean
  fontSize: ReturnType<typeof getEntityFontSizes>
  techLevel?: number | 'B' | 'N'
  listing: boolean
  primaryStatsOnly?: boolean
  controls?: EntityControl[]
}

export function EntityRightHeaderContent({
  data,
  compact,
  fontSize,
  techLevel,
  listing,
  primaryStatsOnly = false,
  controls,
}: EntityRightHeaderContentProps) {
  const description = 'description' in data ? data.description : undefined
  const parsedDescription = useParseTraitReferences(description)

  const handleClick = useCallback((e: React.MouseEvent, onClick: () => void) => {
    e.stopPropagation()
    onClick()
  }, [])

  const abilityContent = description && isAbility(data) && (
    <div
      className={cn(
        'min-w-0 shrink overflow-hidden text-right font-medium italic text-su-white',
        fontSize.xs,
        'max-h-[60px] leading-tight',
        compact && 'max-w-[175px]'
      )}
      style={{ whiteSpace: 'normal' }}
    >
      {parsedDescription}
    </div>
  )

  return (
    <div className="flex gap-2">
      {abilityContent}
      <EntityStats
        data={data}
        compact={compact}
        listing={listing}
        techLevel={techLevel}
        primaryOnly={primaryStatsOnly}
      />
      {controls?.map((control) => {
        const variant = control.variant ?? 'ghost'
        const Icon = control.icon
        return (
          <button
            key={control.key}
            type="button"
            className={cn(
              'flex min-w-[25px] shrink-0 cursor-pointer items-center justify-center gap-1 self-center rounded p-1 transition-colors',
              VARIANT_STYLES[variant],
              control.className
            )}
            title={control.ariaLabel}
            aria-label={control.ariaLabel}
            onClick={(e) => handleClick(e, control.onClick)}
          >
            <Icon className="h-4.5 w-4.5" />
            {control.label && (
              <span className="font-mono text-xs font-bold uppercase leading-none">
                {control.label}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
