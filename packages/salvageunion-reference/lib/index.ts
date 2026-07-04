/**
 * Salvage Union Data ORM
 *
 * Type-safe query interface for Salvage Union game data
 * Models are loaded lazily via SalvageUnionReference.preload().
 */

import { BaseModel, type ModelWithMetadata } from './BaseModel.js'
import {
  getLoadedModel,
  isSchemaLoaded,
  loadSchemas,
  resetLoadStateForTesting,
  toPascalCase,
} from './ModelFactory.js'
import { extractActions, getChassisAbilities, invalidateActionMap } from './utilities.js'
import { invalidateSearchIndex } from './search.js'
import type {
  SURefAbility,
  SURefChassis,
  SURefClass,
  SURefCrawlerBay,
  SURefCrawler,
  SURefCreature,
  SURefDistance,
  SURefDrone,
  SURefEquipment,
  SURefFaction,
  SURefKeyword,
  SURefMeld,
  SURefModule,
  SURefNPC,
  SURefRollTable,
  SURefSquad,
  SURefSystem,
  SURefBioTitan,
  SURefTrait,
  SURefVehicle,
  SURefMetaAbilityTreeRequirement,
  SURefMetaAction,
  SURefMetaCrawlerTechLevel,
  SURefGuide,
  SURefSource,
  SURefTechLevel,
  SURefCatalogCategory,
  SURefEntity,
  SURefMetaEntity,
  SURefEnumSchemaName,
} from './types/index.js'

export { BaseModel, type ModelWithMetadata } from './BaseModel.js'

export { getDataMaps, getSchemaCatalog, type EnhancedSchemaMetadata } from './ModelFactory.js'

export {
  resultForTable,
  resultForColumnsTable,
  isColumnsTable,
  type TableRollResult,
  type ColumnsTableRollResult,
} from './utils/resultForTable.js'

export { rollOnTable, type RollOnTableOutcome, type D20Roller } from './rollOnTable.js'

// Export utility functions (type guards and property extractors)
export * from './utilities.js'

// Export helper functions for common operations
export * from './helpers.js'

// Export slug utilities
export { nameToSlug, getEntitySlug, findEntityBySlug } from './slug.js'

// Export content block helpers
export {
  getParagraphString,
  replaceChassisPlaceholder,
  parseContentBlockString,
} from './contentBlockHelpers.js'

export {
  search,
  searchIn,
  getSuggestions,
  invalidateSearchIndex,
  type SearchOptions,
  type SearchResult,
} from './search.js'

// Export the granted-equipment choice resolver (pure view computation)
export {
  resolveChoiceView,
  type ChoiceSelections,
  type ChoicePrompt,
  type ResolvedChoiceView,
} from './resolveChoiceView.js'

// Export combat utility functions (pure game logic)
export {
  getHeatGenerated,
  applyHeat,
  canActivateAction,
  shouldTriggerHeatCheck,
  canPush,
  nextCondition,
  applySpDamage,
} from './combatUtils.js'

// Import search functions for use in class methods
import {
  search as searchFn,
  searchIn as searchInFn,
  getSuggestions as getSuggestionsFn,
  type SearchOptions,
  type SearchResult,
} from './search.js'

// ---------------------------------------------------------------------------
// LazyModel — a BaseModel that throws descriptive errors until loaded
// ---------------------------------------------------------------------------

/**
 * A BaseModel subclass that guards all data-access methods behind a load
 * check. Before preload(), all data methods throw. After preload(), they
 * delegate to the real backing model.
 *
 * The backing model is replaced in place so that references captured before
 * preload (e.g. `const c = SalvageUnionReference.Chassis`) see the real data
 * after preload completes.
 */
class LazyModel<T> extends BaseModel<T> {
  private readonly _schemaIdForLazy: string
  private _backing: BaseModel<T> | null = null

  // Declared explicitly so TypeScript sees them as class properties
  // (ModelWithMetadata<T> requires these to be present).
  readonly schemaName: string
  readonly displayName: string

  constructor(schemaId: string, _propName: string, displayNameValue: string) {
    // Pass empty arrays / empty schema; data is never used until _backing is set
    super([], {}, schemaId, displayNameValue)
    this._schemaIdForLazy = schemaId
    this.schemaName = schemaId
    this.displayName = displayNameValue
  }

  /**
   * Install the real backing model once preload() has resolved.
   * Called by SalvageUnionReference.preload() after loading completes.
   */
  _install(backing: BaseModel<T>): void {
    this._backing = backing
    // Copy the schema reference so getDataMaps() can read it
    this.schema = backing.schema
  }

  /**
   * Reset to the pre-load state (testing only). Clears the backing model and
   * schema so subsequent data access throws again. Owning the private
   * `_backing` field here lets resetAllForTesting() avoid an `as unknown as`
   * reach-in to poke the private field from outside the class.
   */
  _reset(): void {
    this._backing = null
    this.schema = {}
  }

  private _assertLoaded(): void {
    if (!this._backing) {
      throw new Error(
        `Schema "${this._schemaIdForLazy}" not loaded. Call SalvageUnionReference.preload(['${this._schemaIdForLazy}']) or SalvageUnionReference.preload('all') first.`
      )
    }
  }

  all(): (T & { schemaName: string })[] {
    this._assertLoaded()
    return this._backing!.all()
  }

  find(predicate: (item: T) => boolean): (T & { schemaName: string }) | undefined {
    this._assertLoaded()
    return this._backing!.find(predicate)
  }

  findAll(predicate: (item: T) => boolean): (T & { schemaName: string })[] {
    this._assertLoaded()
    return this._backing!.findAll(predicate)
  }

  getById(id: string): (T & { schemaName: string }) | undefined {
    this._assertLoaded()
    return this._backing!.getById(id)
  }
}

// ---------------------------------------------------------------------------
// Lazy model instances — one per schema, created at module load time
// These are stable object references; preload() populates the backing data.
// Display names are the singular form used by consumers (model-metadata tests).
// ---------------------------------------------------------------------------

const lazyAbilities = new LazyModel<SchemaToEntityMap['abilities']>(
  'abilities',
  'Abilities',
  'Ability'
)
const lazyAbilityTreeRequirements = new LazyModel<SURefMetaAbilityTreeRequirement>(
  'ability-tree-requirements',
  'AbilityTreeRequirements',
  'Ability Tree Requirement'
)
const lazyActions = new LazyModel<SURefMetaAction>('actions', 'Actions', 'Action')
const lazyChassis = new LazyModel<SchemaToEntityMap['chassis']>('chassis', 'Chassis', 'Chassis')
const lazyClasses = new LazyModel<SchemaToEntityMap['classes']>('classes', 'Classes', 'Class')
const lazyCrawlerBays = new LazyModel<SchemaToEntityMap['crawler-bays']>(
  'crawler-bays',
  'CrawlerBays',
  'Crawler Bay'
)
const lazyCrawlerTechLevels = new LazyModel<SURefMetaCrawlerTechLevel>(
  'crawler-tech-levels',
  'CrawlerTechLevels',
  'Crawler Tech Level'
)
const lazyCrawlers = new LazyModel<SchemaToEntityMap['crawlers']>('crawlers', 'Crawlers', 'Crawler')
const lazyCreatures = new LazyModel<SchemaToEntityMap['creatures']>(
  'creatures',
  'Creatures',
  'Creature'
)
const lazyDistances = new LazyModel<SchemaToEntityMap['distances']>(
  'distances',
  'Distances',
  'Distance'
)
const lazyDrones = new LazyModel<SchemaToEntityMap['drones']>('drones', 'Drones', 'Drone')
const lazyEquipment = new LazyModel<SchemaToEntityMap['equipment']>(
  'equipment',
  'Equipment',
  'Equipment'
)
const lazyFactions = new LazyModel<SchemaToEntityMap['factions']>('factions', 'Factions', 'Faction')
const lazyGuides = new LazyModel<SURefGuide>('guides', 'Guides', 'Guide')
const lazyKeywords = new LazyModel<SchemaToEntityMap['keywords']>('keywords', 'Keywords', 'Keyword')
const lazyMeld = new LazyModel<SchemaToEntityMap['meld']>('meld', 'Meld', 'Meld')
const lazyModules = new LazyModel<SchemaToEntityMap['modules']>('modules', 'Modules', 'Module')
const lazyNPCs = new LazyModel<SchemaToEntityMap['npcs']>('npcs', 'NPCs', 'NPC')
const lazyRollTables = new LazyModel<SchemaToEntityMap['roll-tables']>(
  'roll-tables',
  'RollTables',
  'Roll Table'
)
const lazySquads = new LazyModel<SchemaToEntityMap['squads']>('squads', 'Squads', 'Squad')
const lazySystems = new LazyModel<SchemaToEntityMap['systems']>('systems', 'Systems', 'System')
const lazyBioTitans = new LazyModel<SchemaToEntityMap['bio-titans']>(
  'bio-titans',
  'BioTitans',
  'Bio-Titan'
)
const lazyTraits = new LazyModel<SchemaToEntityMap['traits']>('traits', 'Traits', 'Trait')
const lazyVehicles = new LazyModel<SchemaToEntityMap['vehicles']>('vehicles', 'Vehicles', 'Vehicle')
const lazySources = new LazyModel<SURefSource>('sources', 'Sources', 'Source')
const lazyTechLevels = new LazyModel<SURefTechLevel>('tech-levels', 'TechLevels', 'Tech Level')
const lazyCatalogCategories = new LazyModel<SURefCatalogCategory>(
  'catalog-categories',
  'CatalogCategories',
  'Catalog Category'
)

/**
 * Precise per-schema type for {@link lazyModelMap}: each key maps to a
 * `LazyModel` parameterised with that schema's entity type. Annotating the map
 * with this homomorphic mapped type lets each entry be its exact
 * `LazyModel<SURefX>` (no per-entry `as LazyModel<unknown>` cast), enforces that
 * the map covers exactly the SchemaToEntityMap key set, AND makes a generic
 * indexed access `lazyModelMap[schemaName]` simplify to
 * `LazyModel<SchemaToEntityMap[T]>` — so the typed query accessors need no
 * model-level cast either.
 */
type LazyModelMap = { readonly [K in keyof SchemaToEntityMap]: LazyModel<SchemaToEntityMap[K]> }

/** Map from schema ID to its LazyModel instance — used by preload() to install backing models */
const lazyModelMap: LazyModelMap = {
  abilities: lazyAbilities,
  'ability-tree-requirements': lazyAbilityTreeRequirements,
  actions: lazyActions,
  chassis: lazyChassis,
  classes: lazyClasses,
  'crawler-bays': lazyCrawlerBays,
  'crawler-tech-levels': lazyCrawlerTechLevels,
  crawlers: lazyCrawlers,
  creatures: lazyCreatures,
  distances: lazyDistances,
  drones: lazyDrones,
  equipment: lazyEquipment,
  factions: lazyFactions,
  guides: lazyGuides,
  keywords: lazyKeywords,
  meld: lazyMeld,
  modules: lazyModules,
  npcs: lazyNPCs,
  'roll-tables': lazyRollTables,
  squads: lazySquads,
  systems: lazySystems,
  'bio-titans': lazyBioTitans,
  traits: lazyTraits,
  vehicles: lazyVehicles,
  sources: lazySources,
  'tech-levels': lazyTechLevels,
  'catalog-categories': lazyCatalogCategories,
}

/**
 * Erased view of {@link lazyModelMap} for dynamic (arbitrary string id) access,
 * where the caller cannot statically know which schema's entity type applies
 * (e.g. preload() iterating a runtime list of ids). The single `as` here is the
 * one deliberate soundness boundary for the lazy-loading indirection: the id →
 * backing-model correspondence is guaranteed at runtime by loadSchemas().
 */
const lazyModelsById = lazyModelMap as Record<string, LazyModel<unknown>>

export type * from './types/index.js'

export { getJsonSchemaDefinition, getAllJsonSchemaDefinitions } from './schemaDefinitions.js'

// Type mapping from schema names to entity types (includes entity schemas and meta schemas)
export type SchemaToEntityMap = {
  abilities: SURefAbility
  'ability-tree-requirements': SURefMetaAbilityTreeRequirement
  actions: SURefMetaAction
  chassis: SURefChassis
  classes: SURefClass
  'crawler-bays': SURefCrawlerBay
  'crawler-tech-levels': SURefMetaCrawlerTechLevel
  crawlers: SURefCrawler
  creatures: SURefCreature
  distances: SURefDistance
  drones: SURefDrone
  equipment: SURefEquipment
  factions: SURefFaction
  guides: SURefGuide
  keywords: SURefKeyword
  meld: SURefMeld
  modules: SURefModule
  npcs: SURefNPC
  'roll-tables': SURefRollTable
  squads: SURefSquad
  systems: SURefSystem
  'bio-titans': SURefBioTitan
  traits: SURefTrait
  vehicles: SURefVehicle
  sources: SURefSource
  'tech-levels': SURefTechLevel
  'catalog-categories': SURefCatalogCategory
}

// Type for entity schema names (includes entity schemas and meta schemas, excludes non-entity schemas)
export type EntitySchemaName = keyof SchemaToEntityMap

// Registry mapping every schema name to its model key and display name.
// NOTE: this is NOT the only touch-point. Adding a new schema currently
// requires parallel entries in: ModelFactory.ts (dataLoaders,
// jsonSchemaLoaders, zodSchemaMap, schemaDisplayNames), this file (the
// LazyModel instance, lazyModelMap, SchemaToEntityMap, this registry, the
// static accessor), and tools/generateJsonSchemas.ts — see the
// package-contracts.md checklist. Keep them in lockstep or preload()/codegen
// breaks silently.
// Set `entity: false` for non-entity metadata schemas (excluded from EntitySchemaNames).
const SCHEMA_REGISTRY = {
  abilities: { model: 'Abilities', display: 'Ability' },
  'ability-tree-requirements': {
    model: 'AbilityTreeRequirements',
    display: 'Ability Tree Requirement',
  },
  actions: { model: 'Actions', display: 'Action' },
  chassis: { model: 'Chassis', display: 'Chassis' },
  classes: { model: 'Classes', display: 'Class' },
  'crawler-bays': { model: 'CrawlerBays', display: 'Crawler Bay' },
  'crawler-tech-levels': {
    model: 'CrawlerTechLevels',
    display: 'Crawler Tech Level',
  },
  crawlers: { model: 'Crawlers', display: 'Crawler' },
  creatures: { model: 'Creatures', display: 'Creature' },
  distances: { model: 'Distances', display: 'Distance' },
  drones: { model: 'Drones', display: 'Drone' },
  equipment: { model: 'Equipment', display: 'Equipment' },
  factions: { model: 'Factions', display: 'Faction' },
  guides: { model: 'Guides', display: 'Guide' },
  keywords: { model: 'Keywords', display: 'Keyword' },
  meld: { model: 'Meld', display: 'Meld' },
  modules: { model: 'Modules', display: 'Module' },
  npcs: { model: 'NPCs', display: 'NPC' },
  'roll-tables': { model: 'RollTables', display: 'Roll Table' },
  squads: { model: 'Squads', display: 'Squad' },
  systems: { model: 'Systems', display: 'System' },
  'bio-titans': { model: 'BioTitans', display: 'Bio-Titan' },
  traits: { model: 'Traits', display: 'Trait' },
  vehicles: { model: 'Vehicles', display: 'Vehicle' },
  sources: { model: 'Sources', display: 'Source' },
  'tech-levels': { model: 'TechLevels', display: 'Tech Level' },
  'catalog-categories': {
    model: 'CatalogCategories',
    display: 'Catalog Category',
    entity: false as const,
  },
} as const satisfies Record<
  keyof SchemaToEntityMap,
  { model: string; display: string; entity?: boolean }
>

// Runtime set of entity schema names (derived from registry, excludes non-entity metadata schemas)
export const EntitySchemaNames = new Set<EntitySchemaName>(
  (
    Object.entries(SCHEMA_REGISTRY) as [
      EntitySchemaName,
      { model: string; display: string; entity?: boolean },
    ][]
  )
    .filter(([, v]) => v.entity !== false)
    .map(([k]) => k)
)

// Runtime mapping from schema names to model property names (derived from registry)
export const SchemaToModelMap = Object.fromEntries(
  Object.entries(SCHEMA_REGISTRY).map(([k, v]) => [k, v.model])
) as {
  readonly [K in keyof typeof SCHEMA_REGISTRY]: (typeof SCHEMA_REGISTRY)[K]['model']
}

// Runtime mapping from schema names to display names (derived from registry)
export const SchemaToDisplayName = Object.fromEntries(
  Object.entries(SCHEMA_REGISTRY).map(([k, v]) => [k, v.display])
) as {
  readonly [K in keyof typeof SCHEMA_REGISTRY]: (typeof SCHEMA_REGISTRY)[K]['display']
}

/**
 * Main ORM class with static model accessors
 *
 * Data is loaded lazily. Call `SalvageUnionReference.preload('all')` (or a
 * specific array of schema IDs) before accessing any model.
 */
export class SalvageUnionReference {
  // Static model properties — these are LazyModel instances that throw until
  // preload() is called. Each is exposed under its public ModelWithMetadata
  // type via a type annotation (not a cast): LazyModel<T> structurally
  // satisfies ModelWithMetadata<T>, so assignment is checked, not asserted.
  static Abilities: ModelWithMetadata<SchemaToEntityMap['abilities']> = lazyAbilities
  static AbilityTreeRequirements: ModelWithMetadata<SURefMetaAbilityTreeRequirement> =
    lazyAbilityTreeRequirements
  static Actions: ModelWithMetadata<SURefMetaAction> = lazyActions
  static Chassis: ModelWithMetadata<SchemaToEntityMap['chassis']> = lazyChassis
  static Classes: ModelWithMetadata<SchemaToEntityMap['classes']> = lazyClasses
  static CrawlerBays: ModelWithMetadata<SchemaToEntityMap['crawler-bays']> = lazyCrawlerBays
  static CrawlerTechLevels: ModelWithMetadata<SURefMetaCrawlerTechLevel> = lazyCrawlerTechLevels
  static Crawlers: ModelWithMetadata<SchemaToEntityMap['crawlers']> = lazyCrawlers
  static Creatures: ModelWithMetadata<SchemaToEntityMap['creatures']> = lazyCreatures
  static Distances: ModelWithMetadata<SchemaToEntityMap['distances']> = lazyDistances
  static Drones: ModelWithMetadata<SchemaToEntityMap['drones']> = lazyDrones
  static Equipment: ModelWithMetadata<SchemaToEntityMap['equipment']> = lazyEquipment
  static Factions: ModelWithMetadata<SchemaToEntityMap['factions']> = lazyFactions
  static Guides: ModelWithMetadata<SURefGuide> = lazyGuides
  static Keywords: ModelWithMetadata<SchemaToEntityMap['keywords']> = lazyKeywords
  static Meld: ModelWithMetadata<SchemaToEntityMap['meld']> = lazyMeld
  static Modules: ModelWithMetadata<SchemaToEntityMap['modules']> = lazyModules
  static NPCs: ModelWithMetadata<SchemaToEntityMap['npcs']> = lazyNPCs
  static RollTables: ModelWithMetadata<SchemaToEntityMap['roll-tables']> = lazyRollTables
  static Squads: ModelWithMetadata<SchemaToEntityMap['squads']> = lazySquads
  static Systems: ModelWithMetadata<SchemaToEntityMap['systems']> = lazySystems
  static BioTitans: ModelWithMetadata<SchemaToEntityMap['bio-titans']> = lazyBioTitans
  static Traits: ModelWithMetadata<SchemaToEntityMap['traits']> = lazyTraits
  static Vehicles: ModelWithMetadata<SchemaToEntityMap['vehicles']> = lazyVehicles
  static Sources: ModelWithMetadata<SURefSource> = lazySources
  static TechLevels: ModelWithMetadata<SURefTechLevel> = lazyTechLevels
  static CatalogCategories: ModelWithMetadata<SURefCatalogCategory> = lazyCatalogCategories

  // ---------------------------------------------------------------------------
  // preload / isLoaded API
  // ---------------------------------------------------------------------------

  /**
   * Load schemas before use.
   *
   * @param schemas - Array of schema IDs to load, or `'all'` to load everything.
   * @returns Promise that resolves when all requested schemas are loaded.
   *
   * @example
   * // Load everything (safe default):
   * await SalvageUnionReference.preload('all')
   *
   * // Load only what you need (enables code-splitting):
   * await SalvageUnionReference.preload(['chassis', 'systems', 'modules'])
   */
  public static async preload(schemas: string[] | 'all'): Promise<void> {
    await loadSchemas(schemas)

    // Install backing models into all LazyModel wrappers for loaded schemas
    const ids = schemas === 'all' ? Object.keys(lazyModelsById) : schemas
    for (const id of ids) {
      const lazyModel = lazyModelsById[id]
      if (!lazyModel) continue
      if (!isSchemaLoaded(id)) continue

      try {
        const backing = getLoadedModel(id, toPascalCase(id))
        lazyModel._install(backing as BaseModel<unknown>)
      } catch {
        // Already logged during load; skip gracefully
      }
    }

    // Invalidate the action map and search index so they are rebuilt with fresh data
    invalidateActionMap()
    invalidateSearchIndex()
  }

  /**
   * Check whether a schema has been loaded.
   *
   * @param schemaId - The schema ID to check (e.g. `'chassis'`, `'abilities'`).
   * @returns `true` if the schema has been loaded via `preload()`, `false` otherwise.
   */
  public static isLoaded(schemaId: string): boolean {
    return isSchemaLoaded(schemaId)
  }

  // ---------------------------------------------------------------------------
  // Query methods
  // ---------------------------------------------------------------------------

  /**
   * Find a single entity in a specific schema
   */
  public static findIn<T extends keyof SchemaToEntityMap>(
    schemaName: T,
    predicate: (entity: SchemaToEntityMap[T]) => boolean
  ): (SchemaToEntityMap[T] & { schemaName: T }) | undefined {
    // lazyModelMap[schemaName] is already LazyModel<SchemaToEntityMap[T]> (a
    // BaseModel<...>); only the schemaName literal narrowing needs an `as`.
    const model = lazyModelMap[schemaName]
    return model.find(predicate) as (SchemaToEntityMap[T] & { schemaName: T }) | undefined
  }

  /**
   * Find all entities matching a predicate in a specific schema
   */
  public static findAllIn<T extends keyof SchemaToEntityMap>(
    schemaName: T,
    predicate: (entity: SchemaToEntityMap[T]) => boolean
  ): (SchemaToEntityMap[T] & { schemaName: T })[] {
    const model = lazyModelMap[schemaName]
    return model.findAll(predicate) as (SchemaToEntityMap[T] & {
      schemaName: T
    })[]
  }

  /**
   * Get an entity by schema name and ID (O(1) via ID map)
   */
  public static get<T extends keyof SchemaToEntityMap>(
    schemaName: T,
    id: string
  ): (SchemaToEntityMap[T] & { schemaName: T }) | undefined {
    const model = lazyModelMap[schemaName]
    return model.getById(id) as (SchemaToEntityMap[T] & { schemaName: T }) | undefined
  }

  /**
   * Check if an entity exists by schema name and ID
   */
  public static exists<T extends keyof SchemaToEntityMap>(schemaName: T, id: string): boolean {
    return this.get(schemaName, id) !== undefined
  }

  /**
   * Get multiple entities by schema name and IDs
   */
  public static getMany(requests: Array<{ schemaName: keyof SchemaToEntityMap; id: string }>): (
    | (SchemaToEntityMap[keyof SchemaToEntityMap] & {
        schemaName: keyof SchemaToEntityMap
      })
    | undefined
  )[] {
    return requests.map((req) => this.get(req.schemaName, req.id))
  }

  /**
   * Parse a reference string into schema name and ID
   */
  public static parseRef(ref: string): {
    schemaName: SURefEnumSchemaName
    id: string
  } | null {
    const parts = ref.split('::')
    if (parts.length !== 2) return null

    const schemaName = parts[0]
    const id = parts[1]
    if (!schemaName || !id) return null
    if (!(SchemaToModelMap as Record<string, string>)[schemaName as SURefEnumSchemaName])
      return null

    return { schemaName: schemaName as SURefEnumSchemaName, id }
  }

  /**
   * Get an entity by reference string
   */
  public static getByRef(ref: string):
    | (SchemaToEntityMap[keyof SchemaToEntityMap] & {
        schemaName: keyof SchemaToEntityMap
      })
    | undefined {
    const parsed = this.parseRef(ref)
    if (!parsed) return undefined
    if (parsed.schemaName in SchemaToModelMap) {
      return this.get(parsed.schemaName as keyof SchemaToEntityMap, parsed.id)
    }
    return undefined
  }

  /**
   * Search across all or specific schemas
   */
  public static search(options: SearchOptions): SearchResult[] {
    return searchFn(options)
  }

  /**
   * Search within a specific schema
   */
  public static searchIn<T extends SURefEntity>(
    schemaName: SURefEnumSchemaName,
    query: string,
    options?: { limit?: number }
  ): (T & { schemaName: SURefEnumSchemaName })[] {
    return searchInFn(schemaName, query, options)
  }

  /**
   * Get search suggestions based on partial query
   */
  public static getSuggestions(
    query: string,
    options?: {
      schemas?: SURefEnumSchemaName[]
      limit?: number
    }
  ): string[] {
    return getSuggestionsFn(query, options)
  }

  /**
   * Resolve actions from any entity that might have actions
   */
  public static resolveActions(entity: SURefMetaEntity): SURefMetaAction[] | undefined {
    return getChassisAbilities(entity) ?? extractActions(entity)
  }

  /**
   * Get all entities from multiple schemas, tagged with their schema name
   */
  public static getAllBySchemaNames(
    schemaNames: (keyof SchemaToEntityMap)[]
  ): Array<{ schemaName: keyof SchemaToEntityMap; entity: SURefMetaEntity }> {
    const result: Array<{
      schemaName: keyof SchemaToEntityMap
      entity: SURefMetaEntity
    }> = []
    for (const schemaName of schemaNames) {
      // Irreducible cast: lazyModelMap[schemaName] is a union of per-schema
      // LazyModels, but that union includes non-meta entity types (e.g.
      // catalog-categories -> SURefCatalogCategory, which is intentionally NOT
      // in SURefMetaEntity), so neither a plain `as` nor a mapped-type narrowing
      // applies. Callers only ever pass entity/meta schema names, so the
      // narrowed entities are valid SURefMetaEntity in practice.
      const model = lazyModelMap[schemaName] as unknown as BaseModel<SURefMetaEntity>
      for (const entity of model.all()) {
        result.push({ schemaName, entity })
      }
    }
    return result
  }
}

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Testing utilities
// ---------------------------------------------------------------------------

/**
 * Reset all lazy-loading state for testing purposes.
 * Clears ModelFactory load state AND resets all LazyModel backing models.
 * Must be called in tests that need to exercise preload from a clean state.
 */
export function resetAllForTesting(): void {
  resetLoadStateForTesting()
  for (const lazyModel of Object.values(lazyModelMap)) {
    lazyModel._reset()
  }
}
