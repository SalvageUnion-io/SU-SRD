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
