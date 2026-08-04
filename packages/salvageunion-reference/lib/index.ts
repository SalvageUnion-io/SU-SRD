/**
 * Salvage Union Data ORM
 *
 * Type-safe query interface for Salvage Union game data
 * Models are loaded lazily via SalvageUnionReference.preload().
 */

// Imported from the concrete module rather than the ./utilities.js barrel: the
// action-resolution module already imports this one (it needs
// SalvageUnionReference), so going through the barrel would pull every other
// utilities module into that cycle for no reason.
import { extractActions, getChassisAbilities, invalidateActionMap } from './actionResolution.js'
import type { ModelWithMetadata } from './BaseModel.js'
import type { EntitySchemaName, SchemaToEntityMap } from './generated/schemaRegistry.generated.js'
import { lazyModelMap, SCHEMA_REGISTRY } from './generated/schemaRegistry.generated.js'
import type { LazyModel } from './LazyModel.js'
import {
  getLoadedModel,
  isSchemaLoaded,
  loadSchemas,
  resetLoadStateForTesting,
  toPascalCase,
} from './ModelFactory.js'
import { invalidateSearchIndex } from './search.js'
import type {
  SURefEntity,
  SURefEnumSchemaName,
  SURefMetaAction,
  SURefMetaEntity,
} from './types/index.js'

export { BaseModel, type ModelWithMetadata } from './BaseModel.js'
// Export content block helpers
export {
  parseContentBlockString,
  replaceChassisPlaceholder,
  resolveDataValueForTechLevel,
} from './contentBlockHelpers.js'
// Export helper functions for common operations
export * from './helpers.js'
export { type EnhancedSchemaMetadata, getDataMaps, getSchemaCatalog } from './ModelFactory.js'
// Export the granted-equipment choice resolver (pure view computation)
export {
  type ChoicePrompt,
  type ChoiceSelections,
  type ResolvedChoiceView,
  resolveChoiceView,
} from './resolveChoiceView.js'
export { type D20Roller, type RollOnTableOutcome, rollOnTable } from './rollOnTable.js'
export {
  extractContentText,
  getSuggestions,
  invalidateSearchIndex,
  // Search primitives. Public because every consumer that needs them today has
  // forked them instead (discord-bot + component-lib fork `isSchemaName`; srd
  // forks `extractContentText`, `withinEditDistance1` and
  // `TYPO_MIN_TOKEN_LENGTH`). One implementation, one behaviour.
  isSchemaName,
  type SearchOptions,
  type SearchResult,
  search,
  searchIn,
  TYPO_MIN_TOKEN_LENGTH,
  withinEditDistance1,
} from './search.js'
// Export slug utilities
export { findEntityBySlug, getEntitySlug, nameToSlug } from './slug.js'
// Export utility functions (type guards and property extractors)
export * from './utilities.js'
export {
  type ColumnsTableRollResult,
  isColumnsTable,
  resultForColumnsTable,
  resultForTable,
  type TableRollResult,
} from './utils/resultForTable.js'

import type { SearchOptions, SearchResult } from './search.js'
import {
  getSuggestions as getSuggestionsFn,
  search as searchFn,
  searchIn as searchInFn,
} from './search.js'

// ---------------------------------------------------------------------------
// Lazy model registry — LazyModel is defined in ./LazyModel.js; the ~27
// per-schema instances (lazyModelMap), SchemaToEntityMap, and SCHEMA_REGISTRY
// are generated from lib/schemas/registry.ts by tools/generateRegistry.ts
// into ./generated/schemaRegistry.generated.js (imported above).
// ---------------------------------------------------------------------------

/**
 * Erased view of {@link lazyModelMap} for dynamic (arbitrary string id) access,
 * where the caller cannot statically know which schema's entity type applies
 * (e.g. preload() iterating a runtime list of ids). This is a checked widening,
 * not a cast: every per-schema `LazyModel<T>` is assignable to
 * `LazyModel<unknown>`, and the id → backing-model correspondence is guaranteed
 * at runtime by loadSchemas().
 */
const lazyModelsById: Record<string, LazyModel<unknown> | undefined> = lazyModelMap

export type * from './types/index.js'
export type { EntitySchemaName, SchemaToEntityMap }

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
// biome-ignore lint/complexity/noStaticOnlyClass: `SalvageUnionReference.{Model}` static accessors are the package's public API (consumed across all apps); the generator injects statics into this class body, and lib/index.test.ts asserts they are own properties of the class.
export class SalvageUnionReference {
  // Static model properties — these are LazyModel instances that throw until
  // preload() is called. Each is exposed under its public ModelWithMetadata
  // type via a type annotation (not a cast): LazyModel<T> structurally
  // satisfies ModelWithMetadata<T>, so assignment is checked, not asserted.
  //
  // The block below is generated by tools/generateRegistry.ts from
  // lib/schemas/registry.ts (run `bun run build:package` to regenerate) and
  // injected verbatim between the markers. It is intentionally still real,
  // hand-inspectable class-body source (not a runtime mixin/base class) so
  // every property below stays a true *own* property of this class — see
  // lib/index.test.ts's `Object.getOwnPropertyNames(SalvageUnionReference)`.
  // GENERATED:BEGIN — see tools/generateRegistry.ts
  static Abilities: ModelWithMetadata<SchemaToEntityMap['abilities']> = lazyModelMap.abilities
  static AbilityTreeRequirements: ModelWithMetadata<
    SchemaToEntityMap['ability-tree-requirements']
  > = lazyModelMap['ability-tree-requirements']
  static Actions: ModelWithMetadata<SchemaToEntityMap['actions']> = lazyModelMap.actions
  static Chassis: ModelWithMetadata<SchemaToEntityMap['chassis']> = lazyModelMap.chassis
  static Classes: ModelWithMetadata<SchemaToEntityMap['classes']> = lazyModelMap.classes
  static CrawlerBays: ModelWithMetadata<SchemaToEntityMap['crawler-bays']> =
    lazyModelMap['crawler-bays']
  static CrawlerTechLevels: ModelWithMetadata<SchemaToEntityMap['crawler-tech-levels']> =
    lazyModelMap['crawler-tech-levels']
  static Crawlers: ModelWithMetadata<SchemaToEntityMap['crawlers']> = lazyModelMap.crawlers
  static Creatures: ModelWithMetadata<SchemaToEntityMap['creatures']> = lazyModelMap.creatures
  static Distances: ModelWithMetadata<SchemaToEntityMap['distances']> = lazyModelMap.distances
  static Drones: ModelWithMetadata<SchemaToEntityMap['drones']> = lazyModelMap.drones
  static Equipment: ModelWithMetadata<SchemaToEntityMap['equipment']> = lazyModelMap.equipment
  static Factions: ModelWithMetadata<SchemaToEntityMap['factions']> = lazyModelMap.factions
  static Guides: ModelWithMetadata<SchemaToEntityMap['guides']> = lazyModelMap.guides
  static Keywords: ModelWithMetadata<SchemaToEntityMap['keywords']> = lazyModelMap.keywords
  static Meld: ModelWithMetadata<SchemaToEntityMap['meld']> = lazyModelMap.meld
  static Modules: ModelWithMetadata<SchemaToEntityMap['modules']> = lazyModelMap.modules
  static NPCs: ModelWithMetadata<SchemaToEntityMap['npcs']> = lazyModelMap.npcs
  static RollTables: ModelWithMetadata<SchemaToEntityMap['roll-tables']> =
    lazyModelMap['roll-tables']
  static Squads: ModelWithMetadata<SchemaToEntityMap['squads']> = lazyModelMap.squads
  static Systems: ModelWithMetadata<SchemaToEntityMap['systems']> = lazyModelMap.systems
  static BioTitans: ModelWithMetadata<SchemaToEntityMap['bio-titans']> = lazyModelMap['bio-titans']
  static Traits: ModelWithMetadata<SchemaToEntityMap['traits']> = lazyModelMap.traits
  static Vehicles: ModelWithMetadata<SchemaToEntityMap['vehicles']> = lazyModelMap.vehicles
  static Sources: ModelWithMetadata<SchemaToEntityMap['sources']> = lazyModelMap.sources
  static TechLevels: ModelWithMetadata<SchemaToEntityMap['tech-levels']> =
    lazyModelMap['tech-levels']
  static CatalogCategories: ModelWithMetadata<SchemaToEntityMap['catalog-categories']> =
    lazyModelMap['catalog-categories']
  // GENERATED:END

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
        lazyModel._install(backing)
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
    return SalvageUnionReference.get(schemaName, id) !== undefined
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
    return requests.map((req) => SalvageUnionReference.get(req.schemaName, req.id))
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
    if (!(schemaName in SchemaToModelMap)) return null

    // Sole assertion: the registry key set is a superset of SURefEnumSchemaName
    // ('actions' and 'catalog-categories' are registered but not in the zod
    // enum), and this public signature predates that split. Narrowing the
    // guard to the enum would reject 'actions::…' refs — a behavior change.
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
    const parsed = SalvageUnionReference.parseRef(ref)
    if (!parsed) return undefined
    if (parsed.schemaName in SchemaToModelMap) {
      return SalvageUnionReference.get(parsed.schemaName, parsed.id)
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
  public static getAllBySchemaNames<K extends keyof SchemaToEntityMap>(
    schemaNames: K[]
  ): Array<{ schemaName: K; entity: SchemaToEntityMap[K] }> {
    const result: Array<{ schemaName: K; entity: SchemaToEntityMap[K] }> = []
    for (const schemaName of schemaNames) {
      // lazyModelMap is a homomorphic mapped type, so a generic indexed access
      // resolves to LazyModel<SchemaToEntityMap[K]> — no cast needed, and the
      // result is typed by the exact schemas the caller passed (e.g.
      // catalog-categories entities are no longer mislabelled SURefMetaEntity).
      const model = lazyModelMap[schemaName]
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

// ---------------------------------------------------------------------------
// Rules — pure game-rules logic (ADR-006) lives in ./rules/, exposed via the
// 'salvageunion-reference/rules' subpath export (package.json), NOT re-exported
// from this main barrel. Re-exporting `export * from './rules/index.js'` here
// would make every consumer of the main package entrypoint (including ones
// that never touch rules, like the Discord bot's lookup/roll commands)
// transitively load all rules modules via ESM's eager re-export semantics —
// inflating their bundle and diluting their test-coverage denominator with
// code they never exercise. Import rules explicitly:
//   import { computeMechCapacity } from 'salvageunion-reference/rules'
// ---------------------------------------------------------------------------
