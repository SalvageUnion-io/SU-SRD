/**
 * Which roll tables stand on their own in the book, and which are printed
 * inside another entry.
 *
 * A record whose roll IS a table names it by `tableName`: an ability ("System
 * and Software Hacker"), a System's or Module's action ("Mechapult"), a crawler
 * bay ("Trading Bay"). Its card renders that table (`resolveTable`), as the
 * book prints it inside the entry, so the table is EMBEDDED there. A table that
 * a guide step or a choice only points at (`rollTable`: "roll on the Callsign
 * Table") is still TOP-LEVEL: the book prints it under its own heading.
 */

/** Every roll-table name a record claims as its own `tableName`, at any depth. */
function claimedTableNames(records: Iterable<unknown>): Set<string> {
  const names = new Set<string>()
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) visit(child)
      return
    }
    if (node === null || typeof node !== 'object') return
    const { tableName } = node as { tableName?: unknown }
    if (typeof tableName === 'string' && tableName.length > 0) names.add(tableName)
    for (const value of Object.values(node)) visit(value)
  }
  for (const record of records) visit(record)
  return names
}

/**
 * The roll tables no other record claims by `tableName`, in their given order:
 * what the roll-table listing lists. `records` are the dataset's other records
 * (every schema but `roll-tables`); a table claimed nowhere is top-level.
 */
export function topLevelRollTables<T extends { name: string }>(
  tables: readonly T[],
  records: Iterable<unknown>
): T[] {
  const embedded = claimedTableNames(records)
  return tables.filter((table) => !embedded.has(table.name))
}
