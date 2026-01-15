#!/usr/bin/env tsx

/**
 * Check all data files for unique UUIDs
 * This script validates that:
 * 1. All IDs are valid UUIDs (v4 format)
 * 2. All IDs are unique within each file
 * 3. All IDs are unique across all files
 */

import { readFileSync } from 'fs'
import { join } from 'path'

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
  name?: string
  description?: string
  schema?: string
  [key: string]: unknown
}

interface NPC {
  position?: string
  description?: string
  hitPoints?: number
  choices?: Choice[]
  [key: string]: unknown
}

interface Ability {
  name?: string
  description?: string
  choices?: Choice[]
  [key: string]: unknown
}

interface DataItem {
  id?: string
  choices?: Choice[]
  actions?: Action[]
  npc?: NPC
  abilities?: Ability[]
  [key: string]: unknown
}

interface FileResult {
  file: string
  totalItems: number
  itemsWithIds: number
  invalidUUIDs: Array<{ id: string; index: number }>
  duplicatesInFile: Array<{ id: string; indices: number[] }>
}

interface ValidationResult {
  files: FileResult[]
  globalDuplicates: Array<{
    id: string
    files: Array<{ file: string; indices: number[] }>
  }>
  totalIds: number
  uniqueIds: number
  invalidIds: number
  duplicateIds: number
}

// List of data files to check
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

function validateUUID(id: string): boolean {
  return UUID_PATTERN.test(id)
}

function checkFile(filename: string): FileResult {
  const filePath = join(process.cwd(), 'data', filename)
  const data = JSON.parse(readFileSync(filePath, 'utf-8')) as DataItem[]

  const result: FileResult = {
    file: filename,
    totalItems: data.length,
    itemsWithIds: 0,
    invalidUUIDs: [],
    duplicatesInFile: [],
  }

  const idMap = new Map<string, number[]>()

  function checkId(id: string, index: number, context: string = 'root') {
    result.itemsWithIds++

    // Check if valid UUID
    if (!validateUUID(id)) {
      result.invalidUUIDs.push({ id: `${id} (${context})`, index })
    }

    // Track for duplicates
    const indices = idMap.get(id) || []
    indices.push(index)
    idMap.set(id, indices)
  }

  data.forEach((item, index) => {
    // Check root level ID
    if (item.id) {
      checkId(item.id, index, 'root')
    }

    // Check nested action IDs (recursive)
    // Actions can be strings or objects
    const checkActions = (actions: unknown[], context: string) => {
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
              checkId(actionObj.id, index, `${context}[${actionIndex}]`)
            }
            // Recursively check nested actions
            if (actionObj.actions) {
              checkActions(actionObj.actions, `${context}[${actionIndex}].actions`)
            }
          }
        })
      }
    }

    // Check nested choice IDs
    const checkChoices = (choices: Choice[], context: string) => {
      if (choices && Array.isArray(choices)) {
        choices.forEach((choice) => {
          if (choice.id) {
            checkId(choice.id, index, context)
          }
        })
      }
    }

    // Check actions at root level
    if (item.actions) {
      checkActions(item.actions, 'root.actions')
    }

    // Check choices at root level
    if (item.choices) {
      checkChoices(item.choices, 'root.choices')
    }

    // Check choices in NPC
    if (item.npc?.choices) {
      checkChoices(item.npc.choices, 'npc.choices')
    }

    // Check choices in abilities
    if (item.abilities && Array.isArray(item.abilities)) {
      item.abilities.forEach((ability: Ability, abilityIndex: number) => {
        if (ability.choices) {
          checkChoices(ability.choices, `abilities[${abilityIndex}].choices`)
        }
      })
    }
  })

  // Find duplicates within file
  idMap.forEach((indices, id) => {
    if (indices.length > 1) {
      result.duplicatesInFile.push({ id, indices })
    }
  })

  return result
}

function checkAllFiles(): ValidationResult {
  console.log('🔍 Checking all data files for unique UUIDs...\n')

  const fileResults: FileResult[] = []
  const globalIdMap = new Map<string, Array<{ file: string; indices: number[] }>>()

  // Check each file
  for (const filename of dataFiles) {
    const result = checkFile(filename)
    fileResults.push(result)

    // Build global ID map
    const filePath = join(process.cwd(), 'data', filename)
    const data = JSON.parse(readFileSync(filePath, 'utf-8')) as DataItem[]

    const addToGlobalMap = (id: string, index: number) => {
      const locations = globalIdMap.get(id) || []
      locations.push({ file: filename, indices: [index] })
      globalIdMap.set(id, locations)
    }

    data.forEach((item, index) => {
      // Add root level ID
      if (item.id) {
        addToGlobalMap(item.id, index)
      }

      // Add nested action IDs (recursive)
      // Actions can be strings or objects
      const addActionIds = (actions: unknown[]) => {
        if (actions && Array.isArray(actions)) {
          actions.forEach((action) => {
            // Skip if action is a string (reference to action name)
            if (typeof action === 'string') {
              return
            }
            // Only process if action is an object with an id property
            if (typeof action === 'object' && action !== null && 'id' in action) {
              const actionObj = action as Action
              if (actionObj.id) {
                addToGlobalMap(actionObj.id, index)
              }
              // Recursively add nested action IDs
              if (actionObj.actions) {
                addActionIds(actionObj.actions)
              }
            }
          })
        }
      }

      // Add nested choice IDs
      const addChoiceIds = (choices: Choice[]) => {
        if (choices && Array.isArray(choices)) {
          choices.forEach((choice) => {
            if (choice.id) {
              addToGlobalMap(choice.id, index)
            }
          })
        }
      }

      // Check actions at root level
      if (item.actions) {
        addActionIds(item.actions)
      }

      // Check choices at root level
      if (item.choices) {
        addChoiceIds(item.choices)
      }

      // Check choices in NPC
      if (item.npc?.choices) {
        addChoiceIds(item.npc.choices)
      }

      // Check choices in abilities
      if (item.abilities && Array.isArray(item.abilities)) {
        item.abilities.forEach((ability: Ability) => {
          if (ability.choices) {
            addChoiceIds(ability.choices)
          }
        })
      }
    })
  }

  // Find global duplicates
  const globalDuplicates: Array<{
    id: string
    files: Array<{ file: string; indices: number[] }>
  }> = []
  globalIdMap.forEach((locations, id) => {
    if (locations.length > 1) {
      globalDuplicates.push({ id, files: locations })
    }
  })

  // Calculate totals
  const totalIds = fileResults.reduce((sum, r) => sum + r.itemsWithIds, 0)
  const uniqueIds = globalIdMap.size
  const invalidIds = fileResults.reduce((sum, r) => sum + r.invalidUUIDs.length, 0)
  const duplicateIds = globalDuplicates.length

  return {
    files: fileResults,
    globalDuplicates,
    totalIds,
    uniqueIds,
    invalidIds,
    duplicateIds,
  }
}

function printResults(results: ValidationResult): void {
  let hasIssues = false

  // Print file-by-file results
  console.log('📁 File-by-File Analysis:')
  console.log('='.repeat(80))

  for (const fileResult of results.files) {
    const hasFileIssues =
      fileResult.invalidUUIDs.length > 0 || fileResult.duplicatesInFile.length > 0

    if (hasFileIssues) {
      hasIssues = true
      console.log(`\n❌ ${fileResult.file}`)
      console.log(`   Total items: ${fileResult.totalItems}`)
      console.log(`   Items with IDs: ${fileResult.itemsWithIds}`)

      if (fileResult.invalidUUIDs.length > 0) {
        console.log(`   ⚠️  Invalid UUIDs: ${fileResult.invalidUUIDs.length}`)
        fileResult.invalidUUIDs.forEach(({ id, index }) => {
          console.log(`      - Index ${index}: "${id}"`)
        })
      }

      if (fileResult.duplicatesInFile.length > 0) {
        console.log(`   ⚠️  Duplicate IDs within file: ${fileResult.duplicatesInFile.length}`)
        fileResult.duplicatesInFile.forEach(({ id, indices }) => {
          console.log(`      - "${id}" at indices: ${indices.join(', ')}`)
        })
      }
    } else {
      console.log(`✅ ${fileResult.file} (${fileResult.itemsWithIds} IDs)`)
    }
  }

  // Print global duplicates
  if (results.globalDuplicates.length > 0) {
    hasIssues = true
    console.log('\n\n🌍 Global Duplicate IDs (across files):')
    console.log('='.repeat(80))

    results.globalDuplicates.forEach(({ id, files }) => {
      console.log(`\n❌ ID: "${id}"`)
      files.forEach(({ file, indices }) => {
        console.log(`   - ${file} at indices: ${indices.join(', ')}`)
      })
    })
  }

  // Print summary
  console.log('\n\n📊 Summary:')
  console.log('='.repeat(80))
  console.log(`Total IDs found: ${results.totalIds}`)
  console.log(`Unique IDs: ${results.uniqueIds}`)
  console.log(`Invalid UUIDs: ${results.invalidIds}`)
  console.log(`Duplicate IDs (global): ${results.duplicateIds}`)

  if (!hasIssues) {
    console.log('\n✅ All IDs are valid and unique!')
  } else {
    console.log('\n❌ Issues found! Please review the output above.')
    process.exit(1)
  }
}

// Run the check
const results = checkAllFiles()
printResults(results)
