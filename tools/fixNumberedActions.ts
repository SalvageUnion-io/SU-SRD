#!/usr/bin/env bun
/**
 * Fix actions with numbers in parenthesis by:
 * 1. Finding all actions with names like "Bar (2)"
 * 2. Finding which equipment/module/system references them
 * 3. Setting displayName to the un-parenthesized name ("Bar")
 * 4. Renaming the action to include the caller ("Bar (Foo)")
 * 5. Updating the caller to reference the new name
 */

import { join } from 'path'

async function main() {
  const dataDir = join(import.meta.dir, '..', 'src', 'reference', 'data')

  interface Action {
    id: string
    name: string
    displayName?: string
    [key: string]: unknown
  }

  interface Entity {
    id: string
    name: string
    actions?: string[]
    [key: string]: unknown
  }

  function findActionsWithNumbers(actions: Action[]): Action[] {
    const numberPattern = /^(.+?)\s*\((\d+)\)$/
    return actions.filter((action) => numberPattern.test(action.name))
  }

  function extractBaseName(actionName: string): string {
    const match = actionName.match(/^(.+?)\s*\(\d+\)$/)
    return match && match[1] ? match[1].trim() : actionName
  }

  function findCallers(
    actionName: string,
    entities: Entity[]
  ): Array<{ entity: Entity; actionIndex: number }> {
    const callers: Array<{ entity: Entity; actionIndex: number }> = []

    for (const entity of entities) {
      if (!entity.actions || !Array.isArray(entity.actions)) continue

      for (let i = 0; i < entity.actions.length; i++) {
        if (entity.actions[i] === actionName) {
          callers.push({ entity, actionIndex: i })
        }
      }
    }

    return callers
  }

  // Read actions
  const actionsPath = join(dataDir, 'actions.json')
  const actionsFile = Bun.file(actionsPath)
  const actions: Action[] = (await actionsFile.json()) as Action[]

  // Read all entity files that might reference actions
  const entityFiles = [
    'equipment.json',
    'modules.json',
    'systems.json',
    'abilities.json',
    'bio-titans.json',
    'crawlers.json',
    'creatures.json',
    'meld.json',
    'npcs.json',
    'squads.json',
  ]

  const allEntities: Entity[] = []
  for (const file of entityFiles) {
    const filePath = join(dataDir, file)
    const fileHandle = Bun.file(filePath)
    if (await fileHandle.exists()) {
      const entities: Entity[] = (await fileHandle.json()) as Entity[]
      allEntities.push(...entities)
    }
  }

  // Find actions with numbers
  const numberedActions = findActionsWithNumbers(actions)

  console.log(`Found ${numberedActions.length} actions with numbers in parenthesis`)

  // Track changes
  const actionUpdates = new Map<string, { newName: string; displayName: string }>()
  const entityUpdates = new Map<string, Map<number, string>>() // entity id -> action index -> new name

  // Process each numbered action
  for (const action of numberedActions) {
    const baseName = extractBaseName(action.name)
    const callers = findCallers(action.name, allEntities)

    if (callers.length === 0) {
      console.warn(`Warning: Action "${action.name}" has no callers, skipping`)
      continue
    }

    if (callers.length > 1) {
      const firstCaller = callers[0]
      if (firstCaller) {
        console.warn(
          `Warning: Action "${action.name}" has ${callers.length} callers. Using first caller: "${firstCaller.entity.name}"`
        )
      }
    }

    const firstCaller = callers[0]
    if (!firstCaller) {
      console.warn(`Warning: No caller found for action "${action.name}", skipping`)
      continue
    }
    const caller = firstCaller.entity
    const newName = `${baseName} (${caller.name})`
    const displayName = baseName

    // Record action update
    actionUpdates.set(action.id, { newName, displayName })

    // Record entity update
    if (!entityUpdates.has(caller.id)) {
      entityUpdates.set(caller.id, new Map())
    }
    const callerUpdates = entityUpdates.get(caller.id)
    if (callerUpdates) {
      callerUpdates.set(firstCaller.actionIndex, newName)
    }

    console.log(
      `  "${action.name}" -> "${newName}" (displayName: "${displayName}") called by "${caller.name}"`
    )
  }

  // Update actions
  for (const action of actions) {
    const update = actionUpdates.get(action.id)
    if (update) {
      action.name = update.newName
      action.displayName = update.displayName
    }
  }

  // Update entities
  for (const file of entityFiles) {
    const filePath = join(dataDir, file)
    const fileHandle = Bun.file(filePath)
    if (!(await fileHandle.exists())) continue

    const entities: Entity[] = (await fileHandle.json()) as Entity[]
    let changed = false

    for (const entity of entities) {
      const updates = entityUpdates.get(entity.id)
      if (updates && entity.actions) {
        for (const [index, newName] of updates) {
          if (entity.actions[index] !== newName) {
            entity.actions[index] = newName
            changed = true
          }
        }
      }
    }

    if (changed) {
      await Bun.write(filePath, JSON.stringify(entities, null, 2) + '\n')
      console.log(`Updated ${file}`)
    }
  }

  // Write updated actions
  await Bun.write(actionsPath, JSON.stringify(actions, null, 2) + '\n')
  console.log(`Updated actions.json`)

  console.log(`\nDone! Updated ${actionUpdates.size} actions and their callers.`)
}

main()
