/**
 * Extract all actions from data files and create actions.json
 * Deduplicates by content hash, ensuring unique action names
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

interface Action {
  id: string
  name: string
  content?: unknown[]
  activationCost?: number | string
  actionType?: string
  range?: string[]
  damage?: { damageType: string; amount: number | string }
  traits?: Array<{ type: string; amount?: number | string }>
  hidden?: boolean
  structurePoints?: number
  energyPoints?: number
  heatCapacity?: number
  systemSlots?: number
  moduleSlots?: number
  cargoCapacity?: number
  techLevel?: number
  salvageValue?: number
  choices?: unknown[]
  table?: unknown
}

function hashContent(content: unknown[] | undefined): string {
  if (!content || !Array.isArray(content)) return ''
  return JSON.stringify(
    content.map((c: any) => ({
      type: c.type,
      value: typeof c.value === 'string' ? c.value : JSON.stringify(c.value),
    }))
  )
}

function normalizeAction(action: Action): string {
  // Create normalized version for comparison (excluding id)
  return JSON.stringify({
    name: action.name,
    content: hashContent(action.content as unknown[]),
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

const allActions: Action[] = []
const contentHashMap = new Map<string, Action>() // content hash -> canonical action

// Collect all actions
for (const file of dataFiles) {
  const filePath = path.join(__dirname, '..', file)
  if (!fs.existsSync(filePath)) continue

  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))

  for (const entity of data) {
    if (entity.actions && Array.isArray(entity.actions)) {
      for (const action of entity.actions) {
        allActions.push(action as Action)
      }
    }
  }
}

console.log(`Total actions found: ${allActions.length}`)

// Deduplicate by content hash
for (const action of allActions) {
  const contentHash = hashContent(action.content as unknown[])
  const normalized = normalizeAction(action)

  if (contentHash && contentHashMap.has(contentHash)) {
    // Action with identical content already exists, skip
    continue
  }

  // Check if we already have an action with this exact normalized content
  let found = false
  for (const [, existing] of contentHashMap.entries()) {
    if (normalizeAction(existing) === normalized) {
      found = true
      break
    }
  }

  if (!found) {
    contentHashMap.set(contentHash || action.id, action)
  }
}

console.log(`Unique actions by content: ${contentHashMap.size}`)

// Build final actions array, ensuring name uniqueness
const finalActions: Action[] = []
const usedNames = new Set<string>()

for (const action of contentHashMap.values()) {
  let actionName = action.name
  let counter = 1

  // Ensure name uniqueness
  while (usedNames.has(actionName)) {
    actionName = `${action.name} (${counter})`
    counter++
  }

  usedNames.add(actionName)
  finalActions.push({
    ...action,
    name: actionName,
  })
}

// Sort by name for consistency
finalActions.sort((a, b) => a.name.localeCompare(b.name))

console.log(`Final unique actions: ${finalActions.length}`)

// Write to actions.json
const outputPath = path.join(__dirname, '..', 'data', 'actions.json')
fs.writeFileSync(outputPath, JSON.stringify(finalActions, null, 2) + '\n')
console.log(`✅ Created ${outputPath} with ${finalActions.length} actions`)
