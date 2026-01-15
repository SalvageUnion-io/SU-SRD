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

// Create lookup sets for fast validation
const systemNames = new Set(systems.map((s) => s.name as string))
const moduleNames = new Set(modules.map((m) => m.name as string))

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

    // Validate drone systems and modules if present
    if (pattern.drone) {
      const drone = pattern.drone as { systems?: string[]; modules?: string[] } | undefined
      if (drone?.systems && Array.isArray(drone.systems)) {
        for (const systemName of drone.systems) {
          if (!systemNames.has(systemName)) {
            errors.push({
              file: 'chassis.json',
              entityName: String(chassisItem.name ?? 'unknown'),
              field: `patterns.${(pattern as { name?: string }).name ?? 'unknown'}.drone.systems`,
              referencedName: systemName,
              message: `Drone system "${systemName}" not found in systems.json`,
            })
          }
        }
      }

      if (drone?.modules && Array.isArray(drone.modules)) {
        for (const moduleName of drone.modules) {
          if (!moduleNames.has(moduleName)) {
            errors.push({
              file: 'chassis.json',
              entityName: String(chassisItem.name ?? 'unknown'),
              field: `patterns.${(pattern as { name?: string }).name ?? 'unknown'}.drone.modules`,
              referencedName: moduleName,
              message: `Drone module "${moduleName}" not found in modules.json`,
            })
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
