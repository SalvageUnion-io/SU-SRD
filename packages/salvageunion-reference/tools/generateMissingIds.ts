#!/usr/bin/env tsx

/**
 * Generate and add missing UUIDs to all data files
 * This script:
 * 1. Finds all items missing IDs at root level
 * 2. Finds all nested choice objects missing IDs
 * 3. Generates valid UUIDs for all missing IDs
 * 4. Replaces invalid UUIDs with valid ones
 * 5. Fixes duplicate IDs (keeps first occurrence, replaces subsequent ones)
 * 6. Writes the fixed data back to the files
 *
 * Exported as `fixMissingIds()` so it can be invoked in-process — e.g. by
 * `tools/validate.ts --fix`, the unified runner's mechanical-fix tier — in
 * addition to running standalone via `bun run fix:ids`.
 *
 * NOTE: this still rewrites each modified file with
 * `JSON.stringify(data, null, 2)`, which reformats the whole file (the exact
 * problem CLAUDE.md's "never use automated formatters" rule warns about, and
 * that tools/edit-data.ts's CST-preserving editor exists to avoid for other
 * operations). That behavior is intentionally left as-is here — this is
 * existing, already-relied-upon automation being made reusable, not a place
 * to invent new fix logic.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Resolved relative to this file's location (not process.cwd()) so callers
// get correct behavior regardless of which directory `bun` was invoked from.
const packageDataDir = join(__dirname, '..', 'data')

// UUID v4 regex pattern
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface Action {
  id?: string
  name?: string
  actions?: Action[]
  [key: string]: unknown
}

interface Choice {
  id?: string
  name: string
  description: string
  schema: string
}

interface NPC {
  position: string
  description: string
  hitPoints?: number
  choices?: Choice[]
}

interface Ability {
  name: string
  description: string
  choices?: Choice[]
}

interface DataItem {
  id?: string
  npc?: NPC
  abilities?: Ability[]
  choices?: Choice[]
  actions?: Action[]
  [key: string]: unknown
}

interface FileResult {
  file: string
  rootIdsAdded: number
  rootIdsFixed: number
  rootIdsDeduplicated: number
  actionIdsAdded: number
  actionIdsFixed: number
  actionIdsDeduplicated: number
  choiceIdsAdded: number
  choiceIdsFixed: number
  choiceIdsDeduplicated: number
  totalChanges: number
}

export type FixMissingIdsSummary = {
  filesModified: number
  totalChanges: number
  fileResults: FileResult[]
}

function validateUUID(id: string): boolean {
  return UUID_PATTERN.test(id)
}

function processFile(
  filename: string,
  duplicateIds: Set<string>,
  seenIds: Set<string>
): FileResult {
  const filePath = join(packageDataDir, filename)
  let data: DataItem[]
  try {
    data = JSON.parse(readFileSync(filePath, 'utf-8')) as DataItem[]
  } catch {
    // File doesn't exist, return empty result
    return {
      file: filename,
      rootIdsAdded: 0,
      rootIdsFixed: 0,
      rootIdsDeduplicated: 0,
      actionIdsAdded: 0,
      actionIdsFixed: 0,
      actionIdsDeduplicated: 0,
      choiceIdsAdded: 0,
      choiceIdsFixed: 0,
      choiceIdsDeduplicated: 0,
      totalChanges: 0,
    }
  }

  const result: FileResult = {
    file: filename,
    rootIdsAdded: 0,
    rootIdsFixed: 0,
    rootIdsDeduplicated: 0,
    actionIdsAdded: 0,
    actionIdsFixed: 0,
    actionIdsDeduplicated: 0,
    choiceIdsAdded: 0,
    choiceIdsFixed: 0,
    choiceIdsDeduplicated: 0,
    totalChanges: 0,
  }

  data.forEach((item) => {
    // Check and fix root level ID
    if (!item.id) {
      const newId = randomUUID()
      item.id = newId
      seenIds.add(newId)
      result.rootIdsAdded++
      result.totalChanges++
    } else if (!validateUUID(item.id)) {
      const newId = randomUUID()
      item.id = newId
      seenIds.add(newId)
      result.rootIdsFixed++
      result.totalChanges++
    } else if (duplicateIds.has(item.id) && seenIds.has(item.id)) {
      // This is a duplicate, replace it
      const newId = randomUUID()
      item.id = newId
      seenIds.add(newId)
      result.rootIdsDeduplicated++
      result.totalChanges++
    } else {
      // First occurrence of this ID, mark it as seen
      seenIds.add(item.id)
    }

    // Process actions (recursive)
    // Actions can be strings or objects
    const processActions = (actions: unknown[]) => {
      if (actions && Array.isArray(actions)) {
        actions.forEach((action) => {
          // Skip if action is a string (reference to action name)
          if (typeof action === 'string') {
            return
          }
          // Only process if action is an object
          if (typeof action === 'object' && action !== null) {
            const actionObj = action as Action
            if (!actionObj.id) {
              const newId = randomUUID()
              actionObj.id = newId
              seenIds.add(newId)
              result.actionIdsAdded++
              result.totalChanges++
            } else if (!validateUUID(actionObj.id)) {
              const newId = randomUUID()
              actionObj.id = newId
              seenIds.add(newId)
              result.actionIdsFixed++
              result.totalChanges++
            } else if (duplicateIds.has(actionObj.id) && seenIds.has(actionObj.id)) {
              // This is a duplicate, replace it
              const newId = randomUUID()
              actionObj.id = newId
              seenIds.add(newId)
              result.actionIdsDeduplicated++
              result.totalChanges++
            } else {
              // First occurrence of this ID, mark it as seen
              seenIds.add(actionObj.id)
            }
            // Recursively process nested actions
            if (actionObj.actions) {
              processActions(actionObj.actions)
            }
          }
        })
      }
    }

    // Process choices
    const processChoices = (choices: Choice[]) => {
      if (choices && Array.isArray(choices)) {
        choices.forEach((choice) => {
          if (!choice.id) {
            const newId = randomUUID()
            choice.id = newId
            seenIds.add(newId)
            result.choiceIdsAdded++
            result.totalChanges++
          } else if (!validateUUID(choice.id)) {
            const newId = randomUUID()
            choice.id = newId
            seenIds.add(newId)
            result.choiceIdsFixed++
            result.totalChanges++
          } else if (duplicateIds.has(choice.id) && seenIds.has(choice.id)) {
            // This is a duplicate, replace it
            const newId = randomUUID()
            choice.id = newId
            seenIds.add(newId)
            result.choiceIdsDeduplicated++
            result.totalChanges++
          } else {
            // First occurrence of this ID, mark it as seen
            seenIds.add(choice.id)
          }
        })
      }
    }

    // Check actions at root level
    if (item.actions) {
      processActions(item.actions)
    }

    // Check choices at root level
    if (item.choices) {
      processChoices(item.choices)
    }

    // Check choices in NPC
    if (item.npc?.choices) {
      processChoices(item.npc.choices)
    }

    // Check choices in abilities
    if (item.abilities && Array.isArray(item.abilities)) {
      item.abilities.forEach((ability) => {
        if (ability.choices) {
          processChoices(ability.choices)
        }
      })
    }
  })

  // Write back to file if changes were made
  if (result.totalChanges > 0) {
    writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
  }

  return result
}

// List of data files to process
const DATA_FILES = [
  'abilities.json',
  'ability-tree-requirements.json',
  'actions.json',
  'chassis.json',
  'classes.json',
  'crawler-bays.json',
  'crawler-tech-levels.json',
  'crawlers.json',
  'creatures.json',
  'drones.json',
  'equipment.json',
  'keywords.json',
  'meld.json',
  'modules.json',
  'npcs.json',
  'roll-tables.json',
  'squads.json',
  'systems.json',
  'bio-titans.json',
  'traits.json',
  'vehicles.json',
]

function collectIds(
  filename: string,
  data: DataItem[],
  globalIdMap: Map<string, Array<{ file: string; context: string }>>,
  globalIdSet: Set<string>
): void {
  const addId = (id: string, context: string) => {
    if (id && validateUUID(id)) {
      const locations = globalIdMap.get(id) || []
      locations.push({ file: filename, context })
      globalIdMap.set(id, locations)
      globalIdSet.add(id)
    }
  }

  data.forEach((item, index) => {
    if (item.id) {
      addId(item.id, `root[${index}]`)
    }

    const collectActionIds = (actions: unknown[], context: string) => {
      if (actions && Array.isArray(actions)) {
        actions.forEach((action, actionIndex) => {
          // Skip if action is a string (reference to action name)
          if (typeof action === 'string') {
            return
          }
          // Only process if action is an object with an id property
          if (typeof action === 'object' && action !== null && 'id' in action) {
            const actionObj = action as Action
            if (actionObj.id) {
              addId(actionObj.id, `${context}.actions[${actionIndex}]`)
            }
            if (actionObj.actions) {
              collectActionIds(actionObj.actions, `${context}.actions[${actionIndex}]`)
            }
          }
        })
      }
    }

    const collectChoiceIds = (choices: Choice[], context: string) => {
      if (choices && Array.isArray(choices)) {
        choices.forEach((choice, choiceIndex) => {
          if (choice.id) {
            addId(choice.id, `${context}.choices[${choiceIndex}]`)
          }
        })
      }
    }

    if (item.actions) {
      collectActionIds(item.actions, `root[${index}]`)
    }
    if (item.choices) {
      collectChoiceIds(item.choices, `root[${index}]`)
    }
    if (item.npc?.choices) {
      collectChoiceIds(item.npc.choices, `root[${index}].npc`)
    }
    if (item.abilities && Array.isArray(item.abilities)) {
      item.abilities.forEach((ability, abilityIndex) => {
        if (ability.choices) {
          collectChoiceIds(ability.choices, `root[${index}].abilities[${abilityIndex}]`)
        }
      })
    }
  })
}

/**
 * Scan every data file for missing/invalid/duplicate IDs, generate UUIDs for
 * them, and write the fixed data back to disk. Logs progress the same way
 * the standalone CLI always has. Returns a summary so callers (e.g. the
 * unified validate runner's `--fix` tier) can verify something happened
 * rather than trusting a silent no-op.
 */
export function fixMissingIds(): FixMissingIdsSummary {
  console.log('🔍 Scanning for duplicate IDs...\n')
  const globalIdSet = new Set<string>()
  const globalIdMap = new Map<string, Array<{ file: string; context: string }>>()

  for (const filename of DATA_FILES) {
    try {
      const filePath = join(packageDataDir, filename)
      const data = JSON.parse(readFileSync(filePath, 'utf-8')) as DataItem[]
      collectIds(filename, data, globalIdMap, globalIdSet)
    } catch {
      // File might not exist, skip
    }
  }

  const duplicateIds = new Set<string>()
  for (const [id, locations] of globalIdMap.entries()) {
    if (locations.length > 1) {
      duplicateIds.add(id)
    }
  }

  if (duplicateIds.size > 0) {
    console.log(`⚠️  Found ${duplicateIds.size} duplicate ID(s):`)
    for (const id of duplicateIds) {
      const locations = globalIdMap.get(id)
      if (!locations) continue
      console.log(`   - "${id}" appears in:`)
      locations.forEach(({ file, context }) => {
        console.log(`     • ${file}:${context}`)
      })
    }
    console.log()
  }

  console.log('🔧 Generating and fixing UUIDs...\n')

  let totalRootIdsAdded = 0
  let totalRootIdsFixed = 0
  let totalRootIdsDeduplicated = 0
  let totalActionIdsAdded = 0
  let totalActionIdsFixed = 0
  let totalActionIdsDeduplicated = 0
  let totalChoiceIdsAdded = 0
  let totalChoiceIdsFixed = 0
  let totalChoiceIdsDeduplicated = 0
  let filesModified = 0

  const seenIds = new Set<string>()
  const fileResults: FileResult[] = []

  for (const filename of DATA_FILES) {
    const result = processFile(filename, duplicateIds, seenIds)
    fileResults.push(result)

    if (result.totalChanges > 0) {
      filesModified++
      console.log(`📝 ${filename}:`)

      if (result.rootIdsAdded > 0) {
        console.log(`   ✓ Added ${result.rootIdsAdded} root-level ID(s)`)
        totalRootIdsAdded += result.rootIdsAdded
      }

      if (result.rootIdsFixed > 0) {
        console.log(`   ✓ Fixed ${result.rootIdsFixed} invalid root-level ID(s)`)
        totalRootIdsFixed += result.rootIdsFixed
      }

      if (result.rootIdsDeduplicated > 0) {
        console.log(`   ✓ Fixed ${result.rootIdsDeduplicated} duplicate root-level ID(s)`)
        totalRootIdsDeduplicated += result.rootIdsDeduplicated
      }

      if (result.actionIdsAdded > 0) {
        console.log(`   ✓ Added ${result.actionIdsAdded} action ID(s)`)
        totalActionIdsAdded += result.actionIdsAdded
      }

      if (result.actionIdsFixed > 0) {
        console.log(`   ✓ Fixed ${result.actionIdsFixed} invalid action ID(s)`)
        totalActionIdsFixed += result.actionIdsFixed
      }

      if (result.actionIdsDeduplicated > 0) {
        console.log(`   ✓ Fixed ${result.actionIdsDeduplicated} duplicate action ID(s)`)
        totalActionIdsDeduplicated += result.actionIdsDeduplicated
      }

      if (result.choiceIdsAdded > 0) {
        console.log(`   ✓ Added ${result.choiceIdsAdded} choice ID(s)`)
        totalChoiceIdsAdded += result.choiceIdsAdded
      }

      if (result.choiceIdsFixed > 0) {
        console.log(`   ✓ Fixed ${result.choiceIdsFixed} invalid choice ID(s)`)
        totalChoiceIdsFixed += result.choiceIdsFixed
      }

      if (result.choiceIdsDeduplicated > 0) {
        console.log(`   ✓ Fixed ${result.choiceIdsDeduplicated} duplicate choice ID(s)`)
        totalChoiceIdsDeduplicated += result.choiceIdsDeduplicated
      }

      console.log()
    }
  }

  const totalChanges =
    totalRootIdsAdded +
    totalRootIdsFixed +
    totalRootIdsDeduplicated +
    totalActionIdsAdded +
    totalActionIdsFixed +
    totalActionIdsDeduplicated +
    totalChoiceIdsAdded +
    totalChoiceIdsFixed +
    totalChoiceIdsDeduplicated

  if (filesModified === 0) {
    console.log('✅ All IDs are valid! No changes needed.\n')
  } else {
    console.log('📊 Summary:')
    console.log('='.repeat(80))
    console.log(`Files modified: ${filesModified}`)
    console.log(`Root-level IDs added: ${totalRootIdsAdded}`)
    console.log(`Root-level IDs fixed: ${totalRootIdsFixed}`)
    console.log(`Root-level IDs deduplicated: ${totalRootIdsDeduplicated}`)
    console.log(`Action IDs added: ${totalActionIdsAdded}`)
    console.log(`Action IDs fixed: ${totalActionIdsFixed}`)
    console.log(`Action IDs deduplicated: ${totalActionIdsDeduplicated}`)
    console.log(`Choice IDs added: ${totalChoiceIdsAdded}`)
    console.log(`Choice IDs fixed: ${totalChoiceIdsFixed}`)
    console.log(`Choice IDs deduplicated: ${totalChoiceIdsDeduplicated}`)
    console.log(`Total changes: ${totalChanges}`)
    console.log('\n✅ All missing and invalid IDs have been generated and fixed!')
    console.log('\n💡 Run `bun run validate:ids` to verify all IDs are now valid and unique.')
  }

  return { filesModified, totalChanges, fileResults }
}

if (import.meta.main) {
  fixMissingIds()
}
