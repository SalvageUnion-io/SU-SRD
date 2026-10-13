import type { SURefObjectTable } from 'salvageunion-reference'

/** One banded row of a d20 table: its range `key`, its outcome `label`
 * (when the row names one) and its text. */
export type DigestedRollTable = {
  order: number
  label: string | null
  value: string
  key: string
}

type TableContent = string | { label?: string; value: string }

export type RollTableType =
  | SURefObjectTable
  | { type: 'standard' | 'alternate' | 'flat' | 'full'; [key: string]: TableContent }

/**
 * A banded d20 table as rows, highest range first — the order the book prints.
 * Shared by `RollTable` and the entity card's embedded table (`CardRollTable`).
 */
export function digestRollTable(table: RollTableType): DigestedRollTable[] {
  if (!table) return []

  const getSortValue = (key: string): number => {
    if (key === 'type') return -1
    const firstPart = key.split('-')[0]?.trim()
    if (!firstPart) return 0
    const num = parseInt(firstPart, 10)
    return Number.isNaN(num) ? 0 : num
  }

  const sorted = Object.keys(table)
    .filter((key) => key !== 'type')
    .sort((a, b) => {
      const aNum = getSortValue(a)
      const bNum = getSortValue(b)
      return bNum - aNum
    })

  return sorted
    .map((key, order) => {
      const content = table[key as keyof typeof table]

      if (
        content &&
        typeof content === 'object' &&
        content !== null &&
        'value' in content &&
        typeof (content as { value: unknown }).value === 'string'
      ) {
        const tableContent = content as { label?: string; value: string }
        return {
          order,
          label: tableContent.label || null,
          value: tableContent.value,
          key,
        }
      }

      const fullDescription = typeof content === 'string' ? content : ''
      const parts = fullDescription.split(':')
      const labelPart = parts[0]?.trim()
      const valuePart = parts.slice(1).join(':').trim()

      return {
        order,
        label: labelPart && labelPart !== valuePart ? labelPart : null,
        value: valuePart || fullDescription,
        key,
      }
    })
    .filter((item): item is DigestedRollTable => item.value !== undefined)
}

/** One column of a two-roll `columns` table: its d20 range ("9-12") and its entries. */
export type DigestedColumnsColumn = {
  key: string
  entries: { key: string; value: string }[]
}

const isColumnsEntry = (value: unknown): value is { value: string } =>
  !!value && typeof value === 'object' && typeof (value as { value?: unknown }).value === 'string'

/**
 * A `columns` table's columns (Callsign: one d20 picks the column, a second
 * the entry), in the book's order; empty for any other table. Shared by the
 * entity card's table (`CardRollTable`) and the SRD's roll-table page.
 */
export function digestColumnsTable(table: SURefObjectTable): DigestedColumnsColumn[] {
  if (table.type !== 'columns') return []
  return Object.entries(table).flatMap(([key, column]): DigestedColumnsColumn[] => {
    if (key === 'type' || !column || typeof column !== 'object') return []
    const entries = Object.entries(column).flatMap(([entryKey, entry]) =>
      isColumnsEntry(entry) ? [{ key: entryKey, value: entry.value }] : []
    )
    return entries.length > 0 ? [{ key, entries }] : []
  })
}
