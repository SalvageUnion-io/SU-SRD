import { Text } from '../../base/Text'
import type {
  SURefObjectChoice,
  SURefObjectSystemModule,
  SURefMetaEntity,
  SURefEntity,
} from 'salvageunion-reference'
import {
  getModel,
  extractActions,
  isSystemModule,
  getEntityNameFromSystemModule,
  extractVisibleActions,
} from 'salvageunion-reference'
import { EntityDisplay } from './index'
import { NestedActionDisplay } from '../NestedActionDisplay'
import { cn } from '../../../utils/cn'
import type { getEntitySpacing } from './entityDisplayTypes'

function resolveEntityName(
  entity: SURefMetaEntity | SURefObjectSystemModule,
  title?: string
): string | undefined {
  if (title) {
    return title
  }

  if ('name' in entity && typeof entity.name === 'string') {
    return entity.name
  }

  if ('value' in entity && typeof entity.value === 'string') {
    return entity.value
  }

  if (isSystemModule(entity as SURefMetaEntity)) {
    return getEntityNameFromSystemModule(entity as SURefObjectSystemModule)
  }

  const visibleActions = extractVisibleActions(entity as SURefMetaEntity)
  if (visibleActions && visibleActions.length > 0) {
    return visibleActions[0]?.name
  }

  return undefined
}

export type EntityListDisplayProps = {
  choice: SURefObjectChoice
  selectedChoice?: string
  isMultiSelect?: boolean
  spacing: ReturnType<typeof getEntitySpacing>
}

/**
 * Unified component for rendering lists of entities from either schemaEntities or customSystemOptions.
 * Filters to show only the selected entity if selectedChoice is provided.
 * Renders in a vertical stack with header-only entities.
 */
export function EntityListDisplay({
  choice,
  selectedChoice,
  isMultiSelect = false,
  spacing,
}: EntityListDisplayProps) {
  // Handle choiceOptions (structured options like Custom Sniper Rifle modifications)
  const choiceOptions =
    'choiceOptions' in choice && choice.choiceOptions ? choice.choiceOptions : []
  const hasChoiceOptions = choiceOptions.length > 0

  const entities = choice.schemaEntities
    ? choice.schemaEntities
        .map((entityName) => {
          const schema = choice.schema?.[0]
          if (!schema) return null

          const model = getModel(schema.toLowerCase())
          if (!model) return null

          return model.find((e) => e.name === entityName) ?? null
        })
        .filter((e): e is NonNullable<typeof e> => e !== null && e !== undefined)
    : choice.customSystemOptions || []

  // If we have choiceOptions, render them separately
  if (hasChoiceOptions) {
    const visibleOptions =
      selectedChoice && !isMultiSelect
        ? choiceOptions.filter((option) => option.value === selectedChoice)
        : choiceOptions

    if (visibleOptions.length === 0) return null

    return (
      <div style={{ marginTop: `${spacing.contentPadding + 1}rem` }} className="space-y-4">
        {visibleOptions.map((option, idx) => (
          <div
            key={idx}
            className="w-full rounded-md bg-su-white"
            style={spacing.contentPaddingStyle}
          >
            <Text className={cn('font-bold text-base', option.description ? 'mb-2' : '')}>
              {option.label}
            </Text>
            {option.description && (
              <Text className="mb-2 text-sm text-su-black opacity-80">{option.description}</Text>
            )}
          </div>
        ))}
      </div>
    )
  }

  // Otherwise, render entities as before
  const allEntities = entities

  const visibleEntities =
    selectedChoice && !isMultiSelect
      ? allEntities.filter((entity) => {
          const entityName = resolveEntityName(entity as SURefMetaEntity | SURefObjectSystemModule)
          return entityName === selectedChoice
        })
      : allEntities

  if (visibleEntities.length === 0) return null

  return (
    <div style={{ marginTop: `${spacing.contentPadding + 1}rem` }} className="space-y-4">
      {visibleEntities.map((entity, idx) => {
        const entityIsSystemModule = isSystemModule(entity as SURefMetaEntity)

        if (entityIsSystemModule) {
          const systemModule = entity as SURefObjectSystemModule
          const resolvedActions = extractActions(systemModule as SURefMetaEntity)
          const visibleActions = resolvedActions?.filter((a) => !a.hidden)
          const firstAction = visibleActions?.[0]
          if (firstAction) {
            return <NestedActionDisplay key={idx} data={firstAction} compact />
          }
          return null
        }

        // EntityDisplay only accepts SURefEntity, so we need to check if entity is a valid entity
        // System modules without id are handled separately above
        if (!('id' in entity)) {
          return null
        }
        return (
          <EntityDisplay
            key={idx}
            hide={{ actions: true }}
            data={entity as SURefEntity}
            compact
            listing
          />
        )
      })}
    </div>
  )
}
