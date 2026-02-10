import type { DataValue } from '../../../types/common'
import type { SURefObjectDataValue } from 'salvageunion-reference'
import { useEntityDisplayContext } from './useEntityDisplayContext'
import { DataValueDisplayView } from '../DataValueDisplayView'

/**
 * Shared DetailItem component for rendering DataValue items
 * Accepts both DataValue (from types/common) and SURefObjectDataValue (from salvageunion-reference)
 * Used by EntitySubTitleContent, NestedActionDisplay, NestedChassisAbility, and ContentBlockRenderer
 */
export function SharedDetailItem({
  item,
  compact = false,
}: {
  item: DataValue | SURefObjectDataValue
  compact?: boolean
}) {
  const { damaged } = useEntityDisplayContext()

  return <DataValueDisplayView item={item} compact={compact} damaged={damaged} />
}
