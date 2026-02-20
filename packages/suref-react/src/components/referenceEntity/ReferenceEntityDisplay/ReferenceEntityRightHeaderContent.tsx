import type { SURefEntity } from 'salvageunion-reference'
import { isAbility } from 'salvageunion-reference'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { cn } from '../../../utils/cn'
import type { getReferenceEntityFontSizes } from './referenceEntityDisplayTypes'

type ReferenceEntityRightHeaderContentProps = {
  data: SURefEntity
  compact: boolean
  fontSize: ReturnType<typeof getReferenceEntityFontSizes>
}

export function ReferenceEntityRightHeaderContent({
  data,
  compact,
  fontSize,
}: ReferenceEntityRightHeaderContentProps) {
  const description = 'description' in data ? data.description : undefined
  const parsedDescription = useParseTraitReferences(description)

  if (!description || !isAbility(data)) return null

  return (
    <div
      className={cn(
        'min-w-0 shrink overflow-hidden text-right font-medium italic text-su-white',
        fontSize.xs,
        'leading-tight',
        compact && 'max-w-[110px]'
      )}
      style={{ whiteSpace: 'normal' }}
    >
      {parsedDescription}
    </div>
  )
}
