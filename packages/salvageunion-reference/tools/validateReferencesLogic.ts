/**
 * Pure logic for cross-reference validation in the Salvage Union data.
 * Checks that system/module/entity references exist in their respective data
 * files, and that `tableName` references resolve to a real roll table.
 *
 * Extracted from tools/validateReferences.ts so both the standalone CLI and
 * the unified runner (tools/validate.ts) share one implementation over a
 * caller-supplied data bag, instead of each re-reading `data/*.json` itself.
 */

export type ValidationError = {
  file: string
  entityName: string
  field: string
  referencedName: string
  message: string
}

type Rec = Record<string, unknown>

function bag(filesByName: Record<string, unknown[]>, filename: string): Rec[] {
  return (filesByName[filename] ?? []) as Rec[]
}

interface Choice {
  id?: string
  name?: string
  /**
   * The unified option source. Shortlist references live at
   * `source.entities` + `source.schema`; the legacy `schemaEntities`/`schema`
   * duplicates are deliberately NOT read here — validating the copy that is
   * being retired means the check evaporates the day it is deleted.
   */
  source?: { kind?: string; entities?: string[]; schema?: string[] }
  choices?: Choice[]
}

/** The shortlist a catalog choice references, or null when it has none. */
function catalogShortlist(choice: Choice): { entities: string[]; schema: string[] } | null {
  const source = choice.source
  if (source?.kind !== 'catalog') return null
  if (!source.entities || source.entities.length === 0) return null
  return { entities: source.entities, schema: source.schema ?? [] }
}

interface EntityWithChoices {
  name?: string
  choices?: Choice[]
  actions?: Array<{ name?: string; choices?: Choice[] }>
}

function validateChoicesSchemaEntities(
  sourceFile: string,
  entityName: string,
  choicePath: string,
  choices: Choice[],
  schemaEntityNames: Record<string, Set<string>>,
  errors: ValidationError[]
) {
  for (const choice of choices) {
    const choiceId = choice.id || choice.name || 'unknown'
    const currentPath = `${choicePath}.${choiceId}`

    const shortlist = catalogShortlist(choice)
    if (shortlist) {
      const targetSchemas = shortlist.schema

      if (targetSchemas.length === 0) {
        errors.push({
          file: sourceFile,
          entityName,
          field: `${currentPath}.source.entities`,
          referencedName: shortlist.entities.join(', '),
          message: `source.entities defined but no source.schema specified to validate against`,
        })
      } else {
        const validNames = new Set<string>()
        for (const schemaName of targetSchemas) {
          const schemaEntities = schemaEntityNames[schemaName]
          if (schemaEntities) {
            for (const name of schemaEntities) {
              validNames.add(name)
            }
          }
        }

        for (const entityRef of shortlist.entities) {
          if (!validNames.has(entityRef)) {
            errors.push({
              file: sourceFile,
              entityName,
              field: `${currentPath}.source.entities`,
              referencedName: entityRef,
              message: `Entity "${entityRef}" not found in schemas: ${targetSchemas.join(', ')}`,
            })
          }
        }
      }
    }

    if (choice.choices && Array.isArray(choice.choices)) {
      validateChoicesSchemaEntities(
        sourceFile,
        entityName,
        currentPath,
        choice.choices,
        schemaEntityNames,
        errors
      )
    }
  }
}

function validateTableNames(
  node: unknown,
  file: string,
  entityName: string,
  tableNames: Set<string>,
  errors: ValidationError[]
): void {
  if (Array.isArray(node)) {
    for (const item of node) validateTableNames(item, file, entityName, tableNames, errors)
  } else if (node !== null && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'tableName' && typeof value === 'string' && !tableNames.has(value)) {
        errors.push({
          file,
          entityName,
          field: 'tableName',
          referencedName: value,
          message: `Table "${value}" not found in roll-tables.json`,
        })
      }
      validateTableNames(value, file, entityName, tableNames, errors)
    }
  }
}

/**
 * Run every cross-reference check over the supplied data bag. Mirrors the
 * detection logic that previously lived directly in tools/validateReferences.ts.
 */
export function findReferenceErrors(filesByName: Record<string, unknown[]>): ValidationError[] {
  const errors: ValidationError[] = []

  const systems = bag(filesByName, 'systems.json')
  const modules = bag(filesByName, 'modules.json')
  const chassis = bag(filesByName, 'chassis.json')
  const drones = bag(filesByName, 'drones.json')
  const actions = bag(filesByName, 'actions.json')
  const equipment = bag(filesByName, 'equipment.json')
  const abilities = bag(filesByName, 'abilities.json')
  const traits = bag(filesByName, 'traits.json')
  const keywords = bag(filesByName, 'keywords.json')
  const rollTables = bag(filesByName, 'roll-tables.json')

  const systemNames = new Set(systems.map((s) => s.name as string))
  const moduleNames = new Set(modules.map((m) => m.name as string))

  const schemaEntityNames: Record<string, Set<string>> = {
    systems: systemNames,
    modules: moduleNames,
    abilities: new Set(abilities.map((a) => a.name as string)),
    traits: new Set(traits.map((t) => t.name as string)),
    keywords: new Set(keywords.map((k) => k.name as string)),
    equipment: new Set(equipment.map((e) => e.name as string)),
  }

  // Validate chassis patterns
  for (const chassisItem of chassis) {
    if (!chassisItem.patterns || !Array.isArray(chassisItem.patterns)) continue

    for (const pattern of chassisItem.patterns) {
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

      const patternDrones = (
        pattern as { drones?: Array<{ name?: string; systems?: string[]; modules?: string[] }> }
      ).drones
      if (patternDrones && Array.isArray(patternDrones)) {
        for (const droneConfig of patternDrones) {
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

  // Validate drone systems and modules
  for (const drone of drones) {
    const droneSystems = drone.systems
    if (droneSystems && Array.isArray(droneSystems)) {
      for (const systemName of droneSystems) {
        if (typeof systemName !== 'string') continue
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

  // Validate catalog-choice shortlists (source.entities) in actions.json
  for (const action of actions as EntityWithChoices[]) {
    const actionName = String(action.name ?? 'unknown')
    if (action.choices && Array.isArray(action.choices)) {
      validateChoicesSchemaEntities(
        'actions.json',
        actionName,
        'choices',
        action.choices,
        schemaEntityNames,
        errors
      )
    }
  }

  // Validate catalog-choice shortlists (source.entities) in equipment.json
  for (const item of equipment as EntityWithChoices[]) {
    const itemName = String(item.name ?? 'unknown')
    if (item.actions && Array.isArray(item.actions)) {
      for (const action of item.actions) {
        if (action.choices && Array.isArray(action.choices)) {
          const actionName = action.name || 'unknown'
          validateChoicesSchemaEntities(
            'equipment.json',
            itemName,
            `actions.${actionName}.choices`,
            action.choices,
            schemaEntityNames,
            errors
          )
        }
      }
    }
  }

  // Validate that every `tableName` reference resolves to a real roll table.
  const tableNames = new Set(rollTables.map((t) => t.name as string))
  for (const file of [
    'actions.json',
    'systems.json',
    'modules.json',
    'abilities.json',
    'equipment.json',
    'chassis.json',
    'crawlers.json',
    'crawler-bays.json',
    'drones.json',
    'bio-titans.json',
  ]) {
    for (const entity of bag(filesByName, file)) {
      validateTableNames(
        entity,
        file,
        String(entity.name ?? entity.id ?? 'unknown'),
        tableNames,
        errors
      )
    }
  }

  return errors
}
