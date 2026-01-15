import type { ComponentType } from 'react'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import { EntityDisplay } from '../../entity/EntityDisplay'

interface EntityDisplayProps {
  data: SURefEntity
  compact?: boolean
  collapsible?: boolean
  defaultExpanded?: boolean
  onClick?: () => void
  hideActions?: boolean
  hideChoices?: boolean
}

/**
 * Factory function to create simple entity display components.
 * EntityDisplay now handles all schema-specific logic internally.
 *
 * @param schemaName - The schema name (e.g., 'npcs', 'creatures', etc.)
 * @returns A display component configured for the specified entity type
 */
export function createEntityDisplay(
  schemaName: SURefEnumSchemaName
): ComponentType<EntityDisplayProps> {
  const Component = ({
    data,
    compact = false,
    collapsible = false,
    defaultExpanded = true,
    onClick,
    hideActions = false,
    hideChoices = false,
  }: EntityDisplayProps) => {
    return (
      <EntityDisplay
        data={data}
        compact={compact}
        collapsible={collapsible}
        defaultExpanded={defaultExpanded}
        onClick={onClick}
        hideActions={hideActions}
        hideChoices={hideChoices}
      />
    )
  }
  Component.displayName = `${schemaName}Display`
  return Component
}
