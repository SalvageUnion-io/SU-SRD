import type { SURefObjectTable } from '../types/index.js'

/**
 * One row of a roll table, flattened out of the nine-variant bucket union.
 *
 * `key` is the roll or roll range exactly as the book prints it ('1', '2-5',
 * '11-19'), so it doubles as the row's identity for highlighting a result.
 */
export type TableRow = {
  /** Descending sort position — 20 first, 1 last, matching the printed layout. */
  order: number
  /** The roll or range, e.g. '1', '2-5', '11-19'. */
  key: string
  /** Bolded lead-in where the entry has one, otherwise null. */
  label: string | null
  /** The outcome text. */
  value: string
}

function sortValue(key: string): number {
  if (key === 'type') return -1
  const firstPart = key.split('-')[0]?.trim()
  if (!firstPart) return 0
  const num = Number.parseInt(firstPart, 10)
  return Number.isNaN(num) ? 0 : num
}

/**
 * Flatten a roll table into printable rows, highest roll first.
 *
 * ## Why this lives in the package rather than in the card that draws it
 *
 * There are two consumers with the same question and no shared answer before
 * this: the interactive `RollTable` component, which needs rows to draw and a
 * key to highlight after a roll; and `extractStaticEntitySummary`, which needs
 * the same rows for the no-JS and crawler rendering of a roll-table page.
 *
 * Those pages shipped their entire table as serialized island props and
 * rendered **none of it** as markup — measured across six tables, 0 rows in
 * rendered HTML and every row present inside a `<script>` tag. The bytes were
 * paid for and nothing was drawn without JavaScript.
 *
 * Writing a second flattener next to the summary would have fixed that page
 * and created the drift this repo keeps finding: two copies of one piece of
 * logic, differing later in some bucket variant nobody re-checks. The table
 * schema is the package's, so the flattening is the package's.
 *
 * ## The two entry shapes
 *
 * Buckets normally hold `{ label?, value }`. Some hold a bare string, and a
 * bare string of the form `"Lead-in: rest"` is split on the first colon so it
 * renders with the same bold lead-in as the object form — the printed tables
 * use that shape interchangeably.
 *
 * `columns` tables are NOT flattened here: each of their five buckets holds a
 * further 1–20 mapping, so a flat row list would misrepresent a two-roll
 * table. Callers detect them with `isColumnsTable` and handle both rolls.
 */
export function tableRows(table: SURefObjectTable | undefined | null): TableRow[] {
  if (!table) return []

  const keys = Object.keys(table)
    .filter((key) => key !== 'type')
    .sort((a, b) => sortValue(b) - sortValue(a))

  const rows: TableRow[] = []
  for (const [order, key] of keys.entries()) {
    const content = (table as Record<string, unknown>)[key]

    if (
      content &&
      typeof content === 'object' &&
      'value' in content &&
      typeof (content as { value: unknown }).value === 'string'
    ) {
      const entry = content as { label?: string; value: string }
      rows.push({ order, key, label: entry.label || null, value: entry.value })
      continue
    }

    if (typeof content === 'string') {
      const parts = content.split(':')
      const labelPart = parts[0]?.trim()
      const valuePart = parts.slice(1).join(':').trim()
      rows.push({
        order,
        key,
        label: labelPart && labelPart !== valuePart ? labelPart : null,
        value: valuePart || content,
      })
    }
  }
  return rows
}
