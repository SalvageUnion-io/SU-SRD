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
    <div
      className={cn(
        // White, non-italic, semibold flavor — no backing chip, no drop shadow.
        'pr-1.5 text-pretty text-right font-cond font-semibold leading-none text-su-white',
        fontSize.sm
      )}
    >
      {parsedDescription}
    </div>
  )
}
