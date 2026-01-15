#!/usr/bin/env bun

/**
 * Fix action duplicates by:
 * 1. Merging actions where one is a superset (remove numbered version, keep unnumbered)
 * 2. Creating contextual names for actions that differ (e.g., "Titanic Actions" -> "Scylla Titanic Actions")
 * 3. Setting displayName to the base name (without numbers)
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

interface Action {
  id: string
  name: string
  displayName?: string
  [key: string]: unknown
}

interface Entity {
  name: string
  actions?: string[]
  [key: string]: unknown
}

function isSuperset(superset: Action, subset: Action): boolean {
  const supersetKeys = new Set(Object.keys(superset))
  const subsetKeys = new Set(Object.keys(subset))

  // Check if all keys in subset are in superset
  for (const key of subsetKeys) {
    if (key === 'id' || key === 'name') continue
    if (!supersetKeys.has(key)) return false

    // Deep compare values
    const supersetVal = JSON.stringify(superset[key])
    const subsetVal = JSON.stringify(subset[key])
    if (supersetVal !== subsetVal) return false
  }
  return true
}

function fixDuplicates() {
  const actionsPath = join(import.meta.dir, '..', 'data', 'actions.json')
  const actions: Action[] = JSON.parse(readFileSync(actionsPath, 'utf-8'))

  const analysisPath = join(import.meta.dir, '..', 'action-duplicates-analysis.json')
  const analysis = JSON.parse(readFileSync(analysisPath, 'utf-8'))

  // Create maps for quick lookup
  const actionMap = new Map<string, Action>()
  const actionById = new Map<string, Action>()

  for (const action of actions) {
    actionMap.set(action.name, action)
    actionById.set(action.id, action)
  }

  // Track changes
  const actionsToRemove: string[] = []
  const actionsToUpdate: Map<string, Action> = new Map()
  const nameMappings: Map<string, string> = new Map() // old name -> new name

  // Process duplicates
  for (const duplicate of analysis.duplicates) {
    const { baseName, unnumbered, numbered } = duplicate

    // Check if we can merge (one is superset)
    if (unnumbered.length === 1 && numbered.length === 1) {
      const un = actionMap.get(unnumbered[0].name)!
      const num = actionMap.get(numbered[0].name)!

      const unIsSuperset = isSuperset(un, num)
      const numIsSuperset = isSuperset(num, un)

      if (unIsSuperset && !numIsSuperset) {
        // Unnumbered is superset - remove numbered, keep unnumbered
        console.log(`Merging: Keeping "${un.name}", removing "${num.name}"`)
        actionsToRemove.push(num.name)
        // Set displayName to base name (already is, but be explicit)
        if (!un.displayName) {
          un.displayName = baseName
          actionsToUpdate.set(un.name, un)
        }
      } else if (numIsSuperset && !unIsSuperset) {
        // Numbered is superset - merge into unnumbered name
        console.log(`Merging: Moving "${num.name}" to "${un.name}", removing "${num.name}"`)
        // Merge properties from numbered into unnumbered
        for (const [key, value] of Object.entries(num)) {
          if (key !== 'id' && key !== 'name' && !(key in un)) {
            un[key] = value
          }
        }
        actionsToRemove.push(num.name)
        nameMappings.set(num.name, un.name)
        if (!un.displayName) {
          un.displayName = baseName
        }
        actionsToUpdate.set(un.name, un)
      } else {
        // They differ - need contextual names
        console.log(`Differing: Need contextual names for "${baseName}"`)
        // This will be handled below
      }
    } else {
      // Multiple numbered variants or multiple unnumbered - need contextual names
      console.log(`Multiple variants: Need contextual names for "${baseName}"`)
    }
  }

  // Handle actions that need contextual names
  // For now, we'll focus on "Titanic Actions" and "Armour Plating" which are used by bio-titans
  const contextualActions = [
    {
      baseName: 'Titanic Actions',
      entities: [
        'Scylla',
        'Typhon',
        'Chrysalis',
        'Phantom',
        'Electrophorus',
        'Tyrant',
        'Meld Behemoth',
      ],
    },
    { baseName: 'Armour Plating', entities: ['Scylla', 'Typhon'] },
  ]

  // Load entity data to find which entity uses which action
  const schemas = ['bio-titans', 'meld']
  const entityActionMap = new Map<string, { schema: string; entityName: string }[]>()

  for (const schema of schemas) {
    try {
      const schemaPath = join(import.meta.dir, '..', 'data', `${schema}.json`)
      const entities: Entity[] = JSON.parse(readFileSync(schemaPath, 'utf-8'))

      for (const entity of entities) {
        if (entity.actions) {
          for (const actionName of entity.actions) {
            if (!entityActionMap.has(actionName)) {
              entityActionMap.set(actionName, [])
            }
            entityActionMap.get(actionName)!.push({
              schema,
              entityName: entity.name,
            })
          }
        }
      }
    } catch (e) {
      // Schema might not exist
    }
  }

  // Process contextual actions
  for (const { baseName } of contextualActions) {
    const duplicate = analysis.duplicates.find((d: { baseName: string }) => d.baseName === baseName)
    if (!duplicate) continue

    const { unnumbered, numbered } = duplicate

    // Process numbered variants
    for (const numberedAction of numbered) {
      const action = actionMap.get(numberedAction.name)!
      const refs = entityActionMap.get(numberedAction.name) || []

      if (refs.length > 0) {
        // Use first entity as context
        const firstRef = refs[0]
        if (!firstRef) return
        const entityName = firstRef.entityName
        const newName = `${entityName} ${baseName}`

        console.log(`Renaming "${action.name}" to "${newName}"`)
        nameMappings.set(action.name, newName)
        action.name = newName
        action.displayName = baseName
        actionsToUpdate.set(newName, action)
      }
    }

    // Process unnumbered variant if it exists
    if (unnumbered.length > 0) {
      const unAction = actionMap.get(unnumbered[0].name)!
      const refs = entityActionMap.get(unnumbered[0].name) || []

      if (refs.length > 0) {
        const firstRef = refs[0]
        if (!firstRef) return
        const entityName = firstRef.entityName
        const newName = `${entityName} ${baseName}`

        console.log(`Renaming "${unAction.name}" to "${newName}"`)
        nameMappings.set(unAction.name, newName)
        unAction.name = newName
        unAction.displayName = baseName
        actionsToUpdate.set(newName, unAction)
      }
    }
  }

  // Apply updates to actions array
  const updatedActions = actions
    .filter((action) => !actionsToRemove.includes(action.name))
    .map((action) => {
      if (actionsToUpdate.has(action.name)) {
        return actionsToUpdate.get(action.name)!
      }
      return action
    })

  // Update entity references
  console.log('\n=== Updating entity references ===')
  for (const schema of [
    'bio-titans',
    'meld',
    'equipment',
    'systems',
    'modules',
    'npcs',
    'squads',
    'abilities',
  ]) {
    try {
      const schemaPath = join(import.meta.dir, '..', 'data', `${schema}.json`)
      const entities: Entity[] = JSON.parse(readFileSync(schemaPath, 'utf-8'))
      let updated = false

      for (const entity of entities) {
        if (entity.actions) {
          for (let i = 0; i < entity.actions.length; i++) {
            const oldName = entity.actions[i]
            if (oldName && nameMappings.has(oldName)) {
              const newName = nameMappings.get(oldName)!
              console.log(`  ${schema}:${entity.name}: "${oldName}" -> "${newName}"`)
              entity.actions[i] = newName
              updated = true
            }
          }
        }
      }

      if (updated) {
        writeFileSync(schemaPath, JSON.stringify(entities, null, 2) + '\n')
        console.log(`  Updated ${schema}.json`)
      }
    } catch (e) {
      // Schema might not exist
    }
  }

  // Write updated actions
  writeFileSync(actionsPath, JSON.stringify(updatedActions, null, 2) + '\n')
  console.log(`\nUpdated actions.json (removed ${actionsToRemove.length} actions)`)

  // Write name mappings for reference
  const mappingsPath = join(import.meta.dir, '..', 'action-name-mappings.json')
  writeFileSync(mappingsPath, JSON.stringify(Object.fromEntries(nameMappings), null, 2) + '\n')
  console.log(`Saved name mappings to action-name-mappings.json`)
}

fixDuplicates()
