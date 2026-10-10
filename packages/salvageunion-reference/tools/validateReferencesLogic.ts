/**
 * Pure logic for cross-reference validation in the Salvage Union data.
 * Checks that every by-name reference resolves: pattern systems/modules and
 * drones, drone modules, catalog-choice shortlists (which must name a schema),
 * `tableName` / `rollTable` (any depth, any file), guide `guideRef` and step
 * `schemaEntities`, faction `formation` members and ability `grants`.
 *
 * Pure over a caller-supplied data bag, so `tools/validate.ts` (the one CLI,
 * `--only=references`) and the tests share one implementation.
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

/**
 * Trait names are lower-case in traits.json ("ballistic"), while a trait
 * shortlist names them as the rules text does ("Ballistic") — the same Title
 * Case an `addTrait` effect is written in. Resolve trait names without case.
 */
const CASE_INSENSITIVE_SCHEMAS = new Set(['traits'])

/** Names (and ids, for guides) of every row, keyed by schema id (the filename without `.json`). */
function buildNameIndex(filesByName: Record<string, unknown[]>): Record<string, Set<string>> {
  const index: Record<string, Set<string>> = {}
  for (const [file, rows] of Object.entries(filesByName)) {
    const schema = file.replace(/\.json$/, '')
    const fold = CASE_INSENSITIVE_SCHEMAS.has(schema)
    index[schema] = new Set(
      (rows as Rec[])
        .map((r) => r.name)
        .filter((n): n is string => typeof n === 'string')
        .map((n) => (fold ? n.toLowerCase() : n))
    )
  }
  return index
}

function hasName(index: Record<string, Set<string>>, schema: string, name: string): boolean {
  const names = index[schema]
  if (!names) return false
  return names.has(CASE_INSENSITIVE_SCHEMAS.has(schema) ? name.toLowerCase() : name)
}

/** Visit every object at any depth of `node`, with its dotted path. */
function walkObjects(node: unknown, path: string, visit: (obj: Rec, path: string) => void): void {
  if (Array.isArray(node)) {
    for (const [i, child] of node.entries()) walkObjects(child, `${path}[${i}]`, visit)
    return
  }
  if (node === null || typeof node !== 'object') return
  const obj = node as Rec
  visit(obj, path)
  for (const [key, child] of Object.entries(obj)) {
    walkObjects(child, path ? `${path}.${key}` : key, visit)
  }
}

/**
 * The refs any row of any file may carry, wherever they sit: a catalog choice
 * source (its schema and shortlist), a `tableName` / `rollTable`, a `guideRef`.
 */
function validateNestedRefs(
  file: string,
  entityName: string,
  row: Rec,
  index: Record<string, Set<string>>,
  guideIds: Set<string>,
  errors: ValidationError[]
): void {
  const push = (field: string, referencedName: string, message: string) =>
    errors.push({ file, entityName, field, referencedName, message })

  walkObjects(row, '', (obj, path) => {
    for (const key of ['tableName', 'rollTable'] as const) {
      const table = obj[key]
      if (typeof table === 'string' && !hasName(index, 'roll-tables', table)) {
        push(path ? `${path}.${key}` : key, table, `Table "${table}" not found in roll-tables.json`)
      }
    }

    const guideRef = obj.guideRef
    if (typeof guideRef === 'string' && !guideIds.has(guideRef)) {
      push(`${path}.guideRef`, guideRef, `Guide id "${guideRef}" not found in guides.json`)
    }

    const source = obj.source as { kind?: unknown; schema?: unknown; entities?: unknown } | null
    if (source && typeof source === 'object' && source.kind === 'catalog') {
      const schemas = Array.isArray(source.schema) ? (source.schema as string[]) : []
      const entities = Array.isArray(source.entities) ? (source.entities as string[]) : []
      if (schemas.length === 0) {
        push(
          `${path}.source.schema`,
          entities.join(', '),
          'catalog choice names no source.schema — its options cannot be resolved or validated'
        )
        return
      }
      for (const entityRef of entities) {
        if (!schemas.some((schema) => hasName(index, schema, entityRef))) {
          push(
            `${path}.source.entities`,
            entityRef,
            `Entity "${entityRef}" not found in schemas: ${schemas.join(', ')}`
          )
        }
      }
    }
  })
}

type FormationMember = { chassis?: string; pattern?: string; schema?: string }

function validateFormation(
  faction: Rec,
  index: Record<string, Set<string>>,
  chassis: Rec[],
  errors: ValidationError[]
): void {
  const members = faction.formation
  if (!Array.isArray(members)) return
  const entityName = String(faction.name ?? 'unknown')
  for (const [i, member] of (members as FormationMember[]).entries()) {
    const name = member.chassis ?? ''
    const field = `formation[${i}]`
    if (member.schema) {
      if (!hasName(index, member.schema, name)) {
        errors.push({
          file: 'factions.json',
          entityName,
          field,
          referencedName: name,
          message: `"${name}" not found in ${member.schema}.json`,
        })
      }
      continue
    }
    const host = chassis.find((c) => c.name === name)
    if (!host) {
      errors.push({
        file: 'factions.json',
        entityName,
        field,
        referencedName: name,
        message: `Chassis "${name}" not found in chassis.json (a non-chassis member needs a schema)`,
      })
      continue
    }
    const patterns = (host.patterns ?? []) as Array<{ name?: string }>
    if (member.pattern && !patterns.some((p) => p.name === member.pattern)) {
      errors.push({
        file: 'factions.json',
        entityName,
        field,
        referencedName: member.pattern,
        message: `Pattern "${member.pattern}" not found on chassis "${name}"`,
      })
    }
  }
}

/** Every name of a choice at any depth of `row` — what a `schema: 'choice'` grant points at. */
function choiceNames(row: Rec): Set<string> {
  const names = new Set<string>()
  walkObjects(row, '', (obj, path) => {
    if (/(^|\.)choices\[\d+\]$/.test(path) && typeof obj.name === 'string') names.add(obj.name)
  })
  return names
}

function validateGrants(
  file: string,
  row: Rec,
  index: Record<string, Set<string>>,
  errors: ValidationError[]
): void {
  const grants = row.grants
  if (!Array.isArray(grants)) return
  const entityName = String(row.name ?? 'unknown')
  for (const [i, grant] of (grants as Array<{ schema?: string; name?: string }>).entries()) {
    const name = grant.name ?? ''
    const found =
      grant.schema === 'choice'
        ? choiceNames(row).has(name)
        : !!grant.schema && hasName(index, grant.schema, name)
    if (!found) {
      errors.push({
        file,
        entityName,
        field: `grants[${i}]`,
        referencedName: name,
        message:
          grant.schema === 'choice'
            ? `No choice named "${name}" on this entity`
            : `"${name}" not found in ${grant.schema}.json`,
      })
    }
  }
}

function validateGuideSteps(
  guide: Rec,
  index: Record<string, Set<string>>,
  errors: ValidationError[]
) {
  const steps = guide.steps
  if (!Array.isArray(steps)) return
  for (const step of steps as Array<{
    name?: string
    schema?: string[]
    schemaEntities?: string[]
  }>) {
    if (!step.schemaEntities) continue
    const schemas = step.schema ?? []
    for (const entityRef of step.schemaEntities) {
      if (!schemas.some((schema) => hasName(index, schema, entityRef))) {
        errors.push({
          file: 'guides.json',
          entityName: String(guide.name ?? 'unknown'),
          field: `steps.${step.name ?? 'unknown'}.schemaEntities`,
          referencedName: entityRef,
          message: `Entity "${entityRef}" not found in schemas: ${schemas.join(', ') || '(none named)'}`,
        })
      }
    }
  }
}

/**
 * Refs that are known not to resolve and wait on an owner decision. Each one
 * is tolerated by exact file + name; an entry that stops matching fails, so
 * the list cannot outlive its fix.
 */
export const KNOWN_UNRESOLVED_REFS: ReadonlyArray<{
  file: string
  referencedName: string
  reason: string
}> = [
  {
    file: 'factions.json',
    referencedName: 'Chimerium Mutant Mob',
    reason:
      'WWHF p60 prints "Chimerium Mutant Mob" in the Red Mesa Mutants formation, but no entity ' +
      'has that name (npcs.json has Chimerium Mutant Squad). Repointing or renaming is an owner call.',
  },
]

/** Run every cross-reference check over the supplied data bag. */
export function findReferenceErrors(
  filesByName: Record<string, unknown[]>,
  known: typeof KNOWN_UNRESOLVED_REFS = KNOWN_UNRESOLVED_REFS
): ValidationError[] {
  const errors = findAllReferenceErrors(filesByName)
  const isKnown = (e: ValidationError, k: (typeof KNOWN_UNRESOLVED_REFS)[number]) =>
    e.file === k.file && e.referencedName === k.referencedName
  const stale: ValidationError[] = known
    .filter((k) => !errors.some((e) => isKnown(e, k)))
    .map((k) => ({
      file: 'tools/validateReferencesLogic.ts',
      entityName: 'KNOWN_UNRESOLVED_REFS',
      field: k.file,
      referencedName: k.referencedName,
      message: 'stale entry — the ref now resolves or is gone; remove it',
    }))
  return [...errors.filter((e) => !known.some((k) => isKnown(e, k))), ...stale]
}

function findAllReferenceErrors(filesByName: Record<string, unknown[]>): ValidationError[] {
  const errors: ValidationError[] = []

  const chassis = bag(filesByName, 'chassis.json')
  const drones = bag(filesByName, 'drones.json')
  const index = buildNameIndex(filesByName)
  const systemNames = index.systems ?? new Set<string>()
  const moduleNames = index.modules ?? new Set<string>()
  const guideIds = new Set(
    bag(filesByName, 'guides.json')
      .map((g) => g.id)
      .filter((id): id is string => typeof id === 'string')
  )

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
        pattern as {
          drones?: Array<{ name?: string; ref?: string; systems?: string[]; modules?: string[] }>
        }
      ).drones
      if (patternDrones && Array.isArray(patternDrones)) {
        for (const droneConfig of patternDrones) {
          const droneName = droneConfig.name ?? 'unknown'
          if (droneConfig.ref !== undefined && !hasName(index, 'drones', droneConfig.ref)) {
            errors.push({
              file: 'chassis.json',
              entityName: String(chassisItem.name ?? 'unknown'),
              field: `patterns.${(pattern as { name?: string }).name ?? 'unknown'}.drones.${droneName}.ref`,
              referencedName: droneConfig.ref,
              message: `Drone "${droneConfig.ref}" not found in drones.json`,
            })
          }
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
    const droneModules = drone.modules
    if (Array.isArray(droneModules)) {
      for (const moduleName of droneModules as string[]) {
        if (!moduleNames.has(moduleName)) {
          errors.push({
            file: 'drones.json',
            entityName: String(drone.name ?? 'unknown'),
            field: 'modules',
            referencedName: moduleName,
            message: `Module "${moduleName}" not found in modules.json`,
          })
        }
      }
    }
  }

  // Refs that may sit at any depth of any row: catalog choices, roll tables, guide refs.
  for (const [file, rows] of Object.entries(filesByName)) {
    for (const row of rows as Rec[]) {
      const entityName = String(row.name ?? row.id ?? 'unknown')
      validateNestedRefs(file, entityName, row, index, guideIds, errors)
      validateGrants(file, row, index, errors)
    }
  }

  for (const faction of bag(filesByName, 'factions.json')) {
    validateFormation(faction, index, chassis, errors)
  }

  for (const guide of bag(filesByName, 'guides.json')) {
    validateGuideSteps(guide, index, errors)
  }

  return errors
}
