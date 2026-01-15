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
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'

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

function validateUUID(id: string): boolean {
  return UUID_PATTERN.test(id)
}

function processFile(
  filename: string,
  duplicateIds: Set<string>,
  seenIds: Set<string>
): FileResult {
  const filePath = join(process.cwd(), 'data', filename)
  let data: DataItem[]
  try {
    data = JSON.parse(readFileSync(filePath, 'utf-8')) as DataItem[]
  } catch (error) {
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
    writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  }

  return result
}

// List of data files to process
const dataFiles = [
  'abilities.json',
  'ability-tree-requirements.json',
  'actions.json',
  'bio-titans.json',
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
  'traits.json',
  'vehicles.json',
]

// First pass: collect all IDs to detect duplicates
console.log('🔍 Scanning for duplicate IDs...\n')
const globalIdSet = new Set<string>()
const globalIdMap = new Map<string, Array<{ file: string; context: string }>>()

function collectIds(filename: string, data: DataItem[]): void {
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

// Collect all IDs
for (const filename of dataFiles) {
  try {
    const filePath = join(process.cwd(), 'data', filename)
    const data = JSON.parse(readFileSync(filePath, 'utf-8')) as DataItem[]
    collectIds(filename, data)
  } catch (error) {
    // File might not exist, skip
  }
}

// Find duplicates
const duplicateIds = new Set<string>()
for (const [id, locations] of globalIdMap.entries()) {
  if (locations.length > 1) {
    duplicateIds.add(id)
  }
}

if (duplicateIds.size > 0) {
  console.log(`⚠️  Found ${duplicateIds.size} duplicate ID(s):`)
  for (const id of duplicateIds) {
    const locations = globalIdMap.get(id)!
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

// Track which IDs we've seen (keep first occurrence)
const seenIds = new Set<string>()

for (const filename of dataFiles) {
  const result = processFile(filename, duplicateIds, seenIds)

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
  console.log(
    `Total changes: ${totalRootIdsAdded + totalRootIdsFixed + totalRootIdsDeduplicated + totalActionIdsAdded + totalActionIdsFixed + totalActionIdsDeduplicated + totalChoiceIdsAdded + totalChoiceIdsFixed + totalChoiceIdsDeduplicated}`
  )
  console.log('\n✅ All missing and invalid IDs have been generated and fixed!')
  console.log('\n💡 Run `npm run validate:ids` to verify all IDs are now valid and unique.')
}
