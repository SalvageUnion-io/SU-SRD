#!/usr/bin/env tsx
/**
 * Validates the namesake action back-reference convention (see
 * validateActionBackrefsLogic.ts): when an action's name matches an entity in
 * its `actionSource` file, that entity must reference the action in `actions[]`.
 *
 * Enforces what the "Bionic Arms" fix restored — an ability/system/module/etc.
 * that grants a same-named action must list it, so the action's mechanics
 * resolve from the entity. Currently 361/361 namesake matches pass; this guards
 * against the next miss.
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  findMissingActionBackrefs,
  type ActionLike,
  type EntityLike,
} from './validateActionBackrefsLogic.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data')

function loadData(filename: string): Record<string, unknown>[] {
  try {
    return JSON.parse(readFileSync(join(dataDir, filename), 'utf-8'))
  } catch (error) {
    console.error(`Error loading ${filename}:`, error)
    return []
  }
}

// Every `actionSource` value maps 1:1 to a data file of the same basename. Any
// source with no same-named entity is simply a no-op for this check.
const SOURCE_FILES = [
  'abilities',
  'systems',
  'modules',
  'equipment',
  'chassis',
  'bio-titans',
  'crawlers',
  'creatures',
  'meld',
  'npcs',
  'squads',
  'vehicles',
  'drones',
] as const

const actions = loadData('actions.json') as ActionLike[]
const entitiesBySource: Record<string, EntityLike[]> = {}
for (const source of SOURCE_FILES) {
  entitiesBySource[source] = loadData(`${source}.json`) as EntityLike[]
}

const violations = findMissingActionBackrefs(actions, entitiesBySource)

console.log('\n' + '='.repeat(80))
if (violations.length === 0) {
  console.log('✅ Every namesake action is referenced by its source entity.')
  process.exit(0)
} else {
  console.log(
    `❌ Found ${violations.length} namesake action(s) not referenced by their source entity:\n`
  )
  for (const v of violations) {
    console.log(`  [${v.source}] "${v.actionName}"${v.actionType ? ` (${v.actionType})` : ''}`)
    console.log(
      `    An entity named "${v.actionName}" exists in ${v.source}.json but its actions[] does not list it.`
    )
    console.log(
      `    Add "${v.actionName}" to that entity's actions[] (or rename the action if the name match is coincidental).`
    )
    console.log()
  }
  console.log(`Total: ${violations.length} unreferenced namesake action(s)`)
  process.exit(1)
}
