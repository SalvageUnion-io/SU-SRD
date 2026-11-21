/**
 * The tech-level ground rule — the `tone-ground` rule set of `tools/check-rule-sets.ts`.
 *
 * Ruleset §3.8: **TL is the framed ink-on-paper badge, never a text ground.** A
 * tech-level blue (`--color-tl-1`…`-6`, `-b`, `-n`) is the badge's ramp; no
 * header band, and so no title, sits on one. An audit found systems and
 * modules wearing TL-1 sky blue as their header fill, with ink titles, under the
 * green Mech Workshop band: on the mech sheet they read as a second product.
 *
 * ## Why it reads the dataset, not the source
 *
 * Every header ground — Compact, Card and Page, SRD and the app — is the entity
 * model's tone token (`entityTone`, `packages/salvageunion-reference/lib/view/
 * parts/fill.ts`), painted as `--color-<token>`. No source file spells a TL
 * ground out; the resolver builds it from data. So the rule asks the resolver,
 * entity by entity, what ground each "have" header takes (the ink banner of a
 * "do" entity is never toned), and fails on any `tl-*`.
 *
 * ## The book's own TL grounds
 *
 * Systems and modules are headed in their tech level's blue in the book
 * itself: every entry and every index row, under the green Mech Workshop band
 * (Core Book pp. 162–164, 188–190). The owner ruled they follow the book, so
 * they are exempt by design, not pending (`BOOK_TL_GROUNDS`).
 *
 * ## Pending schemas
 *
 * Pilot equipment wears the pilot's orange. The rest of the gear (drones, vehicles) and the tech-level
 * entries themselves still ride the ramp, undecided. They are listed below
 * with their reason, and an entry that no longer paints a TL ground fails as
 * stale, so the list only burns down.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RefEnumSchemaName, RefMetaEntity } from 'salvageunion-reference'
import { entityTone, headerFill } from 'salvageunion-reference'
import type { Finding, Rule, RuleSet } from '../lib/ruleEngine'
import { assertScanFloor } from '../lib/scanFloor'

export const DATA_DIR = 'packages/salvageunion-reference/data'

/** Schemas the book itself heads in a tech-level blue, each with where. */
const BOOK_TL_GROUNDS: Readonly<Record<string, string>> = {
  systems: 'Core Book pp. 162–164: each entry and index row in its tech level’s blue',
  modules: 'Core Book pp. 188–190: each entry and index row in its tech level’s blue',
  chassis: 'a bio-chassis wears bio gear’s mutant green; no other chassis paints a TL',
}

/** Schemas whose headers still paint a TL ground, each with why. */
export const PENDING_TL_GROUNDS: Readonly<Record<string, string>> = {
  drones: 'mech-adjacent gear: not in the change that moved systems and modules',
  vehicles: 'crawler-adjacent gear: not in the change that moved systems and modules',
  'tech-levels': 'the tech-level entry IS the level; whether it keeps its blue is an owner call',
}

const RULE_ID = 'tl-ground'
const TEXT_RULE_ID = 'tl-text'

/** The stylesheets `tl-text` reads. */
export const STYLES_DIR = 'apps/web/src/styles'

/**
 * Rules that may still set words on a TL ground, each with why: a drone
 * companion's cell wears the drone's tech level (drones are pending above).
 */
export const TL_TEXT_EXEMPT: Readonly<Record<string, string>> = {
  '.su-companion-cell': 'a drone companion wears its tech level, as drones do (PENDING_TL_GROUNDS)',
}

const RULES: Rule[] = [
  {
    id: RULE_ID,
    mode: 'zero',
    rule: 'ruleset §3.8 — TL is the framed ink-on-paper badge, never a header or text ground',
    fix:
      'Give the schema a non-TL tone in `entityTone` (packages/salvageunion-reference/lib/' +
      'view/parts/fill.ts) and leave the tech level to the framed TECH LEVEL badge. A ' +
      'stale pending entry: delete it from PENDING_TL_GROUNDS.',
  },
  {
    id: TEXT_RULE_ID,
    mode: 'zero',
    rule: 'ruleset §3.8 — no stylesheet rule sets words on a TL blue',
    fix:
      'Put the words on paper and let the TL colour frame them, as `.su-tl` does ' +
      '(styles/build/dash.css). A case the book heads in TL: TL_TEXT_EXEMPT.',
  },
]

type Entity = RefMetaEntity & { id?: unknown; name?: unknown }

function dataFiles(root: string): string[] {
  try {
    return readdirSync(join(root, DATA_DIR))
      .filter((f) => f.endsWith('.json'))
      .sort()
  } catch {
    return []
  }
}

/** One line per finding: the entity's `"id"` line in its data file, else 1. */
function lineOf(source: string, id: unknown): number {
  if (typeof id !== 'string') return 1
  const at = source.indexOf(`"id": "${id}"`)
  return at < 0 ? 1 : source.slice(0, at).split('\n').length
}

/** Every "have" header the dataset paints, as [file, entity, tone]. */
function headerGrounds(
  root: string
): { file: string; schema: string; line: number; name: string; tone: string }[] {
  const out: { file: string; schema: string; line: number; name: string; tone: string }[] = []
  for (const f of dataFiles(root)) {
    const file = `${DATA_DIR}/${f}`
    const source = readFileSync(join(root, file), 'utf8')
    const data: unknown = JSON.parse(source)
    if (!Array.isArray(data)) continue
    const schema = f.slice(0, -'.json'.length)
    for (const entity of data as Entity[]) {
      if (headerFill(entity, 'card') === 'ink') continue
      const tone = entityTone(schema as RefEnumSchemaName, entity)
      out.push({
        file,
        schema,
        line: lineOf(source, entity.id),
        name: typeof entity.name === 'string' ? entity.name : '(unnamed)',
        tone,
      })
    }
  }
  return out
}

const isTlGround = (tone: string): boolean => tone.startsWith('tl-')

function cssFiles(root: string, dir = STYLES_DIR): string[] {
  let names: string[] = []
  try {
    names = readdirSync(join(root, dir), { withFileTypes: true }).map((d) =>
      d.isDirectory() ? `${d.name}/` : d.name
    )
  } catch {
    return []
  }
  return names.flatMap((n) =>
    n.endsWith('/')
      ? n === '__tests__/'
        ? []
        : cssFiles(root, `${dir}/${n.slice(0, -1)}`)
      : n.endsWith('.css')
        ? [`${dir}/${n}`]
        : []
  )
}

const TL_VALUE = /var\(--tl\b|--color-tl-/
const BLOCK = /([^{}]+)\{([^{}]*)\}/g

/** Every stylesheet rule that paints a TL ground and sets a text colour on it. */
function tlText(root: string): Finding[] {
  const out: Finding[] = []
  for (const file of cssFiles(root)) {
    const source = readFileSync(join(root, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, (c) =>
      c.replace(/[^\n]/g, ' ')
    )
    for (const m of source.matchAll(BLOCK)) {
      const selector = (m[1] ?? '').trim()
      const body = m[2] ?? ''
      const decls = body.split(';').map((d) => d.trim())
      const ground = decls.some((d) => /^background(-color)?\s*:/.test(d) && TL_VALUE.test(d))
      const ink = decls.some((d) => /^color\s*:/.test(d))
      if (!ground || !ink || selector in TL_TEXT_EXEMPT) continue
      out.push({
        file,
        line: source.slice(0, m.index).split('\n').length,
        detail: `${selector} sets words on a TL ground`,
      })
    }
  }
  return out
}

export const toneGround: RuleSet = {
  id: 'tone-ground',
  label: 'tech-level grounds',
  rules: RULES,
  exemptionsLive:
    'packages/gates/rules/toneGround.ts (BOOK_TL_GROUNDS, PENDING_TL_GROUNDS, TL_TEXT_EXEMPT)',
  preflight(root) {
    assertScanFloor('tone-ground (header grounds)', headerGrounds(root).length, 500)
  },
  scan(root) {
    const findings: Finding[] = []
    const painted = new Set<string>()
    for (const g of headerGrounds(root)) {
      if (!isTlGround(g.tone)) continue
      painted.add(g.schema)
      if (g.schema in PENDING_TL_GROUNDS || g.schema in BOOK_TL_GROUNDS) continue
      findings.push({
        file: g.file,
        line: g.line,
        detail: `${g.schema} "${g.name}" paints its header on --color-${g.tone}`,
      })
    }
    const present = new Set(dataFiles(root).map((f) => f.slice(0, -'.json'.length)))
    for (const schema of Object.keys(PENDING_TL_GROUNDS)) {
      if (present.has(schema) && !painted.has(schema)) {
        findings.push({
          file: 'packages/gates/rules/toneGround.ts',
          line: 1,
          detail: `PENDING_TL_GROUNDS.${schema} is stale: no ${schema} header paints a TL ground now`,
        })
      }
    }
    return { [RULE_ID]: findings, [TEXT_RULE_ID]: tlText(root) }
  },
  summary: (root) => `${headerGrounds(root).length} entity headers`,
}
