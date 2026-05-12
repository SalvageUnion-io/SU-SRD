/**
 * Model Factory - Auto-generates models from schema catalog
 * Uses lazy (dynamic) imports for JSON data files so consumers
 * can code-split the ~1.1 MB data corpus via SalvageUnionReference.preload().
 *
 * Zod schemas remain statically imported because they are code (types + validation),
 * not data, and must be available at compilation time.
 */
import { BaseModel } from './BaseModel.js'
import schemaIndex from '../schemas/index.json' with { type: 'json' }
import { z } from 'zod'
import {
  AbilitySchema,
  AbilityTreeRequirementSchema,
  MetaActionSchema,
  TitanSchema,
  ChassisSchema,
  ClassSchema,
  CrawlerBaySchema,
  CrawlerTechLevelSchema,
  CrawlerSchema,
  CreatureSchema,
  DistanceSchema,
  DroneSchema,
  EquipmentSchema,
  FactionSchema,
  KeywordSchema,
  MeldSchema,
  ModuleSchema,
  NPCSchema,
  RollTableSchema,
  SquadSchema,
  SystemSchema,
  TraitEntitySchema,
  VehicleSchema,
  GuideSchema,
  SourceEntitySchema,
  TechLevelEntitySchema,
  CatalogCategorySchema,
} from './schemas/index.js'

// ---------------------------------------------------------------------------
// Lazy loader registries — no JSON is imported at module scope
// ---------------------------------------------------------------------------

const dataLoaders: Record<string, () => Promise<unknown[]>> = {
  abilities: () =>
    import('../data/abilities.json', { with: { type: 'json' } }).then(
      (m) => m.default as unknown[]
    ),
  'ability-tree-requirements': () =>
    import('../data/ability-tree-requirements.json', { with: { type: 'json' } }).then(
      (m) => m.default as unknown[]
    ),
  actions: () =>
    import('../data/actions.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  chassis: () =>
    import('../data/chassis.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  classes: () =>
    import('../data/classes.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  'crawler-bays': () =>
    import('../data/crawler-bays.json', { with: { type: 'json' } }).then(
      (m) => m.default as unknown[]
    ),
  'crawler-tech-levels': () =>
    import('../data/crawler-tech-levels.json', { with: { type: 'json' } }).then(
      (m) => m.default as unknown[]
    ),
  crawlers: () =>
    import('../data/crawlers.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  creatures: () =>
    import('../data/creatures.json', { with: { type: 'json' } }).then(
      (m) => m.default as unknown[]
    ),
  distances: () =>
    import('../data/distances.json', { with: { type: 'json' } }).then(
      (m) => m.default as unknown[]
    ),
  drones: () =>
    import('../data/drones.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  equipment: () =>
    import('../data/equipment.json', { with: { type: 'json' } }).then(
      (m) => m.default as unknown[]
    ),
  guides: () =>
    import('../data/guides.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  keywords: () =>
    import('../data/keywords.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  factions: () =>
    import('../data/factions.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  meld: () =>
    import('../data/meld.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  modules: () =>
    import('../data/modules.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  npcs: () =>
    import('../data/npcs.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  'roll-tables': () =>
    import('../data/roll-tables.json', { with: { type: 'json' } }).then(
      (m) => m.default as unknown[]
    ),
  squads: () =>
    import('../data/squads.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  systems: () =>
    import('../data/systems.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  titans: () =>
    import('../data/titans.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  traits: () =>
    import('../data/traits.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  vehicles: () =>
    import('../data/vehicles.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  sources: () =>
    import('../data/sources.json', { with: { type: 'json' } }).then((m) => m.default as unknown[]),
  'tech-levels': () =>
    import('../data/tech-levels.json', { with: { type: 'json' } }).then(
      (m) => m.default as unknown[]
    ),
  'catalog-categories': () =>
    import('../data/catalog-categories.json', { with: { type: 'json' } }).then(
      (m) => m.default as unknown[]
    ),
}

const jsonSchemaLoaders: Record<string, () => Promise<Record<string, unknown>>> = {
  abilities: () =>
    import('../schemas/abilities.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  'ability-tree-requirements': () =>
    import('../schemas/ability-tree-requirements.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  actions: () =>
    import('../schemas/actions.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  chassis: () =>
    import('../schemas/chassis.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  classes: () =>
    import('../schemas/classes.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  'crawler-bays': () =>
    import('../schemas/crawler-bays.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  'crawler-tech-levels': () =>
    import('../schemas/crawler-tech-levels.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  crawlers: () =>
    import('../schemas/crawlers.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  creatures: () =>
    import('../schemas/creatures.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  distances: () =>
    import('../schemas/distances.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  drones: () =>
    import('../schemas/drones.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  equipment: () =>
    import('../schemas/equipment.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  guides: () =>
    import('../schemas/guides.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  keywords: () =>
    import('../schemas/keywords.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  factions: () =>
    import('../schemas/factions.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  meld: () =>
    import('../schemas/meld.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  modules: () =>
    import('../schemas/modules.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  npcs: () =>
    import('../schemas/npcs.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  'roll-tables': () =>
    import('../schemas/roll-tables.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  squads: () =>
    import('../schemas/squads.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  systems: () =>
    import('../schemas/systems.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  titans: () =>
    import('../schemas/titans.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  traits: () =>
    import('../schemas/traits.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  vehicles: () =>
    import('../schemas/vehicles.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  sources: () =>
    import('../schemas/sources.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  'tech-levels': () =>
    import('../schemas/tech-levels.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
  'catalog-categories': () =>
    import('../schemas/catalog-categories.schema.json', { with: { type: 'json' } }).then(
      (m) => m.default as Record<string, unknown>
    ),
}

/**
 * Zod schema map — statically available, these are code not data
 */
const zodSchemaMap: Record<string, z.ZodType<unknown>> = {
  abilities: AbilitySchema,
  'ability-tree-requirements': AbilityTreeRequirementSchema,
  actions: MetaActionSchema,
  chassis: ChassisSchema,
  classes: ClassSchema,
  'crawler-bays': CrawlerBaySchema,
  'crawler-tech-levels': CrawlerTechLevelSchema,
  crawlers: CrawlerSchema,
  creatures: CreatureSchema,
  distances: DistanceSchema,
  drones: DroneSchema,
  equipment: EquipmentSchema,
  factions: FactionSchema,
  guides: GuideSchema,
  keywords: KeywordSchema,
  meld: MeldSchema,
  modules: ModuleSchema,
  npcs: NPCSchema,
  'roll-tables': RollTableSchema,
  squads: SquadSchema,
  systems: SystemSchema,
  titans: TitanSchema,
  traits: TraitEntitySchema,
  vehicles: VehicleSchema,
  sources: SourceEntitySchema,
  'tech-levels': TechLevelEntitySchema,
  'catalog-categories': CatalogCategorySchema,
}

// ---------------------------------------------------------------------------
// Load state
// ---------------------------------------------------------------------------

/** Set of schema IDs that have been successfully loaded */
const loadedSchemas = new Set<string>()

/** Live model registry — populated by preload(), keyed by PascalCase property name */
const modelRegistry: Record<string, BaseModel<unknown>> = {}

// ---------------------------------------------------------------------------
// Public load-state API (consumed by SalvageUnionReference)
// ---------------------------------------------------------------------------

/**
 * Returns true if the given schema ID has been loaded via preload().
 */
export function isSchemaLoaded(schemaId: string): boolean {
  return loadedSchemas.has(schemaId)
}

/**
 * Load the given schemas (or all schemas if 'all' is passed).
 * Idempotent: already-loaded schemas are skipped.
 * Returns a Promise that resolves when all requested schemas are loaded.
 */
export async function loadSchemas(schemas: string[] | 'all'): Promise<void> {
  const ids = schemas === 'all' ? Object.keys(dataLoaders) : schemas

  // Only load schemas not yet loaded
  const pending = ids.filter((id) => !loadedSchemas.has(id))
  if (pending.length === 0) return

  await Promise.all(pending.map((id) => loadSingleSchema(id)))
}

async function loadSingleSchema(schemaId: string): Promise<void> {
  const dataLoader = dataLoaders[schemaId]
  const jsonSchemaLoader = jsonSchemaLoaders[schemaId]
  const zodSchema = zodSchemaMap[schemaId]

  if (!dataLoader || !jsonSchemaLoader || !zodSchema) {
    throw new Error(`No loader found for schema ID: ${schemaId}`)
  }

  const [rawData, jsonSchema] = await Promise.all([dataLoader(), jsonSchemaLoader()])

  const validatedData = validateAndParseData(schemaId, rawData, zodSchema)
  const displayNameValue = schemaDisplayNames[schemaId]?.singular ?? schemaId
  const model = new BaseModel(validatedData, jsonSchema, schemaId, displayNameValue)

  Object.defineProperties(model, {
    schemaName: {
      value: schemaId,
      writable: false,
      enumerable: true,
      configurable: false,
    },
    displayName: {
      value: displayNameValue,
      writable: false,
      enumerable: true,
      configurable: false,
    },
  })

  const propertyName = toPascalCase(schemaId)
  modelRegistry[propertyName] = model
  loadedSchemas.add(schemaId)
}

/**
 * Get a loaded model by PascalCase property name.
 * Throws with a descriptive error if the schema hasn't been loaded yet.
 */
export function getLoadedModel(schemaId: string, propertyName: string): BaseModel<unknown> {
  if (!loadedSchemas.has(schemaId)) {
    throw new Error(
      `Schema "${schemaId}" not loaded. Call SalvageUnionReference.preload(['${schemaId}']) or SalvageUnionReference.preload('all') first.`
    )
  }
  const model = modelRegistry[propertyName]
  if (!model) {
    throw new Error(`Model for schema "${schemaId}" not found after loading. This is a bug.`)
  }
  return model
}

/**
 * Reset all load state. Exposed for testing only.
 * In production, schemas are loaded once and kept for the lifetime of the process.
 */
export function resetLoadStateForTesting(): void {
  loadedSchemas.clear()
  for (const key of Object.keys(modelRegistry)) {
    delete modelRegistry[key]
  }
}

// ---------------------------------------------------------------------------
// Existing synchronous API — kept for getDataMaps() consumers (e.g. action map)
// ---------------------------------------------------------------------------

/**
 * Get the loaded data and schema maps (synchronous).
 * Only returns data for schemas that have been preloaded.
 * Exposed for client use (e.g. resolveActions in index.ts).
 */
export function getDataMaps(): {
  dataMap: Record<string, unknown[]>
  schemaMap: Record<string, Record<string, unknown>>
} {
  const dataMap: Record<string, unknown[]> = {}
  const schemaMap: Record<string, Record<string, unknown>> = {}

  for (const schemaId of loadedSchemas) {
    const propName = toPascalCase(schemaId)
    const model = modelRegistry[propName]
    if (model) {
      dataMap[schemaId] = model.all() as unknown[]
      schemaMap[schemaId] = (
        model as BaseModel<unknown> & { schema: Record<string, unknown> }
      ).schema
    }
  }

  return { dataMap, schemaMap }
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Convert schema ID to PascalCase property name
 * Examples:
 *   abilities -> Abilities
 *   ability-tree-requirements -> AbilityTreeRequirements
 *   classes -> Classes
 *
 * Exposed for client use
 */
function toPascalCase(id: string): string {
  if (id === 'classes') return 'Classes'
  if (id === 'npcs') return 'NPCs'
  return id
    .split(/[-.]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

/**
 * Validate and parse data using Zod schema
 */
function validateAndParseData<T>(
  schemaId: string,
  rawData: unknown[],
  zodSchema: z.ZodType<T>
): T[] {
  try {
    return z.array(zodSchema).parse(rawData)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`Validation error for schema ${schemaId}:`, error.issues)
      throw new Error(
        `Data validation failed for ${schemaId}: ${error.issues.map((e: { message: string }) => e.message).join(', ')}`,
        { cause: error }
      )
    }
    throw error
  }
}

/**
 * Schema display name mappings
 */
const schemaDisplayNames: Record<string, { singular: string; plural: string }> = {
  abilities: { singular: 'Ability', plural: 'Abilities' },
  'ability-tree-requirements': {
    singular: 'Ability Tree Requirement',
    plural: 'Ability Tree Requirements',
  },
  chassis: { singular: 'Chassis', plural: 'Chassis' },
  classes: { singular: 'Class', plural: 'Classes' },
  'crawler-bays': { singular: 'Crawler Bay', plural: 'Crawler Bays' },
  'crawler-tech-levels': {
    singular: 'Crawler Tech Level',
    plural: 'Crawler Tech Levels',
  },
  crawlers: { singular: 'Crawler', plural: 'Crawlers' },
  creatures: { singular: 'Creature', plural: 'Creatures' },
  distances: { singular: 'Distance', plural: 'Distances' },
  drones: { singular: 'Drone', plural: 'Drones' },
  equipment: { singular: 'Equipment', plural: 'Equipment' },
  guides: { singular: 'Guide', plural: 'Guides' },
  keywords: { singular: 'Keyword', plural: 'Keywords' },
  factions: { singular: 'Faction', plural: 'Factions' },
  meld: { singular: 'Meld', plural: 'Meld' },
  modules: { singular: 'Module', plural: 'Modules' },
  npcs: { singular: 'NPC', plural: 'NPCs' },
  'roll-tables': { singular: 'Roll Table', plural: 'Roll Tables' },
  squads: { singular: 'Squad', plural: 'Squads' },
  systems: { singular: 'System', plural: 'Systems' },
  titans: { singular: 'Titan', plural: 'Titans' },
  traits: { singular: 'Trait', plural: 'Traits' },
  vehicles: { singular: 'Vehicle', plural: 'Vehicles' },
  sources: { singular: 'Source', plural: 'Sources' },
  'tech-levels': { singular: 'Tech Level', plural: 'Tech Levels' },
  'catalog-categories': { singular: 'Catalog Category', plural: 'Catalog Categories' },
}

/**
 * Enhanced schema metadata interface
 */
export interface EnhancedSchemaMetadata {
  id: string
  title: string
  description: string
  comment?: string
  dataFile: string
  schemaFile: string
  itemCount: number
  requiredFields: string[]
  displayName: string
  displayNamePlural: string
  meta?: boolean
}

/**
 * Get schema catalog with enhanced metadata
 * Exposed for client use
 */
export function getSchemaCatalog(): {
  $schema: string
  title: string
  description: string
  version: string
  generated: string
  schemas: EnhancedSchemaMetadata[]
} {
  return {
    ...schemaIndex,
    schemas: schemaIndex.schemas.map((schema) => ({
      ...schema,
      displayName: schemaDisplayNames[schema.id]?.singular || schema.title,
      displayNamePlural: schemaDisplayNames[schema.id]?.plural || schema.title,
    })),
  }
}
