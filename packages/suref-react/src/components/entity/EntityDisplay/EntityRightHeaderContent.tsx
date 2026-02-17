import type { SURefEntity } from 'salvageunion-reference'
import { isAbility } from 'salvageunion-reference'
import { EntityStats } from './EntityStats'
import type { SvOverride } from './EntityStats'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { cn } from '../../../utils/cn'
import type { getEntityFontSizes } from './entityDisplayTypes'

type EntityRightHeaderContentProps = {
  data: SURefEntity
  compact: boolean
  fontSize: ReturnType<typeof getEntityFontSizes>
  techLevel?: number | 'B' | 'N'
  listing: boolean
  primaryStatsOnly?: boolean
  svOverride?: SvOverride
}

export function EntityRightHeaderContent({
  data,
  compact,
  fontSize,
  techLevel,
  listing,
  primaryStatsOnly = false,
  svOverride,
}: EntityRightHeaderContentProps) {
  const description = 'description' in data ? data.description : undefined
  const parsedDescription = useParseTraitReferences(description)

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
    <div className="flex gap-1">
      {abilityContent}
      <EntityStats
        data={data}
        compact={compact}
        listing={listing}
        techLevel={techLevel}
        primaryOnly={primaryStatsOnly}
        svOverride={svOverride}
      />
    </div>
  )
}
