/**
 * Model Factory - Auto-generates models from schema catalog
 * Uses static imports for synchronous data loading
 *
 * Note: Current implementation loads all data at import time for synchronous access.
 * Future optimization: Consider lazy loading schemas on first access for better
 * code splitting and initial bundle size reduction.
 */
import { BaseModel } from './BaseModel.js'
import schemaIndex from './schemas/schemas/index.json' with { type: 'json' }
import { z } from 'zod'
import {
  AbilitySchema,
  AbilityTreeRequirementSchema,
  MetaActionSchema,
  BioTitanSchema,
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
} from './schemas/index.js'

// Import all data files
import abilitiesData from './data/abilities.json' with { type: 'json' }
import abilityTreeRequirementsData from './data/ability-tree-requirements.json' with { type: 'json' }
import actionsData from './data/actions.json' with { type: 'json' }
import bioTitansData from './data/bio-titans.json' with { type: 'json' }
import chassisData from './data/chassis.json' with { type: 'json' }
import classesData from './data/classes.json' with { type: 'json' }
import crawlerBaysData from './data/crawler-bays.json' with { type: 'json' }
import crawlerTechLevelsData from './data/crawler-tech-levels.json' with { type: 'json' }
import crawlersData from './data/crawlers.json' with { type: 'json' }
import creaturesData from './data/creatures.json' with { type: 'json' }
import distancesData from './data/distances.json' with { type: 'json' }
import dronesData from './data/drones.json' with { type: 'json' }
import equipmentData from './data/equipment.json' with { type: 'json' }
import keywordsData from './data/keywords.json' with { type: 'json' }
import factionsData from './data/factions.json' with { type: 'json' }
import meldData from './data/meld.json' with { type: 'json' }
import modulesData from './data/modules.json' with { type: 'json' }
import npcsData from './data/npcs.json' with { type: 'json' }
import rollTablesData from './data/roll-tables.json' with { type: 'json' }
import squadsData from './data/squads.json' with { type: 'json' }
import systemsData from './data/systems.json' with { type: 'json' }
import traitsData from './data/traits.json' with { type: 'json' }
import vehiclesData from './data/vehicles.json' with { type: 'json' }

// Import all schema files
import abilitiesSchema from './schemas/schemas/abilities.schema.json' with { type: 'json' }
import abilityTreeRequirementsSchema from './schemas/schemas/ability-tree-requirements.schema.json' with { type: 'json' }
import actionsSchema from './schemas/schemas/actions.schema.json' with { type: 'json' }
import bioTitansSchema from './schemas/schemas/bio-titans.schema.json' with { type: 'json' }
import chassisSchema from './schemas/schemas/chassis.schema.json' with { type: 'json' }
import classesSchema from './schemas/schemas/classes.schema.json' with { type: 'json' }
import crawlerBaysSchema from './schemas/schemas/crawler-bays.schema.json' with { type: 'json' }
import crawlerTechLevelsSchema from './schemas/schemas/crawler-tech-levels.schema.json' with { type: 'json' }
import crawlersSchema from './schemas/schemas/crawlers.schema.json' with { type: 'json' }
import creaturesSchema from './schemas/schemas/creatures.schema.json' with { type: 'json' }
import distancesSchema from './schemas/schemas/distances.schema.json' with { type: 'json' }
import dronesSchema from './schemas/schemas/drones.schema.json' with { type: 'json' }
import equipmentSchema from './schemas/schemas/equipment.schema.json' with { type: 'json' }
import keywordsSchema from './schemas/schemas/keywords.schema.json' with { type: 'json' }
import factionsSchema from './schemas/schemas/factions.schema.json' with { type: 'json' }
import meldSchema from './schemas/schemas/meld.schema.json' with { type: 'json' }
import modulesSchema from './schemas/schemas/modules.schema.json' with { type: 'json' }
import npcsSchema from './schemas/schemas/npcs.schema.json' with { type: 'json' }
import rollTablesSchema from './schemas/schemas/roll-tables.schema.json' with { type: 'json' }
import squadsSchema from './schemas/schemas/squads.schema.json' with { type: 'json' }
import systemsSchema from './schemas/schemas/systems.schema.json' with { type: 'json' }
import traitsSchema from './schemas/schemas/traits.schema.json' with { type: 'json' }
import vehiclesSchema from './schemas/schemas/vehicles.schema.json' with { type: 'json' }

/**
 * Static data map - all data files indexed by schema ID
 */
const dataMap: Record<string, unknown[]> = {
  abilities: abilitiesData,
  'ability-tree-requirements': abilityTreeRequirementsData,
  actions: actionsData,
  'bio-titans': bioTitansData,
  chassis: chassisData,
  classes: classesData,
  'crawler-bays': crawlerBaysData,
  'crawler-tech-levels': crawlerTechLevelsData,
  crawlers: crawlersData,
  creatures: creaturesData,
  distances: distancesData,
  drones: dronesData,
  equipment: equipmentData,
  keywords: keywordsData,
  factions: factionsData,
  meld: meldData,
  modules: modulesData,
  npcs: npcsData,
  'roll-tables': rollTablesData,
  squads: squadsData,
  systems: systemsData,
  traits: traitsData,
  vehicles: vehiclesData,
}

/**
 * Zod schema map - all Zod schemas indexed by schema ID
 */
const zodSchemaMap: Record<string, z.ZodType<unknown>> = {
  abilities: AbilitySchema,
  'ability-tree-requirements': AbilityTreeRequirementSchema,
  actions: MetaActionSchema,
  'bio-titans': BioTitanSchema,
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
  keywords: KeywordSchema,
  meld: MeldSchema,
  modules: ModuleSchema,
  npcs: NPCSchema,
  'roll-tables': RollTableSchema,
  squads: SquadSchema,
  systems: SystemSchema,
  traits: TraitEntitySchema,
  vehicles: VehicleSchema,
}

/**
 * Static schema map - all schemas indexed by schema ID (JSON Schema, kept for backward compatibility)
 */
const schemaMap: Record<string, Record<string, unknown>> = {
  abilities: abilitiesSchema,
  'ability-tree-requirements': abilityTreeRequirementsSchema,
  actions: actionsSchema,
  'bio-titans': bioTitansSchema,
  chassis: chassisSchema,
  classes: classesSchema,
  'crawler-bays': crawlerBaysSchema,
  'crawler-tech-levels': crawlerTechLevelsSchema,
  crawlers: crawlersSchema,
  creatures: creaturesSchema,
  distances: distancesSchema,
  drones: dronesSchema,
  equipment: equipmentSchema,
  keywords: keywordsSchema,
  factions: factionsSchema,
  meld: meldSchema,
  modules: modulesSchema,
  npcs: npcsSchema,
  'roll-tables': rollTablesSchema,
  squads: squadsSchema,
  systems: systemsSchema,
  traits: traitsSchema,
  vehicles: vehiclesSchema,
}

/**
 * Get the data and schema maps (synchronous)
 * Exposed for client use
 */
export function getDataMaps(): {
  dataMap: Record<string, unknown[]>
  schemaMap: Record<string, Record<string, unknown>>
} {
  return { dataMap, schemaMap }
}

/**
 * Convert schema ID to PascalCase property name
 * Examples:
 *   abilities -> Abilities
 *   ability-tree-requirements -> AbilityTreeRequirements
 *   classes -> Classes
 *
 * Exposed for client use
 */
export function toPascalCase(id: string): string {
  // Handle special case for classes
  if (id === 'classes') return 'Classes'

  // Handle special case for NPCs (all caps)
  if (id === 'npcs') return 'NPCs'

  // Handle hyphenated and dotted names
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
      console.error(`Validation error for schema ${schemaId}:`, error.errors)
      throw new Error(
        `Data validation failed for ${schemaId}: ${error.errors.map((e) => e.message).join(', ')}`
      )
    }
    throw error
  }
}

/**
 * Create a model instance for a given schema entry (synchronous)
 * Returns an object with instance methods and readonly metadata properties
 */
function createModel<T>(schemaId: string): BaseModel<T> & {
  readonly schemaName: string
  readonly displayName: string
} {
  const rawData = dataMap[schemaId]
  const schema = schemaMap[schemaId]
  const zodSchema = zodSchemaMap[schemaId]

  if (!rawData || !schema || !zodSchema) {
    throw new Error(`No data or schema found for schema ID: ${schemaId}`)
  }

  // Validate and parse data using Zod
  const validatedData = validateAndParseData(schemaId, rawData, zodSchema as z.ZodType<T>)

  const displayNameValue = schemaDisplayNames[schemaId]?.plural || schemaId

  const model = new BaseModel<T>(validatedData, schema, schemaId, displayNameValue)

  // Add readonly metadata properties directly to the instance
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

  return model as BaseModel<T> & {
    readonly schemaName: string
    readonly displayName: string
  }
}

/**
 * Auto-generate all models from the schema catalog (synchronous)
 */
export function generateModels(): Record<string, BaseModel<unknown>> {
  const models: Record<string, BaseModel<unknown>> = {}

  for (const schemaEntry of schemaIndex.schemas) {
    const propertyName = toPascalCase(schemaEntry.id)
    models[propertyName] = createModel(schemaEntry.id)
  }

  return models
}

/**
 * Schema display name mappings
 * Exported for use in other modules
 */
export const schemaDisplayNames: Record<string, { singular: string; plural: string }> = {
  abilities: { singular: 'Ability', plural: 'Abilities' },
  'ability-tree-requirements': {
    singular: 'Ability Tree Requirement',
    plural: 'Ability Tree Requirements',
  },
  actions: { singular: 'action', plural: 'actions' },
  'bio-titans': { singular: 'Bio-Titan', plural: 'Bio-Titans' },
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
  keywords: { singular: 'Keyword', plural: 'Keywords' },
  factions: { singular: 'Faction', plural: 'Factions' },
  meld: { singular: 'Meld', plural: 'Meld' },
  modules: { singular: 'Module', plural: 'Modules' },
  npcs: { singular: 'NPC', plural: 'NPCs' },
  'roll-tables': { singular: 'Roll Table', plural: 'Roll Tables' },
  squads: { singular: 'Squad', plural: 'Squads' },
  systems: { singular: 'System', plural: 'Systems' },
  traits: { singular: 'Trait', plural: 'Traits' },
  vehicles: { singular: 'Vehicle', plural: 'Vehicles' },
} as const

/**
 * Computed mapping from schema names to display names (plural)
 * Derived from schemaDisplayNames for convenience
 */
export const SchemaToDisplayName = Object.fromEntries(
  Object.entries(schemaDisplayNames).map(([k, v]) => [k, v.plural])
) as Record<string, string>

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
