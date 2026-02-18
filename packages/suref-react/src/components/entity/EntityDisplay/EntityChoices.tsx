import type { SURefEntity, SURefObjectChoice } from 'salvageunion-reference'
import { getChoices } from 'salvageunion-reference'
import { EntityChoice } from './EntityChoice'
import { cn } from '../../../utils/cn'
import type { getEntitySpacing, getEntityFontSizes } from './entityDisplayTypes'

export type EntityChoicesProps = {
  data: SURefEntity
  spacing: ReturnType<typeof getEntitySpacing>
  fontSize: ReturnType<typeof getEntityFontSizes>
  hideChoices: boolean
}

export function EntityChoices({ data, spacing, fontSize, hideChoices }: EntityChoicesProps) {
  const entityChoices: SURefObjectChoice[] = getChoices(data) || []

  if (entityChoices.length === 0 || hideChoices) {
    return null
  }

  return (
    <div className={cn(spacing.smallSpaceYClass)}>
      {entityChoices.map((choice) => (
        <EntityChoice key={choice.id} choice={choice} fontSize={fontSize} spacing={spacing} />
      ))}
    </div>
  )
}
