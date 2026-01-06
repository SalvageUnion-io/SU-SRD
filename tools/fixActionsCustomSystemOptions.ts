#!/usr/bin/env bun
/**
 * Fix actions.json to convert embedded actions in customSystemOptions to string references
 */

import { join } from 'path'

async function main() {
  const actionsPath = join(import.meta.dir, '..', 'src', 'reference', 'data', 'actions.json')
  const actionsFile = Bun.file(actionsPath)
  const actionsData = (await actionsFile.json()) as Array<{
    id: string
    name: string
    choices?: Array<{
      customSystemOptions?: Array<{
        actions?: unknown[]
        [key: string]: unknown
      }>
      [key: string]: unknown
    }>
    [key: string]: unknown
  }>

  let fixed = 0

  for (const action of actionsData) {
    if (action.choices && Array.isArray(action.choices)) {
      for (const choice of action.choices) {
        if (choice.customSystemOptions && Array.isArray(choice.customSystemOptions)) {
          for (const option of choice.customSystemOptions) {
            if (option.actions && Array.isArray(option.actions)) {
              // Convert embedded action objects to action names
              const actionNames: string[] = []
              for (const embeddedAction of option.actions) {
                if (
                  typeof embeddedAction === 'object' &&
                  embeddedAction !== null &&
                  'name' in embeddedAction
                ) {
                  actionNames.push(embeddedAction.name as string)
                  fixed++
                } else if (typeof embeddedAction === 'string') {
                  actionNames.push(embeddedAction)
                }
              }
              option.actions = actionNames
            }
          }
        }
      }
    }
  }

  // Remove any extra properties that shouldn't be in actions
  for (const action of actionsData) {
    // Keep only valid action properties
    const validKeys = new Set([
      'id',
      'name',
      'content',
      'activationCost',
      'actionType',
      'range',
      'damage',
      'traits',
      'hidden',
      'structurePoints',
      'energyPoints',
      'heatCapacity',
      'systemSlots',
      'moduleSlots',
      'cargoCapacity',
      'techLevel',
      'salvageValue',
      'choices',
      'table',
    ])

    const keysToRemove: string[] = []
    for (const key in action) {
      if (!validKeys.has(key)) {
        keysToRemove.push(key)
      }
    }

    for (const key of keysToRemove) {
      delete action[key]
      fixed++
    }
  }

  await Bun.write(actionsPath, JSON.stringify(actionsData, null, 2) + '\n')
  console.log(`✅ Fixed ${fixed} issues in actions.json`)
}

main()
