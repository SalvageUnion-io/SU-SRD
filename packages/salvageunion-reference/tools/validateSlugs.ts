#!/usr/bin/env tsx

/**
 * Validate slug uniqueness per data file (audit item 4). See
 * validateSlugsLogic.ts for the full rationale.
 *
 * Thin CLI wrapper: all detection logic lives in validateSlugsLogic.ts so
 * this and the unified runner (tools/validate.ts) can never diverge.
 */

import { loadAllDataFiles } from './loadData.js'
import { findSlugCollisions } from './validateSlugsLogic.js'

const filesByName = loadAllDataFiles()
const collisions = findSlugCollisions(filesByName)

for (const { file, slug, entities } of collisions) {
  console.error(`✗ ${file}: slug "${slug}" is shared by ${entities.length} entities:`)
  for (const e of entities) {
    const where = e.source ? ` (${e.source}${e.page ? ` p.${e.page}` : ''})` : ''
    console.error(`    - "${e.name}" id=${e.id}${where}`)
  }
  console.error(
    '  → disambiguate the names (e.g. suffix the source) so every entity keeps a reachable URL.'
  )
}

if (collisions.length > 0) {
  console.error(`\n${collisions.length} slug collision(s) found.`)
  process.exit(1)
}

console.log(`✓ No slug collisions across ${Object.keys(filesByName).length} data files.`)
