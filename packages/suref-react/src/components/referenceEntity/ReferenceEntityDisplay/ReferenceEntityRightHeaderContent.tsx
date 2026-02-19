import type { SURefEntity } from 'salvageunion-reference'
import { isAbility } from 'salvageunion-reference'
import { ReferenceEntityStats } from './ReferenceEntityStats'
import type { SvOverride } from './ReferenceEntityStats'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { cn } from '../../../utils/cn'
import type { getReferenceEntityFontSizes } from './referenceEntityDisplayTypes'

type ReferenceEntityRightHeaderContentProps = {
  data: SURefEntity
  compact: boolean
  fontSize: ReturnType<typeof getReferenceEntityFontSizes>
  techLevel?: number | 'B' | 'N'
  listing: boolean
  primaryStatsOnly?: boolean
  svOverride?: SvOverride
}

export function ReferenceEntityRightHeaderContent({
  data,
  compact,
  fontSize,
  techLevel,
  listing,
  primaryStatsOnly = false,
  svOverride,
}: ReferenceEntityRightHeaderContentProps) {
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
      <ReferenceEntityStats
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
