/**
 * Salvage Union Data ORM
 *
 * Type-safe query interface for Salvage Union game data
 * Models are loaded lazily via SalvageUnionReference.preload().
 */
import type { ModelWithMetadata } from './BaseModel';
import type { EntitySchemaName, SchemaToEntityMap } from './generated/schemaRegistry.generated';
import { SCHEMA_REGISTRY } from './generated/schemaRegistry.generated';
import type { LoadProjection } from './ModelFactory';
import type { RefMetaAction, RefMetaEntity } from './schemas/index';
export { extractPatternActions, extractVisibleActions, getChassisAbilities, getChoices, getTraits, } from './actionResolution';
export { assetUrl, getAssetUrl, srdEntityPath, srdEntityUrl, srdSchemaPath, srdSchemaUrl, } from './assets';
export { bookQuote } from './bookQuote';
export { parseContentBlockString, replaceChassisPlaceholder } from './contentBlockHelpers';
export { getName, getPageReference, getReferenceEntityName, getSlotsRequired, getSource, getTechLevel, getTree, } from './entityFields';
export { isAbility, isBaseAdvancedClass, isCoreClass } from './entityGuards';
export { formerSlugsIn, resolveFormerSlug } from './formerSlugs';
export type * from './generated/entityTypes.generated';
export { byTechLevelThenName, extractStaticEntitySummary, getEntitySchemas, getModel, getReferenceEntityData, getUniqueSources, getUniqueTechLevels, getUniqueTrees, resolveActivationCurrency, resolveGrantedEntities, type StaticEntitySummary, techLevelRank, } from './helpers';
export { getInventorySlots } from './inventorySlots';
export { type EnhancedSchemaMetadata, getDataMaps, getSchemaCatalog } from './ModelFactory';
export { nameToSlug } from './nameToSlug';
export { displayTitle } from './naming';
export { SRD_SITE_URL } from './origin';
export { getPatterns, isBioTitanPattern, normalizePatternName, visiblePatterns, } from './patterns';
export { type ChoiceSelections, resolveChoiceView } from './resolveChoiceView';
export { d20ForTable, NO_EFFECT, type RollOnTableOutcome, rollOnTable, type TableDice, } from './rollOnTable';
export { SchemaNotLoadedError } from './SchemaNotLoadedError';
export type { RefEnumSchemaName, RefObjectAnyPattern, RefObjectBonusPerTechLevel, RefObjectChoice, RefObjectContentBlock, RefObjectDamage, RefObjectDataValue, RefObjectGuideStep, RefObjectPattern, RefObjectTable, RefObjectTrait, } from './schemas/index';
export { extractContentText, isSchemaName, patternSearchText, type SearchOptions, type SearchResult, search, searchIn, } from './search';
export { matchSearchTokens, scoreSearchMatch, searchNameWords, tokenizeSearchQuery, } from './searchRanking';
export { findEntityBySlug, getEntitySlug } from './slug';
export { topLevelRollTables } from './topLevelRollTables';
export { parseTraitReferences, plainTraitText } from './traitText';
export { truncate } from './truncate';
export { resultForColumnsTable, resultForTable } from './utils/resultForTable';
export { DISCORD_NEUTRAL_ACCENT, DISCORD_ROLL_ACCENT, discordAccent, } from './view/discordAccents';
export { type DiscordBlock, discordCard, discordCardParts, discordCiteLine, linkTraitReferences, rangeLabel, } from './view/discordCard';
export { COMPONENT_EMBED_MAX_BYTES, componentEmbedJson, discordEntryCard, } from './view/discordEntryCard';
export { droneOwnLoadout, foldedActionOf, isTitanicAction, type NestedGroup, nestedEntityGroups, patternGroups, resolveLoadout, vehicleSystemNames, } from './view/parts/children';
export { type AdditionalSource, type BookCite, bookName, formatCite, formatProvenance, resolveAdditionalSources, resolveProvenance, } from './view/parts/cite';
export type { ItemCondition, StatLabel } from './view/parts/facts';
export { ACTION_TYPE_LABELS, bookStats, CONDITION_LABELS, entityStats, opensGroup, STAT_LABELS, splitStatLine, } from './view/parts/facts';
export { entityTone, guideTone, headerFill } from './view/parts/fill';
export { bayKind, classKind, entityStamp, isDoEntity, schemaDomain, tierNumeral, } from './view/parts/kind';
export { firstParagraphText } from './view/parts/lead';
export { resolveTable } from './view/parts/table';
export { type FacetCell, facetCells, formatActionType, formatCost, } from './view/parts/traits';
export { glossaryRef, toEntityModel } from './view/toEntityModel';
export type { EntityArt, EntityDomain, EntityInstance, EntityModel, EntityRef, Fact, StatGroup, TraitMention, } from './view/types';
export type { EntitySchemaName, SchemaToEntityMap };
export declare const EntitySchemaNames: Set<keyof SchemaToEntityMap>;
export declare const SchemaToDisplayName: { readonly [K in keyof typeof SCHEMA_REGISTRY]: (typeof SCHEMA_REGISTRY)[K]['display']; };
/**
 * Main ORM class with static model accessors
 *
 * Data is loaded lazily. Call `SalvageUnionReference.preload('all')` (or a
 * specific array of schema IDs) before accessing any model.
 */
export declare class SalvageUnionReference {
    static Abilities: ModelWithMetadata<SchemaToEntityMap['abilities']>;
    static AbilityTreeRequirements: ModelWithMetadata<SchemaToEntityMap['ability-tree-requirements']>;
    static Actions: ModelWithMetadata<SchemaToEntityMap['actions']>;
    static Chassis: ModelWithMetadata<SchemaToEntityMap['chassis']>;
    static Classes: ModelWithMetadata<SchemaToEntityMap['classes']>;
    static CrawlerBays: ModelWithMetadata<SchemaToEntityMap['crawler-bays']>;
    static CrawlerTechLevels: ModelWithMetadata<SchemaToEntityMap['crawler-tech-levels']>;
    static Crawlers: ModelWithMetadata<SchemaToEntityMap['crawlers']>;
    static Creatures: ModelWithMetadata<SchemaToEntityMap['creatures']>;
    static Distances: ModelWithMetadata<SchemaToEntityMap['distances']>;
    static Drones: ModelWithMetadata<SchemaToEntityMap['drones']>;
    static Equipment: ModelWithMetadata<SchemaToEntityMap['equipment']>;
    static Factions: ModelWithMetadata<SchemaToEntityMap['factions']>;
    static Guides: ModelWithMetadata<SchemaToEntityMap['guides']>;
    static Keywords: ModelWithMetadata<SchemaToEntityMap['keywords']>;
    static Meld: ModelWithMetadata<SchemaToEntityMap['meld']>;
    static Modules: ModelWithMetadata<SchemaToEntityMap['modules']>;
    static NPCs: ModelWithMetadata<SchemaToEntityMap['npcs']>;
    static RollTables: ModelWithMetadata<SchemaToEntityMap['roll-tables']>;
    static Squads: ModelWithMetadata<SchemaToEntityMap['squads']>;
    static Systems: ModelWithMetadata<SchemaToEntityMap['systems']>;
    static BioTitans: ModelWithMetadata<SchemaToEntityMap['bio-titans']>;
    static Traits: ModelWithMetadata<SchemaToEntityMap['traits']>;
    static Vehicles: ModelWithMetadata<SchemaToEntityMap['vehicles']>;
    static Sources: ModelWithMetadata<SchemaToEntityMap['sources']>;
    static TechLevels: ModelWithMetadata<SchemaToEntityMap['tech-levels']>;
    static CatalogCategories: ModelWithMetadata<SchemaToEntityMap['catalog-categories']>;
    /**
     * Load schemas before use.
     *
     * Files are installed as committed, with no Zod parse: CI validates them and
     * proves them parse-stable (see the header of `ModelFactory.ts`).
     *
     * @param schemas - Array of schema IDs to load, or `'all'` to load everything.
     * @param options.projection - `'list'` loads a schema's list projection
     *   (rows without their prose, `lib/listProjection.ts`) where it has one, for
     *   a listing that never prints that prose. A later full `preload` replaces it.
     * @returns Promise that resolves when all requested schemas are loaded.
     *
     * @example
     * // Load everything (safe default):
     * await SalvageUnionReference.preload('all')
     *
     * // Load only what you need (enables code-splitting):
     * await SalvageUnionReference.preload(['chassis', 'systems', 'modules'])
     *
     * // A listing: actions without their prose
     * await SalvageUnionReference.preload(['systems', 'actions'], { projection: 'list' })
     */
    static preload(schemas: string[] | 'all', options?: {
        projection?: LoadProjection;
    }): Promise<void>;
    /**
     * Load schemas from data the caller has already imported — the synchronous
     * sibling of {@link preload}, for a runtime with no dynamic `import()`.
     *
     * Convex's default runtime is one: `preload` throws "dynamic module import
     * unsupported" there. Import the committed files statically
     * (`salvageunion-reference/data/<schema>.json`) and pass them unchanged,
     * keyed by schema id. Idempotent, like `preload`, and cheap to repeat: a call
     * that installs nothing new leaves the action map and search index alone.
     *
     * @example
     * import chassis from 'salvageunion-reference/data/chassis.json'
     * SalvageUnionReference.install({ chassis })
     */
    static install(data: Partial<Record<EntitySchemaName, readonly unknown[]>>): void;
    /**
     * Check whether a schema has been loaded.
     *
     * @param schemaId - The schema ID to check (e.g. `'chassis'`, `'abilities'`).
     * @param options.projection - `'list'` also counts a list-projection load.
     * @returns `true` if the schema has been loaded in full via `preload()`
     *   (or, with `projection: 'list'`, in either projection), `false` otherwise.
     */
    static isLoaded(schemaId: string, options?: {
        projection?: LoadProjection;
    }): boolean;
    /**
     * Find a single entity in a specific schema
     */
    static findIn<T extends keyof SchemaToEntityMap>(schemaName: T, predicate: (entity: SchemaToEntityMap[T]) => boolean): (SchemaToEntityMap[T] & {
        schemaName: T;
    }) | undefined;
    /**
     * Find all entities matching a predicate in a specific schema
     */
    static findAllIn<T extends keyof SchemaToEntityMap>(schemaName: T, predicate: (entity: SchemaToEntityMap[T]) => boolean): (SchemaToEntityMap[T] & {
        schemaName: T;
    })[];
    /**
     * Get an entity by schema name and ID (O(1) via ID map)
     */
    static get<T extends keyof SchemaToEntityMap>(schemaName: T, id: string): (SchemaToEntityMap[T] & {
        schemaName: T;
    }) | undefined;
    /**
     * Get an entity by schema name and exact `name` (O(1) via the name index).
     *
     * The name-addressed sibling of {@link get}, for a caller holding a SCHEMA ID
     * rather than a static model (`findIn('chassis', …)`, anything driven by
     * data), so it never needs `findIn(schema, (e) => e.name === x)` — a full
     * linear scan, the pattern `CLAUDE.md` bans. Exactly equivalent to that
     * predicate, including first-writer-wins on duplicates.
     *
     * The slug axis already had its schema-id-holding accessor —
     * `findEntityBySlug` (lib/slug.ts) — so only `name` was missing.
     */
    static getByNameIn<T extends keyof SchemaToEntityMap>(schemaName: T, name: string): (SchemaToEntityMap[T] & {
        schemaName: T;
    }) | undefined;
    /**
     * Resolve actions from any entity that might have actions
     */
    static resolveActions(entity: RefMetaEntity): RefMetaAction[] | undefined;
    /**
     * Get all entities from multiple schemas, tagged with their schema name
     */
    static getAllBySchemaNames<K extends keyof SchemaToEntityMap>(schemaNames: K[]): Array<{
        schemaName: K;
        entity: SchemaToEntityMap[K];
    }>;
}
/**
 * Reset all lazy-loading state for testing purposes.
 * Clears ModelFactory load state AND resets all LazyModel backing models.
 * Must be called in tests that need to exercise preload from a clean state.
 */
export declare function resetAllForTesting(): void;
