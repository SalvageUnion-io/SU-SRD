#!/usr/bin/env bun

/**
 * Analyze actions with numbers in their names to identify duplicates
 * and determine how to handle them.
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface Action {
  id: string
  name: string
  displayName?: string
  [key: string]: unknown
}

function extractBaseName(name: string): string {
  // Remove "(1)", "(2)", etc. from the end
  const match = name.match(/^(.+?)\s*\(\d+\)$/)
  return match && match[1] ? match[1].trim() : name
}

function hasNumberSuffix(name: string): boolean {
  return /\(\d+\)$/.test(name)
}

function analyzeDuplicates() {
  const actionsPath = join(import.meta.dir, '..', 'data', 'actions.json')
  const actions: Action[] = JSON.parse(readFileSync(actionsPath, 'utf-8'))

  // Group actions by base name
  const baseNameGroups = new Map<string, Action[]>()
  const numberedActions: Action[] = []
  const unnumberedActions: Action[] = []

  for (const action of actions) {
    if (hasNumberSuffix(action.name)) {
      numberedActions.push(action)
      const baseName = extractBaseName(action.name)
      if (!baseNameGroups.has(baseName)) {
        baseNameGroups.set(baseName, [])
      }
      baseNameGroups.get(baseName)!.push(action)
    } else {
      unnumberedActions.push(action)
    }
  }

  // Check for duplicates: actions with both numbered and unnumbered versions
  const duplicates = new Map<string, { numbered: Action[]; unnumbered: Action[] }>()

  for (const [baseName, numbered] of baseNameGroups.entries()) {
    const unnumbered = unnumberedActions.filter((a) => a.name === baseName)
    if (unnumbered.length > 0) {
      duplicates.set(baseName, { numbered, unnumbered })
    }
  }

  // Actions with only numbered variants (no unnumbered version)
  const onlyNumbered = new Map<string, Action[]>()
  for (const [baseName, numbered] of baseNameGroups.entries()) {
    if (!duplicates.has(baseName)) {
      onlyNumbered.set(baseName, numbered)
    }
  }

  console.log('=== ANALYSIS RESULTS ===\n')

  console.log(`Total actions: ${actions.length}`)
  console.log(`Actions with numbers: ${numberedActions.length}`)
  console.log(`Actions without numbers: ${unnumberedActions.length}\n`)

  console.log(`Actions with only numbered variants (can remove numbers): ${onlyNumbered.size}`)
  console.log(
    `Actions with both numbered and unnumbered (need contextual names): ${duplicates.size}\n`
  )

  if (onlyNumbered.size > 0) {
    console.log('=== ACTIONS WITH ONLY NUMBERED VARIANTS ===')
    console.log('(Can safely remove numbers and update references)\n')
    for (const [baseName, numbered] of onlyNumbered.entries()) {
      console.log(`"${baseName}": ${numbered.length} variant(s)`)
      numbered.forEach((a) => console.log(`  - "${a.name}" (id: ${a.id})`))
    }
    console.log()
  }

  if (duplicates.size > 0) {
    console.log('=== ACTIONS WITH DUPLICATES (NUMBERED + UNNUMBERED) ===')
    console.log('(Need contextual names based on entity that uses them)\n')
    for (const [baseName, { numbered, unnumbered }] of duplicates.entries()) {
      console.log(`"${baseName}":`)
      console.log(`  Unnumbered: ${unnumbered.length} action(s)`)
      unnumbered.forEach((a) => console.log(`    - "${a.name}" (id: ${a.id})`))
      console.log(`  Numbered: ${numbered.length} variant(s)`)
      numbered.forEach((a) => console.log(`    - "${a.name}" (id: ${a.id})`))

      // Check if one is a superset of the other
      // Ignore 'id' and 'name' fields since we already know names differ
      if (unnumbered.length === 1 && numbered.length === 1) {
        const un = unnumbered[0]
        const num = numbered[0]

        if (!un || !num) return

        // Get keys excluding 'id' and 'name' for comparison
        const unKeys = new Set(Object.keys(un).filter((k) => k !== 'id' && k !== 'name'))
        const numKeys = new Set(Object.keys(num).filter((k) => k !== 'id' && k !== 'name'))
        const allKeys = new Set([...unKeys, ...numKeys])

        // Check if unnumbered has all keys from numbered (and same values)
        const unHasMore = [...numKeys].every((k) => {
          if (!unKeys.has(k)) return false
          return JSON.stringify(un[k]) === JSON.stringify(num[k])
        })

        // Check if numbered has all keys from unnumbered (and same values)
        const numHasMore = [...unKeys].every((k) => {
          if (!numKeys.has(k)) return false
          return JSON.stringify(un[k]) === JSON.stringify(num[k])
        })

        if (unHasMore && !numHasMore) {
          console.log(`    → Unnumbered version is a superset (can merge)`)
        } else if (numHasMore && !unHasMore) {
          console.log(`    → Numbered version is a superset (can merge)`)
        } else if (unHasMore && numHasMore) {
          console.log(`    → Versions are identical (can merge)`)
        } else {
          console.log(`    → Versions differ (need contextual names)`)
          // Show detailed differences
          console.log(`      Differences:`)
          for (const key of allKeys) {
            const unVal = un[key]
            const numVal = num[key]
            const unHas = unKeys.has(key)
            const numHas = numKeys.has(key)

            if (!unHas && numHas) {
              console.log(
                `        - "${key}": only in numbered version: ${JSON.stringify(numVal).substring(0, 100)}`
              )
            } else if (unHas && !numHas) {
              console.log(
                `        - "${key}": only in unnumbered version: ${JSON.stringify(unVal).substring(0, 100)}`
              )
            } else if (JSON.stringify(unVal) !== JSON.stringify(numVal)) {
              const unStr = JSON.stringify(unVal).substring(0, 100)
              const numStr = JSON.stringify(numVal).substring(0, 100)
              console.log(`        - "${key}": differs`)
              console.log(`          Unnumbered: ${unStr}${unStr.length >= 100 ? '...' : ''}`)
              console.log(`          Numbered:   ${numStr}${numStr.length >= 100 ? '...' : ''}`)
            }
          }
        }
      }
      console.log()
    }
  }

  // Find which entities use these actions
  console.log('=== FINDING ENTITY REFERENCES ===\n')
  const schemas = [
    'bio-titans',
    'crawlers',
    'creatures',
    'equipment',
    'meld',
    'npcs',
    'squads',
    'systems',
    'modules',
    'abilities',
  ]

  const actionReferences = new Map<string, { schema: string; entityName: string }[]>()

  for (const schema of schemas) {
    try {
      const schemaPath = join(import.meta.dir, '..', 'data', `${schema}.json`)
      const entities: Array<{ name: string; actions?: string[] }> = JSON.parse(
        readFileSync(schemaPath, 'utf-8')
      )

      for (const entity of entities) {
        if (entity.actions) {
          for (const actionName of entity.actions) {
            if (hasNumberSuffix(actionName) || duplicates.has(extractBaseName(actionName))) {
              if (!actionReferences.has(actionName)) {
                actionReferences.set(actionName, [])
              }
              actionReferences.get(actionName)!.push({
                schema,
                entityName: entity.name,
              })
            }
          }
        }
      }
    } catch (e) {
      // Schema might not exist or might not have actions
    }
  }

  if (actionReferences.size > 0) {
    console.log('Actions referenced by entities:')
    for (const [actionName, refs] of actionReferences.entries()) {
      console.log(`\n"${actionName}":`)
      const bySchema = new Map<string, string[]>()
      for (const ref of refs) {
        if (!bySchema.has(ref.schema)) {
          bySchema.set(ref.schema, [])
        }
        bySchema.get(ref.schema)!.push(ref.entityName)
      }
      for (const [schema, entities] of bySchema.entries()) {
        console.log(`  ${schema}: ${entities.join(', ')}`)
      }
    }
  }

  // Write analysis to file
  const analysis = {
    onlyNumbered: Array.from(onlyNumbered.entries()).map(([baseName, actions]) => ({
      baseName,
      actions: actions.map((a) => ({ name: a.name, id: a.id })),
    })),
    duplicates: Array.from(duplicates.entries()).map(([baseName, { numbered, unnumbered }]) => ({
      baseName,
      unnumbered: unnumbered.map((a) => ({ name: a.name, id: a.id })),
      numbered: numbered.map((a) => ({ name: a.name, id: a.id })),
    })),
    references: Object.fromEntries(actionReferences),
  }

  writeFileSync(
    join(import.meta.dir, '..', 'action-duplicates-analysis.json'),
    JSON.stringify(analysis, null, 2)
  )

  console.log('\n=== Analysis saved to action-duplicates-analysis.json ===')
}

analyzeDuplicates()
