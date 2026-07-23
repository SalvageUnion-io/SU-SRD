import type { SURefObjectTable } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'

/**
 * The roll table a card should render, for the entity itself or for the action
 * that folds into it.
 *
 * Roll-table data reaches an entity two ways in this dataset: INLINE, as a
 * `table` object on the entity or its action, or BY REFERENCE, as a
 * `tableName` string naming an entry in the `roll-tables` schema. The card
 * used to read `entity.table` only, so every by-reference table rendered as
 * nothing at all — an ability like "System and Software Hacker" showed its
 * prose and silently dropped the d20 outcomes that ARE the ability.
 *
 * Both shapes are equally canonical (the validator in
 * `tools/validateReferencesLogic.ts` enforces that every `tableName` resolves),
 * so resolution belongs at the render core rather than in the data.
 *
 * The lookup is defensive: `RollTables` is a LazyModel and throws when the
 * `roll-tables` schema isn't preloaded. A card that can't resolve its table
 * degrades to no table rather than taking the whole tree down — the same
 * discipline as the other reference reads outside a preload gate.
 */
export function resolveCardTable(source: unknown): SURefObjectTable | undefined {
  if (source === null || typeof source !== 'object') return undefined

  if ('table' in source) {
    const table = (source as { table?: unknown }).table
    if (table !== null && typeof table === 'object') return table as SURefObjectTable
  }

  if ('tableName' in source) {
    const tableName = (source as { tableName?: unknown }).tableName
    if (typeof tableName === 'string' && tableName.length > 0) {
      try {
        const rollTable = SalvageUnionReference.RollTables.find(
          (rt) => 'name' in rt && rt.name === tableName
        )
        if (rollTable?.table) return rollTable.table
      } catch {
        return undefined
      }
    }
  }

  return undefined
}
