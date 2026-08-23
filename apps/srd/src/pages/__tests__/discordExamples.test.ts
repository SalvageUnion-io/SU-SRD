import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every entity and table the `/discord` page names as an example must exist.
 *
 * The page told readers to type `/su lookup entity: iron mongrel` — a chassis
 * that has never been in the dataset, carried over from the same fiction the
 * `/api` page documented. It also cited "Keepsakes" and "Mottos" as tables when
 * the real ones are singular, and "heavy laser" when the lasers are "Green
 * Laser", "Red Laser" and so on.
 *
 * None of it was catchable. These are example strings in prose: they typecheck,
 * they lint, and the output snapshot digests a confidently wrong name exactly
 * as happily as a right one. The only way to find them was to look each one up.
 *
 * So this looks each one up, against the built JSON the site itself serves.
 *
 * ## Why the list is hand-maintained
 *
 * Parsing example names out of JSX would be guessing at which `<code>` blocks
 * are entity names and which are command syntax, and would quietly stop
 * checking anything the moment the markup moved. An explicit list is the
 * smaller lie: adding an example means adding it here, and the assertion below
 * fails loudly if a name stops resolving.
 */

const DIST = join(import.meta.dir, '../../../dist')
const SCHEMA_DIR = join(DIST, 'schema')

/**
 * Names the page presents as real, lowercased.
 *
 * Deliberately NOT including command syntax (`/su roll`), prose ("NPC
 * generators"), or the two names now derived at build time — a derived value
 * cannot drift, so asserting on it would only test the ORM.
 */
const CITED_NAMES = [
  'overheat',
  'critical damage',
  'group initiative',
  'reactor overload',
  'area salvage',
  'keepsake',
  'motto',
  'core mechanic',
  'green laser',
]

const built = existsSync(SCHEMA_DIR)

function allEntityNames(): Set<string> {
  const names = new Set<string>()
  if (!built) return names
  for (const file of readdirSync(SCHEMA_DIR)) {
    if (!file.endsWith('.json') || file.endsWith('.schema.json')) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(join(SCHEMA_DIR, file), 'utf8'))
    } catch {
      continue
    }
    if (!Array.isArray(parsed)) continue
    for (const entry of parsed) {
      const name = (entry as { name?: unknown })?.name
      if (typeof name === 'string') names.add(name.toLowerCase())
    }
  }
  return names
}

describe('the /discord page cites entities that exist', () => {
  test('the built schema endpoints are present', () => {
    expect(built, `no built schema JSON at ${SCHEMA_DIR} — run \`bun --filter srd build\``).toBe(
      true
    )
  })

  test('the name index is populated', () => {
    if (!built) return
    // Guards against a vacuous pass: an empty index would make every lookup
    // below "fail open" if the assertion were inverted, and would mean the
    // endpoints stopped being emitted.
    expect(allEntityNames().size).toBeGreaterThan(500)
  })

  test('every cited entity and table name resolves', () => {
    if (!built) return
    const names = allEntityNames()
    const missing = CITED_NAMES.filter((n) => !names.has(n))
    expect(missing, 'the /discord page names entities the bot cannot find').toEqual([])
  })

  test('the fictional chassis is gone from the page', () => {
    const page = readFileSync(join(import.meta.dir, '../discord.page.tsx'), 'utf8')
    // Only inside the comment explaining the fix, never as a live example.
    const live = page.split('\n').filter((l) => l.includes('iron mongrel') && !l.includes('*'))
    expect(live, '"iron mongrel" is back as a live example').toEqual([])
  })
})
