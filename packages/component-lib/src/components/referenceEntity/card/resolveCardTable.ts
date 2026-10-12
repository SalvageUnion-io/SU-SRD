/**
 * The roll table a card renders, for the entity or the action folded into it:
 * INLINE (`table`) or BY REFERENCE (`tableName` → `roll-tables`). The entity
 * model resolves it (`resolveTable` in `salvageunion-reference`,
 * `lib/view/parts/table.ts`).
 */
export { resolveTable as resolveCardTable } from 'salvageunion-reference'
