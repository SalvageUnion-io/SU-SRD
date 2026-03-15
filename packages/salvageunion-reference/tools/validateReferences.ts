#!/usr/bin/env tsx
/**
 * Validates cross-references in the Salvage Union data
 * Checks that system/module/entity references exist in their respective data files
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

const systems = loadData('systems.json')
const modules = loadData('modules.json')
const chassis = loadData('chassis.json')
const vehicles = loadData('vehicles.json')
const drones = loadData('drones.json')
const actions = loadData('actions.json')
const equipment = loadData('equipment.json')
const abilities = loadData('abilities.json')
const traits = loadData('traits.json')
const keywords = loadData('keywords.json')

// Create lookup sets for fast validation
const systemNames = new Set(systems.map((s) => s.name as string))
const moduleNames = new Set(modules.map((m) => m.name as string))

// Schema name to entity names mapping for schemaEntities validation
const schemaEntityNames: Record<string, Set<string>> = {
  systems: systemNames,
  modules: moduleNames,
  abilities: new Set(abilities.map((a) => a.name as string)),
  traits: new Set(traits.map((t) => t.name as string)),
  keywords: new Set(keywords.map((k) => k.name as string)),
  equipment: new Set(equipment.map((e) => e.name as string)),
}

console.log(`Loaded ${systemNames.size} systems and ${moduleNames.size} modules`)

// Validate chassis patterns
console.log('\nValidating chassis patterns...')
for (const chassisItem of chassis) {
  if (!chassisItem.patterns || !Array.isArray(chassisItem.patterns)) continue

  for (const pattern of chassisItem.patterns) {
    // Validate systems in pattern
    if (pattern.systems) {
      for (const system of pattern.systems) {
        const systemName = typeof system === 'string' ? system : system.name
        if (!systemNames.has(systemName)) {
          errors.push({
            file: 'chassis.json',
            entityName: String(chassisItem.name ?? 'unknown'),
            field: `patterns.${(pattern as { name?: string }).name ?? 'unknown'}.systems`,
            referencedName: systemName,
            message: `System "${systemName}" not found in systems.json`,
          })
        }
      }
    }

    // Validate modules in pattern
    if (pattern.modules) {
      for (const module of pattern.modules) {
        const moduleName = typeof module === 'string' ? module : module.name
        if (!moduleNames.has(moduleName)) {
          errors.push({
            file: 'chassis.json',
            entityName: String(chassisItem.name ?? 'unknown'),
            field: `patterns.${(pattern as { name?: string }).name ?? 'unknown'}.modules`,
            referencedName: moduleName,
            message: `Module "${moduleName}" not found in modules.json`,
          })
        }
      }
    }

    // Validate drone configurations if present
    const drones = (
      pattern as { drones?: Array<{ name?: string; systems?: string[]; modules?: string[] }> }
    ).drones
    if (drones && Array.isArray(drones)) {
      for (const droneConfig of drones) {
        const droneName = droneConfig.name ?? 'unknown'
        if (droneConfig.systems && Array.isArray(droneConfig.systems)) {
          for (const systemName of droneConfig.systems) {
            if (!systemNames.has(systemName)) {
              errors.push({
                file: 'chassis.json',
                entityName: String(chassisItem.name ?? 'unknown'),
                field: `patterns.${(pattern as { name?: string }).name ?? 'unknown'}.drones.${droneName}.systems`,
                referencedName: systemName,
                message: `Drone system "${systemName}" not found in systems.json`,
              })
            }
          }
        }

        if (droneConfig.modules && Array.isArray(droneConfig.modules)) {
          for (const moduleName of droneConfig.modules) {
            if (!moduleNames.has(moduleName)) {
              errors.push({
                file: 'chassis.json',
                entityName: String(chassisItem.name ?? 'unknown'),
                field: `patterns.${(pattern as { name?: string }).name ?? 'unknown'}.drones.${droneName}.modules`,
                referencedName: moduleName,
                message: `Drone module "${moduleName}" not found in modules.json`,
              })
            }
          }
        }
      }
    }
  }
}

// Validate vehicle systems
console.log('Validating vehicle systems...')
for (const vehicle of vehicles) {
  const systems = vehicle.systems
  if (!systems || !Array.isArray(systems)) continue

  for (const systemName of systems) {
    if (typeof systemName !== 'string') continue
    if (!systemNames.has(systemName)) {
      errors.push({
        file: 'vehicles.json',
        entityName: String(vehicle.name ?? 'unknown'),
        field: 'systems',
        referencedName: systemName,
        message: `System "${systemName}" not found in systems.json`,
      })
    }
  }
}

// Validate drone systems and modules
console.log('Validating drone systems and modules...')
for (const drone of drones) {
  const systems = drone.systems
  if (systems && Array.isArray(systems)) {
    for (const systemName of systems) {
      if (typeof systemName !== 'string') continue
      // Check if it's a system or module
      if (!systemNames.has(systemName) && !moduleNames.has(systemName)) {
        errors.push({
          file: 'drones.json',
          entityName: String(drone.name ?? 'unknown'),
          field: 'systems',
          referencedName: systemName,
          message: `"${systemName}" not found in systems.json or modules.json`,
        })
      }
    }
  }
}

// Helper to validate choices recursively (actions can contain nested choices)
interface Choice {
  id?: string
  name?: string
  schemaEntities?: string[]
  schema?: string[]
  choices?: Choice[]
}

interface EntityWithChoices {
  name?: string
  choices?: Choice[]
  actions?: Array<{ name?: string; choices?: Choice[] }>
}

function validateChoicesSchemaEntities(
  entity: EntityWithChoices,
  sourceFile: string,
  entityName: string,
  choicePath: string,
  choices: Choice[]
) {
  for (const choice of choices) {
    const choiceId = choice.id || choice.name || 'unknown'
    const currentPath = `${choicePath}.${choiceId}`

    // Check if this choice has schemaEntities and schema
    if (choice.schemaEntities && choice.schemaEntities.length > 0) {
      const targetSchemas = choice.schema || []

      if (targetSchemas.length === 0) {
        // schemaEntities without schema - can't validate target
        errors.push({
          file: sourceFile,
          entityName,
          field: `${currentPath}.schemaEntities`,
          referencedName: choice.schemaEntities.join(', '),
          message: `schemaEntities defined but no schema specified to validate against`,
        })
      } else {
        // Build a set of all valid entity names from the target schemas
        const validNames = new Set<string>()
        for (const schemaName of targetSchemas) {
          const schemaEntities = schemaEntityNames[schemaName]
          if (schemaEntities) {
            for (const name of schemaEntities) {
              validNames.add(name)
            }
          }
        }

        // Validate each schemaEntity
        for (const entityRef of choice.schemaEntities) {
          if (!validNames.has(entityRef)) {
            errors.push({
              file: sourceFile,
              entityName,
              field: `${currentPath}.schemaEntities`,
              referencedName: entityRef,
              message: `Entity "${entityRef}" not found in schemas: ${targetSchemas.join(', ')}`,
            })
          }
        }
      }
    }

    // Recursively validate nested choices
    if (choice.choices && Array.isArray(choice.choices)) {
      validateChoicesSchemaEntities(entity, sourceFile, entityName, currentPath, choice.choices)
    }
  }
}

// Validate schemaEntities in actions.json
console.log('Validating schemaEntities in actions...')
for (const action of actions as EntityWithChoices[]) {
  const actionName = String(action.name ?? 'unknown')

  // Check top-level choices
  if (action.choices && Array.isArray(action.choices)) {
    validateChoicesSchemaEntities(action, 'actions.json', actionName, 'choices', action.choices)
  }
}

// Validate schemaEntities in equipment.json
console.log('Validating schemaEntities in equipment...')
for (const item of equipment as EntityWithChoices[]) {
  const itemName = String(item.name ?? 'unknown')

  // Check choices in actions
  if (item.actions && Array.isArray(item.actions)) {
    for (const action of item.actions) {
      if (action.choices && Array.isArray(action.choices)) {
        const actionName = action.name || 'unknown'
        validateChoicesSchemaEntities(
          item,
          'equipment.json',
          itemName,
          `actions.${actionName}.choices`,
          action.choices
        )
      }
    }
  }
}

// Report results
console.log('\n' + '='.repeat(80))
if (errors.length === 0) {
  console.log('✅ All cross-references are valid!')
  process.exit(0)
} else {
  console.log(`❌ Found ${errors.length} invalid reference(s):\n`)
  for (const error of errors) {
    console.log(`  ${error.file} - ${error.entityName}`)
    console.log(`    Field: ${error.field}`)
    console.log(`    ${error.message}\n`)
  }
  process.exit(1)
}
