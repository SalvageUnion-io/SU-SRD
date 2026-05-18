import type { EntitySchemaName, SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'

export type TradeResult = {
  roll_key: string
  roll_value: number
  selected_chassis?: string
  selected_system?: string
  selected_module?: string
}

export type TradeCategory = 'nothing' | 'modules' | 'systems' | 'systems-and-modules' | 'chassis'

/** Map a roll table key to the trade category it represents */
export function rollKeyToCategory(key: string): TradeCategory {
  switch (key) {
    case '1':
      return 'nothing'
    case '2-5':
      return 'modules'
    case '6-10':
      return 'systems'
    case '11-19':
      return 'systems-and-modules'
    case '20':
      return 'chassis'
    default:
      return 'nothing'
  }
}

/** Whether the mediator has finished selecting all expected items for the roll result */
export function isTradeComplete(result: TradeResult | null | undefined): boolean {
  if (!result) return false
  const category = rollKeyToCategory(result.roll_key)
  switch (category) {
    case 'nothing':
      return true
    case 'modules':
      return !!result.selected_module
    case 'systems':
      return !!result.selected_system
    case 'systems-and-modules':
      return !!result.selected_system && !!result.selected_module
    case 'chassis':
      return !!result.selected_chassis
  }
}

/** Resolve selected ref IDs from a trade result to reference entities for display */
export function resolveTradeEntities(
  result: TradeResult
): Array<{ schemaName: EntitySchemaName; entity: SURefEntity }> {
  const entries: Array<{ schemaName: EntitySchemaName; entity: SURefEntity }> = []

  if (result.selected_chassis) {
    const entity = SalvageUnionReference.get('chassis', result.selected_chassis)
    if (entity) entries.push({ schemaName: 'chassis', entity })
  }
  if (result.selected_system) {
    const entity = SalvageUnionReference.get('systems', result.selected_system)
    if (entity) entries.push({ schemaName: 'systems', entity })
  }
  if (result.selected_module) {
    const entity = SalvageUnionReference.get('modules', result.selected_module)
    if (entity) entries.push({ schemaName: 'modules', entity })
  }

  return entries
}

/**
 * Filter entities by TL <= crawlerTL.
 * Entities with techLevel 'B' or 'N' (or no techLevel) are always included.
 */
export function filterByTechLevel<T extends { techLevel?: number | string }>(
  entities: T[],
  crawlerTL: number
): T[] {
  return entities.filter((e) => {
    const tl = e.techLevel
    if (tl === undefined || typeof tl === 'string') return true
    return tl <= crawlerTL
  })
}
