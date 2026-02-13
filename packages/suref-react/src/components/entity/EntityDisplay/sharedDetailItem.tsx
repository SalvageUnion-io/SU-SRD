import type { DataValue } from '../../../types/common'
import type { SURefObjectDataValue } from 'salvageunion-reference'
import { DataValueDisplayView } from '../DataValueDisplayView'

/**
 * Shared DetailItem component for rendering DataValue items
 * Accepts both DataValue (from types/common) and SURefObjectDataValue (from salvageunion-reference)
 * Used by EntitySubTitleContent, NestedActionDisplay, NestedChassisAbility, and BlockContentRendererView
 */
export function SharedDetailItem({
  item,
  compact = false,
  damaged = false,
}: {
  item: DataValue | SURefObjectDataValue
  compact?: boolean
  damaged?: boolean
}) {
  return <DataValueDisplayView item={item} compact={compact} damaged={damaged} />
}
