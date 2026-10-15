/**
 * Post-build gate: every example the site prints must actually resolve.
 *
 * ## What it asserts
 *
 * Every example URL, field and table/autocomplete name the pages print must
 * resolve against the built site and its data — catching a nonexistent entity,
 * a wrong field shape, or a plural where the real table name is singular.
 *
 * ## Why it is a gate step rather than a test
 *
 * It needs the BUILT site: the whole point is comparing what the pages print
 * against what the site actually emits. CI's unit-test job has no `dist`, so as
 * a `bun test` file it could only fail there or — worse — skip, and a check
 * that skips when the build is missing reads as a pass while asserting nothing.
 *
 * CI's `build-web` job runs it via `check:examples` right after the build that
 * produces its input, so it runs where `dist` is guaranteed.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SITE_URL } from '../src/lib/constants'
import { appPath } from '../src/lib/site'

const DIST = join(import.meta.dir, '../dist')

/** `https://salvageunion.io/schema/chassis.json` -> `schema/chassis.json` */
function toDistPath(url: string): string {
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '')
  if (!path) return 'index.html'
  // An extensionless URL is a directory index; a dotted one is a file.
  return /\.[a-z0-9]+$/i.test(path) ? path : join(path.replace(/\/$/, ''), 'index.html')
}

/** Every `name` across the emitted schema arrays, lowercased. */
function emittedEntityNames(): Set<string> {
  const names = new Set<string>()
  const schemaDir = join(DIST, 'schema')
  for (const file of readdirSync(schemaDir)) {
    if (!file.endsWith('.json') || file.endsWith('.schema.json')) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(join(schemaDir, file), 'utf8'))
    } catch {
      // This check reads names; an endpoint that does not parse has none.
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

/**
 * Entity and table names the `/discord` page presents as real.
 *
 * Hand-maintained on purpose. Parsing them out of the built HTML would mean
 * guessing which `<code>` blocks are entity names and which are command syntax,
 * and would quietly stop checking anything the moment the markup moved. Adding
 * an example means adding it here — a smaller lie than a matcher that silently
 * covers nothing.
 *
 * The two names the page DERIVES at build time are excluded: a derived value
 * cannot drift, so asserting on it would only be testing the ORM.
 */
const DISCORD_CITED_NAMES = [
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

const failures: string[] = []

function check(label: string, ok: boolean, detail?: string) {
  if (!ok) failures.push(detail ? `${label}\n    ${detail}` : label)
}

if (!existsSync(DIST)) {
  console.error(`[page-examples] no build at ${DIST} — run \`bun ssg/build.ts\` first.`)
  process.exit(2)
}

// ── /api: every documented URL must map to an emitted file ──────────────────
const apiHtml = readFileSync(join(DIST, 'api/index.html'), 'utf8')

const documentedUrls = [
  ...new Set(
    [...apiHtml.matchAll(new RegExp(`${RegExp.escape(SITE_URL)}/[a-z0-9\\-./{}]*`, 'gi'))]
      .map((m) => m[0])
      // `/schema/{schemaId}.json` and friends are illustrative, not real.
      .filter((u) => !u.includes('{'))
      .map((u) => u.replace(/[.,]$/, ''))
      // The Cantina's (the Union bar's Build tab): another app's Worker serves it on
      // this origin (ADR-048), so srd's `dist` never holds it.
      .filter((u) => !u.startsWith(`${SITE_URL}${appPath('/')}`))
  ),
]

check(
  '/api documents at least a few URLs',
  documentedUrls.length > 2,
  `found ${documentedUrls.length} — the matcher has drifted`
)

for (const url of documentedUrls) {
  check(`/api documents a URL that 404s: ${url}`, existsSync(join(DIST, toDistPath(url))))
}

// The three things the fabricated sample got wrong.
check('/api still shows the invented `hull` field', !apiHtml.includes('"hull"'))
check('/api still shows the invented `armor` field', !apiHtml.includes('"armor"'))
check('/api still names the nonexistent iron-mongrel', !apiHtml.includes('iron-mongrel'))
check(
  '/api sample shows no real chassis field',
  apiHtml.includes('structurePoints'),
  'expected a genuine field name in the response sample'
)

// ── /discord: every cited entity and table must exist ───────────────────────
const names = emittedEntityNames()
check(
  'the emitted name index is populated',
  names.size > 500,
  `only ${names.size} names — the schema endpoints may have stopped emitting`
)

for (const cited of DISCORD_CITED_NAMES) {
  check(`/discord names an entity the bot cannot find: "${cited}"`, names.has(cited))
}

const discordHtml = readFileSync(join(DIST, 'discord/index.html'), 'utf8')
check(
  '/discord still uses the nonexistent "iron mongrel" as an example',
  !discordHtml.toLowerCase().includes('iron mongrel')
)

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error('page-examples gate FAILED\n')
  for (const failure of failures) console.error(`  ✗ ${failure}`)
  console.error(
    `\n${failures.length} problem(s). These pages print examples that readers copy —` +
      ' an example that does not resolve is worse than no example.'
  )
  process.exit(1)
}

console.error(
  `page-examples OK — ${documentedUrls.length} documented URL(s) resolve, ` +
    `${DISCORD_CITED_NAMES.length} cited name(s) exist among ${names.size} emitted.`
)
