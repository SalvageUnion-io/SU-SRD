/**
 * Migrate data files to reference actions by name instead of embedding them
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
const actionsPath = path.join(__dirname, '..', 'data', 'actions.json')
const actionsData = JSON.parse(fs.readFileSync(actionsPath, 'utf8')) as Array<{
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
  const filePath = path.join(__dirname, '..', file)
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${file} (not found)`)
    continue
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  let totalActions = 0
  let migratedActions = 0
  let missingActions = 0

  for (const entity of data) {
    if (entity.actions && Array.isArray(entity.actions)) {
      totalActions += entity.actions.length

      // Replace actions array with array of action names
      const actionNames: string[] = []

      for (const action of entity.actions) {
        // Try to find action by ID first
        let actionName: string | undefined = actionByIdMap.get(action.id)

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
              `⚠️  Action not found in actions.json: ${action.name || action.id} in ${file}/${entity.name || entity.id}`
            )
            missingActions++
            // Use the action's name anyway - it should be in actions.json
            actionName = action.name
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
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n')
  console.log(
    `✅ Migrated ${file}: ${migratedActions}/${totalActions} actions (${missingActions} missing)`
  )
}

console.log('\n✅ Migration complete!')
