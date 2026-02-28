import type { SURefEntity } from 'salvageunion-reference'
import { isAbility } from 'salvageunion-reference'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { cn } from '../../../utils/cn'
import type { getReferenceEntityFontSizes } from './referenceEntityDisplayTypes'

type ReferenceEntityRightHeaderContentProps = {
  data: SURefEntity
  fontSize: ReturnType<typeof getReferenceEntityFontSizes>
}

export function ReferenceEntityRightHeaderContent({
  data,
  fontSize,
}: ReferenceEntityRightHeaderContentProps) {
  const description = 'description' in data ? data.description : undefined
  const parsedDescription = useParseTraitReferences(description)

  if (!description || !isAbility(data)) return null

  return (
    <div className={cn('pr-1.5 text-pretty text-right font-medium italic leading-tight text-su-white', fontSize.xs)}>
      {parsedDescription}
    </div>
  )
}
