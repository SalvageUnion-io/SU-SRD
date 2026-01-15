import { Text } from '../base/Text'
import type { SURefEntity } from 'salvageunion-reference'

interface EntityDescriptionProps {
  entity: SURefEntity
}

export function EntityDescription({ entity }: EntityDescriptionProps) {
  const description =
    'description' in entity && entity.description && typeof entity.description === 'string'
      ? entity.description
      : null

  if (!description) return null

  return (
    <Text fontSize="sm" color="fg.muted">
      {description}
    </Text>
  )
}
