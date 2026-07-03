#!/usr/bin/env tsx

/**
 * Validate slug uniqueness per data file (audit item 4).
 *
 * Entity URLs, deep links, and lookup helpers key on `nameToSlug(name)`
 * within a schema (suref-web routes /schema/[schemaId]/item/[slug],
 * findEntityBySlug, the Discord bot's name lookups). Two same-named entities
 * in one schema therefore SHADOW each other: only the first is reachable —
 * the second silently loses its page, JSON endpoint, og-image, and bot
 * autocomplete entry. This happened for real: two "Salvage Cache Table"
 * roll-tables (We Were Here First! p.23 vs Reclamation of the Wastes p.10)
 * collided until they were disambiguated by source.
 *
 * Cross-file collisions are fine (slugs are namespaced by schema). Entities
 * without a name (meta rows) are skipped — they slug by id, which
 * checkUniqueIds already guarantees unique.
 */

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { nameToSlug } from '../lib/slug.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

type NamedEntity = { id?: string; name?: string; source?: string; page?: number }

const dataDir = join(__dirname, '..', 'data')
const files = readdirSync(dataDir).filter((f) => f.endsWith('.json'))

let collisions = 0

for (const file of files) {
  const raw = JSON.parse(readFileSync(join(dataDir, file), 'utf-8')) as unknown
  if (!Array.isArray(raw)) continue

  const bySlug = new Map<string, NamedEntity[]>()
  for (const entity of raw as NamedEntity[]) {
    if (typeof entity?.name !== 'string' || entity.name === '') continue
    const slug = nameToSlug(entity.name)
    const bucket = bySlug.get(slug)
    if (bucket) bucket.push(entity)
    else bySlug.set(slug, [entity])
  }

  for (const [slug, entities] of bySlug) {
    if (entities.length < 2) continue
    collisions++
    console.error(`✗ ${file}: slug "${slug}" is shared by ${entities.length} entities:`)
    for (const e of entities) {
      const where = e.source ? ` (${e.source}${e.page ? ` p.${e.page}` : ''})` : ''
      console.error(`    - "${e.name}" id=${e.id}${where}`)
    }
    console.error(
      '  → disambiguate the names (e.g. suffix the source) so every entity keeps a reachable URL.'
    )
  }
}

if (collisions > 0) {
  console.error(`\n${collisions} slug collision(s) found.`)
  process.exit(1)
}

console.log(`✓ No slug collisions across ${files.length} data files.`)
