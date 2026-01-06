#!/usr/bin/env bun
/**
 * Migrate data files to reference actions by name instead of embedding them
 */

import { join } from 'path'

async function main() {
  const dataFiles = [
    'data/abilities.json',
    'data/systems.json',
    'data/modules.json',
    'data/equipment.json',
    'data/bio-titans.json',
    'data/crawlers.json',
    'data/creatures.json',
    'data/meld.json',
    'data/npcs.json',
    'data/squads.json',
  ]

  // Load actions.json to create a lookup map
  const actionsPath = join(import.meta.dir, '..', 'src', 'reference', 'data', 'actions.json')
  const actionsFile = Bun.file(actionsPath)
  const actionsData = (await actionsFile.json()) as Array<{
    id: string
    name: string
    [key: string]: unknown
  }>

  // Create maps for lookup
  const actionByIdMap = new Map<string, string>() // id -> name
  const actionByNameMap = new Map<string, { id: string; [key: string]: unknown }>() // name -> action

  for (const action of actionsData) {
    actionByIdMap.set(action.id, action.name)
    actionByNameMap.set(action.name, action)
  }

  console.log(`Loaded ${actionsData.length} actions from actions.json`)

  // Function to normalize action for comparison
  function normalizeAction(action: any): string {
    return JSON.stringify({
      name: action.name,
      content: action.content,
      activationCost: action.activationCost,
      actionType: action.actionType,
      range: action.range,
      damage: action.damage,
      traits: action.traits,
      hidden: action.hidden,
      structurePoints: action.structurePoints,
      energyPoints: action.energyPoints,
      heatCapacity: action.heatCapacity,
      systemSlots: action.systemSlots,
      moduleSlots: action.moduleSlots,
      cargoCapacity: action.cargoCapacity,
      techLevel: action.techLevel,
      salvageValue: action.salvageValue,
      choices: action.choices,
      table: action.table,
    })
  }

  // Migrate each data file
  for (const file of dataFiles) {
    const filePath = join(import.meta.dir, '..', file)
    const fileHandle = Bun.file(filePath)
    if (!(await fileHandle.exists())) {
      console.log(`⚠️  Skipping ${file} (not found)`)
      continue
    }

    const data = (await fileHandle.json()) as Array<{
      actions?: unknown[]
      name?: string
      id?: string
      [key: string]: unknown
    }>
    let totalActions = 0
    let migratedActions = 0
    let missingActions = 0

    for (const entity of data) {
      if (entity.actions && Array.isArray(entity.actions)) {
        totalActions += entity.actions.length

        // Replace actions array with array of action names
        const actionNames: string[] = []

        for (const actionItem of entity.actions) {
          // Type guard for action objects
          if (typeof actionItem !== 'object' || actionItem === null) continue
          const action = actionItem as { id?: string; name?: string; [key: string]: unknown }
          // Try to find action by ID first
          let actionName: string | undefined = action.id ? actionByIdMap.get(action.id) : undefined

          // If not found by ID, try to find by matching content
          if (!actionName) {
            const normalized = normalizeAction(action)
            for (const [name, storedAction] of actionByNameMap.entries()) {
              if (normalizeAction(storedAction) === normalized) {
                actionName = name
                break
              }
            }
          }

          // If still not found, use the action's name directly (should exist in actions.json)
          if (!actionName) {
            if (action.name && actionByNameMap.has(action.name)) {
              actionName = action.name
            } else {
              console.warn(
                `⚠️  Action not found in actions.json: ${action.name || action.id || 'unknown'} in ${file}/${entity.name || entity.id || 'unknown'}`
              )
              missingActions++
              // Use the action's name anyway - it should be in actions.json
              actionName = action.name || action.id
            }
          }

          if (actionName) {
            actionNames.push(actionName)
            migratedActions++
          }
        }

        // Replace the actions array with names
        entity.actions = actionNames
      }
    }

    // Write back to file
    await Bun.write(filePath, JSON.stringify(data, null, 2) + '\n')
    console.log(
      `✅ Migrated ${file}: ${migratedActions}/${totalActions} actions (${missingActions} missing)`
    )
  }

  console.log('\n✅ Migration complete!')
}

main()
