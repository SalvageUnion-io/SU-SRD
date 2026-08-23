import { describe, expect, test } from 'bun:test'
import { extractStaticEntitySummary } from '../helpers.js'
import { SalvageUnionReference } from '../index.js'
import { isColumnsTable } from './resultForTable.js'
import { tableRows } from './tableRows.js'

/**
 * Roll-table rows must survive into the static summary.
 *
 * The defect this guards: every roll-table page shipped its whole d20 table as
 * serialized island props and rendered NONE of it as markup. Measured across
 * six tables before the fix — 0 rows in rendered HTML, every row inside a
 * `<script>`. Without JavaScript the page was a title and a source line.
 *
 * Nothing caught it. It typechecks, it lints, and the output snapshot compares
 * `<main>` TEXT, so a page whose text was 173 characters of chrome looked
 * exactly as legitimate as one with its table in it. The only signal was
 * fetching the page and stripping the scripts.
 */

// No `preload()` here on purpose — `test/reference-preload.ts` already runs
// `preload('all')` for every workspace that touches reference data, and
// `test-hygiene.test.ts` fails any file that repeats it.
const ALL = SalvageUnionReference.RollTables.all()

/** The non-columns tables, which are the ones the static path renders. */
const FLAT = ALL.filter((entity) => !isColumnsTable(entity.table))

describe('roll-table rows reach the static summary', () => {
  test('there are roll tables to check', () => {
    // Guards against a vacuous pass if the schema stops loading.
    expect(ALL.length).toBeGreaterThan(50)
    expect(FLAT.length).toBeGreaterThan(50)
  })

  test('every non-columns table yields one row per bucket', () => {
    const wrong: string[] = []
    for (const entity of FLAT) {
      const buckets = Object.keys(entity.table).filter((k) => k !== 'type').length
      const rows = tableRows(entity.table)
      if (rows.length !== buckets) {
        wrong.push(`${entity.name}: ${rows.length} rows for ${buckets} buckets`)
      }
    }
    expect(wrong, 'a bucket variant is being dropped by the flattener').toEqual([])
  })

  test('every row carries non-empty outcome text', () => {
    const empty: string[] = []
    for (const entity of FLAT) {
      for (const row of tableRows(entity.table)) {
        if (!row.value.trim()) empty.push(`${entity.name} @ ${row.key}`)
      }
    }
    expect(empty, 'a row rendered with no outcome text').toEqual([])
  })

  test('the static summary exposes those rows — the no-JS path', () => {
    // The actual regression surface: a page renders nothing without JS if the
    // summary is empty, however healthy `tableRows` itself is.
    const bare = FLAT.filter((entity) => extractStaticEntitySummary(entity).table.length === 0).map(
      (entity) => entity.name
    )
    expect(bare, 'these roll-table pages would render no rows without JavaScript').toEqual([])
  })

  test('rows are ordered highest roll first, as printed', () => {
    const standard = FLAT.find((entity) => entity.table.type === 'standard')
    expect(standard).toBeDefined()
    if (!standard) return
    const leading = tableRows(standard.table).map((r) =>
      Number.parseInt(r.key.split('-')[0] ?? '0', 10)
    )
    expect(leading).toEqual([...leading].sort((a, b) => b - a))
  })

  test('columns tables are excluded rather than flattened wrong', () => {
    // A two-roll table flattened to one row list would look right and be wrong,
    // which is worse than rendering nothing.
    const columnsTable = ALL.find((entity) => isColumnsTable(entity.table))
    if (!columnsTable) return
    expect(extractStaticEntitySummary(columnsTable).table).toEqual([])
  })
})
