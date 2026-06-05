#!/usr/bin/env tsx
/**
 * Validates action references in the Salvage Union data
 * Checks that all action names referenced in data files exist in actions.json
 */

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

interface ValidationError {
  file: string
  entityName: string
  field: string
  referencedName: string
  message: string
  suggestion?: string
}

const errors: ValidationError[] = []

// Load all data files
const dataDir = join(__dirname, '..', 'data')

function loadData(filename: string): Record<string, unknown>[] {
  try {
    const content = readFileSync(join(dataDir, filename), 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error(`Error loading ${filename}:`, error)
    return []
  }
}

// Load actions.json to get all valid action names
const actions = loadData('actions.json')
const actionNames = new Set(actions.map((a) => (a.name as string) || ''))

// Create a map for fuzzy matching suggestions
const actionNamesLower = new Map<string, string>()
actions.forEach((a) => {
  const name = (a.name as string) || ''
  actionNamesLower.set(name.toLowerCase(), name)
})

console.log(`Loaded ${actionNames.size} actions from actions.json\n`)

// Data files that may contain action references
const dataFiles = [
  'abilities.json',
  'systems.json',
  'modules.json',
  'equipment.json',
  'bio-titans.json',
  'crawlers.json',
  'creatures.json',
  'meld.json',
  'npcs.json',
  'squads.json',
  'chassis.json',
]

function findSimilarAction(referencedName: string): string | undefined {
  const lower = referencedName.toLowerCase()

  // Exact case-insensitive match
  if (actionNamesLower.has(lower)) {
    return actionNamesLower.get(lower)
  }

  // Find close matches (same words, different case/spacing)
  for (const [lowerName, actualName] of actionNamesLower.entries()) {
    // Remove special characters and compare
    const normalize = (s: string) => s.replace(/[^a-z0-9]/g, '')
    if (normalize(lower) === normalize(lowerName)) {
      return actualName
    }
  }

  return undefined
}

// Validate action references in each data file
for (const filename of dataFiles) {
  const data = loadData(filename)

  for (const entity of data) {
    const entityName = String(entity.name ?? entity.id ?? 'unknown')

    // Check actions arrays
    if (entity.actions && Array.isArray(entity.actions)) {
      for (const actionRef of entity.actions) {
        if (typeof actionRef === 'string') {
          const actionName = actionRef
          if (!actionNames.has(actionName)) {
            const suggestion = findSimilarAction(actionName)
            errors.push({
              file: filename,
              entityName,
              field: 'actions',
              referencedName: actionName,
              message: `Action "${actionName}" not found in actions.json`,
              suggestion: suggestion ? `Did you mean "${suggestion}"?` : undefined,
            })
          }
        }
      }
    }

    // Check chassisAbilities arrays (for chassis.json)
    // Chassis abilities are now stored as actions in actions.json
    if (entity.chassisAbilities && Array.isArray(entity.chassisAbilities)) {
      for (const abilityRef of entity.chassisAbilities) {
        if (typeof abilityRef === 'string') {
          const abilityName = abilityRef
          if (!actionNames.has(abilityName)) {
            const suggestion = findSimilarAction(abilityName)
            errors.push({
              file: filename,
              entityName,
              field: 'chassisAbilities',
              referencedName: abilityName,
              message: `Chassis ability "${abilityName}" not found in actions.json`,
              suggestion: suggestion ? `Did you mean "${suggestion}"?` : undefined,
            })
          }
        }
      }
    }
  }

  if (data.length > 0) {
    console.log(`✅ Validated ${filename} (${data.length} entities)`)
  }
}

// Report results
console.log('\n' + '='.repeat(80))
if (errors.length === 0) {
  console.log('✅ All action references are valid!')
  process.exit(0)
} else {
  console.log(`❌ Found ${errors.length} invalid action reference(s):\n`)

  // Group errors by file for better readability
  const errorsByFile = new Map<string, ValidationError[]>()
  for (const error of errors) {
    if (!errorsByFile.has(error.file)) {
      errorsByFile.set(error.file, [])
    }
    errorsByFile.get(error.file)!.push(error)
  }

  for (const [file, fileErrors] of errorsByFile.entries()) {
    console.log(`\n${file}:`)
    for (const error of fileErrors) {
      console.log(`  ${error.entityName}`)
      console.log(`    Field: ${error.field}`)
      console.log(`    ${error.message}`)
      if (error.suggestion) {
        console.log(`    💡 ${error.suggestion}`)
      }
      console.log()
    }
  }

  console.log(`\nTotal: ${errors.length} invalid reference(s)`)
  process.exit(1)
}
