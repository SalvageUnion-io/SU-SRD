import { Text } from '../../base/Text'
import { isAbility } from 'salvageunion-reference'
import { EntityStats } from './EntityStats'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { useParseTraitReferences } from '../../../utils/parseTraitReferences'
import { cn } from '../../../utils/cn'

export function EntityRightHeaderContent({
  collapsible,
  isExpanded,
}: {
  isExpanded: boolean
  collapsible: boolean
}) {
  const { data, compact, fontSize, rightContent } = useEntityDisplayContext()
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
    <div className="flex gap-2">
      {abilityContent}
      <EntityStats data={data} />
      {rightContent}
      {collapsible && (
        <div className="flex min-w-[25px] shrink-0 items-center justify-center self-center">
          <Text className="text-lg text-su-white">{isExpanded ? '\u25BC' : '\u25B6'}</Text>
        </div>
      )}
    </div>
  )
}
