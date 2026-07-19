// === lib/BaseModel.d.ts ===
/**
 * Type for models with metadata properties
 */
export type ModelWithMetadata<T> = BaseModel<T> & {
    readonly schemaName: string;
    readonly displayName: string;
};
/**
 * Simplified Base Model class for querying JSON data with type safety
 * Provides only the essential query methods
 *
 * Performance: schemaName is stamped on each entity at construction time
 * and an ID map is built for O(1) lookups via getById().
 */
export declare class BaseModel<T> {
    protected data: (T & {
        schemaName: string;
    })[];
    protected idMap: Map<string, T & {
        schemaName: string;
    }>;
    schema: Record<string, unknown>;
    protected _schemaName: string;
    protected _displayName: string;
    constructor(data: T[], schema: Record<string, unknown>, schemaName: string, displayName: string);
    /**
     * Get all items (schemaName already stamped)
     */
    all(): (T & {
        schemaName: string;
    })[];
    /**
     * Find a single item by predicate (same interface as Array.find)
     */
    find(predicate: (item: T) => boolean): (T & {
        schemaName: string;
    }) | undefined;
    /**
     * Find all items matching predicate (same interface as Array.filter)
     */
    findAll(predicate: (item: T) => boolean): (T & {
        schemaName: string;
    })[];
    /**
     * Get an entity by ID in O(1) time
     */
    getById(id: string): (T & {
        schemaName: string;
    }) | undefined;
}
//# sourceMappingURL=BaseModel.d.ts.map
// === lib/LazyModel.d.ts ===
import { BaseModel } from './BaseModel.js';
/**
 * A BaseModel subclass that guards all data-access methods behind a load
 * check. Before preload(), all data methods throw. After preload(), they
 * delegate to the real backing model.
 *
 * The backing model is replaced in place so that references captured before
 * preload (e.g. `const c = SalvageUnionReference.Chassis`) see the real data
 * after preload completes.
 *
 * Extracted to its own module (rather than living in lib/index.ts) so that
 * the generated lib/generated/schemaRegistry.generated.ts — which
 * instantiates one LazyModel per schema — can import it without creating a
 * circular import with lib/index.ts.
 */
export declare class LazyModel<T> extends BaseModel<T> {
    private readonly _schemaIdForLazy;
    private _backing;
    readonly schemaName: string;
    readonly displayName: string;
    constructor(schemaId: string, _propName: string, displayNameValue: string);
    /**
     * Install the real backing model once preload() has resolved.
     * Called by SalvageUnionReference.preload() after loading completes.
     */
    _install(backing: BaseModel<T>): void;
    /**
     * Reset to the pre-load state (testing only). Clears the backing model and
     * schema so subsequent data access throws again. Owning the private
     * `_backing` field here lets resetAllForTesting() avoid an `as unknown as`
     * reach-in to poke the private field from outside the class.
     */
    _reset(): void;
    private _loadedBacking;
    all(): (T & {
        schemaName: string;
    })[];
    find(predicate: (item: T) => boolean): (T & {
        schemaName: string;
    }) | undefined;
    findAll(predicate: (item: T) => boolean): (T & {
        schemaName: string;
    })[];
    getById(id: string): (T & {
        schemaName: string;
    }) | undefined;
}
//# sourceMappingURL=LazyModel.d.ts.map
// === lib/ModelFactory.d.ts ===
/**
 * Model Factory - Auto-generates models from schema catalog
 * Uses lazy (dynamic) imports for JSON data files so consumers
 * can code-split the ~1.1 MB data corpus via SalvageUnionReference.preload().
 *
 * The four registries below (dataLoaders, jsonSchemaLoaders, zodSchemaMap,
 * schemaDisplayNames) are generated from lib/schemas/registry.ts by
 * tools/generateRegistry.ts into lib/generated/modelFactoryRegistry.generated.ts
 * — run `bun run build:package` to regenerate after editing the manifest.
 */
import { BaseModel } from './BaseModel.js';
import { toPascalCase } from './naming.js';
import { zodSchemaMap, schemaDisplayNames } from './generated/modelFactoryRegistry.generated.js';
export { toPascalCase };
export { zodSchemaMap, schemaDisplayNames };
/**
 * Returns true if the given schema ID has been loaded via preload().
 */
export declare function isSchemaLoaded(schemaId: string): boolean;
/**
 * Load the given schemas (or all schemas if 'all' is passed).
 * Idempotent: already-loaded schemas are skipped.
 * Returns a Promise that resolves when all requested schemas are loaded.
 */
export declare function loadSchemas(schemas: string[] | 'all'): Promise<void>;
/**
 * Get a loaded model by PascalCase property name.
 * Throws with a descriptive error if the schema hasn't been loaded yet.
 */
export declare function getLoadedModel(schemaId: string, propertyName: string): BaseModel<unknown>;
/**
 * Reset all load state. Exposed for testing only.
 * In production, schemas are loaded once and kept for the lifetime of the process.
 */
export declare function resetLoadStateForTesting(): void;
/**
 * Get the loaded data and schema maps (synchronous).
 * Only returns data for schemas that have been preloaded.
 * Exposed for client use (e.g. resolveActions in index.ts).
 */
export declare function getDataMaps(): {
    dataMap: Record<string, unknown[]>;
    schemaMap: Record<string, Record<string, unknown>>;
};
/**
 * Registry key sets, exported for the consistency test ONLY — the loader
 * maps themselves stay private (they must remain static-literal for
 * bundler-analyzable dynamic imports). Every map here must cover exactly
 * the same schema ids; lib/registryConsistency.test.ts enforces it.
 */
export declare const _registryKeySets: {
    dataLoaders: string[];
    jsonSchemaLoaders: string[];
    zodSchemaMap: string[];
};
/**
 * Enhanced schema metadata interface
 */
export interface EnhancedSchemaMetadata {
    id: string;
    title: string;
    description: string;
    comment?: string;
    dataFile: string;
    schemaFile: string;
    itemCount: number;
    requiredFields: string[];
    displayName: string;
    displayNamePlural: string;
    meta?: boolean;
}
/**
 * Get schema catalog with enhanced metadata
 * Exposed for client use
 */
export declare function getSchemaCatalog(): {
    $schema: string;
    title: string;
    description: string;
    version: string;
    generated: string;
    schemas: EnhancedSchemaMetadata[];
};
//# sourceMappingURL=ModelFactory.d.ts.map
// === lib/combatUtils.d.ts ===
/**
 * Combat utility functions for Salvage Union game logic.
 *
 * Pure functions with no side effects. No backend dependency.
 * All combat math and rule checks live here so the logic is testable
 * in isolation and reusable across any consumer (ITUN, Discord bot, etc.).
 */
import type { ItemCondition } from './utilities.js';
/**
 * Minimal shape needed to read heat trait data from an entity.
 * The traits array is optional — many entities have no traits.
 */
type EntityWithTraits = {
    traits?: Array<{
        type: string;
        amount?: number | string;
    }>;
    [key: string]: unknown;
};
/**
 * Return the heat generated by an entity's hot trait.
 *
 * - Fixed heat:    trait `{ type: 'hot', amount: N }` → returns N
 * - Variable heat: trait `{ type: 'hot (x)' }` → returns `'variable'`
 * - No hot trait:  returns `0`
 */
export declare function getHeatGenerated(entity: EntityWithTraits): number | 'variable';
/**
 * Apply heat to a mech, clamping at the heat cap.
 * Heat cannot exceed heatCap.
 */
export declare function applyHeat(currentHeat: number, heatGenerated: number, heatCap: number): number;
/**
 * Check whether an action can be activated given current heat and cost.
 * An action is blocked if using it would push heat above the heat cap.
 */
export declare function canActivateAction(currentHeat: number, heatCost: number, heatCap: number): boolean;
/**
 * Determine whether a Heat Check is triggered.
 * Per rules p.234, a Heat Check triggers when:
 *  - The mech's heat reaches or exceeds its heat capacity after gaining heat, OR
 *  - The mech is Pushed (Push always brings heat to capacity, so this is covered
 *    by the same condition).
 *
 * Normal heat gain that stays below capacity does NOT trigger a Heat Check.
 */
export declare function shouldTriggerHeatCheck(currentHeat: number, heatGained: number, heatCapacity: number): boolean;
/**
 * Check whether the mech can push.
 * Pushing adds 2 heat. Cannot push if the +2 would exceed the heat cap.
 */
export declare function canPush(currentHeat: number, heatCap: number): boolean;
/**
 * Return the next condition in the damage progression.
 * intact → damaged → destroyed → destroyed (stays at destroyed)
 */
export declare function nextCondition(current: ItemCondition): ItemCondition;
/**
 * Apply SP damage to a mech.
 *
 * Per Salvage Union rules:
 * - newSp = max(0, currentSp - damage)
 * - hpDamage = floor(damage / 2)
 *
 * Returns the new SP value and the HP damage that flows through to the pilot.
 */
export declare function applySpDamage(currentSp: number, damage: number): {
    newSp: number;
    hpDamage: number;
};
export {};
//# sourceMappingURL=combatUtils.d.ts.map
// === lib/contentBlockHelpers.d.ts ===
/**
 * Helper functions for working with content blocks in entity data
 */
import type { SURefObjectContentBlock, SURefObjectDataValue } from './types/index.js';
/**
 * Extract the string value from a paragraph content block
 * @param content - Array of content blocks
 * @returns The string value from the first paragraph block, or undefined if not found
 */
export declare function getParagraphString(content: SURefObjectContentBlock[] | undefined): string | undefined;
/**
 * Replace [(CHASSIS)] placeholder with actual chassis name, prefixed with "The"
 *
 * @param text - Text that may contain [(CHASSIS)] placeholders
 * @param chassisName - Optional chassis name to replace placeholders with
 * @returns Text with placeholders replaced, or original text if no chassis name provided
 */
export declare function replaceChassisPlaceholder(text: string | undefined, chassisName?: string): string;
/**
 * Extract and parse string value from a content block
 *
 * @param block - Content block to extract string value from
 * @param chassisName - Optional chassis name to replace [(CHASSIS)] placeholders
 * @returns Parsed string value with placeholders replaced
 */
export declare function parseContentBlockString(block: SURefObjectContentBlock, chassisName?: string): string;
/**
 * Resolve a data value's numeric value against an effective tech level, applying
 * its `perTechLevel` scaling ("+N per Tech Level after the first"). Used for
 * granted, TL-scalable pilot equipment (e.g. Custom Sniper Rifle damage).
 *
 * The base value is the entity's TL1 value; each tech level above the first adds
 * `perTechLevel`. A value with no `perTechLevel`, a non-numeric value, or an
 * undefined/≤1 effective level returns the base unchanged.
 *
 * @returns `{ value, scaled }` — the resolved numeric value and whether scaling
 * actually changed it (drives the "modified" highlight in the UI).
 */
export declare function resolveDataValueForTechLevel(dv: SURefObjectDataValue, effectiveTechLevel: number | undefined): {
    value: number | string | undefined;
    scaled: boolean;
};
//# sourceMappingURL=contentBlockHelpers.d.ts.map
// === lib/generated/modelFactoryRegistry.generated.d.ts ===
/**
 * AUTO-GENERATED by tools/generateRegistry.ts from lib/schemas/registry.ts.
 * DO NOT EDIT DIRECTLY — edit lib/schemas/registry.ts and run
 * `bun run build:package` to regenerate.
 */
import { z } from '../zod.js';
export declare const dataLoaders: Record<string, () => Promise<unknown[]>>;
export declare const jsonSchemaLoaders: Record<string, () => Promise<Record<string, unknown>>>;
/**
 * Zod schema map — statically available, these are code not data.
 * Exported so the `validate:schemas` tool validates data against the exact
 * same schemas runtime uses, rather than maintaining a parallel literal that
 * could silently drift.
 */
export declare const zodSchemaMap: Record<string, z.ZodType<unknown>>;
/**
 * Schema display name mappings
 */
export declare const schemaDisplayNames: Record<string, {
    singular: string;
    plural: string;
}>;
//# sourceMappingURL=modelFactoryRegistry.generated.d.ts.map
// === lib/generated/schemaRegistry.generated.d.ts ===
/**
 * AUTO-GENERATED by tools/generateRegistry.ts from lib/schemas/registry.ts.
 * DO NOT EDIT DIRECTLY — edit lib/schemas/registry.ts and run
 * `bun run build:package` to regenerate.
 */
import { LazyModel } from '../LazyModel.js';
import type { SURefAbility, SURefMetaAbilityTreeRequirement, SURefMetaAction, SURefChassis, SURefClass, SURefCrawlerBay, SURefMetaCrawlerTechLevel, SURefCrawler, SURefCreature, SURefDistance, SURefDrone, SURefEquipment, SURefFaction, SURefGuide, SURefKeyword, SURefMeld, SURefModule, SURefNPC, SURefRollTable, SURefSquad, SURefSystem, SURefBioTitan, SURefTrait, SURefVehicle, SURefSource, SURefTechLevel, SURefCatalogCategory } from '../types/index.js';
export type SchemaToEntityMap = {
    abilities: SURefAbility;
    'ability-tree-requirements': SURefMetaAbilityTreeRequirement;
    actions: SURefMetaAction;
    chassis: SURefChassis;
    classes: SURefClass;
    'crawler-bays': SURefCrawlerBay;
    'crawler-tech-levels': SURefMetaCrawlerTechLevel;
    crawlers: SURefCrawler;
    creatures: SURefCreature;
    distances: SURefDistance;
    drones: SURefDrone;
    equipment: SURefEquipment;
    factions: SURefFaction;
    guides: SURefGuide;
    keywords: SURefKeyword;
    meld: SURefMeld;
    modules: SURefModule;
    npcs: SURefNPC;
    'roll-tables': SURefRollTable;
    squads: SURefSquad;
    systems: SURefSystem;
    'bio-titans': SURefBioTitan;
    traits: SURefTrait;
    vehicles: SURefVehicle;
    sources: SURefSource;
    'tech-levels': SURefTechLevel;
    'catalog-categories': SURefCatalogCategory;
};
export type EntitySchemaName = keyof SchemaToEntityMap;
/**
 * Map from schema ID to its LazyModel instance — used by preload() to
 * install backing models. Each entry is directly `LazyModel<SchemaToEntityMap[K]>`
 * (a homomorphic mapped type), so no per-entry cast is needed and a generic
 * indexed access `lazyModelMap[schemaName]` simplifies to
 * `LazyModel<SchemaToEntityMap[T]>`.
 */
export declare const lazyModelMap: {
    readonly [K in keyof SchemaToEntityMap]: LazyModel<SchemaToEntityMap[K]>;
};
export declare const SCHEMA_REGISTRY: {
    readonly abilities: {
        readonly model: "Abilities";
        readonly display: "Ability";
    };
    readonly 'ability-tree-requirements': {
        readonly model: "AbilityTreeRequirements";
        readonly display: "Ability Tree Requirement";
    };
    readonly actions: {
        readonly model: "Actions";
        readonly display: "Action";
    };
    readonly chassis: {
        readonly model: "Chassis";
        readonly display: "Chassis";
    };
    readonly classes: {
        readonly model: "Classes";
        readonly display: "Class";
    };
    readonly 'crawler-bays': {
        readonly model: "CrawlerBays";
        readonly display: "Crawler Bay";
    };
    readonly 'crawler-tech-levels': {
        readonly model: "CrawlerTechLevels";
        readonly display: "Crawler Tech Level";
    };
    readonly crawlers: {
        readonly model: "Crawlers";
        readonly display: "Crawler";
    };
    readonly creatures: {
        readonly model: "Creatures";
        readonly display: "Creature";
    };
    readonly distances: {
        readonly model: "Distances";
        readonly display: "Distance";
    };
    readonly drones: {
        readonly model: "Drones";
        readonly display: "Drone";
    };
    readonly equipment: {
        readonly model: "Equipment";
        readonly display: "Equipment";
    };
    readonly factions: {
        readonly model: "Factions";
        readonly display: "Faction";
    };
    readonly guides: {
        readonly model: "Guides";
        readonly display: "Guide";
    };
    readonly keywords: {
        readonly model: "Keywords";
        readonly display: "Keyword";
    };
    readonly meld: {
        readonly model: "Meld";
        readonly display: "Meld";
    };
    readonly modules: {
        readonly model: "Modules";
        readonly display: "Module";
    };
    readonly npcs: {
        readonly model: "NPCs";
        readonly display: "NPC";
    };
    readonly 'roll-tables': {
        readonly model: "RollTables";
        readonly display: "Roll Table";
    };
    readonly squads: {
        readonly model: "Squads";
        readonly display: "Squad";
    };
    readonly systems: {
        readonly model: "Systems";
        readonly display: "System";
    };
    readonly 'bio-titans': {
        readonly model: "BioTitans";
        readonly display: "Bio-Titan";
    };
    readonly traits: {
        readonly model: "Traits";
        readonly display: "Trait";
    };
    readonly vehicles: {
        readonly model: "Vehicles";
        readonly display: "Vehicle";
    };
    readonly sources: {
        readonly model: "Sources";
        readonly display: "Source";
    };
    readonly 'tech-levels': {
        readonly model: "TechLevels";
        readonly display: "Tech Level";
    };
    readonly 'catalog-categories': {
        readonly model: "CatalogCategories";
        readonly display: "Catalog Category";
        readonly entity: false;
    };
};
//# sourceMappingURL=schemaRegistry.generated.d.ts.map
// === lib/helpers.d.ts ===
/**
 * Helper functions for common operations on Salvage Union reference data
 * These functions provide convenient access patterns used by consuming applications
 */
import type { SURefAbility, SURefChassis, SURefClass, SURefCrawler, SURefMetaCrawlerTechLevel, SURefEntity, SURefEnumSchemaName, SURefObjectAdvancedClass, SURefObjectCrawlerMutation } from './types/index.js';
import type { EntitySchemaName } from './index.js';
import type { ModelWithMetadata } from './BaseModel.js';
import { type EnhancedSchemaMetadata } from './ModelFactory.js';
/**
 * Get the display name for a schema
 * @param schemaName - The schema name
 * @returns The display name or the schema name if not found
 */
export declare function getDisplayName(schemaName: SURefEnumSchemaName): string;
/**
 * Normalize a schema name to the canonical form
 * Handles aliases like 'classes-core' -> 'classes', 'classes-hybrid' -> 'classes'
 * @param schemaName - The schema name (may be an alias)
 * @returns The normalized schema name
 */
export declare function normalizeSchemaName(schemaName: string): SURefEnumSchemaName;
/**
 * Get a model by schema name
 * Automatically normalizes schema name aliases (e.g., 'classes-core' -> 'classes')
 * @param schemaName - The schema name (may be an alias)
 * @returns The model instance or undefined if not found
 */
export declare function getModel(schemaName: string | SURefEnumSchemaName): ModelWithMetadata<SURefEntity> | undefined;
/**
 * Resolve an entity's `grants` into the granted entities, skipping `choice`
 * grants (handled separately). Single source of truth for the grant-resolution
 * walk — used by the display layer (Grants block) and any tooling.
 */
export declare function resolveGrantedEntities(entity: SURefEntity): SURefEntity[];
/**
 * Get a map of all schema names to their models
 * Useful for dynamic model access
 */
export declare function getModelMap(): Record<SURefEnumSchemaName, ModelWithMetadata<SURefEntity>>;
/**
 * Find an entity by ID in any schema (only works with entity schemas, not meta schemas)
 * @param schemaName - The schema to search in (must be an entity schema)
 * @param id - The entity ID
 * @returns The entity or undefined if not found
 */
export declare function findById<T extends SURefEntity>(schemaName: EntitySchemaName, id: string): T | undefined;
/**
 * Get the name of an entity by ID with fallback (only works with entity schemas, not meta schemas)
 * @param schemaName - The schema to search in (must be an entity schema)
 * @param id - The entity ID
 * @param fallback - Fallback string if entity not found (default: 'Unknown')
 * @returns The entity name or fallback
 */
export declare function getNameById(schemaName: EntitySchemaName, id: string | null, fallback?: string): string;
/**
 * Type guard to check if a class is a base class (has coreTrees)
 */
export declare function isBaseClass(cls: SURefClass): cls is SURefClass & {
    coreTrees: string[];
};
/**
 * Get all base classes (classes with coreTrees)
 * @returns Array of base classes
 */
export declare function getCoreClasses(): (SURefClass & {
    schemaName: string;
})[];
/**
 * Get all hybrid classes (classes with hybrid=true)
 * @returns Array of hybrid classes
 */
export declare function getHybridClasses(): (SURefObjectAdvancedClass & {
    schemaName: string;
})[];
/**
 * Get all base classes with advanced/legendary trees (advanceable base classes)
 * @returns Array of advanceable base classes
 */
export declare function getAdvanceableClasses(): SURefClass[];
/**
 * Find a base class by name
 * @param className - Name of the class to find
 * @returns The base class or undefined if not found
 */
export declare function findCoreClass(className: string): SURefClass | undefined;
/**
 * Find a hybrid class by name
 * @param className - Name of the class to find
 * @returns The hybrid class or undefined if not found
 */
export declare function findHybridClass(className: string): SURefObjectAdvancedClass | undefined;
/**
 * Find an advanced class by name (base class that has advancedTree)
 * @param className - Name of the base class to find
 * @returns The base class with advanced tree or undefined if not found
 */
export declare function findAdvancedClass(className: string): SURefClass | undefined;
/**
 * Find a class by name across all class types (base, hybrid)
 * @param className - Name of the class to find
 * @returns The class or undefined if not found
 */
export declare function findClass(className: string): SURefClass | undefined;
/**
 * Get chassis that have patterns
 * @returns Array of chassis with patterns
 */
export declare function getChassisWithPatterns(): SURefChassis[];
/**
 * Find a chassis by ID
 * @param chassisId - The ID of the chassis to find
 * @returns The chassis or undefined if not found
 */
export declare function findChassisById(chassisId: string): SURefChassis | undefined;
/**
 * Get chassis name by ID with fallback
 * @param chassisId - The ID of the chassis to find
 * @param fallback - Fallback string if chassis not found (default: 'Unknown')
 * @returns The chassis name or fallback
 */
export declare function getChassisNameById(chassisId: string | null, fallback?: string): string;
/**
 * Find a crawler by ID
 * @param crawlerId - The ID of the crawler to find
 * @returns The crawler or undefined if not found
 */
export declare function findCrawlerById(crawlerId: string): (SURefCrawler & {
    schemaName: string;
}) | undefined;
/**
 * Get crawler name by ID with fallback
 * @param crawlerId - The ID of the crawler to find
 * @param fallback - Fallback string if crawler not found (default: 'Unknown')
 * @returns The crawler name or fallback
 */
export declare function getCrawlerNameById(crawlerId: string | null, fallback?: string): string;
/**
 * Get all mutations for a crawler type by ID
 * @param crawlerId - The crawler type ID
 * @returns Array of mutations, or empty array if none
 */
export declare function getCrawlerMutations(crawlerId: string): SURefObjectCrawlerMutation[];
/**
 * Get the total weapon slot count for a crawler type.
 * Base is 1 (from the Armament Bay) plus any weapon_slots mutations.
 * @param crawlerId - The crawler type ID
 * @returns Total weapon slots available
 */
export declare function getWeaponSlotCount(crawlerId: string): number;
/**
 * Get the max SP bonus from a crawler type's mutations.
 * @param crawlerId - The crawler type ID
 * @returns Sum of max_sp_bonus mutation values
 */
export declare function getMaxSpBonus(crawlerId: string): number;
/**
 * Normalize tech level to a number for calculations
 * Treats "B" (Bio) and "N" (Nanite) as 1
 * @param techLevel - The tech level (number, 'B', or 'N')
 * @returns The numeric tech level
 */
export declare function normalizeTechLevel(techLevel: number | 'B' | 'N' | null | undefined): number;
/**
 * Find a crawler tech level by level number
 * @param techLevel - The tech level number to find
 * @returns The tech level or undefined if not found
 */
export declare function findCrawlerTechLevel(techLevel: number): (SURefMetaCrawlerTechLevel & {
    schemaName: string;
}) | undefined;
/**
 * Get structure points for a tech level with fallback
 * @param techLevel - The tech level number (or 'B'/'N' which are treated as 1)
 * @param fallback - Fallback number if tech level not found (default: 20)
 * @returns The structure points or fallback
 */
export declare function getStructurePointsForTechLevel(techLevel: number | 'B' | 'N' | null, fallback?: number): number;
/**
 * Get abilities by level
 * @param level - The ability level
 * @returns Array of abilities at that level
 */
export declare function getAbilitiesByLevel(level: number): (SURefAbility & {
    schemaName: string;
})[];
/**
 * Get all tech levels as an array of numbers
 * Derived from crawler-tech-levels data
 * @returns Array of tech level numbers (1-6)
 */
export declare function getTechLevels(): readonly number[];
/**
 * Minimum tech level (always 1)
 */
export declare const MIN_TECH_LEVEL = 1;
/**
 * Maximum tech level
 * Derived from crawler-tech-levels data
 */
export declare function getMaxTechLevel(): number;
/**
 * Get scrap conversion rate for a tech level
 * Each tech level is worth its numeric value in TL1 scrap
 * "B" (Bio) and "N" (Nanite) are treated as 1
 * @param techLevel - The tech level (1-6, 'B', or 'N')
 * @returns The conversion rate (tech level value)
 */
export declare function getScrapConversionRate(techLevel: number | 'B' | 'N'): number;
/**
 * Get all scrap conversion rates as a record
 * @returns Record mapping tech level to conversion rate
 */
export declare function getScrapConversionRates(): Record<number, number>;
/**
 * Pilot default values
 * These are standard starting values for pilots
 */
export declare const PILOT_DEFAULTS: {
    readonly maxHP: 10;
    readonly maxAP: 5;
    readonly startingTP: 0;
    readonly inventorySlots: 6;
};
/**
 * Crawler default values
 * Derived from crawler-tech-levels data (TL1 defaults)
 */
export declare const CRAWLER_DEFAULTS: {
    readonly initialTechLevel: 1;
    readonly baseStructurePoints: 20;
    readonly baseUpgrade: 0;
};
/**
 * Mech default values
 * Standard starting values for mechs
 */
export declare const MECH_DEFAULTS: {
    readonly startingDamage: 0;
    readonly startingHeat: 0;
};
/**
 * Crawler upkeep and upgrade rules
 * Upkeep cost increases by `step` scrap per tech level; max upgrade cap.
 */
export declare const UPKEEP_RULES: {
    readonly step: 5;
    readonly maxUpgrade: 25;
};
/**
 * Resolve the activation currency for a given schema/entity category.
 * Mech-level sources (chassis, systems, modules) cost EP; variable-cost abilities
 * cost XP; everything else costs AP.
 */
export declare function resolveActivationCurrency(schemaName: SURefEnumSchemaName | 'actions' | undefined, variable?: boolean): 'AP' | 'EP' | 'XP';
/**
 * Get the list of action types from the ActionType enum schema.
 * Returns the canonical values: Passive, Free, Reaction, Turn, Short, Long, DownTime.
 */
export declare function getActionTypes(): string[];
/**
 * Get all entity schemas (non-meta schemas)
 * Filters out meta schemas like actions, ability-tree-requirements, etc.
 * @returns Array of entity schema metadata
 */
export declare function getEntitySchemas(): EnhancedSchemaMetadata[];
/**
 * Get unique tech levels from an array of entities, sorted correctly
 * Numeric levels ascending, then 'B', then 'N'
 * @param entities - Array of entities to extract tech levels from
 * @returns Sorted array of unique tech levels
 */
export declare function getUniqueTechLevels(entities: SURefEntity[]): (number | 'B' | 'N')[];
/**
 * Get unique source strings from an array of entities.
 * "Salvage Union Workshop Manual" is always first; the rest are sorted alphabetically.
 * @param entities - Array of entities to extract sources from
 * @returns Sorted array of unique source strings
 */
export declare function getUniqueSources(entities: SURefEntity[]): string[];
/**
 * Get unique ability-tree strings from an array of entities, sorted alphabetically.
 * Only abilities carry a `tree`; entities without one are skipped.
 * @param entities - Array of entities to extract trees from
 * @returns Sorted array of unique tree strings
 */
export declare function getUniqueTrees(entities: SURefEntity[]): string[];
/**
 * Aggregate display data extracted from an entity
 */
export type ReferenceEntityData = {
    id: string;
    name: string;
    slug: string;
    description: string | undefined;
    source: string | undefined;
    page: number | undefined;
    techLevel: number | 'B' | 'N' | undefined;
    assetUrl: string | undefined;
};
/**
 * Extract common display data from an entity in one call
 * Eliminates repeated defensive field extraction across consumers
 * @param entity - The entity to extract display data from
 * @returns Aggregated display data
 */
export declare function getReferenceEntityData(entity: SURefEntity): ReferenceEntityData;
/**
 * Static summary data extracted from an entity for SEO/static HTML rendering
 */
export type StaticEntitySummary = {
    name: string;
    description: string | undefined;
    source: string | undefined;
    page: number | undefined;
    techLevel: number | 'B' | 'N' | undefined;
    contentParagraphs: string[];
    stats: {
        label: string;
        value: string | number;
    }[];
    traits: string[];
};
/**
 * Extract a static summary from an entity for server-side rendering (SEO)
 * Collects text content, numeric stats, and trait names into a flat structure
 * suitable for rendering as static HTML at build time.
 * @param entity - The entity to extract a summary from
 * @returns Static summary data
 */
export declare function extractStaticEntitySummary(entity: SURefEntity): StaticEntitySummary;
//# sourceMappingURL=helpers.d.ts.map
// === lib/index.d.ts ===
/**
 * Salvage Union Data ORM
 *
 * Type-safe query interface for Salvage Union game data
 * Models are loaded lazily via SalvageUnionReference.preload().
 */
import type { ModelWithMetadata } from './BaseModel.js';
import { SCHEMA_REGISTRY, type SchemaToEntityMap, type EntitySchemaName } from './generated/schemaRegistry.generated.js';
import type { SURefMetaAction, SURefEntity, SURefMetaEntity, SURefEnumSchemaName } from './types/index.js';
export { BaseModel, type ModelWithMetadata } from './BaseModel.js';
export { getDataMaps, getSchemaCatalog, type EnhancedSchemaMetadata } from './ModelFactory.js';
export { resultForTable, resultForColumnsTable, isColumnsTable, type TableRollResult, type ColumnsTableRollResult, } from './utils/resultForTable.js';
export { rollOnTable, type RollOnTableOutcome, type D20Roller } from './rollOnTable.js';
export * from './utilities.js';
export * from './helpers.js';
export { nameToSlug, getEntitySlug, findEntityBySlug } from './slug.js';
export { getParagraphString, replaceChassisPlaceholder, parseContentBlockString, resolveDataValueForTechLevel, } from './contentBlockHelpers.js';
export { search, searchIn, getSuggestions, invalidateSearchIndex, type SearchOptions, type SearchResult, } from './search.js';
export { resolveChoiceView, type ChoiceSelections, type ChoicePrompt, type ResolvedChoiceView, } from './resolveChoiceView.js';
export { getHeatGenerated, applyHeat, canActivateAction, shouldTriggerHeatCheck, canPush, nextCondition, applySpDamage, } from './combatUtils.js';
import { type SearchOptions, type SearchResult } from './search.js';
export type * from './types/index.js';
export { getJsonSchemaDefinition, getAllJsonSchemaDefinitions } from './schemaDefinitions.js';
export type { SchemaToEntityMap, EntitySchemaName };
export declare const EntitySchemaNames: Set<keyof SchemaToEntityMap>;
export declare const SchemaToModelMap: { readonly [K in keyof typeof SCHEMA_REGISTRY]: (typeof SCHEMA_REGISTRY)[K]["model"]; };
export declare const SchemaToDisplayName: { readonly [K in keyof typeof SCHEMA_REGISTRY]: (typeof SCHEMA_REGISTRY)[K]["display"]; };
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
    static preload(schemas: string[] | 'all'): Promise<void>;
    /**
     * Check whether a schema has been loaded.
     *
     * @param schemaId - The schema ID to check (e.g. `'chassis'`, `'abilities'`).
     * @returns `true` if the schema has been loaded via `preload()`, `false` otherwise.
     */
    static isLoaded(schemaId: string): boolean;
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
     * Check if an entity exists by schema name and ID
     */
    static exists<T extends keyof SchemaToEntityMap>(schemaName: T, id: string): boolean;
    /**
     * Get multiple entities by schema name and IDs
     */
    static getMany(requests: Array<{
        schemaName: keyof SchemaToEntityMap;
        id: string;
    }>): ((SchemaToEntityMap[keyof SchemaToEntityMap] & {
        schemaName: keyof SchemaToEntityMap;
    }) | undefined)[];
    /**
     * Parse a reference string into schema name and ID
     */
    static parseRef(ref: string): {
        schemaName: SURefEnumSchemaName;
        id: string;
    } | null;
    /**
     * Get an entity by reference string
     */
    static getByRef(ref: string): (SchemaToEntityMap[keyof SchemaToEntityMap] & {
        schemaName: keyof SchemaToEntityMap;
    }) | undefined;
    /**
     * Search across all or specific schemas
     */
    static search(options: SearchOptions): SearchResult[];
    /**
     * Search within a specific schema
     */
    static searchIn<T extends SURefEntity>(schemaName: SURefEnumSchemaName, query: string, options?: {
        limit?: number;
    }): (T & {
        schemaName: SURefEnumSchemaName;
    })[];
    /**
     * Get search suggestions based on partial query
     */
    static getSuggestions(query: string, options?: {
        schemas?: SURefEnumSchemaName[];
        limit?: number;
    }): string[];
    /**
     * Resolve actions from any entity that might have actions
     */
    static resolveActions(entity: SURefMetaEntity): SURefMetaAction[] | undefined;
    /**
     * Get all entities from multiple schemas, tagged with their schema name
     */
    static getAllBySchemaNames(schemaNames: (keyof SchemaToEntityMap)[]): Array<{
        schemaName: keyof SchemaToEntityMap;
        entity: SURefMetaEntity;
    }>;
}
/**
 * Reset all lazy-loading state for testing purposes.
 * Clears ModelFactory load state AND resets all LazyModel backing models.
 * Must be called in tests that need to exercise preload from a clean state.
 */
export declare function resetAllForTesting(): void;
//# sourceMappingURL=index.d.ts.map
// === lib/naming.d.ts ===
/**
 * Schema-id naming helpers.
 *
 * Zero imports by design: both tools/generateRegistry.ts (a build-time
 * script that must run before any generated code exists) and runtime code
 * (lib/ModelFactory.ts, lib/index.ts) depend on this module, so it must not
 * pull in Zod, data, or any generated file — that would create a bootstrap
 * dependency of codegen on its own output.
 */
/**
 * Convert a kebab-case schema id to its PascalCase model property name.
 * Examples:
 *   abilities -> Abilities
 *   ability-tree-requirements -> AbilityTreeRequirements
 *   classes -> Classes (irregular: stays as-is, not re-pluralized)
 *   npcs -> NPCs (irregular: acronym casing)
 */
export declare function toPascalCase(id: string): string;
//# sourceMappingURL=naming.d.ts.map
// === lib/resolveChoiceView.d.ts ===
/**
 * resolveChoiceView — pure resolver for granted-equipment choices.
 *
 * Given an entity (e.g. Custom Sniper Rifle) carrying a base `datavalues`
 * content block, base `traits`, and a set of `choices`, plus the player's
 * current `selections`, compute the live dataview:
 *
 *   { datavalues, traits, prompts }
 *
 * - `datavalues`: the base datavalue row with applied effects (setRange
 *   replaces Range, addDamage bumps Damage), and unresolved required-choice
 *   prompts removed once resolved.
 * - `traits`: base traits with `addTrait`/`removeTrait` effects applied
 *   (explicit on choiceOptions, or inferred from trait-schema `schemaEntities`
 *   choices). Adding an existing trait upgrades its amount (Explosive 1 → 2).
 * - `prompts`: one entry per unresolved required choice (nothing selected),
 *   e.g. { choiceId, label, text: 'Choose: Ballistic or Energy' }.
 *
 * The function is deterministic and performs no I/O. It is the single source
 * of truth shared by srd (ephemeral selection state) and ITUN
 * (persisted selection state).
 */
import type { SURefObjectDataValue, SURefObjectTrait, SURefObjectContentBlock, SURefObjectChoice } from './schemas/index.js';
/**
 * Selections keyed by choice id, each holding the selected option values.
 */
export type ChoiceSelections = Record<string, string[]>;
/**
 * Unresolved required-choice prompt surfaced in the dataview row.
 */
export type ChoicePrompt = {
    choiceId: string;
    label: string;
    text: string;
};
/**
 * The resolved dataview for an entity given a set of selections.
 */
export type ResolvedChoiceView = {
    datavalues: SURefObjectDataValue[];
    traits: SURefObjectTrait[];
    prompts: ChoicePrompt[];
};
/**
 * Minimal structural shape the resolver needs from an entity. Kept local so
 * the resolver accepts any entity carrying content + choices without forcing
 * the caller through the full SURefEntity union.
 */
type ResolvableEntity = {
    content?: SURefObjectContentBlock[];
    traits?: SURefObjectTrait[];
    choices?: SURefObjectChoice[];
};
/**
 * Resolve the live dataview for an entity given a set of choice selections.
 */
export declare function resolveChoiceView(entity: ResolvableEntity, selections: ChoiceSelections): ResolvedChoiceView;
export {};
//# sourceMappingURL=resolveChoiceView.d.ts.map
// === lib/rollOnTable.d.ts ===
/**
 * rollOnTable — the one shared orchestration for rolling on any Salvage Union
 * roll table (ADR-006 pure rules logic).
 *
 * Both the Discord bot's /roll command and ITUN's pilot-identity roll buttons
 * previously reimplemented the same dance: detect the table shape
 * (isColumnsTable), roll one or two d20s, unpack resultForTable /
 * resultForColumnsTable. This helper owns that branch; consumers own dice
 * presentation. The roller is injected so tests (and future "roll with
 * advantage" features) control the dice.
 */
import type { SURefObjectTable } from './types/index.js';
/** A d20 roller: returns an integer 1–20. Injectable for tests. */
export type D20Roller = () => number;
export type RollOnTableOutcome = {
    success: true;
    kind: 'flat';
    /** The single d20 roll. */
    roll: number;
    /** The matched range key (e.g. "11-19"). */
    key: string;
    label?: string;
    value: string;
} | {
    success: true;
    kind: 'columns';
    /** First d20 — selects the column (e.g. "1-4"). */
    columnRoll: number;
    /** Second d20 — selects the entry within the column. */
    entryRoll: number;
    columnKey: string;
    entryKey: string | number;
    label?: string;
    value: string;
} | {
    success: false;
    error: string;
};
/**
 * Roll on a table's data, handling both flat d20 tables (one roll) and
 * columns-type tables (two rolls: column then entry). Never throws — malformed
 * or missing table data comes back as `{ success: false }`.
 */
export declare function rollOnTable(table: SURefObjectTable | undefined, rollD20: D20Roller): RollOnTableOutcome;
//# sourceMappingURL=rollOnTable.d.ts.map
// === lib/rules/capacity.d.ts ===
/**
 * Mech capacity rule enforcement (REQ-009).
 *
 * Computes slot usage and surfaces violations. All operations are synchronous
 * and pure — same input always yields same output. No React, no IndexedDB.
 *
 * Chassis slot caps come from `salvageunion-reference` via the lazy-loaded
 * `SalvageUnionReference.Chassis` model. Callers must ensure the relevant
 * schemas are preloaded (e.g. `SalvageUnionReference.preload(['chassis',
 * 'systems', 'modules'])`) before the first call to `computeMechCapacity`.
 */
import type { MechCapacityResult, MechInput } from './types.js';
/**
 * Compute mech capacity from a `MechInput` and return slot usage + violations.
 *
 * Violation kinds:
 * - `chassis-not-found` — the `chassisRef` doesn't resolve to a chassis entry
 * - `system-over-slots` — total system slot usage exceeds the chassis cap
 * - `module-over-slots` — total module slot usage exceeds the chassis cap
 * - `system-requires-chassis` — (reserved for future chassis-locked system checks)
 *
 * When `chassis-not-found` is present, `systemSlotsMax` and `moduleSlotsMax`
 * are both 0 and all slot violations are suppressed (can't enforce without a cap).
 */
export declare function computeMechCapacity(mech: MechInput): MechCapacityResult;
//# sourceMappingURL=capacity.d.ts.map
// === lib/rules/cargo.d.ts ===
/**
 * Cargo capacity rule enforcement (REQ-015).
 *
 * Computes slot usage across reference-linked and custom cargo items, and
 * surfaces violations. All operations are pure and synchronous.
 *
 * Reference-linked items (`kind: 'ref'`) are resolved against the
 * salvageunion-reference Equipment dataset by name. If a ref cannot be found,
 * a `missing-ref` violation is produced and that item is counted at 1 slot
 * so capacity math doesn't silently hide missing entries.
 *
 * Custom items (`kind: 'custom'`) carry their slot count explicitly.
 */
import type { CargoCapacityResult, CargoItem, CargoParent } from './types.js';
/**
 * Compute cargo capacity for a parent entity (mech or crawler) given its
 * cargo item list.
 *
 * Violation kinds:
 * - `missing-ref` — a ref-linked item's name doesn't match any known SU entity
 * - `over-capacity` — total slot usage exceeds `parent.cargoCapacity`
 */
export declare function computeCargoCapacity(parent: CargoParent, items: CargoItem[]): CargoCapacityResult;
//# sourceMappingURL=cargo.d.ts.map
// === lib/rules/choiceCatalog.d.ts ===
import type { SURefMetaEntity, SURefObjectChoice } from '../types/index.js';
/**
 * Resolve the entities a catalog choice offers.
 *
 * - A shortlist choice resolves its named entities across the schema(s).
 * - A schema-only choice resolves the whole collection, narrowed by `filter`.
 * - When `opts.techLevel` is a number, entities carrying a higher numeric
 *   `techLevel` are dropped (the crawler mounts its Tech Level or lower).
 *
 * Returns `[]` for any non-catalog choice, or a catalog with no schema.
 */
export declare function resolveCatalogChoiceEntities(choice: SURefObjectChoice, opts?: {
    techLevel?: number;
}): SURefMetaEntity[];
/**
 * Whether a choice is a **schema-only** catalog — "pick any entity from the
 * collection" (no fixed shortlist). These render as an entity listing; a
 * shortlist catalog renders as an option-card grid instead.
 */
export declare function isSchemaOnlyCatalogChoice(choice: SURefObjectChoice): boolean;
//# sourceMappingURL=choiceCatalog.d.ts.map
// === lib/rules/coreMechanic.d.ts ===
/**
 * Core Mechanic d20 (design review R-6/U-3).
 *
 * Salvage Union Core Book p.229-232 / Quick Ref 2.0 p.1 — the game's single
 * resolution roll. Roll a d20 and read the band:
 *
 *   20    → Nailed It       (outstanding success + a bonus of your choice)
 *   11-19 → Success         (goal achieved without compromise)
 *   6-10  → Tough Choice    (success at a cost — Setback attached)
 *   2-5   → Failure         (failed; Setback of the Mediator's choice)
 *   1     → Cascade Failure (severe consequence of the Mediator's choice)
 *
 * The app's value is the band text + Push bookkeeping, not the RNG: rolling
 * is component-state only (never persisted), while a mech Push routes the +2
 * Heat and Heat Check through the store per ADR-007 (mechanical bookkeeping
 * auto-applies; the player marks any destroyed System/Module by hand).
 *
 * This module is PURE: no React, no store, no real randomness — the d20 is
 * injected via the shared `Roll` type so tests are deterministic.
 */
import type { HeatCheckEffect, Roll } from './types.js';
export type CoreRollBand = 'nailed' | 'success' | 'tough' | 'failure' | 'cascade';
export type CoreRollBandInfo = {
    band: CoreRollBand;
    /** Band title as printed on the Quick Ref ("Nailed It", "Tough Choice", …). */
    label: string;
    /** The d20 range, e.g. '11–19'. */
    range: string;
    /** One-line rules summary (Quick Ref 2.0 wording, condensed). */
    summary: string;
};
/** Band metadata in table order (20 → 1), for readouts and legends. */
export declare const CORE_ROLL_BANDS: Record<CoreRollBand, CoreRollBandInfo>;
/**
 * Maps a Core Mechanic d20 roll to its band (p.229-232). Rolls are clamped
 * into [1, 20] defensively — modifiers never move a roll off the table.
 */
export declare function coreRollBand(roll: number): CoreRollBand;
export type CoreRollResult = {
    /** The d20 face rolled. */
    roll: number;
    band: CoreRollBand;
};
/** Rolls the Core Mechanic d20 via the injected roller and reads the band. */
export declare function performCoreRoll(roll: Roll): CoreRollResult;
/**
 * One-line readout for a mech Push's Heat Check outcome, surfaced next to the
 * re-rolled d20 in the quick-roll log. Mirrors HeatCheckControl's wording so
 * the FAB and the sheet-body readout never disagree.
 */
export declare function describePushOutcome(nextHeat: number, effect: HeatCheckEffect): string;
//# sourceMappingURL=coreMechanic.d.ts.map
// === lib/rules/crawlerCapacity.d.ts ===
/**
 * Crawler capacity rule enforcement (Phase 3, soft-warn).
 *
 * Computes bay and weapon-system usage for a crawler and surfaces violations.
 * All operations are synchronous and pure — same input always yields same output.
 * No React, no IndexedDB.
 *
 * Bay caps are derived from tech level per the Salvage Union Workshop Manual:
 *   Bays: techLevel × 2  (TL1=2, TL2=4, TL3=6, TL4=8, TL5=10, TL6=12)
 *
 * The cap is on WEAPONS SYSTEMS specifically — the damage-dealing systems that
 * occupy the crawler's Armament Bay — and is gated by CRAWLER TYPE, not tech
 * level. Per the Salvage Union Core Book Digital Edition 2.0a:
 *   - p. 213, Crawler Creation step 3 ("Choose your Weapons System"): "A Union
 *     Crawler can mount a single Weapons System in its Armament Bay." — one
 *     weapons system for every crawler type, independent of tech level.
 *   - p. 216, Battle Crawler ability "Improved Armour and Armaments": "Your
 *     Union Crawler may mount two Weapons Systems in its Armament Bay instead
 *     of the usual one..." — the sole exception, raising the cap to 2.
 *
 * So: Battle Crawler = 2 weapons systems, every other crawler type = 1.
 * NON-weapon systems (Armour Plating, Cargo Pod, Locomotion System, …) are NOT
 * subject to this cap — only weapons systems are counted (the caller filters
 * them; see isWeaponSystem in ./crawlerSystems).
 *
 * These caps are SOFT — violations are warnings only. Submit is never blocked.
 */
/**
 * Input shape for computeCrawlerCapacity.
 * `techLevel` is the numeric tech level (1–6). Pass 0 for "unknown".
 */
export type CrawlerCapacityInput = {
    /** Numeric tech level 1–6. 0 or out-of-range triggers tech-level-unknown violation. */
    techLevel: number;
    /** Slugs of entities assigned to bays (pilots / mechs). */
    bays: string[];
    /**
     * Slugs of the installed WEAPONS systems only — the damage-dealing systems
     * that occupy the Armament Bay. ONLY these count toward the cap; non-weapon
     * systems are unlimited by this rule and must be filtered out by the caller
     * (see isWeaponSystem in ./crawlerSystems).
     */
    weaponSystems: string[];
    /**
     * Whether the crawler is a Battle Crawler. A Battle Crawler mounts two
     * Weapons Systems (Core Book p. 216, "Improved Armour and Armaments");
     * every other crawler type mounts one (p. 213, step 3). Defaults to false.
     */
    isBattleCrawler?: boolean;
};
export type CrawlerCapacityViolation = {
    kind: 'bays-over-capacity';
    message: string;
    details: {
        used: number;
        max: number;
    };
} | {
    kind: 'weapon-systems-over-capacity';
    message: string;
    details: {
        used: number;
        max: number;
    };
} | {
    kind: 'tech-level-unknown';
    message: string;
    details: {
        techLevel: number;
    };
};
export type CrawlerCapacityResult = {
    baysUsed: number;
    baysMax: number;
    weaponSystemsUsed: number;
    weaponSystemsMax: number;
    violations: CrawlerCapacityViolation[];
};
/**
 * Compute crawler capacity from a `CrawlerCapacityInput` and return usage + violations.
 *
 * Violation kinds:
 * - `tech-level-unknown` — the `techLevel` is outside the valid 1–6 range
 * - `bays-over-capacity`           — bays used exceeds cap for the tech level
 * - `weapon-systems-over-capacity` — weapons systems exceed the crawler-type cap
 *
 * The weapon-system cap is gated by crawler type (Battle = 2, otherwise = 1),
 * not tech level, so it is enforced even when the tech level is unknown — only
 * the bay cap depends on tech level. When `tech-level-unknown` is present,
 * `baysMax` is 0 and the bay violation is suppressed (can't enforce without a
 * cap).
 *
 * Violations are SOFT — they do not prevent saving. Surface them as warnings
 * in the UI with a red-ring indicator and a capacity banner; do not disable
 * the submit button.
 */
export declare function computeCrawlerCapacity(crawler: CrawlerCapacityInput): CrawlerCapacityResult;
//# sourceMappingURL=crawlerCapacity.d.ts.map
// === lib/rules/crawlerSystems.d.ts ===
import type { SURefSystem } from '../types/index.js';
/**
 * True when `system` is a Weapons System — i.e. at least one of its resolved
 * actions deals damage. Requires the `systems` and `actions` reference data to
 * be preloaded (the ORM resolves action-name refs against the action map).
 */
export declare function isWeaponSystem(system: SURefSystem): boolean;
//# sourceMappingURL=crawlerSystems.d.ts.map
// === lib/rules/creation.d.ts ===
/**
 * Creation-legality predicates and pick budgets (Pilot Bay pp.18–19 +
 * Mech Workshop pp.94–95 + Union Crawler pp.212–213 — wizard-refresh
 * plan §5.1).
 *
 * Pure predicates over NEUTRAL structural inputs only — the exact primitive
 * values a rule reads (numbers, arrays, strings) with REQUIRED fields — in
 * the style of capacity.ts (ADR-006). No React, no IndexedDB, no app
 * imports; a consumer narrows its resolved reference records to these
 * primitives at the call site, so no entity-union/weak-type ambiguity ever
 * reaches this module.
 *
 * Source scope note (plan Q12): predicates are Tech-Level/tree based and
 * deliberately allow all sources (core + expansions) — "Tech 1" and
 * "core tree" are the rules' own boundaries, source is not.
 */
/**
 * The ability shape creation legality reads (level 1–3 | 'L' | 'G' + tree).
 */
export type CreationAbilityInput = {
    level: number | string;
    tree: string;
};
/** The equipment shape creation legality reads. */
export type CreationEquipmentInput = {
    techLevel?: number | string;
};
/**
 * The neutral input for class legality: a class's core ability trees, or
 * `undefined` for a class that has none. Predicates take THIS array — the
 * value they actually read — rather than a class object, so a consumer's
 * (unioned) class record is narrowed to `coreTrees` at the call site and no
 * weak-type/union ambiguity ever reaches this module.
 */
export type CreationCoreTrees = readonly string[] | undefined;
/**
 * A legal creation class is one of the six CORE classes — the classes with a
 * non-empty `coreTrees` field ("There are six core Pilot classes", p.18).
 * Advanced/Hybrid specialisations expose no core trees, so they never qualify.
 */
export declare function isLegalCreationClass(coreTrees: CreationCoreTrees): boolean;
/**
 * A legal first ability is `level === 1` AND `tree ∈ coreTrees`
 * ("Your Pilot starts with 1 Ability of your choice", p.18). The core-tree
 * bound structurally excludes Generic ('G') and Legendary ('L') abilities and
 * the Level-1 entries of advanced/hybrid trees — those trees appear in no
 * class's `coreTrees`.
 */
export declare function isLegalCreationAbility(ability: CreationAbilityInput, coreTrees: CreationCoreTrees): boolean;
/**
 * The legal first-ability pool for a class: its core trees' Level-1 abilities.
 * For the Salvager — coreTrees = all 15 core trees ("a 'jack of all trades'
 * Class, they can pick from any of the Core Ability trees", p.18) — this is
 * exactly the 15 core-tree Level-1 abilities, asserted by a unit test.
 */
export declare function legalCreationAbilities<T extends CreationAbilityInput>(abilities: readonly T[], coreTrees: CreationCoreTrees): T[];
/**
 * Legal starting equipment is Tech 1 ("You may choose two pieces of Tech 1
 * Pilot Equipment from the list", p.19).
 */
export declare function isLegalCreationEquipment(item: CreationEquipmentInput): boolean;
/** Starting ability picks: exactly 1 ("starts with 1 Ability", p.18). */
export declare const PILOT_CREATION_ABILITY_PICKS = 1;
/** Starting equipment picks: exactly 2 ("two pieces of Tech 1", p.19). */
export declare const PILOT_CREATION_EQUIPMENT_PICKS = 2;
/** Ability picks still owed (never negative). */
export declare function pilotAbilityPicksRemaining(selectedCount: number): number;
/** Equipment picks still owed (never negative). */
export declare function pilotEquipmentPicksRemaining(selectedCount: number): number;
/** Exactly the budgeted ability picks — over-budget (a stale draft) is NOT complete. */
export declare function isPilotAbilityPickComplete(selectedCount: number): boolean;
/** Exactly the budgeted equipment picks — over-budget is NOT complete. */
export declare function isPilotEquipmentPickComplete(selectedCount: number): boolean;
/**
 * A legal creation chassis is Tech 1 ("Craft a Tech 1 Mech Chassis of your
 * choice from the Mech Chassis Blueprints list", p.94). Takes the primitive
 * the rule reads — a chassis record's `techLevel` (numeric tiers, or the
 * 'B'/'N' expansion tiers, which are never 1).
 */
export declare function isLegalCreationChassis(techLevel: number | string): boolean;
/**
 * A legal creation system is Tech 1 ("You now craft Tech 1 Systems from the
 * System Blueprints list", p.95).
 */
export declare function isLegalCreationSystem(techLevel: number | string): boolean;
/**
 * A legal creation module is Tech 1 ("you may craft Tech 1 Modules from the
 * Module Blueprints list", p.95).
 */
export declare function isLegalCreationModule(techLevel: number | string): boolean;
/**
 * The pattern shape starting legality reads: the STORED `legalStarting` data
 * tag (optional on the reference pattern records — absent means unflagged).
 * Used only as a generic constraint; the predicate itself takes the primitive.
 */
export type CreationPatternInput = {
    legalStarting?: boolean;
};
/**
 * A legal STARTING pattern carries the stored `legalStarting` data flag —
 * an explicit tag set only where the source book calls it out. NEVER
 * computed from tech level or salvage value (project data convention;
 * PR #292). Takes the primitive the rule reads — the record's
 * `legalStarting` value (undefined = unflagged = not legal starting).
 */
export declare function isLegalStartingPattern(legalStarting: boolean | undefined): boolean;
/** Filters a chassis's patterns down to the stored-`legalStarting` set. */
export declare function legalStartingPatterns<T extends CreationPatternInput>(patterns: readonly T[]): T[];
/**
 * The whole starting budget: 20 Tech 1 Scrap for chassis + Systems + Modules
 * ("You start with 20 Tech 1 Scrap. You will use this Scrap to craft your
 * first Mech", p.94).
 */
export declare const MECH_CREATION_SCRAP_CAP = 20;
/** One loadout line: an item's Salvage Value + how many copies are crafted. */
export type MechCreationLoadoutEntry = {
    sv: number;
    count: number;
};
export type MechCreationBudgetInput = {
    /** The chosen chassis's Salvage Value; 0 while no chassis is chosen. */
    chassisSV: number;
    /** Installed systems + modules as (sv, count) lines. */
    loadout: readonly MechCreationLoadoutEntry[];
};
export type MechCreationBudget = {
    /** The 20-Scrap starting cap. */
    cap: number;
    /** Tech 1 Scrap spent: chassis cost + Σ(item cost × count). */
    spent: number;
    /** Scrap left (negative when an out-of-regime draft overspends). */
    remaining: number;
    /** Whether one more copy of an item with this SV fits the remaining scrap. */
    perItemAffordable: (sv: number) => boolean;
};
/**
 * The 20-Scrap creation economy (p.94), built on the canonical crafting cost
 * (`scrapCostFor` — cost equals Salvage Value): chassis + every installed
 * copy debit one shared pool; whatever remains banks to the Union Crawler.
 */
export declare function mechCreationBudget(input: MechCreationBudgetInput): MechCreationBudget;
/**
 * A new Union Crawler's Tech Level is fixed ("A Tech 1 starting Union Crawler
 * is about the size of a small village", p.213 — creation always starts at
 * Tech Level 1, a Hamlet Crawler).
 */
export declare const CRAWLER_CREATION_TECH_LEVEL = 1;
/**
 * A legal creation crawler weapon is a Tech 1 Weapons System ("To start, this
 * can be any Tech 1 Weapons System of the players' choice", p.213 — creation
 * is stricter than the in-play `TL ≤ crawler TL` rule). Takes the primitive
 * the rule reads — the system record's `techLevel` (numeric tiers, or the
 * 'B'/'N' expansion tiers, which are never 1). The caller separately filters
 * to WEAPONS systems (`isWeaponSystem`) — the Armament Bay holds nothing else.
 */
export declare function isLegalCreationCrawlerWeapon(techLevel: number | string): boolean;
/**
 * The neutral mutation line a crawler type's stored `mutations` rows carry —
 * the exact values these rules read (a discriminator string + a number), NOT
 * the whole SURef crawler record. A consumer narrows its resolved type record
 * to `mutations` at the call site.
 */
export type CrawlerMutationInput = {
    type: string;
    value: number;
};
/**
 * Armament-Bay weapon slots for a crawler type: base 1 ("A Union Crawler can
 * mount a single Weapons System in its Armament Bay", p.213) plus any
 * `weapon_slots` mutations — the STORED data flag on the type record (the
 * Battle Crawler's "Improved Armour and Armaments" grants +1, p.216). Never
 * derived from action-name string matching.
 */
export declare function crawlerWeaponSlots(mutations: readonly CrawlerMutationInput[] | undefined): number;
/**
 * Max-SP bonus for a crawler type: the sum of its stored `max_sp_bonus`
 * mutations (the Battle Crawler's +5 Max SP, p.216). Applied AT READ by
 * `crawlerMaxSP` — the stored crawler record keeps the BARE tech-level value,
 * so type swaps re-derive correctly in both directions.
 */
export declare function crawlerMaxSpBonus(mutations: readonly CrawlerMutationInput[] | undefined): number;
/**
 * Minimum Armament-Bay weapons at creation: the book's step 3 mounts one
 * ("Choose your Weapons System … A Union Crawler can mount a single Weapons
 * System in its Armament Bay", p.213) — a guided crawler never ships unarmed.
 */
export declare const CRAWLER_CREATION_MIN_WEAPONS = 1;
/** Whether the creation weapon pick satisfies the minimum-1 mount (p.213). */
export declare function isCrawlerWeaponPickComplete(selectedCount: number): boolean;
//# sourceMappingURL=creation.d.ts.map
// === lib/rules/derivedStats.d.ts ===
/**
 * Derived maxima for all three entities (plan 2.5, gap 11).
 *
 * "Many maxima are derived, not fixed" (rules digest): store modifiers,
 * compute totals. This module is the single source for those computations —
 * it replaces the old PILOT_MAX_HP/PILOT_MAX_AP constants (lib/pilotStats.ts)
 * and the crawler SP slug-regex previously local to CrawlerSheet.
 *
 *   Pilot:   maxHP = 10 + maxHpModifier − Σ(minor injury: 1, major: 2)
 *            maxAP = 5 + maxApModifier
 *   Mech:    max{SP,EP,Heat,Cargo} = chassis stat + max*Modifier
 *   Crawler: maxSP = tech-level structurePoints (ORM) + the chosen TYPE's
 *            `max_sp_bonus` mutations (Battle +5, applied at read —
 *            wizard-refresh Phase 5) + maxSpModifier (a pure hand-edit)
 *
 * All functions are pure — no side effects, no async, no React. Parameter
 * types are small structural shapes (not full persisted records) — a
 * consumer's Zod-inferred Pilot/Mech/Crawler types (e.g. ITUN's
 * `src/lib/schemas/`) satisfy them automatically.
 */
/**
 * Base pilot stats per the core rules (10 HP / 5 AP / 6 inventory slots).
 * These are NOT in the reference data — class records do not encode them —
 * so they live here as the named baseline the derivations build on.
 */
export declare const PILOT_BASE_HP = 10;
export declare const PILOT_BASE_AP = 5;
export declare const PILOT_BASE_INVENTORY_SLOTS = 6;
/** A single pilot injury (rules A11): minor −1 max HP, major −2. */
type Injury = {
    severity: 'minor' | 'major';
    note: string;
};
type PilotDerivationInput = {
    injuries?: Injury[];
    maxHpModifier?: number;
    maxApModifier?: number;
};
/** Total max-HP penalty from injuries: minor −1, major −2 (rules A2/A11). */
export declare function injuryMaxHpPenalty(injuries: Injury[] | undefined): number;
/**
 * Derived max HP. Can legitimately reach 0 or below — that is the dead state
 * (rules A2: "if Max HP reaches 0 the Pilot dies") and is surfaced by
 * isPilotDead(), not clamped away here.
 */
export declare function pilotMaxHP(pilot: PilotDerivationInput): number;
/** Derived max AP (base 5 + Stat Training tiers etc.). */
export declare function pilotMaxAP(pilot: PilotDerivationInput): number;
/** Dead-state check: derived max HP ≤ 0 means the pilot is dead. */
export declare function isPilotDead(pilot: PilotDerivationInput): boolean;
/**
 * Clamp current HP/AP to the derived maxima (floor 0). Run on every recompute
 * — e.g. after an injury is added or a modifier edited — and persist the
 * returned patch when non-empty.
 */
export declare function clampPilotCurrentStats(pilot: PilotDerivationInput & {
    currentHP?: number;
    currentAP?: number;
}): Partial<{
    currentHP: number;
    currentAP: number;
}>;
/** The chassis stats the mech derivations need (resolved from the ORM by ref). */
export type ChassisStats = {
    structurePoints?: number;
    energyPoints?: number;
    heatCapacity?: number;
    cargoCapacity?: number;
};
type MechDerivationInput = {
    chassisRef: string;
    maxSpModifier?: number;
    maxEpModifier?: number;
    maxHeatModifier?: number;
    maxCargoModifier?: number;
    systems?: string[];
    modules?: string[];
};
/**
 * The mech-stat-bonus key each derivation sums over installed systems/modules.
 * Mirrors the `statBonus` field names declared on the reference item schema.
 */
type StatBonusKey = 'structurePoints' | 'energyPoints' | 'heatCapacity' | 'cargoCapacity';
/**
 * Resolve a mech's chassis from the reference ORM. `chassisRef` stores the
 * chassis SLUG (v6 migration); legacy names/ids are tolerated at resolution.
 */
export declare function findChassisByRef(chassisRef: string): ChassisStats | null;
/**
 * Σ(declared statBonus × installed count) for one stat across every installed
 * system and module (rules B2/B4/B6/B14 — Heat Sink +1 Max Heat each,
 * Capacitance Bank +2 EP each, Cargo Pod/Holds/Bays +N Cargo, etc.). Each ref
 * in the arrays counts as one installed copy, so two Heat Sinks sum to +2.
 * Items with no `statBonus` data contribute 0 — bonuses are never inferred from
 * prose (only flat, explicitly-declared modifiers are summed).
 */
export declare function installedStatBonus(mech: MechDerivationInput, stat: StatBonusKey): number;
/**
 * Derived mech maxima: chassis stat + hand-edited modifier (composite armour,
 * etc.) + Σ(installed system/module `statBonus` × count) (heat sinks,
 * capacitance banks, holds — rules B2/B4/B6/B14). Pass a pre-resolved `chassis`
 * to avoid repeated ORM lookups; floored at 0 so a negative total never
 * produces a negative maximum.
 */
export declare function mechMaxSP(mech: MechDerivationInput, chassis?: ChassisStats | null): number;
export declare function mechMaxEP(mech: MechDerivationInput, chassis?: ChassisStats | null): number;
export declare function mechMaxHeat(mech: MechDerivationInput, chassis?: ChassisStats | null): number;
export declare function mechMaxCargo(mech: MechDerivationInput, chassis?: ChassisStats | null): number;
/**
 * Clamp current SP/EP/Heat to the derived maxima. Run after any modifier or
 * chassis change and persist the returned patch when non-empty.
 * (Cargo is a slot count, not a current/max pair — over-capacity cargo is
 * displayed honestly, never clamped, per design §2.12.)
 */
export declare function clampMechCurrentStats(mech: MechDerivationInput & {
    currentSP?: number;
    currentEP?: number;
    currentHeat?: number;
}, chassis?: ChassisStats | null): Partial<{
    currentSP: number;
    currentEP: number;
    currentHeat: number;
}>;
/**
 * The unified read-time conditions vocabulary for a mech (plan 2.3): the
 * free-form `conditions[]` merged with the automation-written boolean flags
 * (shutdown → 'Shutdown', vulnerable → 'Vulnerable', destroyed → 'Destroyed'),
 * deduplicated case-insensitively. Display layers render THIS list so the
 * two storage forms never disagree on screen.
 */
export declare function unifiedMechConditions(mech: {
    conditions: string[];
    shutdown?: boolean;
    vulnerable?: boolean;
    destroyed?: boolean;
}): string[];
type CrawlerDerivationInput = {
    techLevel: string;
    /**
     * Chosen crawler-type ref (SRD id OR name) — the type's stored
     * `max_sp_bonus` mutations (Battle +5) apply AT READ, so the record keeps
     * the BARE tech-level value and type swaps re-derive in both directions
     * (wizard-refresh Phase 5). Absent/unresolvable = no type bonus.
     */
    type?: string;
    maxSpModifier?: number;
};
/** The additive parts of a crawler's derived max SP (and their total). */
export type CrawlerMaxSPParts = {
    /** The tech level's structurePoints (20/25/30/35/40/50 for TL 1–6). */
    base: number;
    /** The chosen type's `max_sp_bonus` mutations, applied at read (Battle +5). */
    typeBonus: number;
    /** The hand-edited maxSpModifier (a pure player-edit field). */
    modifier: number;
    /** base + typeBonus + modifier, floored at 0. */
    total: number;
};
/**
 * Derived crawler max SP, decomposed: the tech level's structurePoints from
 * the reference ORM, plus the chosen TYPE's stored `max_sp_bonus` mutations
 * applied AT READ (Battle Crawler +5 — the record stores the BARE tech-level
 * value, so type swaps re-derive correctly both ways), plus the hand-edited
 * maxSpModifier. Base resolves to 0 when the techLevel slug cannot be parsed
 * — the caller should surface that as a data problem rather than rendering a
 * silent 0-pip track.
 */
export declare function crawlerMaxSPParts(crawler: CrawlerDerivationInput): CrawlerMaxSPParts;
/** Derived crawler max SP — `crawlerMaxSPParts(crawler).total`. */
export declare function crawlerMaxSP(crawler: CrawlerDerivationInput): number;
/**
 * Clamp current SP to the derived max. Persist the returned patch when
 * non-empty (e.g. after editing maxSpModifier or downgrading tech level).
 */
export declare function clampCrawlerCurrentStats(crawler: CrawlerDerivationInput & {
    currentSP?: number;
}): Partial<{
    currentSP: number;
}>;
export {};
//# sourceMappingURL=derivedStats.d.ts.map
// === lib/rules/detailWarnings.d.ts ===
/**
 * Detail-view soft-warning derivation.
 *
 * The wizard Review steps surface soft warnings pre-save, but simply VIEWING an
 * entity on its detail route showed nothing — even when the stored entity has
 * warning-worthy state. These helpers derive the same advisory warnings for a
 * STATIC (unchanged) entity so the detail routes can render a passive
 * `<SoftWarningBanner>`.
 *
 * The evaluators in `softWarnings.ts` are change-based (before/after). For a
 * static view there is no change, so the pilot check passes `before === after`
 * (the stored snapshot) — its STATE-based prerequisites (tree order, 6-core
 * gates, one-Legendary, ability cap) are meaningful with an identical pair. The
 * mech and crawler checks reuse the capacity utilities directly (the same way
 * MechWizard / CrawlerBuilder derive their live capacity warnings), since the
 * change-based mech evaluator yields nothing useful for an unchanged loadout.
 *
 * All functions are pure and synchronous. They require `SalvageUnionReference`
 * to be preloaded (the app root preloads 'all'; the detail routes already
 * depend on it). With an empty ORM every helper degrades to an empty array,
 * never a throw.
 */
import type { SoftWarning } from './types.js';
/**
 * Soft warnings for a stored pilot's current state. Enriches the pilot into a
 * snapshot and evaluates the state-based prerequisite checks with
 * `before === after` (no change — a static view).
 */
export declare function pilotDetailWarnings(pilot: {
    abilities: string[];
    classRef?: string;
}): SoftWarning[];
/**
 * Soft warnings for a stored mech's loadout. Reuses `computeMechCapacity` and
 * surfaces the over-slot violations (the same subset MechWizard shows live).
 */
export declare function mechDetailWarnings(mech: {
    chassisRef: string;
    systems: string[];
    modules: string[];
}): SoftWarning[];
/**
 * Soft warnings for a stored crawler. Reuses `computeCrawlerCapacity` and
 * surfaces the weapons-system over-capacity violation (the same check
 * CrawlerBuilder shows live). Crawler-specific rules beyond this are deferred
 * to M4 — the banner is intentionally empty otherwise.
 */
export declare function crawlerDetailWarnings(crawler: {
    type?: string;
    techLevel: string;
    systems: string[];
}): SoftWarning[];
//# sourceMappingURL=detailWarnings.d.ts.map
// === lib/rules/heatCheck.d.ts ===
/**
 * Heat Check / Reactor Overload rules (Slice C, #199).
 *
 * Salvage Union Core Book p.233-235 — the central mech combat mechanic.
 *
 * Rules summary:
 * - Heat can never exceed Heat Cap (clamped by `clampHeat`).
 * - A Heat Check triggers when the pilot Pushes, reaches Heat Cap, or starts a
 *   turn at Heat Cap. Roll a d20: if the roll is <= current Heat the reactor
 *   OVERLOADS.
 * - On overload, roll the Reactor Overload Table (another d20):
 *     1     → catastrophic meltdown (mech destroyed)
 *     2-5   → a System is destroyed (player picks which)
 *     6-10  → a Module is destroyed (player picks which)
 *     11-19 → reactor overheat: mech shuts down, becomes Vulnerable, and takes
 *             SP damage equal to current Heat
 *     20    → safe (no effect)
 * - Push: re-roll a die, +2 Heat (clamped to cap), then immediately a Heat Check.
 *
 * This module is PURE: no React, no IndexedDB, no real randomness. The d20 is
 * injected via a `Roll` function so every function is deterministic in tests.
 * The production caller (ITUN's MechSheet) passes a real RNG-backed roller —
 * see `apps/in-the-union-now/src/lib/rules/heatCheck.ts`'s `defaultRoll`
 * (kept app-local: it depends on `@randsum/roller`, a UI-adjacent concern
 * outside the pure-math boundary this module owns) and `heatCheckPatch`
 * (kept app-local: it assembles a `Partial<Mech>` write-through patch, which
 * needs ITUN's own Zod-derived `Mech` type — ADR-006/ADR-007).
 *
 * The functions here compute the *deterministic* parts of the outcome (clamped
 * heat, SP damage, shutdown/vulnerable/destroyed flags) and report the table
 * band. Marking WHICH System/Module is destroyed (the 2-5 / 6-10 bands) is left
 * to the player via the existing ConditionToggle — this module never auto-picks.
 */
import type { HeatCheckEffect, PushResult, ReactorOverloadOutcome, Roll } from './types.js';
/**
 * Clamps a heat value into [0, cap]. Heat can never exceed Heat Cap (rule 1).
 * A negative cap is treated as 0.
 */
export declare function clampHeat(heat: number, cap: number): number;
/**
 * Maps a Reactor Overload Table d20 roll to its outcome band (p.234-235).
 *   1     → meltdown
 *   2-5   → system-destroyed
 *   6-10  → module-destroyed
 *   11-19 → overheat
 *   20    → safe
 */
export declare function reactorOverloadOutcome(roll: number): ReactorOverloadOutcome;
type HeatCheckInput = {
    /** Current Heat at the moment of the check (already clamped to cap). */
    heat: number;
    /** Current SP — used to apply overheat damage on an 11-19. */
    currentSP: number;
    /** Injectable d20 roller. */
    roll: Roll;
    /** Injectable clock for the recorded timestamp (defaults to () => new Date()). */
    now?: () => Date;
};
/**
 * Performs a single Heat Check (rule 2).
 *
 * Rolls a d20; if roll <= heat the reactor overloads and a second d20 is rolled
 * on the Reactor Overload Table. Returns the deterministic effect. SP damage and
 * shutdown/vulnerable are applied for the 11-19 band; destroyed for roll 1. The
 * 2-5 / 6-10 bands set `requiresPlayerChoice` and leave SP/flags untouched.
 */
export declare function performHeatCheck({ heat, currentSP, roll, now }: HeatCheckInput): HeatCheckEffect;
type PushInput = {
    /** Current Heat before the Push. */
    heat: number;
    /** Heat Cap — the new heat is clamped to this. */
    heatCap: number;
    /** Current SP. */
    currentSP: number;
    /** Injectable d20 roller. */
    roll: Roll;
    /** Injectable clock. */
    now?: () => Date;
};
/**
 * Performs a Push (rule 3): +2 Heat (clamped to cap), then an immediate Heat
 * Check at the new heat. Returns both the new heat and the check effect.
 */
export declare function performPush({ heat, heatCap, currentSP, roll, now }: PushInput): PushResult;
export {};
//# sourceMappingURL=heatCheck.d.ts.map
// === lib/rules/index.d.ts ===
/**
 * Rule-enforcement utilities barrel (ADR-006 — pure rules logic lives here).
 *
 * Pure TypeScript — no React, no IndexedDB, no app dependency.
 * All functions are synchronous; same input always yields same output.
 *
 * Prerequisites: the salvageunion-reference schemas used by these utilities
 * must be preloaded before the first call:
 *   SalvageUnionReference.preload(['chassis', 'systems', 'modules', 'equipment', 'crawler-tech-levels'])
 *
 * Migrated from apps/in-the-union-now/src/lib/rules/ — see ADR-006. Tier 1/2
 * modules (fully portable pure math) live here; Tier 3 modules (deep coupling
 * to full persisted records + app-storage conventions like CargoLot /
 * crypto.randomUUID()) remain app-local in ITUN for now.
 */
export { computeMechCapacity } from './capacity.js';
export { PILOT_CREATION_ABILITY_PICKS, PILOT_CREATION_EQUIPMENT_PICKS, MECH_CREATION_SCRAP_CAP, CRAWLER_CREATION_TECH_LEVEL, CRAWLER_CREATION_MIN_WEAPONS, isLegalCreationClass, isLegalCreationAbility, legalCreationAbilities, isLegalCreationEquipment, isLegalCreationChassis, isLegalCreationSystem, isLegalCreationModule, isLegalCreationCrawlerWeapon, isLegalStartingPattern, legalStartingPatterns, mechCreationBudget, crawlerWeaponSlots, crawlerMaxSpBonus, isCrawlerWeaponPickComplete, pilotAbilityPicksRemaining, pilotEquipmentPicksRemaining, isPilotAbilityPickComplete, isPilotEquipmentPickComplete, } from './creation.js';
export type { CreationCoreTrees, CreationAbilityInput, CreationEquipmentInput, CreationPatternInput, CrawlerMutationInput, MechCreationBudget, MechCreationBudgetInput, MechCreationLoadoutEntry, } from './creation.js';
export { enrichPilotSnapshot } from './pilotSnapshot.js';
export { computeCrawlerCapacity } from './crawlerCapacity.js';
export { salvageValueFor, scrapCostFor, tierUpgradeCost } from './scrap.js';
export { computeCargoCapacity } from './cargo.js';
export { evaluateSoftWarnings, evaluatePilotWarnings, evaluateMechWarnings, PILOT_ABILITY_CAP, SALVAGER_ABILITY_CAP, } from './softWarnings.js';
export { isWeaponSystem } from './crawlerSystems.js';
export { resolveCatalogChoiceEntities, isSchemaOnlyCatalogChoice, } from './choiceCatalog.js';
export { matchesRef, resolveChassisRef, resolveSystemRef, resolveModuleRef, resolveInstalledRef, refDisplayName, } from './resolveRefs.js';
export { pilotDetailWarnings, mechDetailWarnings, crawlerDetailWarnings } from './detailWarnings.js';
export { clampHeat, reactorOverloadOutcome, performHeatCheck, performPush } from './heatCheck.js';
export { CORE_ROLL_BANDS, coreRollBand, performCoreRoll, describePushOutcome, } from './coreMechanic.js';
export type { CoreRollBand, CoreRollBandInfo, CoreRollResult } from './coreMechanic.js';
export { mechEffectiveDamage, applyMechDamage, criticalDamageOutcome, performCriticalDamage, pilotEffectiveDamage, applyPilotDamage, criticalInjuryOutcome, performCriticalInjury, } from './takeDamage.js';
export type { DamageKind, MechDamageInput, MechDamageEffect, PilotDamageInput, PilotDamageEffect, CriticalDamageEffect, CriticalInjuryEffect, } from './takeDamage.js';
export { PILOT_BASE_HP, PILOT_BASE_AP, PILOT_BASE_INVENTORY_SLOTS, injuryMaxHpPenalty, pilotMaxHP, pilotMaxAP, isPilotDead, clampPilotCurrentStats, findChassisByRef, installedStatBonus, mechMaxSP, mechMaxEP, mechMaxHeat, mechMaxCargo, clampMechCurrentStats, unifiedMechConditions, crawlerMaxSP, crawlerMaxSPParts, clampCrawlerCurrentStats, } from './derivedStats.js';
export type { ChassisStats, CrawlerMaxSPParts } from './derivedStats.js';
export { MEDIATOR_TABLE_NAMES, MEDIATOR_TABLE_LABEL, performMediatorRoll, describeMediatorRoll, } from './mediatorTables.js';
export type { FindRollTable } from './mediatorTables.js';
export type { TechLevel, SoftWarning, SoftWarningSeverity, SoftWarningContext, EditSnapshot, MechInput, MechSystemSlot, MechModuleSlot, MechCapacityResult, CapacityViolation, ScrapableItem, CargoItem, CargoItemRef, CargoItemCustom, CargoParent, CargoCapacityResult, CargoViolation, PilotSnapshot, MechSnapshot, AbilityInput, AbilityTier, SystemSnapshot, Roll, ReactorOverloadOutcome, HeatCheckResult, HeatCheckEffect, PushResult, CriticalDamageOutcome, CriticalDamageResult, CriticalInjuryOutcome, CriticalInjuryResult, MediatorTableId, MediatorRollResult, } from './types.js';
export type { CrawlerCapacityInput, CrawlerCapacityResult, CrawlerCapacityViolation, } from './crawlerCapacity.js';
//# sourceMappingURL=index.d.ts.map
// === lib/rules/mediatorTables.d.ts ===
/**
 * Mediator tables — Reaction / Morale / Retreat rolls (design-review R-5).
 *
 * Salvage Union Workshop Manual p.268:
 * - **Reaction Roll**: rolled when the Pilots meet a group of NPCs, to set
 *   their initial disposition (Actively Hostile … Actively Helpful).
 * - **Morale**: rolled when an NPC Mech/Creature drops to 50% or less of its
 *   SP/HP (or a group suffers 50%+ losses) to see if it stays in the fight.
 *   Pilots never roll Morale.
 * - **Retreat**: rolled when a group (Pilots or NPCs) chooses to retreat, to
 *   find out how the escape goes.
 *
 * This module is PURE: no React, no IndexedDB, no real randomness. The d20 is
 * injected via the shared `Roll` seam (./types.ts) and the table lookup via
 * `findTable`, so every function is deterministic in tests. The outcome text
 * is read verbatim from the reference roll-table data (roll-tables.json) via
 * `resultForTable` — never duplicated here.
 *
 * ADR-007 boundary: these tables have no mechanical bookkeeping to apply —
 * the result is narrative guidance for the Mediator. The roll is recorded;
 * acting on it (fleeing, surrendering, marking losses) stays a table call.
 */
import type { MediatorRollResult, MediatorTableId, Roll } from './types.js';
/** Reference roll-table `name` for each Mediator table id. */
export declare const MEDIATOR_TABLE_NAMES: Record<MediatorTableId, string>;
/** Short UI label for each Mediator table id. */
export declare const MEDIATOR_TABLE_LABEL: Record<MediatorTableId, string>;
/**
 * Looks up a reference roll table by its `name`. Injectable for tests —
 * `table` is structurally loose so fake tables don't have to satisfy the full
 * reference union; performMediatorRoll narrows it for resultForTable.
 */
export type FindRollTable = (name: string) => {
    table?: unknown;
} | undefined;
type MediatorRollInput = {
    /** Which Mediator table to roll. */
    table: MediatorTableId;
    /** Injectable d20 roller. */
    roll: Roll;
    /** Injectable table lookup (production: SalvageUnionReference.RollTables). */
    findTable: FindRollTable;
    /** Injectable clock for the recorded timestamp. */
    now?: () => Date;
};
/**
 * Rolls a d20 on the given Mediator table and returns the recorded result,
 * with `label`/`value` copied verbatim from the reference table entry.
 * Returns null when the table cannot be found or the roll fails to resolve
 * (missing/drifted reference data) — callers surface that as a no-op.
 */
export declare function performMediatorRoll({ table, roll, findTable, now, }: MediatorRollInput): MediatorRollResult | null;
/** One-line readout for a recorded Mediator roll (HeatCheckControl style). */
export declare function describeMediatorRoll(result: MediatorRollResult): string;
export {};
//# sourceMappingURL=mediatorTables.d.ts.map
// === lib/rules/pilotSnapshot.d.ts ===
/**
 * Pilot snapshot enrichment for soft-warning evaluation.
 *
 * The `Pilot` type (from the Zod schema) stores `abilities` as `string[]`
 * (slug refs) and the class as `classRef`. The soft-warning system's
 * `PilotSnapshot` expects `AbilityInput[]` — structs carrying the ability's
 * tree, level and tier — plus class tier flags.
 *
 * `enrichPilotSnapshot` resolves all of that from `salvageunion-reference`,
 * so the prerequisite checks in softWarnings.ts (tree order, 6-core gates,
 * one-Legendary, Salvager cap) receive the data they need. Wizards call this
 * pre-save on both the stored pilot (before) and the form state (after).
 *
 * All functions are pure — no side effects, no async, no React.
 * Prerequisite: SalvageUnionReference must be preloaded with 'abilities' and
 * 'classes' before calling (the app root preloads 'all').
 */
import type { PilotSnapshot } from './types.js';
/**
 * Enrich a `Pilot`-shaped object (or wizard form state) into a `PilotSnapshot`
 * suitable for `evaluateSoftWarnings`. Resolves each ability's tree/level and
 * classifies its tier; resolves the class to set `isSalvager`/`classTier`.
 *
 * Unknown ability refs survive as bare `{ ref }` entries — the warning checks
 * skip them rather than fabricating violations.
 */
export declare function enrichPilotSnapshot(pilot: {
    abilities: string[];
    classRef?: string;
}): PilotSnapshot;
//# sourceMappingURL=pilotSnapshot.d.ts.map
// === lib/rules/resolveRefs.d.ts ===
/**
 * Canonical resolution of stored entity refs against the reference ORM.
 *
 * Mech records store SLUG references (chassisRef, systems[], modules[]) into
 * salvageunion-reference — the same convention as pilot `classRef` and
 * encounter-NPC `refSlug`, and the repo-wide "entity links use slugs" rule.
 * Records written before the v6 IndexedDB migration (and snapshots published
 * by older clients) may still carry display NAMES, so every resolver here is
 * tolerant: it matches by slug first, then by name, then by id. Unresolvable
 * refs (renamed reference entities, foreign snapshot data) return null and
 * callers degrade gracefully — never throw.
 *
 * All functions are pure and synchronous; reference data must be preloaded
 * (the app root's GameDataReady gate guarantees this).
 */
type RefEntity = {
    id: string;
    name?: string;
};
/** True when `ref` (slug, name, or id) identifies `entity`. */
export declare function matchesRef(entity: RefEntity, ref: string): boolean;
/** Resolve a mech `chassisRef` (slug; legacy name/id tolerated). */
export declare function resolveChassisRef(ref: string): ({
    id: string;
    indexable: boolean;
    blackMarket: boolean;
    name: string;
    source: "Salvage Union Workshop Manual" | "Salvage Union Starter Set" | "Reclamation of the Wastes" | "The Hive" | "Thatcher's Mech Base" | "Relics of a Time Gone By" | "Mech Monday" | "We Were Here First!" | "Rainmaker" | "False Flag";
    page: number;
    structurePoints: number;
    energyPoints: number;
    heatCapacity: number;
    systemSlots: number;
    moduleSlots: number;
    cargoCapacity: number;
    techLevel: number | "B" | "N";
    salvageValue: number;
    chassisAbilities: string[];
    patterns: {
        name: string;
        content?: import("zod").infer<typeof import("../index.js").ContentSchema>;
        legalStarting?: boolean;
        source?: import("zod").infer<typeof import("../index.js").SourceSchema>;
        page?: import("zod").infer<typeof import("../index.js").PositiveIntegerSchema>;
        booklet?: string;
        additionalSources?: import("zod").infer<typeof import("../index.js").AdditionalSourceSchema>[];
        systems: import("zod").infer<typeof import("../index.js").PatternSystemModuleSchema>[];
        modules: import("zod").infer<typeof import("../index.js").PatternSystemModuleSchema>[];
        drones?: import("zod").infer<typeof import("../index.js").PatternDroneConfigSchema>[];
    }[];
    hasArtwork?: boolean | undefined;
    content?: {
        type?: import("zod").infer<typeof import("../index.js").ContentTypeSchema>;
        value?: string | import("zod").infer<typeof import("../index.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: import("zod").infer<typeof import("../index.js").ContentTypeSchema>;
            value?: string | import("zod").infer<typeof import("../index.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }[] | undefined;
    booklet?: string | undefined;
    additionalSources?: {
        source: "Salvage Union Workshop Manual" | "Salvage Union Starter Set" | "Reclamation of the Wastes" | "The Hive" | "Thatcher's Mech Base" | "Relics of a Time Gone By" | "Mech Monday" | "We Were Here First!" | "Rainmaker" | "False Flag";
        page: number;
        booklet?: string | undefined;
    }[] | undefined;
} & {
    schemaName: string;
}) | null;
/** Resolve an installed system ref (slug; legacy name/id tolerated). */
export declare function resolveSystemRef(ref: string): ({
    id: string;
    indexable: boolean;
    blackMarket: boolean;
    source: "Salvage Union Workshop Manual" | "Salvage Union Starter Set" | "Reclamation of the Wastes" | "The Hive" | "Thatcher's Mech Base" | "Relics of a Time Gone By" | "Mech Monday" | "We Were Here First!" | "Rainmaker" | "False Flag";
    page: number;
    name: string;
    techLevel: number | "B" | "N";
    slotsRequired: number;
    salvageValue: number;
    actions: string[];
    hasArtwork?: boolean | undefined;
    content?: {
        type?: import("zod").infer<typeof import("../index.js").ContentTypeSchema>;
        value?: string | import("zod").infer<typeof import("../index.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: import("zod").infer<typeof import("../index.js").ContentTypeSchema>;
            value?: string | import("zod").infer<typeof import("../index.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }[] | undefined;
    booklet?: string | undefined;
    additionalSources?: {
        source: "Salvage Union Workshop Manual" | "Salvage Union Starter Set" | "Reclamation of the Wastes" | "The Hive" | "Thatcher's Mech Base" | "Relics of a Time Gone By" | "Mech Monday" | "We Were Here First!" | "Rainmaker" | "False Flag";
        page: number;
        booklet?: string | undefined;
    }[] | undefined;
    traits?: {
        type: string;
        amount?: string | number | undefined;
    }[] | undefined;
    structurePoints?: number | undefined;
    energyPoints?: number | undefined;
    heatCapacity?: number | undefined;
    systemSlots?: number | undefined;
    moduleSlots?: number | undefined;
    cargoCapacity?: number | undefined;
    recommended?: boolean | undefined;
    count?: number | undefined;
    statBonus?: {
        structurePoints?: number | undefined;
        energyPoints?: number | undefined;
        heatCapacity?: number | undefined;
        cargoCapacity?: number | undefined;
    } | undefined;
} & {
    schemaName: string;
}) | null;
/** Resolve an installed module ref (slug; legacy name/id tolerated). */
export declare function resolveModuleRef(ref: string): ({
    id: string;
    indexable: boolean;
    blackMarket: boolean;
    source: "Salvage Union Workshop Manual" | "Salvage Union Starter Set" | "Reclamation of the Wastes" | "The Hive" | "Thatcher's Mech Base" | "Relics of a Time Gone By" | "Mech Monday" | "We Were Here First!" | "Rainmaker" | "False Flag";
    page: number;
    name: string;
    techLevel: number | "B" | "N";
    slotsRequired: number;
    salvageValue: number;
    actions: string[];
    hasArtwork?: boolean | undefined;
    content?: {
        type?: import("zod").infer<typeof import("../index.js").ContentTypeSchema>;
        value?: string | import("zod").infer<typeof import("../index.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: import("zod").infer<typeof import("../index.js").ContentTypeSchema>;
            value?: string | import("zod").infer<typeof import("../index.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }[] | undefined;
    booklet?: string | undefined;
    additionalSources?: {
        source: "Salvage Union Workshop Manual" | "Salvage Union Starter Set" | "Reclamation of the Wastes" | "The Hive" | "Thatcher's Mech Base" | "Relics of a Time Gone By" | "Mech Monday" | "We Were Here First!" | "Rainmaker" | "False Flag";
        page: number;
        booklet?: string | undefined;
    }[] | undefined;
    structurePoints?: number | undefined;
    energyPoints?: number | undefined;
    heatCapacity?: number | undefined;
    systemSlots?: number | undefined;
    moduleSlots?: number | undefined;
    cargoCapacity?: number | undefined;
    recommended?: boolean | undefined;
    count?: number | undefined;
    statBonus?: {
        structurePoints?: number | undefined;
        energyPoints?: number | undefined;
        heatCapacity?: number | undefined;
        cargoCapacity?: number | undefined;
    } | undefined;
} & {
    schemaName: string;
}) | null;
/**
 * Resolve an installed system-or-module ref — systems win a (theoretical)
 * cross-schema name collision, matching the historical lookup order.
 */
export declare function resolveInstalledRef(ref: string): ({
    id: string;
    indexable: boolean;
    blackMarket: boolean;
    source: "Salvage Union Workshop Manual" | "Salvage Union Starter Set" | "Reclamation of the Wastes" | "The Hive" | "Thatcher's Mech Base" | "Relics of a Time Gone By" | "Mech Monday" | "We Were Here First!" | "Rainmaker" | "False Flag";
    page: number;
    name: string;
    techLevel: number | "B" | "N";
    slotsRequired: number;
    salvageValue: number;
    actions: string[];
    hasArtwork?: boolean | undefined;
    content?: {
        type?: import("zod").infer<typeof import("../index.js").ContentTypeSchema>;
        value?: string | import("zod").infer<typeof import("../index.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: import("zod").infer<typeof import("../index.js").ContentTypeSchema>;
            value?: string | import("zod").infer<typeof import("../index.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }[] | undefined;
    booklet?: string | undefined;
    additionalSources?: {
        source: "Salvage Union Workshop Manual" | "Salvage Union Starter Set" | "Reclamation of the Wastes" | "The Hive" | "Thatcher's Mech Base" | "Relics of a Time Gone By" | "Mech Monday" | "We Were Here First!" | "Rainmaker" | "False Flag";
        page: number;
        booklet?: string | undefined;
    }[] | undefined;
    structurePoints?: number | undefined;
    energyPoints?: number | undefined;
    heatCapacity?: number | undefined;
    systemSlots?: number | undefined;
    moduleSlots?: number | undefined;
    cargoCapacity?: number | undefined;
    recommended?: boolean | undefined;
    count?: number | undefined;
    statBonus?: {
        structurePoints?: number | undefined;
        energyPoints?: number | undefined;
        heatCapacity?: number | undefined;
        cargoCapacity?: number | undefined;
    } | undefined;
} & {
    schemaName: string;
}) | null;
/** Display name for a ref: the resolved entity's name, else the raw ref. */
export declare function refDisplayName(ref: string): string;
export {};
//# sourceMappingURL=resolveRefs.d.ts.map
// === lib/rules/scrap.d.ts ===
/**
 * Scrap economy rule utilities (REQ-014, REQ-015).
 *
 * Salvage Union uses a tiered scrap currency: each tech level (TL1–TL6) is a
 * distinct denomination. Scrap at a higher tech level is worth more, but the
 * conversion rates are not directly in the reference data — items carry their
 * own `salvageValue` which is the canonical cost/sell price in "Tech N Scrap"
 * units (i.e., TL-2 Scrap for a TL-2 item, etc.).
 *
 * Crawler tech-level upgrades use the `upgradeCost` field from
 * salvageunion-reference `crawler-tech-levels.json` (SRD p.218).
 *
 * All functions are pure — no side effects, no async, no React.
 */
import type { ScrapableItem, TechLevel } from './types.js';
/**
 * Returns the sell (salvage) value of an item in units of its own tech level's
 * scrap. This is the `salvageValue` field from the reference data.
 *
 * Example: a TL-2 system with salvageValue 3 yields 3 TL-2 Scrap when salvaged.
 */
export declare function salvageValueFor(item: ScrapableItem): number;
/**
 * Returns the buy (install) cost of an item in units of its own tech level's
 * scrap. Per SRD rules the purchase cost equals the salvage value.
 *
 * SRD reference: Workshop Manual p.162–163 ("Salvage and Scrap" rules).
 */
export declare function scrapCostFor(item: ScrapableItem): number;
/**
 * Returns the cost in scrap to upgrade a crawler from `fromTL` to `toTL`.
 *
 * Upgrade costs come from `salvageunion-reference` `crawler-tech-levels.json`
 * (SRD p.218). The `upgradeCost` multiplier on the *current* tech level record
 * gives the cost to move to the next level.
 *
 * Only sequential upgrades (fromTL → fromTL+1) are directly priced in the
 * data. Jumping multiple tiers sums each intermediate upgrade cost.
 *
 * Returns `null` when:
 * - `fromTL` equals `toTL` (no upgrade needed)
 * - `fromTL` is already at maximum (TL6 has null upgradeCost in the data)
 * - any intermediate tech-level record is not found in the dataset
 *
 * Callers should treat `null` as "cannot determine cost" and surface a
 * manual-review warning rather than blocking.
 */
export declare function tierUpgradeCost(fromTL: TechLevel, toTL: TechLevel): number | null;
//# sourceMappingURL=scrap.d.ts.map
// === lib/rules/softWarnings.d.ts ===
/**
 * Soft-warning rule evaluation (REQ-012).
 *
 * Soft warnings are non-blocking rule violations surfaced at save time. The
 * user sees them in a confirm-and-proceed dialog and may dismiss them. They do
 * not prevent saving — they inform and protect against common mistakes.
 *
 * This module is intentionally kept to documented cases only. Additional
 * warning rules belong in M4 story #225 (REQ-NF-21).
 *
 * All functions are pure — no side effects, no async, no React.
 */
import type { EditSnapshot, MechSnapshot, PilotSnapshot, SoftWarning, SoftWarningContext } from './types.js';
/**
 * The pilot ability soft cap (plan 2.2): 10 abilities, 12 for Salvager.
 * The schema no longer caps the array — exceeding the rules cap is a soft
 * warning, never a parse failure or a blocked save.
 */
export declare const PILOT_ABILITY_CAP = 10;
export declare const SALVAGER_ABILITY_CAP = 12;
/**
 * Evaluate soft warnings for a pilot edit.
 *
 * Documented cases (all advisory, never blocking — plan 3.3/3.4):
 * - Tree order violated (level n taken without the levels below it)
 * - Advanced/Hybrid ability without the 6-core gate
 * - Legendary ability without 6 core + 3 advanced; more than one Legendary
 * - Class switched to Advanced/Hybrid without the 6-core gate
 * - Ability count beyond the rules cap (10 / Salvager 12)
 *
 * Returns an empty array when no warnings apply.
 */
export declare function evaluatePilotWarnings(snapshot: EditSnapshot<PilotSnapshot>, context: SoftWarningContext): SoftWarning[];
/**
 * Evaluate soft warnings for a mech edit.
 *
 * Documented cases:
 * - A system that another system depends on is being removed
 * - Tech level is being downgraded (optionally: without a scrap refund)
 *
 * Returns an empty array when no warnings apply.
 */
export declare function evaluateMechWarnings(snapshot: EditSnapshot<MechSnapshot>, context: SoftWarningContext): SoftWarning[];
/**
 * Unified entry point for soft-warning evaluation.
 *
 * Dispatches to the appropriate entity-specific evaluator based on
 * `context.entityType`. For 'pilot', `before`/`after` must be `PilotSnapshot`.
 * For 'mech', they must be `MechSnapshot`. For 'crawler', only the
 * tech-level downgrade check applies (crawler-specific rules are M4).
 *
 * When `entityType` is 'crawler', pass any object satisfying `MechSnapshot`
 * (only the `techLevel` field is read; `systems` can be an empty array).
 *
 * Returns an empty array when no warnings apply.
 */
export declare function evaluateSoftWarnings(before: PilotSnapshot | MechSnapshot, after: PilotSnapshot | MechSnapshot, context: SoftWarningContext): SoftWarning[];
//# sourceMappingURL=softWarnings.d.ts.map
// === lib/rules/takeDamage.d.ts ===
/**
 * Take Damage / Critical Damage / Critical Injury rules (design-review R-1).
 *
 * Salvage Union Core Book p.239-242 — damage intake, the most error-prone
 * live math in the game.
 *
 * Rules summary:
 * - Mech Damage (p.239-240): weapons that list SP damage reduce mech SP 1:1.
 *   A weapon that lists HP damage deals HALF that damage to a mech (floored).
 *   SP can never go below 0. On reaching 0 SP, roll the Critical Damage
 *   Table (d20):
 *     1     → Catastrophic: mech + mounted Systems/Modules + Cargo destroyed;
 *             pilot dies unless they can escape
 *     2-5   → System Destruction: a System destroyed (player marks which);
 *             chassis Damaged and inoperable
 *     6-10  → Module Destruction: a Module destroyed (player marks which);
 *             chassis Damaged and inoperable
 *     11-19 → Core Damage: chassis Damaged and inoperable; pilot reduced to
 *             0 HP unless they can escape
 *     20    → Miraculous Survival: mech Intact at 1 SP, fully operational
 * - Pilot Damage (p.241): weapons that list HP damage reduce pilot HP 1:1.
 *   A weapon that deals SP damage deals 2× that damage to a pilot. HP can
 *   never go below 0. On reaching 0 HP, roll the Critical Injury Table (d20):
 *     1     → Fatal Injury: the pilot dies
 *     2-5   → Major Injury (−2 max HP until healed, T5-6 Med Bay) + Unconscious
 *     6-10  → Minor Injury (−1 max HP until healed, T3-4 Med Bay) + Unconscious
 *     11-19 → Unconscious: stable at 0 HP until they regain ≥1 HP
 *     20    → Miraculous Survival: 1 HP, conscious, acts normally
 * - Vulnerable (e.g. a shut-down mech) takes 2× damage. The doubling applies
 *   to the damage the TARGET takes — i.e. after the SP↔HP conversion.
 *
 * The band data mirrors the "Critical Damage" / "Critical Injury" tables in
 * salvageunion-reference data/roll-tables.json, encoded here as pure band
 * functions the same way heatCheck.ts encodes the Reactor Overload bands.
 * The SP subtraction itself is the shared `applySpDamage` from
 * salvageunion-reference/lib/combatUtils.ts (ADR-006 — never reimplemented).
 *
 * This module is PURE: no React, no store, no real randomness — the d20 is
 * injected via `Roll`. Per ADR-007 the functions return deterministic
 * bookkeeping for the caller to apply and FLAG the destructive/narrative
 * choices (which System/Module dies, whether an injury is accepted, pilot
 * death) for the player — never auto-picked.
 */
import type { CriticalDamageOutcome, CriticalDamageResult, CriticalInjuryOutcome, CriticalInjuryResult, Roll } from './types.js';
/** What the incoming weapon lists in its profile (drives the p.240/241 conversions). */
export type DamageKind = 'sp' | 'hp';
/**
 * The SP damage a mech actually takes: HP-listed weapons deal half damage to
 * mechs (floored), then Vulnerable doubles what the mech takes. Non-positive
 * amounts are 0.
 */
export declare function mechEffectiveDamage(amount: number, kind: DamageKind, vulnerable: boolean): number;
export type MechDamageInput = {
    /** Current SP before the hit. */
    currentSP: number;
    /** The weapon's listed damage. */
    amount: number;
    /** What the weapon lists — SP applies 1:1, HP is halved vs mechs. */
    kind: DamageKind;
    /** Vulnerable targets take 2× damage. */
    vulnerable: boolean;
};
export type MechDamageEffect = {
    /** SP damage actually applied after conversion + Vulnerable. */
    effectiveDamage: number;
    /** New SP (clamped at 0 by the shared applySpDamage). */
    nextSP: number;
    /** True when this hit left the mech at 0 SP — roll Critical Damage. */
    criticalDue: boolean;
};
/**
 * Applies one hit to a mech's SP. The subtraction/clamp is the shared
 * `applySpDamage`; `criticalDue` signals the Critical Damage Table prompt
 * (only when real damage landed — arriving at 0 from 0 with a 0-damage input
 * never prompts).
 */
export declare function applyMechDamage({ currentSP, amount, kind, vulnerable, }: MechDamageInput): MechDamageEffect;
/**
 * Maps a Critical Damage Table d20 roll to its outcome band (p.240).
 *   1     → catastrophic
 *   2-5   → system-destruction
 *   6-10  → module-destruction
 *   11-19 → core-damage
 *   20    → miraculous-survival
 */
export declare function criticalDamageOutcome(roll: number): CriticalDamageOutcome;
/**
 * The deterministic state changes a Critical Damage roll produces. The caller
 * applies these as a patch to the mech. `requiresPlayerChoice` flags the 2-5 /
 * 6-10 bands: the player marks WHICH System/Module is destroyed via its
 * status badge (ADR-007 — this module never auto-picks one). The pilot-side
 * consequences of `catastrophic`/`core-damage` (death / 0 HP unless they
 * escape) are narrative and stay advisory text at the control layer.
 */
export type CriticalDamageEffect = {
    /** The recorded result for display + persistence. */
    result: CriticalDamageResult;
    /** SP override — 1 on miraculous-survival, null otherwise (unchanged). */
    nextSP: number | null;
    /** True on catastrophic (roll 1) — the mech is destroyed. */
    destroyed: boolean;
    /** True on 2-19 — the chassis is Damaged and inoperable until repaired. */
    chassisDamaged: boolean;
    /** 2-5 → 'system', 6-10 → 'module': the player marks one destroyed. */
    requiresPlayerChoice: 'system' | 'module' | null;
};
type CriticalRollInput = {
    /** Injectable d20 roller. */
    roll: Roll;
    /** Injectable clock for the recorded timestamp (defaults to () => new Date()). */
    now?: () => Date;
};
/** Rolls the Critical Damage Table (p.240) and returns the deterministic effect. */
export declare function performCriticalDamage({ roll, now }: CriticalRollInput): CriticalDamageEffect;
/**
 * The HP damage a pilot actually takes: SP-listed weapons deal 2× damage to
 * pilots, then Vulnerable doubles what the pilot takes. Non-positive amounts
 * are 0.
 */
export declare function pilotEffectiveDamage(amount: number, kind: DamageKind, vulnerable: boolean): number;
export type PilotDamageInput = {
    /** Current HP before the hit. */
    currentHP: number;
    /** The weapon's listed damage. */
    amount: number;
    /** What the weapon lists — HP applies 1:1, SP is doubled vs pilots. */
    kind: DamageKind;
    /** Vulnerable targets take 2× damage. */
    vulnerable: boolean;
};
export type PilotDamageEffect = {
    /** HP damage actually applied after conversion + Vulnerable. */
    effectiveDamage: number;
    /** New HP (clamped at 0 — HP never goes negative). */
    nextHP: number;
    /** True when this hit left the pilot at 0 HP — roll Critical Injury. */
    criticalDue: boolean;
};
/** Applies one hit to a pilot's HP (clamped at 0, never negative). */
export declare function applyPilotDamage({ currentHP, amount, kind, vulnerable, }: PilotDamageInput): PilotDamageEffect;
/**
 * Maps a Critical Injury Table d20 roll to its outcome band (p.241).
 *   1     → fatal
 *   2-5   → major-injury
 *   6-10  → minor-injury
 *   11-19 → unconscious
 *   20    → miraculous-survival
 */
export declare function criticalInjuryOutcome(roll: number): CriticalInjuryOutcome;
/**
 * The deterministic state changes a Critical Injury roll produces.
 * Unconsciousness (bands 2-19) is recoverable bookkeeping the caller may
 * auto-apply as a condition; the max-HP-reducing `injury` (2-5 / 6-10) is
 * offered for the player to ACCEPT into the injuries list, and `fatal` is
 * narrative only (ADR-007 — the app never kills a pilot automatically).
 */
export type CriticalInjuryEffect = {
    /** The recorded result for display + persistence. */
    result: CriticalInjuryResult;
    /** HP override — 1 on miraculous-survival, null otherwise (unchanged). */
    nextHP: number | null;
    /** True on 2-19 — the pilot is Unconscious until they regain ≥1 HP. */
    unconscious: boolean;
    /** The injury severity the player is prompted to accept (2-5 / 6-10). */
    injury: 'minor' | 'major' | null;
    /** True on a roll of 1 — the pilot dies (player marks it, never auto). */
    fatal: boolean;
};
/** Rolls the Critical Injury Table (p.241) and returns the deterministic effect. */
export declare function performCriticalInjury({ roll, now }: CriticalRollInput): CriticalInjuryEffect;
export {};
//# sourceMappingURL=takeDamage.d.ts.map
// === lib/rules/types.d.ts ===
/**
 * Structural type aliases for the rules module.
 *
 * These types describe the SHAPE of entities that the rule utilities consume.
 * They are intentionally defined here as plain structural types (not imported
 * from any app's Zod schemas) so this module has no dependency on any
 * consumer app — ADR-006 (pure rules logic lives in this package). A
 * consumer's Zod-inferred types (e.g. ITUN's `src/lib/schemas/`) satisfy
 * these structural shapes automatically (TypeScript's structural type system
 * ensures compatibility at call sites); this module never imports them back.
 *
 * (Migrated from ITUN's `src/lib/rules/types.ts` — see ADR-006. Originally
 * authored with exactly this file-disjoint intent, anticipating this move.)
 */
/**
 * Tech level — matches salvageunion-reference's `TechLevelSchema`: the numeric
 * tiers 1–6 plus the two non-numeric equipment tiers 'B' (Bio) and 'N' (Nanite).
 * Per the Core Book "TECH LEVELS" box (p.3), TECH 6 covers "BIO AND NANITE TECH";
 * Bio/Nanite systems & modules exist in the catalog and must be selectable.
 */
export type TechLevel = 1 | 2 | 3 | 4 | 5 | 6 | 'B' | 'N';
/**
 * A system installed on a mech, identified by a name reference into the
 * `salvageunion-reference` Systems dataset.
 *
 * `slotCost` may be explicitly overridden (e.g. by a chassis ability). When
 * absent the utility looks up the canonical `slotsRequired` from the dataset.
 */
export type MechSystemSlot = {
    /** Name reference — must match a system name in salvageunion-reference */
    ref: string;
    /** Override for slot cost; defaults to the reference data's slotsRequired */
    slotCost?: number;
};
/**
 * A module installed on a mech, identified by a name reference into the
 * `salvageunion-reference` Modules dataset.
 */
export type MechModuleSlot = {
    /** Name reference — must match a module name in salvageunion-reference */
    ref: string;
    /** Override for slot cost; defaults to the reference data's slotsRequired */
    slotCost?: number;
};
/**
 * Minimal mech shape consumed by `computeMechCapacity`.
 * The `chassisRef` must match a chassis name in salvageunion-reference.
 */
export type MechInput = {
    chassisRef: string;
    systems: MechSystemSlot[];
    modules: MechModuleSlot[];
};
/**
 * Discriminated union of capacity violations.
 */
export type CapacityViolation = {
    kind: 'system-over-slots';
    message: string;
    details: {
        used: number;
        max: number;
    };
} | {
    kind: 'module-over-slots';
    message: string;
    details: {
        used: number;
        max: number;
    };
} | {
    kind: 'system-requires-chassis';
    message: string;
    details: {
        systemRef: string;
        requiredChassis: string;
    };
} | {
    kind: 'chassis-not-found';
    message: string;
    details: {
        chassisRef: string;
    };
};
/**
 * Result of `computeMechCapacity`.
 */
export type MechCapacityResult = {
    systemSlotsUsed: number;
    systemSlotsMax: number;
    moduleSlotsUsed: number;
    moduleSlotsMax: number;
    violations: CapacityViolation[];
};
/**
 * A reference-linked cargo item (resolved from salvageunion-reference).
 */
export type CargoItemRef = {
    kind: 'ref';
    /** Name of the equipment/system in salvageunion-reference */
    ref: string;
    /** Explicit slot count override (optional; falls back to the dataset value) */
    slotCount?: number;
};
/**
 * A custom (player-entered) cargo item with no SRD reference.
 */
export type CargoItemCustom = {
    kind: 'custom';
    name: string;
    slotCount: number;
};
export type CargoItem = CargoItemRef | CargoItemCustom;
/**
 * Minimal parent shape consumed by `computeCargoCapacity`.
 * `cargoCapacity` is the maximum cargo slots.
 */
export type CargoParent = {
    cargoCapacity: number;
};
/**
 * Discriminated union of cargo violations.
 */
export type CargoViolation = {
    kind: 'over-capacity';
    message: string;
    details: {
        used: number;
        max: number;
    };
} | {
    kind: 'missing-ref';
    message: string;
    details: {
        ref: string;
    };
};
/**
 * Result of `computeCargoCapacity`.
 */
export type CargoCapacityResult = {
    used: number;
    max: number;
    violations: CargoViolation[];
};
/**
 * Minimal item shape consumed by `salvageValueFor` / `scrapCostFor`.
 * Any SU entity with a salvageValue and techLevel satisfies this.
 */
export type ScrapableItem = {
    salvageValue: number;
    techLevel: TechLevel;
};
/**
 * Severity of a soft warning.
 */
export type SoftWarningSeverity = 'info' | 'warn';
/**
 * A non-blocking rule violation surfaced at save time.
 *
 * Soft warnings do not prevent saving. The user sees them in a
 * confirm-and-proceed dialog and may dismiss them.
 */
export type SoftWarning = {
    code: string;
    message: string;
    severity: SoftWarningSeverity;
};
/**
 * Tier of an ability tree (advancement rules, plan S5):
 * - core: a class's three core trees (Salvager: any core tree)
 * - advanced: an Advanced/Hybrid specialisation tree (2 TP, gated on 6 core)
 * - legendary: a Legendary tree (3 TP, gated on 6 core + 3 advanced; max one)
 */
export type AbilityTier = 'core' | 'advanced' | 'legendary';
/**
 * Minimal ability shape for soft-warning checks. `tree`/`level`/`tier` are
 * resolved from salvageunion-reference by `enrichPilotSnapshot`; checks that
 * need them no-op when they are absent (un-enriched snapshots).
 */
export type AbilityInput = {
    ref: string;
    /** Display name for warning messages (defaults to ref). */
    name?: string;
    /** Ability tree this ability belongs to, if known. */
    tree?: string;
    /** Tree level (1–3 numeric; 'L' legendary, 'G' general), if known. */
    level?: number | 'L' | 'G';
    /** Tier classification of the ability's tree, if known. */
    tier?: AbilityTier;
};
/**
 * Minimal pilot shape consumed by `evaluateSoftWarnings`.
 */
export type PilotSnapshot = {
    abilities: AbilityInput[];
    /**
     * True when the pilot's class is Salvager — raises the ability soft cap
     * from 10 to 12 (Core trees only, per the core rules).
     */
    isSalvager?: boolean;
    /**
     * 'base' for the six core classes; 'advanced-hybrid' for an Advanced or
     * Hybrid specialisation class. Undefined when unresolvable.
     */
    classTier?: 'base' | 'advanced-hybrid';
    /** Class display name for warning messages, if known. */
    className?: string;
};
/**
 * Minimal system shape for soft-warning dependency checks.
 */
export type SystemSnapshot = {
    ref: string;
    /** Other system refs this system depends on (if known) */
    requires?: string[];
};
/**
 * Minimal mech shape consumed by `evaluateSoftWarnings`.
 */
export type MechSnapshot = {
    techLevel?: TechLevel;
    systems: SystemSnapshot[];
};
/**
 * Context object passed to `evaluateSoftWarnings`.
 * Describes what was changed and who is being saved.
 */
export type SoftWarningContext = {
    /** Type of entity being saved */
    entityType: 'pilot' | 'mech' | 'crawler';
    /** Is this a downgrade in tech level? */
    techLevelDowngraded?: boolean;
    /**
     * If a scrap refund was expected but not issued on TL downgrade.
     * Set to true when the edit skips the refund step.
     */
    scrapRefundSkipped?: boolean;
};
/**
 * Before/after snapshot pair consumed by `evaluateSoftWarnings`.
 */
export type EditSnapshot<T> = {
    before: T;
    after: T;
};
/** A function that returns an integer die roll in [1, sides]. Injectable. */
export type Roll = (sides: number) => number;
/**
 * Reactor Overload outcome categories (Core Book p.234-235).
 *   1     → meltdown
 *   2-5   → system-destroyed
 *   6-10  → module-destroyed
 *   11-19 → overheat
 *   20    → safe
 */
export type ReactorOverloadOutcome = 'meltdown' | 'system-destroyed' | 'module-destroyed' | 'overheat' | 'safe';
/**
 * Recorded result of a Heat Check (and any subsequent Reactor Overload roll).
 * Snapshot-safe plain data a consumer stores on the mech so the sheet can
 * render the last outcome.
 */
export type HeatCheckResult = {
    heatCheckRoll: number;
    heatAtCheck: number;
    overloaded: boolean;
    overloadRoll?: number;
    outcome?: ReactorOverloadOutcome;
    /** ISO timestamp of when this check was rolled. */
    rolledAt: string;
};
/**
 * The deterministic state changes a Heat Check produces. The caller applies
 * these as a patch to the mech. `requiresPlayerChoice` is true for the 2-5 /
 * 6-10 bands, signalling the UI to prompt the player to mark a System/Module
 * (this module never auto-picks one).
 */
export type HeatCheckEffect = {
    /** The recorded result for display + persistence. */
    result: HeatCheckResult;
    /** New SP after applying overheat damage (only changes on 11-19). */
    nextSP: number;
    /** True when the mech shuts down (11-19). */
    shutdown: boolean;
    /** True when the mech becomes Vulnerable (11-19). */
    vulnerable: boolean;
    /** True when the mech is destroyed (meltdown, roll 1). */
    destroyed: boolean;
    /** True when the player must pick a System/Module to mark destroyed (2-5 / 6-10). */
    requiresPlayerChoice: boolean;
};
export type PushResult = {
    /** Heat after +2 (clamped to cap), before any overheat SP damage. */
    nextHeat: number;
    /** The Heat Check performed at the new heat. */
    effect: HeatCheckEffect;
};
/**
 * Critical Damage Table outcome bands (Core Book p.239-240).
 *   1     → catastrophic
 *   2-5   → system-destruction
 *   6-10  → module-destruction
 *   11-19 → core-damage
 *   20    → miraculous-survival
 */
export type CriticalDamageOutcome = 'catastrophic' | 'system-destruction' | 'module-destruction' | 'core-damage' | 'miraculous-survival';
/** Recorded result of a Critical Damage Table roll. */
export type CriticalDamageResult = {
    roll: number;
    outcome: CriticalDamageOutcome;
    /** ISO timestamp of when this result was rolled. */
    rolledAt: string;
};
/**
 * Critical Injury Table outcome bands (Core Book p.241).
 *   1     → fatal
 *   2-5   → major-injury
 *   6-10  → minor-injury
 *   11-19 → unconscious
 *   20    → miraculous-survival
 */
export type CriticalInjuryOutcome = 'fatal' | 'major-injury' | 'minor-injury' | 'unconscious' | 'miraculous-survival';
/** Recorded result of a Critical Injury Table roll. */
export type CriticalInjuryResult = {
    roll: number;
    outcome: CriticalInjuryOutcome;
    /** ISO timestamp of when this result was rolled. */
    rolledAt: string;
};
/** The three Mediator tables the tray can roll (Workshop Manual p.268). */
export type MediatorTableId = 'reaction' | 'morale' | 'retreat';
/**
 * Recorded result of a Mediator table roll (Reaction / Morale / Retreat).
 * Snapshot-safe plain data — same shape discipline as HeatCheckResult.
 */
export type MediatorRollResult = {
    table: MediatorTableId;
    roll: number;
    /** Band label from the table entry (e.g. 'Friendly'), when present. */
    label?: string;
    /** Full outcome text from the table entry. */
    value: string;
    /** ISO timestamp of when this result was rolled. */
    rolledAt: string;
};
//# sourceMappingURL=types.d.ts.map
// === lib/schemaDefinitions.d.ts ===
export declare function getJsonSchemaDefinition(schemaId: string): Record<string, unknown> | undefined;
export declare function getAllJsonSchemaDefinitions(): Record<string, Record<string, unknown>>;
//# sourceMappingURL=schemaDefinitions.d.ts.map
// === lib/schemas/common.d.ts ===
/**
 * Zod common primitive schemas from common.schema.json
 */
import { z } from '../zod.js';
/**
 * Unique identifier for the entry
 */
export declare const IdSchema: z.ZodString;
/**
 * Name of the entry
 */
export declare const NameSchema: z.ZodString;
/**
 * Non-negative integer (0 or greater)
 */
export declare const NonNegativeIntegerSchema: z.ZodNumber;
/**
 * Positive integer (1 or greater)
 */
export declare const PositiveIntegerSchema: z.ZodNumber;
/**
 * Cost in ability points to activate an ability
 */
export declare const ActivationCostSchema: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"X">]>;
/**
 * Technology level of the item or entity (integer 1-6, 'B' for Bio, or 'N' for Nanite)
 */
export declare const TechLevelSchema: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>;
//# sourceMappingURL=common.d.ts.map
// === lib/schemas/entities.d.ts ===
/**
 * Zod entity schemas - all 24 entity types
 */
import { z } from '../zod.js';
import { ContentSchema, TableSchema, ChoicesSchema, TraitSchema, SystemModuleSchema } from './objects.js';
import { ActionTypeSchema, SchemaNameSchema } from './enums.js';
import { NonNegativeIntegerSchema, PositiveIntegerSchema, TechLevelSchema } from './common.js';
/**
 * Pilot abilities and skills
 */
export declare const AbilitySchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    description: z.ZodOptional<z.ZodString>;
    tree: z.ZodEnum<{
        "Advanced Engineer": "Advanced Engineer";
        "Advanced Hacking": "Advanced Hacking";
        "Advanced Hauler": "Advanced Hauler";
        "Advanced Scout": "Advanced Scout";
        "Advanced Soldier": "Advanced Soldier";
        Augmentation: "Augmentation";
        Cyborg: "Cyborg";
        Electronics: "Electronics";
        Fabricator: "Fabricator";
        Forging: "Forging";
        Generic: "Generic";
        "Gladiatorial Combat": "Gladiatorial Combat";
        Hacking: "Hacking";
        Leadership: "Leadership";
        "Legendary Cyborg": "Legendary Cyborg";
        "Legendary Engineer": "Legendary Engineer";
        "Legendary Fabricator": "Legendary Fabricator";
        "Legendary Hacker": "Legendary Hacker";
        "Legendary Hauler": "Legendary Hauler";
        "Legendary Ranger": "Legendary Ranger";
        "Legendary Scout": "Legendary Scout";
        "Legendary Smuggler": "Legendary Smuggler";
        "Legendary Soldier": "Legendary Soldier";
        "Legendary Union Rep": "Legendary Union Rep";
        "Mech-Tech": "Mech-Tech";
        "Mechanical Knowledge": "Mechanical Knowledge";
        Ranger: "Ranger";
        Recon: "Recon";
        Salvaging: "Salvaging";
        Sleuth: "Sleuth";
        Smuggler: "Smuggler";
        Sniper: "Sniper";
        Survivalist: "Survivalist";
        "Tactical Warfare": "Tactical Warfare";
        Trading: "Trading";
        "Union Rep": "Union Rep";
    }>;
    level: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"L">, z.ZodLiteral<"G">]>;
    mechActionType: z.ZodOptional<z.ZodEnum<{
        Long: "Long";
        Passive: "Passive";
        Free: "Free";
        Reaction: "Reaction";
        Turn: "Turn";
        Short: "Short";
        DownTime: "DownTime";
    }>>;
    grants: z.ZodOptional<z.ZodArray<z.ZodObject<{
        schema: z.ZodUnion<readonly [z.ZodEnum<{
            classes: "classes";
            npcs: "npcs";
            abilities: "abilities";
            "ability-tree-requirements": "ability-tree-requirements";
            chassis: "chassis";
            "crawler-bays": "crawler-bays";
            "crawler-tech-levels": "crawler-tech-levels";
            crawlers: "crawlers";
            creatures: "creatures";
            distances: "distances";
            drones: "drones";
            equipment: "equipment";
            guides: "guides";
            keywords: "keywords";
            factions: "factions";
            meld: "meld";
            modules: "modules";
            "roll-tables": "roll-tables";
            sources: "sources";
            squads: "squads";
            "tech-levels": "tech-levels";
            systems: "systems";
            "bio-titans": "bio-titans";
            traits: "traits";
            vehicles: "vehicles";
        }>, z.ZodLiteral<"choice">]>;
        name: z.ZodString;
    }, z.core.$strict>>>;
    activationCurrency: z.ZodOptional<z.ZodEnum<{
        "EP or AP": "EP or AP";
        "SP or HP": "SP or HP";
        Variable: "Variable";
    }>>;
    actions: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
/**
 * Requirements for ability trees
 */
export declare const AbilityTreeRequirementSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    requirement: z.ZodArray<z.ZodEnum<{
        "Advanced Engineer": "Advanced Engineer";
        "Advanced Hacking": "Advanced Hacking";
        "Advanced Hauler": "Advanced Hauler";
        "Advanced Scout": "Advanced Scout";
        "Advanced Soldier": "Advanced Soldier";
        Augmentation: "Augmentation";
        Cyborg: "Cyborg";
        Electronics: "Electronics";
        Fabricator: "Fabricator";
        Forging: "Forging";
        Generic: "Generic";
        "Gladiatorial Combat": "Gladiatorial Combat";
        Hacking: "Hacking";
        Leadership: "Leadership";
        "Legendary Cyborg": "Legendary Cyborg";
        "Legendary Engineer": "Legendary Engineer";
        "Legendary Fabricator": "Legendary Fabricator";
        "Legendary Hacker": "Legendary Hacker";
        "Legendary Hauler": "Legendary Hauler";
        "Legendary Ranger": "Legendary Ranger";
        "Legendary Scout": "Legendary Scout";
        "Legendary Smuggler": "Legendary Smuggler";
        "Legendary Soldier": "Legendary Soldier";
        "Legendary Union Rep": "Legendary Union Rep";
        "Mech-Tech": "Mech-Tech";
        "Mechanical Knowledge": "Mechanical Knowledge";
        Ranger: "Ranger";
        Recon: "Recon";
        Salvaging: "Salvaging";
        Sleuth: "Sleuth";
        Smuggler: "Smuggler";
        Sniper: "Sniper";
        Survivalist: "Survivalist";
        "Tactical Warfare": "Tactical Warfare";
        Trading: "Trading";
        "Union Rep": "Union Rep";
    }>>;
}, z.core.$strict>;
/**
 * Actions, abilities, and attacks that can be performed
 */
export declare const MetaActionSchema: z.ZodType<{
    id: string;
    name: string;
    content?: z.infer<typeof ContentSchema>;
    structurePoints?: number;
    energyPoints?: number;
    heatCapacity?: number;
    systemSlots?: number;
    moduleSlots?: number;
    cargoCapacity?: number;
    techLevel?: z.infer<typeof TechLevelSchema>;
    salvageValue?: number;
    displayName?: string;
    activationCost?: z.infer<typeof import("./common.js").ActivationCostSchema>;
    range?: z.infer<typeof import("./enums.js").RangeSchema>;
    actionType?: z.infer<typeof ActionTypeSchema>;
    traits?: z.infer<typeof TraitSchema>[];
    damage?: z.infer<typeof import("./objects.js").DamageSchema>;
    choices?: z.infer<typeof import("./objects.js").ChoiceSchema>[];
    table?: z.infer<typeof TableSchema>;
    tableName?: string;
    hidden?: boolean;
    activationCurrency?: z.infer<z.ZodEnum<{
        "EP or AP": "EP or AP";
        "SP or HP": "SP or HP";
        Variable: "Variable";
    }>>;
    source?: z.infer<typeof import("./enums.js").SourceSchema>;
    page?: z.infer<typeof PositiveIntegerSchema>;
    actionSource?: z.infer<typeof SchemaNameSchema>;
    drone?: string;
    requiredTraits?: string[];
}, unknown, z.core.$ZodTypeInternals<{
    id: string;
    name: string;
    content?: z.infer<typeof ContentSchema>;
    structurePoints?: number;
    energyPoints?: number;
    heatCapacity?: number;
    systemSlots?: number;
    moduleSlots?: number;
    cargoCapacity?: number;
    techLevel?: z.infer<typeof TechLevelSchema>;
    salvageValue?: number;
    displayName?: string;
    activationCost?: z.infer<typeof import("./common.js").ActivationCostSchema>;
    range?: z.infer<typeof import("./enums.js").RangeSchema>;
    actionType?: z.infer<typeof ActionTypeSchema>;
    traits?: z.infer<typeof TraitSchema>[];
    damage?: z.infer<typeof import("./objects.js").DamageSchema>;
    choices?: z.infer<typeof import("./objects.js").ChoiceSchema>[];
    table?: z.infer<typeof TableSchema>;
    tableName?: string;
    hidden?: boolean;
    activationCurrency?: z.infer<z.ZodEnum<{
        "EP or AP": "EP or AP";
        "SP or HP": "SP or HP";
        Variable: "Variable";
    }>>;
    source?: z.infer<typeof import("./enums.js").SourceSchema>;
    page?: z.infer<typeof PositiveIntegerSchema>;
    actionSource?: z.infer<typeof SchemaNameSchema>;
    drone?: string;
    requiredTraits?: string[];
}, unknown>>;
/**
 * Bio-Titans: mech-scale biological monsters.
 *
 * Instinctual, mech-scale creatures (e.g. Scylla, Typhon, Chrysalis) with a
 * structurePoints + actions statblock — actions often include a "Titanic
 * Actions" entry. Bio-salvage extracted from a Bio-Titan equals its starting
 * Structure Points (derived at the display layer).
 */
export declare const BioTitanSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    structurePoints: z.ZodNumber;
    actions: z.ZodArray<z.ZodString>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
}, z.core.$strict>;
/**
 * Mech chassis definitions
 */
export declare const ChassisSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    structurePoints: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    energyPoints: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    heatCapacity: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    systemSlots: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    moduleSlots: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    cargoCapacity: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    techLevel: z.ZodNonOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>>;
    salvageValue: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    chassisAbilities: z.ZodArray<z.ZodString>;
    patterns: z.ZodArray<z.ZodType<{
        name: string;
        content?: z.infer<typeof ContentSchema>;
        legalStarting?: boolean;
        source?: z.infer<typeof import("./enums.js").SourceSchema>;
        page?: z.infer<typeof PositiveIntegerSchema>;
        booklet?: string;
        additionalSources?: z.infer<typeof import("./objects.js").AdditionalSourceSchema>[];
        systems: z.infer<typeof import("./objects.js").PatternSystemModuleSchema>[];
        modules: z.infer<typeof import("./objects.js").PatternSystemModuleSchema>[];
        drones?: z.infer<typeof import("./objects.js").PatternDroneConfigSchema>[];
    }, unknown, z.core.$ZodTypeInternals<{
        name: string;
        content?: z.infer<typeof ContentSchema>;
        legalStarting?: boolean;
        source?: z.infer<typeof import("./enums.js").SourceSchema>;
        page?: z.infer<typeof PositiveIntegerSchema>;
        booklet?: string;
        additionalSources?: z.infer<typeof import("./objects.js").AdditionalSourceSchema>[];
        systems: z.infer<typeof import("./objects.js").PatternSystemModuleSchema>[];
        modules: z.infer<typeof import("./objects.js").PatternSystemModuleSchema>[];
        drones?: z.infer<typeof import("./objects.js").PatternDroneConfigSchema>[];
    }, unknown>>>;
}, z.core.$strict>;
/**
 * Pilot Classes (Base and Hybrid)
 */
export declare const ClassSchema: z.ZodUnion<readonly [z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    maxAbilities: z.ZodNumber;
    advanceable: z.ZodBoolean;
    coreTrees: z.ZodArray<z.ZodEnum<{
        "Advanced Engineer": "Advanced Engineer";
        "Advanced Hacking": "Advanced Hacking";
        "Advanced Hauler": "Advanced Hauler";
        "Advanced Scout": "Advanced Scout";
        "Advanced Soldier": "Advanced Soldier";
        Augmentation: "Augmentation";
        Cyborg: "Cyborg";
        Electronics: "Electronics";
        Fabricator: "Fabricator";
        Forging: "Forging";
        Generic: "Generic";
        "Gladiatorial Combat": "Gladiatorial Combat";
        Hacking: "Hacking";
        Leadership: "Leadership";
        "Legendary Cyborg": "Legendary Cyborg";
        "Legendary Engineer": "Legendary Engineer";
        "Legendary Fabricator": "Legendary Fabricator";
        "Legendary Hacker": "Legendary Hacker";
        "Legendary Hauler": "Legendary Hauler";
        "Legendary Ranger": "Legendary Ranger";
        "Legendary Scout": "Legendary Scout";
        "Legendary Smuggler": "Legendary Smuggler";
        "Legendary Soldier": "Legendary Soldier";
        "Legendary Union Rep": "Legendary Union Rep";
        "Mech-Tech": "Mech-Tech";
        "Mechanical Knowledge": "Mechanical Knowledge";
        Ranger: "Ranger";
        Recon: "Recon";
        Salvaging: "Salvaging";
        Sleuth: "Sleuth";
        Smuggler: "Smuggler";
        Sniper: "Sniper";
        Survivalist: "Survivalist";
        "Tactical Warfare": "Tactical Warfare";
        Trading: "Trading";
        "Union Rep": "Union Rep";
    }>>;
    advancedTree: z.ZodOptional<z.ZodEnum<{
        "Advanced Engineer": "Advanced Engineer";
        "Advanced Hacking": "Advanced Hacking";
        "Advanced Hauler": "Advanced Hauler";
        "Advanced Scout": "Advanced Scout";
        "Advanced Soldier": "Advanced Soldier";
        Augmentation: "Augmentation";
        Cyborg: "Cyborg";
        Electronics: "Electronics";
        Fabricator: "Fabricator";
        Forging: "Forging";
        Generic: "Generic";
        "Gladiatorial Combat": "Gladiatorial Combat";
        Hacking: "Hacking";
        Leadership: "Leadership";
        "Legendary Cyborg": "Legendary Cyborg";
        "Legendary Engineer": "Legendary Engineer";
        "Legendary Fabricator": "Legendary Fabricator";
        "Legendary Hacker": "Legendary Hacker";
        "Legendary Hauler": "Legendary Hauler";
        "Legendary Ranger": "Legendary Ranger";
        "Legendary Scout": "Legendary Scout";
        "Legendary Smuggler": "Legendary Smuggler";
        "Legendary Soldier": "Legendary Soldier";
        "Legendary Union Rep": "Legendary Union Rep";
        "Mech-Tech": "Mech-Tech";
        "Mechanical Knowledge": "Mechanical Knowledge";
        Ranger: "Ranger";
        Recon: "Recon";
        Salvaging: "Salvaging";
        Sleuth: "Sleuth";
        Smuggler: "Smuggler";
        Sniper: "Sniper";
        Survivalist: "Survivalist";
        "Tactical Warfare": "Tactical Warfare";
        Trading: "Trading";
        "Union Rep": "Union Rep";
    }>>;
    legendaryTree: z.ZodOptional<z.ZodEnum<{
        "Advanced Engineer": "Advanced Engineer";
        "Advanced Hacking": "Advanced Hacking";
        "Advanced Hauler": "Advanced Hauler";
        "Advanced Scout": "Advanced Scout";
        "Advanced Soldier": "Advanced Soldier";
        Augmentation: "Augmentation";
        Cyborg: "Cyborg";
        Electronics: "Electronics";
        Fabricator: "Fabricator";
        Forging: "Forging";
        Generic: "Generic";
        "Gladiatorial Combat": "Gladiatorial Combat";
        Hacking: "Hacking";
        Leadership: "Leadership";
        "Legendary Cyborg": "Legendary Cyborg";
        "Legendary Engineer": "Legendary Engineer";
        "Legendary Fabricator": "Legendary Fabricator";
        "Legendary Hacker": "Legendary Hacker";
        "Legendary Hauler": "Legendary Hauler";
        "Legendary Ranger": "Legendary Ranger";
        "Legendary Scout": "Legendary Scout";
        "Legendary Smuggler": "Legendary Smuggler";
        "Legendary Soldier": "Legendary Soldier";
        "Legendary Union Rep": "Legendary Union Rep";
        "Mech-Tech": "Mech-Tech";
        "Mechanical Knowledge": "Mechanical Knowledge";
        Ranger: "Ranger";
        Recon: "Recon";
        Salvaging: "Salvaging";
        Sleuth: "Sleuth";
        Smuggler: "Smuggler";
        Sniper: "Sniper";
        Survivalist: "Survivalist";
        "Tactical Warfare": "Tactical Warfare";
        Trading: "Trading";
        "Union Rep": "Union Rep";
    }>>;
}, z.core.$strict>, z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    hybrid: z.ZodOptional<z.ZodBoolean>;
    advancedTree: z.ZodEnum<{
        "Advanced Engineer": "Advanced Engineer";
        "Advanced Hacking": "Advanced Hacking";
        "Advanced Hauler": "Advanced Hauler";
        "Advanced Scout": "Advanced Scout";
        "Advanced Soldier": "Advanced Soldier";
        Augmentation: "Augmentation";
        Cyborg: "Cyborg";
        Electronics: "Electronics";
        Fabricator: "Fabricator";
        Forging: "Forging";
        Generic: "Generic";
        "Gladiatorial Combat": "Gladiatorial Combat";
        Hacking: "Hacking";
        Leadership: "Leadership";
        "Legendary Cyborg": "Legendary Cyborg";
        "Legendary Engineer": "Legendary Engineer";
        "Legendary Fabricator": "Legendary Fabricator";
        "Legendary Hacker": "Legendary Hacker";
        "Legendary Hauler": "Legendary Hauler";
        "Legendary Ranger": "Legendary Ranger";
        "Legendary Scout": "Legendary Scout";
        "Legendary Smuggler": "Legendary Smuggler";
        "Legendary Soldier": "Legendary Soldier";
        "Legendary Union Rep": "Legendary Union Rep";
        "Mech-Tech": "Mech-Tech";
        "Mechanical Knowledge": "Mechanical Knowledge";
        Ranger: "Ranger";
        Recon: "Recon";
        Salvaging: "Salvaging";
        Sleuth: "Sleuth";
        Smuggler: "Smuggler";
        Sniper: "Sniper";
        Survivalist: "Survivalist";
        "Tactical Warfare": "Tactical Warfare";
        Trading: "Trading";
        "Union Rep": "Union Rep";
    }>;
    legendaryTree: z.ZodEnum<{
        "Advanced Engineer": "Advanced Engineer";
        "Advanced Hacking": "Advanced Hacking";
        "Advanced Hauler": "Advanced Hauler";
        "Advanced Scout": "Advanced Scout";
        "Advanced Soldier": "Advanced Soldier";
        Augmentation: "Augmentation";
        Cyborg: "Cyborg";
        Electronics: "Electronics";
        Fabricator: "Fabricator";
        Forging: "Forging";
        Generic: "Generic";
        "Gladiatorial Combat": "Gladiatorial Combat";
        Hacking: "Hacking";
        Leadership: "Leadership";
        "Legendary Cyborg": "Legendary Cyborg";
        "Legendary Engineer": "Legendary Engineer";
        "Legendary Fabricator": "Legendary Fabricator";
        "Legendary Hacker": "Legendary Hacker";
        "Legendary Hauler": "Legendary Hauler";
        "Legendary Ranger": "Legendary Ranger";
        "Legendary Scout": "Legendary Scout";
        "Legendary Smuggler": "Legendary Smuggler";
        "Legendary Soldier": "Legendary Soldier";
        "Legendary Union Rep": "Legendary Union Rep";
        "Mech-Tech": "Mech-Tech";
        "Mechanical Knowledge": "Mechanical Knowledge";
        Ranger: "Ranger";
        Recon: "Recon";
        Salvaging: "Salvaging";
        Sleuth: "Sleuth";
        Smuggler: "Smuggler";
        Sniper: "Sniper";
        Survivalist: "Survivalist";
        "Tactical Warfare": "Tactical Warfare";
        Trading: "Trading";
        "Union Rep": "Union Rep";
    }>;
}, z.core.$strict>]>;
/**
 * Resource cost to build or add an upgrade bay to a Union Crawler.
 * Expansion "upgrade" bays (e.g. Bio-Mech Bay, Nanite Processing Bay) are
 * bought with a mix of Scrap (at a given Tech level) and/or Bio-Salvage.
 */
export declare const CrawlerBayCostSchema: z.ZodObject<{
    scrap: z.ZodOptional<z.ZodNumber>;
    scrapTechLevel: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>;
    bioSalvage: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
/**
 * Bays and facilities on Union Crawlers.
 *
 * Two shapes are supported:
 * - Core fixed facilities (Workshop Manual / Starter Set) have a crew `npc`
 *   and a `damagedEffect`.
 * - Expansion "upgrade" / found bays (e.g. Bio-Mech Bay, Nanite Processing Bay,
 *   Training Bay) are player-addable or scenario facilities with a build `cost`
 *   and/or `techLevel`, and typically no crew NPC or damaged effect.
 */
export declare const CrawlerBaySchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    expansion: z.ZodOptional<z.ZodBoolean>;
    damagedEffect: z.ZodOptional<z.ZodString>;
    npc: z.ZodOptional<z.ZodType<{
        position: string;
        content?: z.infer<typeof ContentSchema>;
        hitPoints: z.infer<typeof NonNegativeIntegerSchema>;
        choices?: z.infer<typeof ChoicesSchema>;
    }, unknown, z.core.$ZodTypeInternals<{
        position: string;
        content?: z.infer<typeof ContentSchema>;
        hitPoints: z.infer<typeof NonNegativeIntegerSchema>;
        choices?: z.infer<typeof ChoicesSchema>;
    }, unknown>>>;
    techLevel: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>;
    salvageValue: z.ZodOptional<z.ZodNumber>;
    cost: z.ZodOptional<z.ZodObject<{
        scrap: z.ZodOptional<z.ZodNumber>;
        scrapTechLevel: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>;
        bioSalvage: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
    choices: z.ZodOptional<z.ZodArray<z.ZodType<{
        id: string;
        name: string;
        choiceType?: "permanent" | "session" | "freeform";
        content?: z.infer<typeof ContentSchema>;
        rollTable?: string;
        schemaEntities?: string[];
        schema?: z.infer<typeof SchemaNameSchema>[];
        customSystemOptions?: z.infer<typeof SystemModuleSchema>[];
        setIndexable?: boolean;
        multiSelect?: boolean;
        choiceOptions?: z.infer<z.ZodObject<{
            label: z.ZodString;
            value: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                op: z.ZodLiteral<"addTrait">;
                value: z.ZodString;
                amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"removeTrait">;
                value: z.ZodString;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"setRange">;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"addDamage">;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                unit: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>], "op">>>;
        }, z.core.$strict>>[];
        constraints?: z.infer<z.ZodObject<{
            field: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            scalesWithField: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        source?: z.infer<z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"text">;
            multiline: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"table">;
            rollTable: z.ZodString;
            orChooseOwn: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"options">;
            options: z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                value: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
                effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                    op: z.ZodLiteral<"addTrait">;
                    value: z.ZodString;
                    amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"removeTrait">;
                    value: z.ZodString;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"setRange">;
                    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"addDamage">;
                    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                    unit: z.ZodOptional<z.ZodString>;
                }, z.core.$strict>], "op">>>;
            }, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"catalog">;
            schema: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                classes: "classes";
                npcs: "npcs";
                abilities: "abilities";
                "ability-tree-requirements": "ability-tree-requirements";
                chassis: "chassis";
                "crawler-bays": "crawler-bays";
                "crawler-tech-levels": "crawler-tech-levels";
                crawlers: "crawlers";
                creatures: "creatures";
                distances: "distances";
                drones: "drones";
                equipment: "equipment";
                guides: "guides";
                keywords: "keywords";
                factions: "factions";
                meld: "meld";
                modules: "modules";
                "roll-tables": "roll-tables";
                sources: "sources";
                squads: "squads";
                "tech-levels": "tech-levels";
                systems: "systems";
                "bio-titans": "bio-titans";
                traits: "traits";
                vehicles: "vehicles";
            }>>>;
            entities: z.ZodOptional<z.ZodArray<z.ZodString>>;
            filter: z.ZodOptional<z.ZodObject<{
                field: z.ZodOptional<z.ZodString>;
                min: z.ZodOptional<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
                damageType: z.ZodOptional<z.ZodEnum<{
                    HP: "HP";
                    SP: "SP";
                }>>;
            }, z.core.$strict>>;
            reveals: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"systemVariant">;
            options: z.ZodArray<z.ZodObject<{
                structurePoints: z.ZodOptional<z.ZodNumber>;
                energyPoints: z.ZodOptional<z.ZodNumber>;
                heatCapacity: z.ZodOptional<z.ZodNumber>;
                systemSlots: z.ZodOptional<z.ZodNumber>;
                moduleSlots: z.ZodOptional<z.ZodNumber>;
                cargoCapacity: z.ZodOptional<z.ZodNumber>;
                name: z.ZodOptional<z.ZodString>;
                techLevel: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>;
                slotsRequired: z.ZodNumber;
                salvageValue: z.ZodNumber;
                recommended: z.ZodOptional<z.ZodBoolean>;
                count: z.ZodOptional<z.ZodNumber>;
                statBonus: z.ZodOptional<z.ZodObject<{
                    structurePoints: z.ZodOptional<z.ZodNumber>;
                    energyPoints: z.ZodOptional<z.ZodNumber>;
                    heatCapacity: z.ZodOptional<z.ZodNumber>;
                    cargoCapacity: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strict>>;
                actions: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strict>], "kind">>;
        cardinality?: z.infer<z.ZodObject<{
            min: z.ZodNumber;
            max: z.ZodUnion<readonly [z.ZodNumber, z.ZodObject<{
                scalesWith: z.ZodString;
            }, z.core.$strict>]>;
        }, z.core.$strict>>;
        lifetime?: "permanent" | "session";
    }, unknown, z.core.$ZodTypeInternals<{
        id: string;
        name: string;
        choiceType?: "permanent" | "session" | "freeform";
        content?: z.infer<typeof ContentSchema>;
        rollTable?: string;
        schemaEntities?: string[];
        schema?: z.infer<typeof SchemaNameSchema>[];
        customSystemOptions?: z.infer<typeof SystemModuleSchema>[];
        setIndexable?: boolean;
        multiSelect?: boolean;
        choiceOptions?: z.infer<z.ZodObject<{
            label: z.ZodString;
            value: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                op: z.ZodLiteral<"addTrait">;
                value: z.ZodString;
                amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"removeTrait">;
                value: z.ZodString;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"setRange">;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"addDamage">;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                unit: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>], "op">>>;
        }, z.core.$strict>>[];
        constraints?: z.infer<z.ZodObject<{
            field: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            scalesWithField: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        source?: z.infer<z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"text">;
            multiline: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"table">;
            rollTable: z.ZodString;
            orChooseOwn: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"options">;
            options: z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                value: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
                effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                    op: z.ZodLiteral<"addTrait">;
                    value: z.ZodString;
                    amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"removeTrait">;
                    value: z.ZodString;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"setRange">;
                    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"addDamage">;
                    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                    unit: z.ZodOptional<z.ZodString>;
                }, z.core.$strict>], "op">>>;
            }, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"catalog">;
            schema: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                classes: "classes";
                npcs: "npcs";
                abilities: "abilities";
                "ability-tree-requirements": "ability-tree-requirements";
                chassis: "chassis";
                "crawler-bays": "crawler-bays";
                "crawler-tech-levels": "crawler-tech-levels";
                crawlers: "crawlers";
                creatures: "creatures";
                distances: "distances";
                drones: "drones";
                equipment: "equipment";
                guides: "guides";
                keywords: "keywords";
                factions: "factions";
                meld: "meld";
                modules: "modules";
                "roll-tables": "roll-tables";
                sources: "sources";
                squads: "squads";
                "tech-levels": "tech-levels";
                systems: "systems";
                "bio-titans": "bio-titans";
                traits: "traits";
                vehicles: "vehicles";
            }>>>;
            entities: z.ZodOptional<z.ZodArray<z.ZodString>>;
            filter: z.ZodOptional<z.ZodObject<{
                field: z.ZodOptional<z.ZodString>;
                min: z.ZodOptional<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
                damageType: z.ZodOptional<z.ZodEnum<{
                    HP: "HP";
                    SP: "SP";
                }>>;
            }, z.core.$strict>>;
            reveals: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"systemVariant">;
            options: z.ZodArray<z.ZodObject<{
                structurePoints: z.ZodOptional<z.ZodNumber>;
                energyPoints: z.ZodOptional<z.ZodNumber>;
                heatCapacity: z.ZodOptional<z.ZodNumber>;
                systemSlots: z.ZodOptional<z.ZodNumber>;
                moduleSlots: z.ZodOptional<z.ZodNumber>;
                cargoCapacity: z.ZodOptional<z.ZodNumber>;
                name: z.ZodOptional<z.ZodString>;
                techLevel: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>;
                slotsRequired: z.ZodNumber;
                salvageValue: z.ZodNumber;
                recommended: z.ZodOptional<z.ZodBoolean>;
                count: z.ZodOptional<z.ZodNumber>;
                statBonus: z.ZodOptional<z.ZodObject<{
                    structurePoints: z.ZodOptional<z.ZodNumber>;
                    energyPoints: z.ZodOptional<z.ZodNumber>;
                    heatCapacity: z.ZodOptional<z.ZodNumber>;
                    cargoCapacity: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strict>>;
                actions: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strict>], "kind">>;
        cardinality?: z.infer<z.ZodObject<{
            min: z.ZodNumber;
            max: z.ZodUnion<readonly [z.ZodNumber, z.ZodObject<{
                scalesWith: z.ZodString;
            }, z.core.$strict>]>;
        }, z.core.$strict>>;
        lifetime?: "permanent" | "session";
    }, unknown>>>>;
    tableName: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
/**
 * Tech levels for Union Crawlers
 */
export declare const CrawlerTechLevelSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    techLevel: z.ZodNumber;
    structurePoints: z.ZodNumber;
    upkeepCost: z.ZodNumber;
    upgradeCost: z.ZodNullable<z.ZodNumber>;
    populationMin: z.ZodNumber;
    populationMax: z.ZodNumber;
}, z.core.$strict>;
/**
 * Crawler vehicles
 */
export declare const CrawlerSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    npc: z.ZodType<{
        position: string;
        content?: z.infer<typeof ContentSchema>;
        hitPoints: z.infer<typeof NonNegativeIntegerSchema>;
        choices?: z.infer<typeof ChoicesSchema>;
    }, unknown, z.core.$ZodTypeInternals<{
        position: string;
        content?: z.infer<typeof ContentSchema>;
        hitPoints: z.infer<typeof NonNegativeIntegerSchema>;
        choices?: z.infer<typeof ChoicesSchema>;
    }, unknown>>;
    actions: z.ZodArray<z.ZodString>;
    mutations: z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodEnum<{
            weapon_slots: "weapon_slots";
            max_sp_bonus: "max_sp_bonus";
        }>;
        value: z.ZodNumber;
    }, z.core.$strict>>>;
}, z.core.$strict>;
/**
 * Creatures and wildlife
 */
export declare const CreatureSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    actions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    hitPoints: z.ZodNumber;
}, z.core.$strict>;
/**
 * Distances
 */
export declare const DistanceSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
}, z.core.$strict>;
/**
 * Tech level descriptions
 */
export declare const TechLevelEntitySchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    techLevel: z.ZodNumber;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
}, z.core.$strict>;
/**
 * Autonomous drones.
 *
 * Most drones are configured from `systems`, but some drone-class threats
 * (e.g. The Iron Lady) carry named `actions` — sometimes including a "Titanic
 * Actions" entry — and equipped `modules`, mirroring a mech statblock.
 */
export declare const DroneSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    structurePoints: z.ZodOptional<z.ZodNumber>;
    techLevel: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>;
    salvageValue: z.ZodOptional<z.ZodNumber>;
    systems: z.ZodOptional<z.ZodArray<z.ZodString>>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    systemSlots: z.ZodOptional<z.ZodNumber>;
    moduleSlots: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
    actions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    modules: z.ZodOptional<z.ZodArray<z.ZodString>>;
    choices: z.ZodOptional<z.ZodArray<z.ZodType<{
        id: string;
        name: string;
        choiceType?: "permanent" | "session" | "freeform";
        content?: z.infer<typeof ContentSchema>;
        rollTable?: string;
        schemaEntities?: string[];
        schema?: z.infer<typeof SchemaNameSchema>[];
        customSystemOptions?: z.infer<typeof SystemModuleSchema>[];
        setIndexable?: boolean;
        multiSelect?: boolean;
        choiceOptions?: z.infer<z.ZodObject<{
            label: z.ZodString;
            value: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                op: z.ZodLiteral<"addTrait">;
                value: z.ZodString;
                amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"removeTrait">;
                value: z.ZodString;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"setRange">;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"addDamage">;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                unit: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>], "op">>>;
        }, z.core.$strict>>[];
        constraints?: z.infer<z.ZodObject<{
            field: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            scalesWithField: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        source?: z.infer<z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"text">;
            multiline: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"table">;
            rollTable: z.ZodString;
            orChooseOwn: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"options">;
            options: z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                value: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
                effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                    op: z.ZodLiteral<"addTrait">;
                    value: z.ZodString;
                    amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"removeTrait">;
                    value: z.ZodString;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"setRange">;
                    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"addDamage">;
                    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                    unit: z.ZodOptional<z.ZodString>;
                }, z.core.$strict>], "op">>>;
            }, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"catalog">;
            schema: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                classes: "classes";
                npcs: "npcs";
                abilities: "abilities";
                "ability-tree-requirements": "ability-tree-requirements";
                chassis: "chassis";
                "crawler-bays": "crawler-bays";
                "crawler-tech-levels": "crawler-tech-levels";
                crawlers: "crawlers";
                creatures: "creatures";
                distances: "distances";
                drones: "drones";
                equipment: "equipment";
                guides: "guides";
                keywords: "keywords";
                factions: "factions";
                meld: "meld";
                modules: "modules";
                "roll-tables": "roll-tables";
                sources: "sources";
                squads: "squads";
                "tech-levels": "tech-levels";
                systems: "systems";
                "bio-titans": "bio-titans";
                traits: "traits";
                vehicles: "vehicles";
            }>>>;
            entities: z.ZodOptional<z.ZodArray<z.ZodString>>;
            filter: z.ZodOptional<z.ZodObject<{
                field: z.ZodOptional<z.ZodString>;
                min: z.ZodOptional<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
                damageType: z.ZodOptional<z.ZodEnum<{
                    HP: "HP";
                    SP: "SP";
                }>>;
            }, z.core.$strict>>;
            reveals: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"systemVariant">;
            options: z.ZodArray<z.ZodObject<{
                structurePoints: z.ZodOptional<z.ZodNumber>;
                energyPoints: z.ZodOptional<z.ZodNumber>;
                heatCapacity: z.ZodOptional<z.ZodNumber>;
                systemSlots: z.ZodOptional<z.ZodNumber>;
                moduleSlots: z.ZodOptional<z.ZodNumber>;
                cargoCapacity: z.ZodOptional<z.ZodNumber>;
                name: z.ZodOptional<z.ZodString>;
                techLevel: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>;
                slotsRequired: z.ZodNumber;
                salvageValue: z.ZodNumber;
                recommended: z.ZodOptional<z.ZodBoolean>;
                count: z.ZodOptional<z.ZodNumber>;
                statBonus: z.ZodOptional<z.ZodObject<{
                    structurePoints: z.ZodOptional<z.ZodNumber>;
                    energyPoints: z.ZodOptional<z.ZodNumber>;
                    heatCapacity: z.ZodOptional<z.ZodNumber>;
                    cargoCapacity: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strict>>;
                actions: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strict>], "kind">>;
        cardinality?: z.infer<z.ZodObject<{
            min: z.ZodNumber;
            max: z.ZodUnion<readonly [z.ZodNumber, z.ZodObject<{
                scalesWith: z.ZodString;
            }, z.core.$strict>]>;
        }, z.core.$strict>>;
        lifetime?: "permanent" | "session";
    }, unknown, z.core.$ZodTypeInternals<{
        id: string;
        name: string;
        choiceType?: "permanent" | "session" | "freeform";
        content?: z.infer<typeof ContentSchema>;
        rollTable?: string;
        schemaEntities?: string[];
        schema?: z.infer<typeof SchemaNameSchema>[];
        customSystemOptions?: z.infer<typeof SystemModuleSchema>[];
        setIndexable?: boolean;
        multiSelect?: boolean;
        choiceOptions?: z.infer<z.ZodObject<{
            label: z.ZodString;
            value: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                op: z.ZodLiteral<"addTrait">;
                value: z.ZodString;
                amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"removeTrait">;
                value: z.ZodString;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"setRange">;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"addDamage">;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                unit: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>], "op">>>;
        }, z.core.$strict>>[];
        constraints?: z.infer<z.ZodObject<{
            field: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            scalesWithField: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        source?: z.infer<z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"text">;
            multiline: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"table">;
            rollTable: z.ZodString;
            orChooseOwn: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"options">;
            options: z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                value: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
                effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                    op: z.ZodLiteral<"addTrait">;
                    value: z.ZodString;
                    amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"removeTrait">;
                    value: z.ZodString;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"setRange">;
                    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"addDamage">;
                    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                    unit: z.ZodOptional<z.ZodString>;
                }, z.core.$strict>], "op">>>;
            }, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"catalog">;
            schema: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                classes: "classes";
                npcs: "npcs";
                abilities: "abilities";
                "ability-tree-requirements": "ability-tree-requirements";
                chassis: "chassis";
                "crawler-bays": "crawler-bays";
                "crawler-tech-levels": "crawler-tech-levels";
                crawlers: "crawlers";
                creatures: "creatures";
                distances: "distances";
                drones: "drones";
                equipment: "equipment";
                guides: "guides";
                keywords: "keywords";
                factions: "factions";
                meld: "meld";
                modules: "modules";
                "roll-tables": "roll-tables";
                sources: "sources";
                squads: "squads";
                "tech-levels": "tech-levels";
                systems: "systems";
                "bio-titans": "bio-titans";
                traits: "traits";
                vehicles: "vehicles";
            }>>>;
            entities: z.ZodOptional<z.ZodArray<z.ZodString>>;
            filter: z.ZodOptional<z.ZodObject<{
                field: z.ZodOptional<z.ZodString>;
                min: z.ZodOptional<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
                damageType: z.ZodOptional<z.ZodEnum<{
                    HP: "HP";
                    SP: "SP";
                }>>;
            }, z.core.$strict>>;
            reveals: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"systemVariant">;
            options: z.ZodArray<z.ZodObject<{
                structurePoints: z.ZodOptional<z.ZodNumber>;
                energyPoints: z.ZodOptional<z.ZodNumber>;
                heatCapacity: z.ZodOptional<z.ZodNumber>;
                systemSlots: z.ZodOptional<z.ZodNumber>;
                moduleSlots: z.ZodOptional<z.ZodNumber>;
                cargoCapacity: z.ZodOptional<z.ZodNumber>;
                name: z.ZodOptional<z.ZodString>;
                techLevel: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>;
                slotsRequired: z.ZodNumber;
                salvageValue: z.ZodNumber;
                recommended: z.ZodOptional<z.ZodBoolean>;
                count: z.ZodOptional<z.ZodNumber>;
                statBonus: z.ZodOptional<z.ZodObject<{
                    structurePoints: z.ZodOptional<z.ZodNumber>;
                    energyPoints: z.ZodOptional<z.ZodNumber>;
                    heatCapacity: z.ZodOptional<z.ZodNumber>;
                    cargoCapacity: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strict>>;
                actions: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strict>], "kind">>;
        cardinality?: z.infer<z.ZodObject<{
            min: z.ZodNumber;
            max: z.ZodUnion<readonly [z.ZodNumber, z.ZodObject<{
                scalesWith: z.ZodString;
            }, z.core.$strict>]>;
        }, z.core.$strict>>;
        lifetime?: "permanent" | "session";
    }, unknown>>>>;
}, z.core.$strict>;
/**
 * Pilot equipment and gear
 */
export declare const EquipmentSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    structurePoints: z.ZodOptional<z.ZodNumber>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    systemSlots: z.ZodOptional<z.ZodNumber>;
    moduleSlots: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
    salvageValue: z.ZodOptional<z.ZodNumber>;
    techLevel: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>;
    actions: z.ZodArray<z.ZodString>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    bonusPerTechLevel: z.ZodOptional<z.ZodObject<{
        structurePoints: z.ZodOptional<z.ZodNumber>;
        energyPoints: z.ZodOptional<z.ZodNumber>;
        heatCapacity: z.ZodOptional<z.ZodNumber>;
        systemSlots: z.ZodOptional<z.ZodNumber>;
        moduleSlots: z.ZodOptional<z.ZodNumber>;
        cargoCapacity: z.ZodOptional<z.ZodNumber>;
        techLevel: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>;
        salvageValue: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    choices: z.ZodOptional<z.ZodArray<z.ZodType<{
        id: string;
        name: string;
        choiceType?: "permanent" | "session" | "freeform";
        content?: z.infer<typeof ContentSchema>;
        rollTable?: string;
        schemaEntities?: string[];
        schema?: z.infer<typeof SchemaNameSchema>[];
        customSystemOptions?: z.infer<typeof SystemModuleSchema>[];
        setIndexable?: boolean;
        multiSelect?: boolean;
        choiceOptions?: z.infer<z.ZodObject<{
            label: z.ZodString;
            value: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                op: z.ZodLiteral<"addTrait">;
                value: z.ZodString;
                amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"removeTrait">;
                value: z.ZodString;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"setRange">;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"addDamage">;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                unit: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>], "op">>>;
        }, z.core.$strict>>[];
        constraints?: z.infer<z.ZodObject<{
            field: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            scalesWithField: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        source?: z.infer<z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"text">;
            multiline: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"table">;
            rollTable: z.ZodString;
            orChooseOwn: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"options">;
            options: z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                value: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
                effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                    op: z.ZodLiteral<"addTrait">;
                    value: z.ZodString;
                    amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"removeTrait">;
                    value: z.ZodString;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"setRange">;
                    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"addDamage">;
                    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                    unit: z.ZodOptional<z.ZodString>;
                }, z.core.$strict>], "op">>>;
            }, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"catalog">;
            schema: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                classes: "classes";
                npcs: "npcs";
                abilities: "abilities";
                "ability-tree-requirements": "ability-tree-requirements";
                chassis: "chassis";
                "crawler-bays": "crawler-bays";
                "crawler-tech-levels": "crawler-tech-levels";
                crawlers: "crawlers";
                creatures: "creatures";
                distances: "distances";
                drones: "drones";
                equipment: "equipment";
                guides: "guides";
                keywords: "keywords";
                factions: "factions";
                meld: "meld";
                modules: "modules";
                "roll-tables": "roll-tables";
                sources: "sources";
                squads: "squads";
                "tech-levels": "tech-levels";
                systems: "systems";
                "bio-titans": "bio-titans";
                traits: "traits";
                vehicles: "vehicles";
            }>>>;
            entities: z.ZodOptional<z.ZodArray<z.ZodString>>;
            filter: z.ZodOptional<z.ZodObject<{
                field: z.ZodOptional<z.ZodString>;
                min: z.ZodOptional<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
                damageType: z.ZodOptional<z.ZodEnum<{
                    HP: "HP";
                    SP: "SP";
                }>>;
            }, z.core.$strict>>;
            reveals: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"systemVariant">;
            options: z.ZodArray<z.ZodObject<{
                structurePoints: z.ZodOptional<z.ZodNumber>;
                energyPoints: z.ZodOptional<z.ZodNumber>;
                heatCapacity: z.ZodOptional<z.ZodNumber>;
                systemSlots: z.ZodOptional<z.ZodNumber>;
                moduleSlots: z.ZodOptional<z.ZodNumber>;
                cargoCapacity: z.ZodOptional<z.ZodNumber>;
                name: z.ZodOptional<z.ZodString>;
                techLevel: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>;
                slotsRequired: z.ZodNumber;
                salvageValue: z.ZodNumber;
                recommended: z.ZodOptional<z.ZodBoolean>;
                count: z.ZodOptional<z.ZodNumber>;
                statBonus: z.ZodOptional<z.ZodObject<{
                    structurePoints: z.ZodOptional<z.ZodNumber>;
                    energyPoints: z.ZodOptional<z.ZodNumber>;
                    heatCapacity: z.ZodOptional<z.ZodNumber>;
                    cargoCapacity: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strict>>;
                actions: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strict>], "kind">>;
        cardinality?: z.infer<z.ZodObject<{
            min: z.ZodNumber;
            max: z.ZodUnion<readonly [z.ZodNumber, z.ZodObject<{
                scalesWith: z.ZodString;
            }, z.core.$strict>]>;
        }, z.core.$strict>>;
        lifetime?: "permanent" | "session";
    }, unknown, z.core.$ZodTypeInternals<{
        id: string;
        name: string;
        choiceType?: "permanent" | "session" | "freeform";
        content?: z.infer<typeof ContentSchema>;
        rollTable?: string;
        schemaEntities?: string[];
        schema?: z.infer<typeof SchemaNameSchema>[];
        customSystemOptions?: z.infer<typeof SystemModuleSchema>[];
        setIndexable?: boolean;
        multiSelect?: boolean;
        choiceOptions?: z.infer<z.ZodObject<{
            label: z.ZodString;
            value: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                op: z.ZodLiteral<"addTrait">;
                value: z.ZodString;
                amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"removeTrait">;
                value: z.ZodString;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"setRange">;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"addDamage">;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                unit: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>], "op">>>;
        }, z.core.$strict>>[];
        constraints?: z.infer<z.ZodObject<{
            field: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            scalesWithField: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        source?: z.infer<z.ZodDiscriminatedUnion<[z.ZodObject<{
            kind: z.ZodLiteral<"text">;
            multiline: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"table">;
            rollTable: z.ZodString;
            orChooseOwn: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"options">;
            options: z.ZodArray<z.ZodObject<{
                label: z.ZodString;
                value: z.ZodString;
                description: z.ZodOptional<z.ZodString>;
                effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                    op: z.ZodLiteral<"addTrait">;
                    value: z.ZodString;
                    amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"removeTrait">;
                    value: z.ZodString;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"setRange">;
                    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                }, z.core.$strict>, z.ZodObject<{
                    op: z.ZodLiteral<"addDamage">;
                    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                    unit: z.ZodOptional<z.ZodString>;
                }, z.core.$strict>], "op">>>;
            }, z.core.$strict>>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"catalog">;
            schema: z.ZodOptional<z.ZodArray<z.ZodEnum<{
                classes: "classes";
                npcs: "npcs";
                abilities: "abilities";
                "ability-tree-requirements": "ability-tree-requirements";
                chassis: "chassis";
                "crawler-bays": "crawler-bays";
                "crawler-tech-levels": "crawler-tech-levels";
                crawlers: "crawlers";
                creatures: "creatures";
                distances: "distances";
                drones: "drones";
                equipment: "equipment";
                guides: "guides";
                keywords: "keywords";
                factions: "factions";
                meld: "meld";
                modules: "modules";
                "roll-tables": "roll-tables";
                sources: "sources";
                squads: "squads";
                "tech-levels": "tech-levels";
                systems: "systems";
                "bio-titans": "bio-titans";
                traits: "traits";
                vehicles: "vehicles";
            }>>>;
            entities: z.ZodOptional<z.ZodArray<z.ZodString>>;
            filter: z.ZodOptional<z.ZodObject<{
                field: z.ZodOptional<z.ZodString>;
                min: z.ZodOptional<z.ZodNumber>;
                max: z.ZodOptional<z.ZodNumber>;
                damageType: z.ZodOptional<z.ZodEnum<{
                    HP: "HP";
                    SP: "SP";
                }>>;
            }, z.core.$strict>>;
            reveals: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strict>, z.ZodObject<{
            kind: z.ZodLiteral<"systemVariant">;
            options: z.ZodArray<z.ZodObject<{
                structurePoints: z.ZodOptional<z.ZodNumber>;
                energyPoints: z.ZodOptional<z.ZodNumber>;
                heatCapacity: z.ZodOptional<z.ZodNumber>;
                systemSlots: z.ZodOptional<z.ZodNumber>;
                moduleSlots: z.ZodOptional<z.ZodNumber>;
                cargoCapacity: z.ZodOptional<z.ZodNumber>;
                name: z.ZodOptional<z.ZodString>;
                techLevel: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>;
                slotsRequired: z.ZodNumber;
                salvageValue: z.ZodNumber;
                recommended: z.ZodOptional<z.ZodBoolean>;
                count: z.ZodOptional<z.ZodNumber>;
                statBonus: z.ZodOptional<z.ZodObject<{
                    structurePoints: z.ZodOptional<z.ZodNumber>;
                    energyPoints: z.ZodOptional<z.ZodNumber>;
                    heatCapacity: z.ZodOptional<z.ZodNumber>;
                    cargoCapacity: z.ZodOptional<z.ZodNumber>;
                }, z.core.$strict>>;
                actions: z.ZodArray<z.ZodString>;
            }, z.core.$strip>>;
        }, z.core.$strict>], "kind">>;
        cardinality?: z.infer<z.ZodObject<{
            min: z.ZodNumber;
            max: z.ZodUnion<readonly [z.ZodNumber, z.ZodObject<{
                scalesWith: z.ZodString;
            }, z.core.$strict>]>;
        }, z.core.$strict>>;
        lifetime?: "permanent" | "session";
    }, unknown>>>>;
}, z.core.$strict>;
/**
 * Faction groups and organizations
 */
export declare const FactionSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    goals: z.ZodString;
    assets: z.ZodString;
    weaknesses: z.ZodString;
    formation: z.ZodOptional<z.ZodArray<z.ZodObject<{
        chassis: z.ZodString;
        pattern: z.ZodOptional<z.ZodString>;
        schema: z.ZodOptional<z.ZodEnum<{
            classes: "classes";
            npcs: "npcs";
            abilities: "abilities";
            "ability-tree-requirements": "ability-tree-requirements";
            chassis: "chassis";
            "crawler-bays": "crawler-bays";
            "crawler-tech-levels": "crawler-tech-levels";
            crawlers: "crawlers";
            creatures: "creatures";
            distances: "distances";
            drones: "drones";
            equipment: "equipment";
            guides: "guides";
            keywords: "keywords";
            factions: "factions";
            meld: "meld";
            modules: "modules";
            "roll-tables": "roll-tables";
            sources: "sources";
            squads: "squads";
            "tech-levels": "tech-levels";
            systems: "systems";
            "bio-titans": "bio-titans";
            traits: "traits";
            vehicles: "vehicles";
        }>>;
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        page: z.ZodNumber;
        quantity: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
}, z.core.$strict>;
/**
 * Game keywords and terminology
 */
export declare const KeywordSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
}, z.core.$strict>;
/**
 * Meld-infected creatures
 */
export declare const MeldSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    actions: z.ZodArray<z.ZodString>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    salvageValue: z.ZodOptional<z.ZodNumber>;
    hitPoints: z.ZodOptional<z.ZodNumber>;
    structurePoints: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
/**
 * Mech modules
 */
export declare const ModuleSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    name: z.ZodString;
    structurePoints: z.ZodOptional<z.ZodNumber>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    systemSlots: z.ZodOptional<z.ZodNumber>;
    moduleSlots: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
    techLevel: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>;
    slotsRequired: z.ZodNumber;
    salvageValue: z.ZodNumber;
    recommended: z.ZodOptional<z.ZodBoolean>;
    count: z.ZodOptional<z.ZodNumber>;
    statBonus: z.ZodOptional<z.ZodObject<{
        structurePoints: z.ZodOptional<z.ZodNumber>;
        energyPoints: z.ZodOptional<z.ZodNumber>;
        heatCapacity: z.ZodOptional<z.ZodNumber>;
        cargoCapacity: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
    actions: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
/**
 * Non-player characters and people
 */
export declare const NPCSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    actions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    hitPoints: z.ZodNumber;
    damageType: z.ZodOptional<z.ZodEnum<{
        HP: "HP";
        SP: "SP";
    }>>;
    bioSalvageValue: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
/**
 * Random tables and roll tables
 */
export declare const RollTableSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    table: z.ZodDiscriminatedUnion<[z.ZodObject<{
        type: z.ZodLiteral<"standard">;
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11-19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6-10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2-5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"alternate">;
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '19-20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11-18': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6-10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2-5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"flat">;
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '3': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '4': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '7': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '8': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '9': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '12': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '13': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '14': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '15': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '16': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '17': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '18': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"dramatic">;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"duos">;
        '1-2': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '3-4': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '5-6': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '7-8': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '9-10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11-12': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '13-14': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '15-16': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '17-18': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '19-20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"bio-chassis">;
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2-3': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '4-5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6-8': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '9-10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11-19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"columns">;
        '1-4': z.ZodObject<{
            '1': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '2': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '3': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '4': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '5': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '6': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '7': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '8': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '9': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '10': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '11': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '12': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '13': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '14': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '15': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '16': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '17': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '18': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '19': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '20': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
        '5-8': z.ZodObject<{
            '1': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '2': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '3': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '4': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '5': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '6': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '7': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '8': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '9': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '10': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '11': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '12': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '13': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '14': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '15': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '16': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '17': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '18': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '19': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '20': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
        '9-12': z.ZodObject<{
            '1': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '2': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '3': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '4': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '5': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '6': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '7': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '8': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '9': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '10': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '11': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '12': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '13': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '14': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '15': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '16': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '17': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '18': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '19': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '20': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
        '13-16': z.ZodObject<{
            '1': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '2': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '3': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '4': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '5': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '6': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '7': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '8': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '9': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '10': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '11': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '12': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '13': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '14': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '15': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '16': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '17': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '18': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '19': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '20': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
        '17-20': z.ZodObject<{
            '1': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '2': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '3': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '4': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '5': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '6': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '7': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '8': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '9': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '10': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '11': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '12': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '13': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '14': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '15': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '16': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '17': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '18': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '19': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
            '20': z.ZodObject<{
                label: z.ZodOptional<z.ZodString>;
                value: z.ZodString;
            }, z.core.$strict>;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"salvage-cache">;
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2-3': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '4-5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6-7': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '8-9': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '10-11': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '12-13': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '14-15': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '16-17': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '18-19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>, z.ZodObject<{
        type: z.ZodLiteral<"octet">;
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2-4': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '5-7': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '8-10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11-13': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '14-16': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '17-19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>], "type">;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
}, z.core.$strict>;
/**
 * NPC squads and groups
 */
export declare const SquadSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    hitPoints: z.ZodOptional<z.ZodNumber>;
    actions: z.ZodArray<z.ZodString>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    damageType: z.ZodOptional<z.ZodEnum<{
        HP: "HP";
        SP: "SP";
    }>>;
}, z.core.$strict>;
/**
 * Mech systems
 */
export declare const SystemSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    name: z.ZodString;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    structurePoints: z.ZodOptional<z.ZodNumber>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    systemSlots: z.ZodOptional<z.ZodNumber>;
    moduleSlots: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
    techLevel: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>;
    slotsRequired: z.ZodNumber;
    salvageValue: z.ZodNumber;
    recommended: z.ZodOptional<z.ZodBoolean>;
    count: z.ZodOptional<z.ZodNumber>;
    statBonus: z.ZodOptional<z.ZodObject<{
        structurePoints: z.ZodOptional<z.ZodNumber>;
        energyPoints: z.ZodOptional<z.ZodNumber>;
        heatCapacity: z.ZodOptional<z.ZodNumber>;
        cargoCapacity: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
    actions: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
/**
 * Traits and special properties
 */
export declare const TraitEntitySchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
}, z.core.$strict>;
/**
 * Conventional vehicles.
 *
 * Unlike mechs, vehicles are not built from the system/module install economy:
 * their capabilities are expressed directly as named `actions`. The `systems`
 * field inherited from MechanicalEntitySchema is omitted here, and there is no
 * `modules` field — a vehicle carries neither (the schema is strict).
 */
export declare const VehicleSchema: z.ZodObject<{
    id: z.ZodString;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    structurePoints: z.ZodOptional<z.ZodNumber>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    systemSlots: z.ZodOptional<z.ZodNumber>;
    moduleSlots: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
    techLevel: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>;
    salvageValue: z.ZodOptional<z.ZodNumber>;
    name: z.ZodString;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    booklet: z.ZodOptional<z.ZodString>;
    page: z.ZodNumber;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    actions: z.ZodOptional<z.ZodArray<z.ZodString>>;
}, z.core.$strict>;
/**
 * Player-facing guides and processes (character creation, progression, downtime)
 */
export declare const GuideSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    guideType: z.ZodEnum<{
        "character-creation": "character-creation";
        "mech-creation": "mech-creation";
        "crawler-creation": "crawler-creation";
        progression: "progression";
        downtime: "downtime";
        gameplay: "gameplay";
    }>;
    guideColor: z.ZodDefault<z.ZodString>;
    steps: z.ZodArray<z.ZodType<{
        id: string;
        name: string;
        stepType: z.infer<z.ZodEnum<{
            freeform: "freeform";
            "select-one": "select-one";
            "select-many": "select-many";
            "roll-table": "roll-table";
            info: "info";
            "sub-guide": "sub-guide";
        }>>;
        section?: string;
        content?: z.infer<typeof ContentSchema>;
        schema?: z.infer<typeof import("./objects.js").SchemaNameWithActionsSchema>[];
        schemaEntities?: string[];
        schemaField?: string;
        rollTable?: string;
        choiceOptions?: z.infer<z.ZodObject<{
            label: z.ZodString;
            value: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                op: z.ZodLiteral<"addTrait">;
                value: z.ZodString;
                amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"removeTrait">;
                value: z.ZodString;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"setRange">;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"addDamage">;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                unit: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>], "op">>>;
        }, z.core.$strict>>[];
        filters?: z.infer<z.ZodObject<{
            field: z.ZodString;
            operator: z.ZodOptional<z.ZodEnum<{
                eq: "eq";
                ne: "ne";
            }>>;
            value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>[];
        constraints?: z.infer<z.ZodObject<{
            field: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            scalesWithField: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        dependsOn?: string[];
        contextFrom?: string;
        guideRef?: string;
        optional?: boolean;
        paperOnly?: boolean;
        entityLayout?: "sidebar";
    }, unknown, z.core.$ZodTypeInternals<{
        id: string;
        name: string;
        stepType: z.infer<z.ZodEnum<{
            freeform: "freeform";
            "select-one": "select-one";
            "select-many": "select-many";
            "roll-table": "roll-table";
            info: "info";
            "sub-guide": "sub-guide";
        }>>;
        section?: string;
        content?: z.infer<typeof ContentSchema>;
        schema?: z.infer<typeof import("./objects.js").SchemaNameWithActionsSchema>[];
        schemaEntities?: string[];
        schemaField?: string;
        rollTable?: string;
        choiceOptions?: z.infer<z.ZodObject<{
            label: z.ZodString;
            value: z.ZodString;
            description: z.ZodOptional<z.ZodString>;
            effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
                op: z.ZodLiteral<"addTrait">;
                value: z.ZodString;
                amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"removeTrait">;
                value: z.ZodString;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"setRange">;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
            }, z.core.$strict>, z.ZodObject<{
                op: z.ZodLiteral<"addDamage">;
                value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
                unit: z.ZodOptional<z.ZodString>;
            }, z.core.$strict>], "op">>>;
        }, z.core.$strict>>[];
        filters?: z.infer<z.ZodObject<{
            field: z.ZodString;
            operator: z.ZodOptional<z.ZodEnum<{
                eq: "eq";
                ne: "ne";
            }>>;
            value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>[];
        constraints?: z.infer<z.ZodObject<{
            field: z.ZodOptional<z.ZodString>;
            min: z.ZodOptional<z.ZodNumber>;
            max: z.ZodOptional<z.ZodNumber>;
            scalesWithField: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>;
        dependsOn?: string[];
        contextFrom?: string;
        guideRef?: string;
        optional?: boolean;
        paperOnly?: boolean;
        entityLayout?: "sidebar";
    }, unknown>>>;
    repeatable: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>;
/**
 * Source books and expansions
 */
export declare const SourceEntitySchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
        value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof import("./enums.js").ContentTypeSchema>;
            value?: string | z.infer<typeof import("./objects.js").DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    purchaseLink: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    verifiedAgainst: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
/**
 * Catalog categories for organizing schemas in the UI (meta schema, not a game entity)
 */
export declare const CatalogCategorySchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    schemas: z.ZodArray<z.ZodEnum<{
        classes: "classes";
        npcs: "npcs";
        abilities: "abilities";
        "ability-tree-requirements": "ability-tree-requirements";
        chassis: "chassis";
        "crawler-bays": "crawler-bays";
        "crawler-tech-levels": "crawler-tech-levels";
        crawlers: "crawlers";
        creatures: "creatures";
        distances: "distances";
        drones: "drones";
        equipment: "equipment";
        guides: "guides";
        keywords: "keywords";
        factions: "factions";
        meld: "meld";
        modules: "modules";
        "roll-tables": "roll-tables";
        sources: "sources";
        squads: "squads";
        "tech-levels": "tech-levels";
        systems: "systems";
        "bio-titans": "bio-titans";
        traits: "traits";
        vehicles: "vehicles";
    }>>;
    flat: z.ZodDefault<z.ZodBoolean>;
}, z.core.$strict>;
//# sourceMappingURL=entities.d.ts.map
// === lib/schemas/enums.d.ts ===
/**
 * Zod enum schemas from enums.schema.json
 */
import { z } from '../zod.js';
/**
 * The source book or expansion for this content
 */
export declare const SourceSchema: z.ZodEnum<{
    "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
    "Salvage Union Starter Set": "Salvage Union Starter Set";
    "Reclamation of the Wastes": "Reclamation of the Wastes";
    "The Hive": "The Hive";
    "Thatcher's Mech Base": "Thatcher's Mech Base";
    "Relics of a Time Gone By": "Relics of a Time Gone By";
    "Mech Monday": "Mech Monday";
    "We Were Here First!": "We Were Here First!";
    Rainmaker: "Rainmaker";
    "False Flag": "False Flag";
}>;
/**
 * Type of content block for rendering structured text
 */
export declare const ContentTypeSchema: z.ZodEnum<{
    paragraph: "paragraph";
    heading: "heading";
    "list-item": "list-item";
    label: "label";
    datavalues: "datavalues";
    hint: "hint";
    flavor: "flavor";
    choice: "choice";
}>;
/**
 * Individual range value
 */
export declare const RangeItemSchema: z.ZodEnum<{
    Close: "Close";
    Medium: "Medium";
    Long: "Long";
    Far: "Far";
}>;
/**
 * Range bands for abilities and weapons
 */
export declare const RangeSchema: z.ZodArray<z.ZodEnum<{
    Close: "Close";
    Medium: "Medium";
    Long: "Long";
    Far: "Far";
}>>;
/**
 * Type of action required to use an ability
 */
export declare const ActionTypeSchema: z.ZodEnum<{
    Long: "Long";
    Passive: "Passive";
    Free: "Free";
    Reaction: "Reaction";
    Turn: "Turn";
    Short: "Short";
    DownTime: "DownTime";
}>;
/**
 * Type of damage
 */
export declare const DamageTypeSchema: z.ZodEnum<{
    HP: "HP";
    SP: "SP";
}>;
/**
 * Type of advanced class
 */
export declare const ClassTypeSchema: z.ZodEnum<{
    Advanced: "Advanced";
    Hybrid: "Hybrid";
}>;
/**
 * Ability tree name
 */
export declare const TreeSchema: z.ZodEnum<{
    "Advanced Engineer": "Advanced Engineer";
    "Advanced Hacking": "Advanced Hacking";
    "Advanced Hauler": "Advanced Hauler";
    "Advanced Scout": "Advanced Scout";
    "Advanced Soldier": "Advanced Soldier";
    Augmentation: "Augmentation";
    Cyborg: "Cyborg";
    Electronics: "Electronics";
    Fabricator: "Fabricator";
    Forging: "Forging";
    Generic: "Generic";
    "Gladiatorial Combat": "Gladiatorial Combat";
    Hacking: "Hacking";
    Leadership: "Leadership";
    "Legendary Cyborg": "Legendary Cyborg";
    "Legendary Engineer": "Legendary Engineer";
    "Legendary Fabricator": "Legendary Fabricator";
    "Legendary Hacker": "Legendary Hacker";
    "Legendary Hauler": "Legendary Hauler";
    "Legendary Ranger": "Legendary Ranger";
    "Legendary Scout": "Legendary Scout";
    "Legendary Smuggler": "Legendary Smuggler";
    "Legendary Soldier": "Legendary Soldier";
    "Legendary Union Rep": "Legendary Union Rep";
    "Mech-Tech": "Mech-Tech";
    "Mechanical Knowledge": "Mechanical Knowledge";
    Ranger: "Ranger";
    Recon: "Recon";
    Salvaging: "Salvaging";
    Sleuth: "Sleuth";
    Smuggler: "Smuggler";
    Sniper: "Sniper";
    Survivalist: "Survivalist";
    "Tactical Warfare": "Tactical Warfare";
    Trading: "Trading";
    "Union Rep": "Union Rep";
}>;
/**
 * Name of the schema
 */
export declare const SchemaNameSchema: z.ZodEnum<{
    classes: "classes";
    npcs: "npcs";
    abilities: "abilities";
    "ability-tree-requirements": "ability-tree-requirements";
    chassis: "chassis";
    "crawler-bays": "crawler-bays";
    "crawler-tech-levels": "crawler-tech-levels";
    crawlers: "crawlers";
    creatures: "creatures";
    distances: "distances";
    drones: "drones";
    equipment: "equipment";
    guides: "guides";
    keywords: "keywords";
    factions: "factions";
    meld: "meld";
    modules: "modules";
    "roll-tables": "roll-tables";
    sources: "sources";
    squads: "squads";
    "tech-levels": "tech-levels";
    systems: "systems";
    "bio-titans": "bio-titans";
    traits: "traits";
    vehicles: "vehicles";
}>;
//# sourceMappingURL=enums.d.ts.map
// === lib/schemas/index.d.ts ===
/**
 * Schema index - exports all Zod schemas and inferred TypeScript types
 */
import type { z } from '../zod.js';
export * from './enums.js';
export * from './common.js';
export * from './objects.js';
export * from './entities.js';
import type { SourceSchema, ContentTypeSchema, RangeItemSchema, RangeSchema, ActionTypeSchema, DamageTypeSchema, ClassTypeSchema, TreeSchema, SchemaNameSchema } from './enums.js';
import type { IdSchema, NameSchema, NonNegativeIntegerSchema, PositiveIntegerSchema, ActivationCostSchema, TechLevelSchema } from './common.js';
import type { TraitSchema, StatsSchema, ChassisStatsSchema, EquipmentStatsSchema, CombatEntitySchema, MechanicalEntitySchema, DataValueSchema, ContentBlockSchema, ContentSchema, TableContentSchema, TableSchema, PatternSystemModuleSchema, MechStatBonusSchema, SystemModuleSchema, ChoiceSchema, ChoicesSchema, NpcSchema, PatternSchema, DamageSchema, ActionSchema, AdditionalSourceSchema, BaseEntitySchema, AdvancedClassSchema, FormationMechSchema, GrantSchema, CrawlerMutationSchema, SchemaNameWithActionsSchema, GuideStepSchema } from './objects.js';
import type { AbilitySchema, AbilityTreeRequirementSchema, MetaActionSchema, BioTitanSchema, ChassisSchema, ClassSchema, CrawlerBaySchema, CrawlerTechLevelSchema, CrawlerSchema, CreatureSchema, DistanceSchema, DroneSchema, EquipmentSchema, FactionSchema, KeywordSchema, MeldSchema, ModuleSchema, NPCSchema, RollTableSchema, SquadSchema, SystemSchema, TraitEntitySchema, VehicleSchema, GuideSchema, SourceEntitySchema, TechLevelEntitySchema, CatalogCategorySchema } from './entities.js';
export type SURefEnumSource = z.infer<typeof SourceSchema>;
export type SURefEnumContentType = z.infer<typeof ContentTypeSchema>;
export type SURefEnumRangeItem = z.infer<typeof RangeItemSchema>;
export type SURefEnumRange = z.infer<typeof RangeSchema>;
export type SURefEnumActionType = z.infer<typeof ActionTypeSchema>;
export type SURefEnumDamageType = z.infer<typeof DamageTypeSchema>;
export type SURefEnumClassType = z.infer<typeof ClassTypeSchema>;
export type SURefEnumTree = z.infer<typeof TreeSchema>;
export type SURefEnumSchemaName = z.infer<typeof SchemaNameSchema>;
export type SURefCommonId = z.infer<typeof IdSchema>;
export type SURefCommonName = z.infer<typeof NameSchema>;
export type SURefCommonNonNegativeInteger = z.infer<typeof NonNegativeIntegerSchema>;
export type SURefCommonPositiveInteger = z.infer<typeof PositiveIntegerSchema>;
export type SURefCommonActivationCost = z.infer<typeof ActivationCostSchema>;
export type SURefCommonTechLevel = z.infer<typeof TechLevelSchema>;
export type SURefCommonSalvageValue = z.infer<typeof NonNegativeIntegerSchema>;
export type SURefCommonHitPoints = z.infer<typeof NonNegativeIntegerSchema>;
export type SURefCommonStructurePoints = z.infer<typeof PositiveIntegerSchema>;
export type SURefObjectTrait = z.infer<typeof TraitSchema>;
export type SURefObjectStats = z.infer<typeof StatsSchema>;
export type SURefObjectChassisStats = z.infer<typeof ChassisStatsSchema>;
export type SURefObjectEquipmentStats = z.infer<typeof EquipmentStatsSchema>;
export type SURefObjectCombatEntity = z.infer<typeof CombatEntitySchema>;
export type SURefObjectMechanicalEntity = z.infer<typeof MechanicalEntitySchema>;
export type SURefObjectDataValue = z.infer<typeof DataValueSchema>;
export type SURefObjectContentBlock = z.infer<typeof ContentBlockSchema>;
export type SURefObjectContent = z.infer<typeof ContentSchema>;
export type SURefObjectTableContent = z.infer<typeof TableContentSchema>;
export type SURefObjectTable = z.infer<typeof TableSchema>;
export type SURefObjectPatternSystemModule = z.infer<typeof PatternSystemModuleSchema>;
export type SURefObjectMechStatBonus = z.infer<typeof MechStatBonusSchema>;
export type SURefObjectSystemModule = z.infer<typeof SystemModuleSchema>;
export type SURefObjectChoice = z.infer<typeof ChoiceSchema>;
export type SURefObjectChoices = z.infer<typeof ChoicesSchema>;
export type SURefObjectNpc = z.infer<typeof NpcSchema>;
export type SURefObjectPattern = z.infer<typeof PatternSchema>;
export type SURefObjectDamage = z.infer<typeof DamageSchema>;
export type SURefObjectAction = z.infer<typeof ActionSchema>;
export type SURefObjectAdditionalSource = z.infer<typeof AdditionalSourceSchema>;
export type SURefObjectBaseEntity = z.infer<typeof BaseEntitySchema>;
export type SURefObjectBonusPerTechLevel = z.infer<typeof StatsSchema>;
export type SURefObjectAdvancedClass = z.infer<typeof AdvancedClassSchema>;
export type SURefObjectFormationMech = z.infer<typeof FormationMechSchema>;
export type SURefObjectGrant = z.infer<typeof GrantSchema>;
export type SURefObjectCrawlerMutation = z.infer<typeof CrawlerMutationSchema>;
export type SURefObjectSchemaName = z.infer<typeof SchemaNameWithActionsSchema>;
export type SURefObjectGuideStep = z.infer<typeof GuideStepSchema>;
export type SURefObjectTraits = SURefObjectTrait[];
export type SURefObjectSystems = string[];
export type SURefObjectModules = string[];
export type SURefObjectActionOptions = Array<{
    label: string;
    value: string;
}>;
export type SURefAbility = z.infer<typeof AbilitySchema>;
export type SURefMetaAbilityTreeRequirement = z.infer<typeof AbilityTreeRequirementSchema>;
export type SURefMetaAction = z.infer<typeof MetaActionSchema>;
export type SURefBioTitan = z.infer<typeof BioTitanSchema>;
export type SURefChassis = z.infer<typeof ChassisSchema>;
export type SURefClass = z.infer<typeof ClassSchema>;
export type SURefCrawlerBay = z.infer<typeof CrawlerBaySchema>;
export type SURefMetaCrawlerTechLevel = z.infer<typeof CrawlerTechLevelSchema>;
export type SURefCrawler = z.infer<typeof CrawlerSchema>;
export type SURefCreature = z.infer<typeof CreatureSchema>;
export type SURefDistance = z.infer<typeof DistanceSchema>;
export type SURefDrone = z.infer<typeof DroneSchema>;
export type SURefEquipment = z.infer<typeof EquipmentSchema>;
export type SURefFaction = z.infer<typeof FactionSchema>;
export type SURefKeyword = z.infer<typeof KeywordSchema>;
export type SURefMeld = z.infer<typeof MeldSchema>;
export type SURefModule = z.infer<typeof ModuleSchema>;
export type SURefNPC = z.infer<typeof NPCSchema>;
export type SURefRollTable = z.infer<typeof RollTableSchema>;
export type SURefSquad = z.infer<typeof SquadSchema>;
export type SURefSystem = z.infer<typeof SystemSchema>;
export type SURefTrait = z.infer<typeof TraitEntitySchema>;
export type SURefVehicle = z.infer<typeof VehicleSchema>;
export type SURefGuide = z.infer<typeof GuideSchema>;
export type SURefSource = z.infer<typeof SourceEntitySchema>;
export type SURefTechLevel = z.infer<typeof TechLevelEntitySchema>;
export type SURefCatalogCategory = z.infer<typeof CatalogCategorySchema>;
export type SURefEntity = SURefAbility | SURefChassis | SURefClass | SURefCrawler | SURefCrawlerBay | SURefCreature | SURefDistance | SURefDrone | SURefEquipment | SURefFaction | SURefGuide | SURefKeyword | SURefMeld | SURefModule | SURefNPC | SURefRollTable | SURefSource | SURefSquad | SURefSystem | SURefTechLevel | SURefBioTitan | SURefTrait | SURefVehicle;
export type SURefMetaEntity = SURefAbility | SURefChassis | SURefClass | SURefCrawler | SURefCrawlerBay | SURefCreature | SURefDistance | SURefDrone | SURefEquipment | SURefFaction | SURefKeyword | SURefMeld | SURefMetaAbilityTreeRequirement | SURefMetaAction | SURefMetaCrawlerTechLevel | SURefGuide | SURefSource | SURefTechLevel | SURefBioTitan | SURefModule | SURefNPC | SURefRollTable | SURefSquad | SURefSystem | SURefTrait | SURefVehicle;
//# sourceMappingURL=index.d.ts.map
// === lib/schemas/objects.d.ts ===
/**
 * Zod object schemas from objects.schema.json
 */
import { z } from '../zod.js';
import { NonNegativeIntegerSchema, PositiveIntegerSchema, TechLevelSchema, ActivationCostSchema } from './common.js';
import { SourceSchema, ContentTypeSchema, RangeSchema, ActionTypeSchema, SchemaNameSchema } from './enums.js';
/**
 * Special traits and properties of items, systems, or abilities
 */
export declare const TraitSchema: z.ZodObject<{
    amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
    type: z.ZodString;
}, z.core.$strict>;
/**
 * Statistics for mechs, chassis, and vehicles
 */
export declare const StatsSchema: z.ZodObject<{
    structurePoints: z.ZodOptional<z.ZodNumber>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    systemSlots: z.ZodOptional<z.ZodNumber>;
    moduleSlots: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
    techLevel: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>;
    salvageValue: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/**
 * Statistics specific to chassis — all stats required
 */
export declare const ChassisStatsSchema: z.ZodObject<{
    structurePoints: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    energyPoints: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    heatCapacity: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    systemSlots: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    moduleSlots: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    cargoCapacity: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
    techLevel: z.ZodNonOptional<z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>>;
    salvageValue: z.ZodNonOptional<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
/**
 * Statistics for equipment (systems and modules)
 */
export declare const EquipmentStatsSchema: z.ZodObject<{
    techLevel: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>;
    salvageValue: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/**
 * Entity that can perform actions and has traits
 */
export declare const CombatEntitySchema: z.ZodObject<{
    actions: z.ZodOptional<z.ZodArray<z.ZodString>>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
}, z.core.$strip>;
/**
 * Mechanical entity with structure points and equipment stats
 */
export declare const MechanicalEntitySchema: z.ZodObject<{
    structurePoints: z.ZodOptional<z.ZodNumber>;
    techLevel: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>>;
    salvageValue: z.ZodOptional<z.ZodNumber>;
    systems: z.ZodOptional<z.ZodArray<z.ZodString>>;
    traits: z.ZodOptional<z.ZodArray<z.ZodObject<{
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>>;
        type: z.ZodString;
    }, z.core.$strict>>>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    systemSlots: z.ZodOptional<z.ZodNumber>;
    moduleSlots: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/**
 * A data value with label, optional value, and optional type
 */
export declare const DataValueSchema: z.ZodObject<{
    label: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    type: z.ZodOptional<z.ZodString>;
    unit: z.ZodOptional<z.ZodString>;
    perTechLevel: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
/**
 * Block of structured content for rendering (paragraph, heading, list item, etc.)
 * Note: Using z.lazy() for recursive structure
 */
export declare const ContentBlockSchema: z.ZodType<{
    type?: z.infer<typeof ContentTypeSchema>;
    value?: string | z.infer<typeof DataValueSchema>[];
    label?: string;
    level?: number;
    lead?: boolean;
    choiceId?: string;
    items?: Array<{
        type?: z.infer<typeof ContentTypeSchema>;
        value?: string | z.infer<typeof DataValueSchema>[];
        label?: string;
        level?: number;
    }>;
}>;
/**
 * Array of content blocks
 */
export declare const ContentSchema: z.ZodArray<z.ZodType<{
    type?: z.infer<typeof ContentTypeSchema>;
    value?: string | z.infer<typeof DataValueSchema>[];
    label?: string;
    level?: number;
    lead?: boolean;
    choiceId?: string;
    items?: Array<{
        type?: z.infer<typeof ContentTypeSchema>;
        value?: string | z.infer<typeof DataValueSchema>[];
        label?: string;
        level?: number;
    }>;
}, unknown, z.core.$ZodTypeInternals<{
    type?: z.infer<typeof ContentTypeSchema>;
    value?: string | z.infer<typeof DataValueSchema>[];
    label?: string;
    level?: number;
    lead?: boolean;
    choiceId?: string;
    items?: Array<{
        type?: z.infer<typeof ContentTypeSchema>;
        value?: string | z.infer<typeof DataValueSchema>[];
        label?: string;
        level?: number;
    }>;
}, unknown>>>;
/**
 * Table content with label and value
 */
export declare const TableContentSchema: z.ZodObject<{
    label: z.ZodOptional<z.ZodString>;
    value: z.ZodString;
}, z.core.$strict>;
/**
 * Roll table discriminated union for random outcomes based on d20 rolls
 */
export declare const TableSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"standard">;
    '1': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '20': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '11-19': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '6-10': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '2-5': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"alternate">;
    '1': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '19-20': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '11-18': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '6-10': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '2-5': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"flat">;
    '1': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '2': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '3': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '4': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '5': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '6': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '7': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '8': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '9': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '10': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '11': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '12': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '13': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '14': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '15': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '16': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '17': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '18': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '19': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '20': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"dramatic">;
    '20': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"duos">;
    '1-2': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '3-4': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '5-6': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '7-8': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '9-10': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '11-12': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '13-14': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '15-16': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '17-18': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '19-20': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"bio-chassis">;
    '1': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '2-3': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '4-5': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '6-8': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '9-10': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '11-19': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '20': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"columns">;
    '1-4': z.ZodObject<{
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '3': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '4': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '7': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '8': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '9': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '12': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '13': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '14': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '15': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '16': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '17': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '18': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>;
    '5-8': z.ZodObject<{
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '3': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '4': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '7': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '8': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '9': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '12': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '13': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '14': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '15': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '16': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '17': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '18': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>;
    '9-12': z.ZodObject<{
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '3': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '4': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '7': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '8': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '9': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '12': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '13': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '14': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '15': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '16': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '17': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '18': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>;
    '13-16': z.ZodObject<{
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '3': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '4': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '7': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '8': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '9': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '12': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '13': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '14': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '15': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '16': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '17': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '18': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>;
    '17-20': z.ZodObject<{
        '1': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '2': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '3': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '4': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '5': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '6': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '7': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '8': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '9': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '10': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '11': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '12': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '13': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '14': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '15': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '16': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '17': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '18': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '19': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
        '20': z.ZodObject<{
            label: z.ZodOptional<z.ZodString>;
            value: z.ZodString;
        }, z.core.$strict>;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"salvage-cache">;
    '1': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '2-3': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '4-5': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '6-7': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '8-9': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '10-11': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '12-13': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '14-15': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '16-17': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '18-19': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '20': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>, z.ZodObject<{
    type: z.ZodLiteral<"octet">;
    '1': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '2-4': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '5-7': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '8-10': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '11-13': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '14-16': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '17-19': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
    '20': z.ZodObject<{
        label: z.ZodOptional<z.ZodString>;
        value: z.ZodString;
    }, z.core.$strict>;
}, z.core.$strict>], "type">;
/**
 * Pattern system/module configuration
 */
export declare const PatternSystemModuleSchema: z.ZodObject<{
    name: z.ZodString;
    count: z.ZodOptional<z.ZodNumber>;
    preselectedChoices: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.core.$strict>;
/**
 * Explicit, per-installed-item bonuses a system/module applies to a mech's
 * derived core maxima. Each field is the FLAT amount this one installed item
 * adds to the corresponding mech maximum; consumers sum (bonus × installed
 * count) across all installed systems/modules.
 *
 * This is deliberately distinct from the absolute-stat fields in StatsSchema
 * (which describe an entity's own stats): these are signed modifiers applied to
 * the host mech. Only populate items whose rule text states a flat numeric
 * core-stat change (e.g. Cargo Pod +1 Cargo Capacity, Heat Sink +1 Max Heat,
 * Capacitance Bank +2 EP). Items with prose-only or conditional benefits get
 * no bonus data — never infer a number from prose.
 */
export declare const MechStatBonusSchema: z.ZodObject<{
    structurePoints: z.ZodOptional<z.ZodNumber>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
/**
 * A system or module that can be installed on a mech
 */
export declare const SystemModuleSchema: z.ZodObject<{
    structurePoints: z.ZodOptional<z.ZodNumber>;
    energyPoints: z.ZodOptional<z.ZodNumber>;
    heatCapacity: z.ZodOptional<z.ZodNumber>;
    systemSlots: z.ZodOptional<z.ZodNumber>;
    moduleSlots: z.ZodOptional<z.ZodNumber>;
    cargoCapacity: z.ZodOptional<z.ZodNumber>;
    name: z.ZodOptional<z.ZodString>;
    techLevel: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>;
    slotsRequired: z.ZodNumber;
    salvageValue: z.ZodNumber;
    recommended: z.ZodOptional<z.ZodBoolean>;
    count: z.ZodOptional<z.ZodNumber>;
    statBonus: z.ZodOptional<z.ZodObject<{
        structurePoints: z.ZodOptional<z.ZodNumber>;
        energyPoints: z.ZodOptional<z.ZodNumber>;
        heatCapacity: z.ZodOptional<z.ZodNumber>;
        cargoCapacity: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strict>>;
    actions: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
/**
 * Choice effect schema — describes a mechanical effect applied when a choice option is selected
 */
/**
 * A single mechanical effect of a choice option, discriminated by `op` so each
 * operation only permits the fields it actually uses (no `removeTrait` with an
 * `amount`, no `addDamage` with an `amount`, etc.):
 *
 * - `addTrait`    — add a trait by name; optional `amount` is its magnitude
 *                   (e.g. Burn 1). Adding a trait that already exists upgrades it.
 * - `removeTrait` — strip a trait by name.
 * - `setRange`    — replace the Range datavalue.
 * - `addDamage`   — increase the Damage datavalue; optional `unit` (e.g. "SP").
 */
export declare const ChoiceEffectSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    op: z.ZodLiteral<"addTrait">;
    value: z.ZodString;
    amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
}, z.core.$strict>, z.ZodObject<{
    op: z.ZodLiteral<"removeTrait">;
    value: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    op: z.ZodLiteral<"setRange">;
    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
}, z.core.$strict>, z.ZodObject<{
    op: z.ZodLiteral<"addDamage">;
    value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    unit: z.ZodOptional<z.ZodString>;
}, z.core.$strict>], "op">;
/**
 * Choice options schema
 */
declare const ChoiceOptionSchema: z.ZodObject<{
    label: z.ZodString;
    value: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        op: z.ZodLiteral<"addTrait">;
        value: z.ZodString;
        amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"removeTrait">;
        value: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"setRange">;
        value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
    }, z.core.$strict>, z.ZodObject<{
        op: z.ZodLiteral<"addDamage">;
        value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
        unit: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>], "op">>>;
}, z.core.$strict>;
/**
 * Choice constraints schema
 */
declare const ChoiceConstraintsSchema: z.ZodObject<{
    field: z.ZodOptional<z.ZodString>;
    min: z.ZodOptional<z.ZodNumber>;
    max: z.ZodOptional<z.ZodNumber>;
    scalesWithField: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
/**
 * Choice cardinality — how many picks a choice grants.
 * `max` is either a fixed number or `{ scalesWith }`, a field name resolved on
 * the parent entity (e.g. `techLevel`). Replaces `multiSelect` +
 * `constraints.min/max` + `constraints.scalesWithField`.
 */
declare const CardinalitySchema: z.ZodObject<{
    min: z.ZodNumber;
    max: z.ZodUnion<readonly [z.ZodNumber, z.ZodObject<{
        scalesWith: z.ZodString;
    }, z.core.$strict>]>;
}, z.core.$strict>;
/**
 * Choice source — the discriminated "where do the options come from" axis
 * ([ADR ref] the unified choice model). Exactly one `kind`; the renderer
 * switches on it and never probes optional fields.
 *
 * - `text`          — a free-text field (was: no option source).
 * - `table`         — roll on a named table, or choose your own.
 * - `options`       — an inline structured option list (was: choiceOptions).
 * - `catalog`       — pick a card-bearing entity from schema collection(s),
 *                     optionally a named shortlist and/or a filter (a numeric
 *                     `field` range, or `damageType` — keep only systems whose
 *                     actions deal that damage type, i.e. Weapons Systems);
 *                     `reveals` flips index visibility (was: setIndexable).
 *                     Schema-only (no shortlist) → resolved to an entity listing.
 * - `systemVariant` — pick from inline custom System/Module variants.
 */
declare const ChoiceSourceSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"text">;
    multiline: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"table">;
    rollTable: z.ZodString;
    orChooseOwn: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"options">;
    options: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        value: z.ZodString;
        description: z.ZodOptional<z.ZodString>;
        effects: z.ZodOptional<z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
            op: z.ZodLiteral<"addTrait">;
            value: z.ZodString;
            amount: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"removeTrait">;
            value: z.ZodString;
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"setRange">;
            value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
        }, z.core.$strict>, z.ZodObject<{
            op: z.ZodLiteral<"addDamage">;
            value: z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>;
            unit: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>], "op">>>;
    }, z.core.$strict>>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"catalog">;
    schema: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        classes: "classes";
        npcs: "npcs";
        abilities: "abilities";
        "ability-tree-requirements": "ability-tree-requirements";
        chassis: "chassis";
        "crawler-bays": "crawler-bays";
        "crawler-tech-levels": "crawler-tech-levels";
        crawlers: "crawlers";
        creatures: "creatures";
        distances: "distances";
        drones: "drones";
        equipment: "equipment";
        guides: "guides";
        keywords: "keywords";
        factions: "factions";
        meld: "meld";
        modules: "modules";
        "roll-tables": "roll-tables";
        sources: "sources";
        squads: "squads";
        "tech-levels": "tech-levels";
        systems: "systems";
        "bio-titans": "bio-titans";
        traits: "traits";
        vehicles: "vehicles";
    }>>>;
    entities: z.ZodOptional<z.ZodArray<z.ZodString>>;
    filter: z.ZodOptional<z.ZodObject<{
        field: z.ZodOptional<z.ZodString>;
        min: z.ZodOptional<z.ZodNumber>;
        max: z.ZodOptional<z.ZodNumber>;
        damageType: z.ZodOptional<z.ZodEnum<{
            HP: "HP";
            SP: "SP";
        }>>;
    }, z.core.$strict>>;
    reveals: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>, z.ZodObject<{
    kind: z.ZodLiteral<"systemVariant">;
    options: z.ZodArray<z.ZodObject<{
        structurePoints: z.ZodOptional<z.ZodNumber>;
        energyPoints: z.ZodOptional<z.ZodNumber>;
        heatCapacity: z.ZodOptional<z.ZodNumber>;
        systemSlots: z.ZodOptional<z.ZodNumber>;
        moduleSlots: z.ZodOptional<z.ZodNumber>;
        cargoCapacity: z.ZodOptional<z.ZodNumber>;
        name: z.ZodOptional<z.ZodString>;
        techLevel: z.ZodUnion<readonly [z.ZodNumber, z.ZodLiteral<"B">, z.ZodLiteral<"N">]>;
        slotsRequired: z.ZodNumber;
        salvageValue: z.ZodNumber;
        recommended: z.ZodOptional<z.ZodBoolean>;
        count: z.ZodOptional<z.ZodNumber>;
        statBonus: z.ZodOptional<z.ZodObject<{
            structurePoints: z.ZodOptional<z.ZodNumber>;
            energyPoints: z.ZodOptional<z.ZodNumber>;
            heatCapacity: z.ZodOptional<z.ZodNumber>;
            cargoCapacity: z.ZodOptional<z.ZodNumber>;
        }, z.core.$strict>>;
        actions: z.ZodArray<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strict>], "kind">;
/**
 * Choice schema (using z.lazy() for recursive reference to ContentSchema)
 */
export declare const ChoiceSchema: z.ZodType<{
    id: string;
    name: string;
    choiceType?: 'permanent' | 'session' | 'freeform';
    content?: z.infer<typeof ContentSchema>;
    rollTable?: string;
    schemaEntities?: string[];
    schema?: z.infer<typeof SchemaNameSchema>[];
    customSystemOptions?: z.infer<typeof SystemModuleSchema>[];
    setIndexable?: boolean;
    multiSelect?: boolean;
    choiceOptions?: z.infer<typeof ChoiceOptionSchema>[];
    constraints?: z.infer<typeof ChoiceConstraintsSchema>;
    source?: z.infer<typeof ChoiceSourceSchema>;
    cardinality?: z.infer<typeof CardinalitySchema>;
    lifetime?: 'permanent' | 'session';
}>;
/**
 * Array of choices
 */
export declare const ChoicesSchema: z.ZodArray<z.ZodType<{
    id: string;
    name: string;
    choiceType?: "permanent" | "session" | "freeform";
    content?: z.infer<typeof ContentSchema>;
    rollTable?: string;
    schemaEntities?: string[];
    schema?: z.infer<typeof SchemaNameSchema>[];
    customSystemOptions?: z.infer<typeof SystemModuleSchema>[];
    setIndexable?: boolean;
    multiSelect?: boolean;
    choiceOptions?: z.infer<typeof ChoiceOptionSchema>[];
    constraints?: z.infer<typeof ChoiceConstraintsSchema>;
    source?: z.infer<typeof ChoiceSourceSchema>;
    cardinality?: z.infer<typeof CardinalitySchema>;
    lifetime?: "permanent" | "session";
}, unknown, z.core.$ZodTypeInternals<{
    id: string;
    name: string;
    choiceType?: "permanent" | "session" | "freeform";
    content?: z.infer<typeof ContentSchema>;
    rollTable?: string;
    schemaEntities?: string[];
    schema?: z.infer<typeof SchemaNameSchema>[];
    customSystemOptions?: z.infer<typeof SystemModuleSchema>[];
    setIndexable?: boolean;
    multiSelect?: boolean;
    choiceOptions?: z.infer<typeof ChoiceOptionSchema>[];
    constraints?: z.infer<typeof ChoiceConstraintsSchema>;
    source?: z.infer<typeof ChoiceSourceSchema>;
    cardinality?: z.infer<typeof CardinalitySchema>;
    lifetime?: "permanent" | "session";
}, unknown>>>;
/**
 * NPC associated with an entity
 */
export declare const NpcSchema: z.ZodType<{
    position: string;
    content?: z.infer<typeof ContentSchema>;
    hitPoints: z.infer<typeof NonNegativeIntegerSchema>;
    choices?: z.infer<typeof ChoicesSchema>;
}>;
/**
 * Named drone configuration for patterns with multiple drones
 */
export declare const PatternDroneConfigSchema: z.ZodObject<{
    name: z.ZodString;
    systems: z.ZodArray<z.ZodString>;
    modules: z.ZodArray<z.ZodString>;
}, z.core.$strict>;
/**
 * Pattern schema (using z.lazy() for recursive reference)
 */
export declare const PatternSchema: z.ZodType<{
    name: string;
    content?: z.infer<typeof ContentSchema>;
    legalStarting?: boolean;
    source?: z.infer<typeof SourceSchema>;
    page?: z.infer<typeof PositiveIntegerSchema>;
    booklet?: string;
    additionalSources?: z.infer<typeof AdditionalSourceSchema>[];
    systems: z.infer<typeof PatternSystemModuleSchema>[];
    modules: z.infer<typeof PatternSystemModuleSchema>[];
    drones?: z.infer<typeof PatternDroneConfigSchema>[];
}>;
/**
 * Damage schema
 */
export declare const DamageSchema: z.ZodObject<{
    damageType: z.ZodEnum<{
        HP: "HP";
        SP: "SP";
    }>;
    amount: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
}, z.core.$strict>;
/**
 * Activation currency enum
 */
declare const ActivationCurrencySchema: z.ZodEnum<{
    "EP or AP": "EP or AP";
    "SP or HP": "SP or HP";
    Variable: "Variable";
}>;
/**
 * Action schema (using z.lazy() for recursive references)
 */
export declare const ActionSchema: z.ZodType<{
    id: string;
    name: string;
    content?: z.infer<typeof ContentSchema>;
    structurePoints?: number;
    energyPoints?: number;
    heatCapacity?: number;
    systemSlots?: number;
    moduleSlots?: number;
    cargoCapacity?: number;
    techLevel?: z.infer<typeof TechLevelSchema>;
    salvageValue?: number;
    displayName?: string;
    activationCost?: z.infer<typeof ActivationCostSchema>;
    range?: z.infer<typeof RangeSchema>;
    actionType?: z.infer<typeof ActionTypeSchema>;
    traits?: z.infer<typeof TraitSchema>[];
    damage?: z.infer<typeof DamageSchema>;
    choices?: z.infer<typeof ChoiceSchema>[];
    table?: z.infer<typeof TableSchema>;
    tableName?: string;
    hidden?: boolean;
    activationCurrency?: z.infer<typeof ActivationCurrencySchema>;
    source?: z.infer<typeof SourceSchema>;
    page?: z.infer<typeof PositiveIntegerSchema>;
    actionSource?: z.infer<typeof SchemaNameSchema>;
    drone?: string;
    requiredTraits?: string[];
}>;
/**
 * Reprint of an entity in a secondary source book
 *
 * `booklet` is optional and used when a source is a multi-booklet product
 * (e.g. the Salvage Union Starter Set, which uses CR / PH / PC / RR / AP codes
 * for its Core Rulebook / Pilots Handbook / Parts Catalogue / Rules Reference / Asset Pack).
 * Single-volume sources omit it.
 */
export declare const AdditionalSourceSchema: z.ZodObject<{
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    booklet: z.ZodOptional<z.ZodString>;
    page: z.ZodNumber;
}, z.core.$strict>;
/**
 * Basic entity with name, content, source, and page reference
 */
export declare const BaseEntitySchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof ContentTypeSchema>;
        value?: string | z.infer<typeof DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof ContentTypeSchema>;
            value?: string | z.infer<typeof DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof ContentTypeSchema>;
        value?: string | z.infer<typeof DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof ContentTypeSchema>;
            value?: string | z.infer<typeof DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
}, z.core.$strip>;
/**
 * Advanced or hybrid character class
 */
export declare const AdvancedClassSchema: z.ZodObject<{
    hasArtwork: z.ZodOptional<z.ZodBoolean>;
    content: z.ZodOptional<z.ZodArray<z.ZodType<{
        type?: z.infer<typeof ContentTypeSchema>;
        value?: string | z.infer<typeof DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof ContentTypeSchema>;
            value?: string | z.infer<typeof DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown, z.core.$ZodTypeInternals<{
        type?: z.infer<typeof ContentTypeSchema>;
        value?: string | z.infer<typeof DataValueSchema>[];
        label?: string;
        level?: number;
        lead?: boolean;
        choiceId?: string;
        items?: Array<{
            type?: z.infer<typeof ContentTypeSchema>;
            value?: string | z.infer<typeof DataValueSchema>[];
            label?: string;
            level?: number;
        }>;
    }, unknown>>>>;
    id: z.ZodString;
    indexable: z.ZodDefault<z.ZodBoolean>;
    blackMarket: z.ZodDefault<z.ZodBoolean>;
    name: z.ZodString;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    booklet: z.ZodOptional<z.ZodString>;
    additionalSources: z.ZodOptional<z.ZodArray<z.ZodObject<{
        source: z.ZodEnum<{
            "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
            "Salvage Union Starter Set": "Salvage Union Starter Set";
            "Reclamation of the Wastes": "Reclamation of the Wastes";
            "The Hive": "The Hive";
            "Thatcher's Mech Base": "Thatcher's Mech Base";
            "Relics of a Time Gone By": "Relics of a Time Gone By";
            "Mech Monday": "Mech Monday";
            "We Were Here First!": "We Were Here First!";
            Rainmaker: "Rainmaker";
            "False Flag": "False Flag";
        }>;
        booklet: z.ZodOptional<z.ZodString>;
        page: z.ZodNumber;
    }, z.core.$strict>>>;
    hybrid: z.ZodOptional<z.ZodBoolean>;
    advancedTree: z.ZodEnum<{
        "Advanced Engineer": "Advanced Engineer";
        "Advanced Hacking": "Advanced Hacking";
        "Advanced Hauler": "Advanced Hauler";
        "Advanced Scout": "Advanced Scout";
        "Advanced Soldier": "Advanced Soldier";
        Augmentation: "Augmentation";
        Cyborg: "Cyborg";
        Electronics: "Electronics";
        Fabricator: "Fabricator";
        Forging: "Forging";
        Generic: "Generic";
        "Gladiatorial Combat": "Gladiatorial Combat";
        Hacking: "Hacking";
        Leadership: "Leadership";
        "Legendary Cyborg": "Legendary Cyborg";
        "Legendary Engineer": "Legendary Engineer";
        "Legendary Fabricator": "Legendary Fabricator";
        "Legendary Hacker": "Legendary Hacker";
        "Legendary Hauler": "Legendary Hauler";
        "Legendary Ranger": "Legendary Ranger";
        "Legendary Scout": "Legendary Scout";
        "Legendary Smuggler": "Legendary Smuggler";
        "Legendary Soldier": "Legendary Soldier";
        "Legendary Union Rep": "Legendary Union Rep";
        "Mech-Tech": "Mech-Tech";
        "Mechanical Knowledge": "Mechanical Knowledge";
        Ranger: "Ranger";
        Recon: "Recon";
        Salvaging: "Salvaging";
        Sleuth: "Sleuth";
        Smuggler: "Smuggler";
        Sniper: "Sniper";
        Survivalist: "Survivalist";
        "Tactical Warfare": "Tactical Warfare";
        Trading: "Trading";
        "Union Rep": "Union Rep";
    }>;
    legendaryTree: z.ZodEnum<{
        "Advanced Engineer": "Advanced Engineer";
        "Advanced Hacking": "Advanced Hacking";
        "Advanced Hauler": "Advanced Hauler";
        "Advanced Scout": "Advanced Scout";
        "Advanced Soldier": "Advanced Soldier";
        Augmentation: "Augmentation";
        Cyborg: "Cyborg";
        Electronics: "Electronics";
        Fabricator: "Fabricator";
        Forging: "Forging";
        Generic: "Generic";
        "Gladiatorial Combat": "Gladiatorial Combat";
        Hacking: "Hacking";
        Leadership: "Leadership";
        "Legendary Cyborg": "Legendary Cyborg";
        "Legendary Engineer": "Legendary Engineer";
        "Legendary Fabricator": "Legendary Fabricator";
        "Legendary Hacker": "Legendary Hacker";
        "Legendary Hauler": "Legendary Hauler";
        "Legendary Ranger": "Legendary Ranger";
        "Legendary Scout": "Legendary Scout";
        "Legendary Smuggler": "Legendary Smuggler";
        "Legendary Soldier": "Legendary Soldier";
        "Legendary Union Rep": "Legendary Union Rep";
        "Mech-Tech": "Mech-Tech";
        "Mechanical Knowledge": "Mechanical Knowledge";
        Ranger: "Ranger";
        Recon: "Recon";
        Salvaging: "Salvaging";
        Sleuth: "Sleuth";
        Smuggler: "Smuggler";
        Sniper: "Sniper";
        Survivalist: "Survivalist";
        "Tactical Warfare": "Tactical Warfare";
        Trading: "Trading";
        "Union Rep": "Union Rep";
    }>;
}, z.core.$strict>;
/**
 * Formation member schema
 * Supports chassis+pattern combos and standalone entities (vehicles, drones, squads, npcs)
 */
export declare const FormationMechSchema: z.ZodObject<{
    chassis: z.ZodString;
    pattern: z.ZodOptional<z.ZodString>;
    schema: z.ZodOptional<z.ZodEnum<{
        classes: "classes";
        npcs: "npcs";
        abilities: "abilities";
        "ability-tree-requirements": "ability-tree-requirements";
        chassis: "chassis";
        "crawler-bays": "crawler-bays";
        "crawler-tech-levels": "crawler-tech-levels";
        crawlers: "crawlers";
        creatures: "creatures";
        distances: "distances";
        drones: "drones";
        equipment: "equipment";
        guides: "guides";
        keywords: "keywords";
        factions: "factions";
        meld: "meld";
        modules: "modules";
        "roll-tables": "roll-tables";
        sources: "sources";
        squads: "squads";
        "tech-levels": "tech-levels";
        systems: "systems";
        "bio-titans": "bio-titans";
        traits: "traits";
        vehicles: "vehicles";
    }>>;
    source: z.ZodEnum<{
        "Salvage Union Workshop Manual": "Salvage Union Workshop Manual";
        "Salvage Union Starter Set": "Salvage Union Starter Set";
        "Reclamation of the Wastes": "Reclamation of the Wastes";
        "The Hive": "The Hive";
        "Thatcher's Mech Base": "Thatcher's Mech Base";
        "Relics of a Time Gone By": "Relics of a Time Gone By";
        "Mech Monday": "Mech Monday";
        "We Were Here First!": "We Were Here First!";
        Rainmaker: "Rainmaker";
        "False Flag": "False Flag";
    }>;
    page: z.ZodNumber;
    quantity: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
/**
 * Grant schema
 */
export declare const GrantSchema: z.ZodObject<{
    schema: z.ZodUnion<readonly [z.ZodEnum<{
        classes: "classes";
        npcs: "npcs";
        abilities: "abilities";
        "ability-tree-requirements": "ability-tree-requirements";
        chassis: "chassis";
        "crawler-bays": "crawler-bays";
        "crawler-tech-levels": "crawler-tech-levels";
        crawlers: "crawlers";
        creatures: "creatures";
        distances: "distances";
        drones: "drones";
        equipment: "equipment";
        guides: "guides";
        keywords: "keywords";
        factions: "factions";
        meld: "meld";
        modules: "modules";
        "roll-tables": "roll-tables";
        sources: "sources";
        squads: "squads";
        "tech-levels": "tech-levels";
        systems: "systems";
        "bio-titans": "bio-titans";
        traits: "traits";
        vehicles: "vehicles";
    }>, z.ZodLiteral<"choice">]>;
    name: z.ZodString;
}, z.core.$strict>;
/**
 * A mutation applied by a crawler type that modifies game rules
 */
export declare const CrawlerMutationSchema: z.ZodObject<{
    type: z.ZodEnum<{
        weapon_slots: "weapon_slots";
        max_sp_bonus: "max_sp_bonus";
    }>;
    value: z.ZodNumber;
}, z.core.$strict>;
/**
 * Schema name (includes 'actions' as special case)
 */
export declare const SchemaNameWithActionsSchema: z.ZodUnion<readonly [z.ZodEnum<{
    classes: "classes";
    npcs: "npcs";
    abilities: "abilities";
    "ability-tree-requirements": "ability-tree-requirements";
    chassis: "chassis";
    "crawler-bays": "crawler-bays";
    "crawler-tech-levels": "crawler-tech-levels";
    crawlers: "crawlers";
    creatures: "creatures";
    distances: "distances";
    drones: "drones";
    equipment: "equipment";
    guides: "guides";
    keywords: "keywords";
    factions: "factions";
    meld: "meld";
    modules: "modules";
    "roll-tables": "roll-tables";
    sources: "sources";
    squads: "squads";
    "tech-levels": "tech-levels";
    systems: "systems";
    "bio-titans": "bio-titans";
    traits: "traits";
    vehicles: "vehicles";
}>, z.ZodLiteral<"actions">]>;
/**
 * Filter criteria for selecting entities in a guide step
 */
declare const GuideStepFilterSchema: z.ZodObject<{
    field: z.ZodString;
    operator: z.ZodOptional<z.ZodEnum<{
        eq: "eq";
        ne: "ne";
    }>>;
    value: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodBoolean]>>;
    min: z.ZodOptional<z.ZodNumber>;
    max: z.ZodOptional<z.ZodNumber>;
}, z.core.$strict>;
/**
 * Type of decision a guide step represents
 */
declare const GuideStepTypeSchema: z.ZodEnum<{
    freeform: "freeform";
    "select-one": "select-one";
    "select-many": "select-many";
    "roll-table": "roll-table";
    info: "info";
    "sub-guide": "sub-guide";
}>;
/**
 * A single step in a guide
 */
export declare const GuideStepSchema: z.ZodType<{
    id: string;
    name: string;
    stepType: z.infer<typeof GuideStepTypeSchema>;
    section?: string;
    content?: z.infer<typeof ContentSchema>;
    schema?: z.infer<typeof SchemaNameWithActionsSchema>[];
    schemaEntities?: string[];
    schemaField?: string;
    rollTable?: string;
    choiceOptions?: z.infer<typeof ChoiceOptionSchema>[];
    filters?: z.infer<typeof GuideStepFilterSchema>[];
    constraints?: z.infer<typeof ChoiceConstraintsSchema>;
    dependsOn?: string[];
    contextFrom?: string;
    guideRef?: string;
    optional?: boolean;
    paperOnly?: boolean;
    entityLayout?: 'sidebar';
}>;
/**
 * Category of a guide
 */
export declare const GuideTypeSchema: z.ZodEnum<{
    "character-creation": "character-creation";
    "mech-creation": "mech-creation";
    "crawler-creation": "crawler-creation";
    progression: "progression";
    downtime: "downtime";
    gameplay: "gameplay";
}>;
export {};
//# sourceMappingURL=objects.d.ts.map
// === lib/schemas/registry.d.ts ===
/**
 * Registry manifest — the single source of truth for every schema (entity
 * type) the salvageunion-reference package exposes.
 *
 * Adding a new schema type means:
 *   1. Writing the Zod schema in lib/schemas/entities.ts and inferring its
 *      type + adding it to the SURefEntity/SURefMetaEntity unions in
 *      lib/schemas/index.ts AND lib/types/index.ts (hand-authored — these
 *      need human judgment about which unions a schema belongs in).
 *   2. Adding the data file (data/<id>.json) and a catalog entry in
 *      schemas/index.json (hand-authored — prose description, required
 *      fields).
 *   3. Adding ONE entry to the array below.
 *   4. Running `bun run build:package`.
 *
 * Everything else — ModelFactory's dataLoaders / jsonSchemaLoaders /
 * zodSchemaMap / schemaDisplayNames, index.ts's LazyModel instances /
 * lazyModelMap / SchemaToEntityMap / SCHEMA_REGISTRY / static accessors — is
 * generated from this manifest by tools/generateRegistry.ts into
 * lib/generated/*.generated.ts (and, for the static accessors, injected into
 * lib/index.ts between the `GENERATED:BEGIN`/`GENERATED:END` markers).
 * lib/registryConsistency.test.ts independently verifies every generated
 * registry still covers the same key set.
 *
 * This file has ZERO imports on purpose: tools/generateRegistry.ts imports
 * it directly, without pulling in Zod, the data corpus, or any generated
 * code, so codegen never has a circular / bootstrap dependency on its own
 * output.
 */
export type RegistryEntry = {
    /** kebab-case schema id, e.g. "power-cores" — the data/schema filename stem */
    id: string;
    /** Exported SURef* type name from lib/schemas/index.ts, e.g. "SURefChassis" */
    typeName: string;
    /** Exported Zod schema variable name from lib/schemas/index.ts, e.g. "ChassisSchema" */
    zodExportName: string;
    /** Singular display name, e.g. "Chassis" */
    singular: string;
    /** Plural display name, e.g. "Chassis" */
    plural: string;
    /**
     * Set to `false` for non-entity metadata schemas (e.g. catalog-categories):
     * excluded from EntitySchemaNames and (by convention, hand-enforced in the
     * type unions) the SURefEntity union. Defaults to an entity schema (`true`)
     * when omitted.
     */
    entity?: boolean;
};
export declare const registry: RegistryEntry[];
//# sourceMappingURL=registry.d.ts.map
// === lib/search.d.ts ===
/**
 * Search functionality for Salvage Union data
 */
import type { SURefEntity, SURefEnumSchemaName } from './types/index.js';
export interface SearchOptions {
    query: string;
    schemas?: SURefEnumSchemaName[];
    limit?: number;
}
/** Reset the lazy index — called by preload() so an index built before data
 *  loaded never survives a successful preload. */
export declare function invalidateSearchIndex(): void;
export interface SearchResult {
    schemaName: SURefEnumSchemaName;
    schemaTitle: string;
    entity: SURefEntity & {
        schemaName: SURefEnumSchemaName;
    };
    entityId: string;
    entityName: string;
    matchedFields: string[];
    matchScore: number;
}
/**
 * Search across all or specific schemas
 */
export declare function search(options: SearchOptions): SearchResult[];
/**
 * Search within a specific schema
 */
export declare function searchIn<T extends SURefEntity>(schemaName: SURefEnumSchemaName, query: string, options?: {
    limit?: number;
}): (T & {
    schemaName: SURefEnumSchemaName;
})[];
/**
 * Get search suggestions based on partial query
 * Returns unique entity names that match the query
 */
export declare function getSuggestions(query: string, options?: {
    schemas?: SURefEnumSchemaName[];
    limit?: number;
}): string[];
//# sourceMappingURL=search.d.ts.map
// === lib/slug.d.ts ===
/**
 * Utility functions for converting entity names to URL-safe slugs
 * and finding entities by their slug
 *
 * Note: This module avoids importing from helpers.ts to prevent circular dependencies.
 * It uses getDataMaps() from ModelFactory directly for entity lookups.
 */
import type { SURefEntity, SURefEnumSchemaName } from './types/index.js';
/**
 * Converts a name to a URL-safe slug
 * - Converts to lowercase
 * - Replaces spaces and special characters with hyphens
 * - Removes multiple consecutive hyphens
 * - Trims hyphens from start and end
 *
 * CodeQL js/polynomial-redos note: the trailing-hyphen-trim regex used to be
 * `/^-+|-+$/g`. The `-+$` branch has a quantifier immediately followed by an
 * anchor with nothing after it in the string to guarantee the match, which is
 * the classic superlinear (O(n^2)) backtracking shape for the query
 * (e.g. `"a" + "-".repeat(n) + "a"` forces a retry at every start position).
 * The fix collapses whitespace/hyphen runs into a single hyphen first
 * (`[\s-]+` — safe: nothing follows the quantifier, so no backtracking), which
 * guarantees at most one leading and one trailing hyphen remains. That lets
 * the final trim drop its quantifier entirely (`/^-|-$/g`), leaving no
 * superlinear regex in the function.
 */
export declare function nameToSlug(name: string): string;
/**
 * Finds an entity in a schema by its slug
 * Returns the entity if found, null otherwise
 */
export declare function findEntityBySlug(schemaName: SURefEnumSchemaName, slug: string): SURefEntity | null;
/**
 * Gets the slug for an entity
 * Returns the slug if the entity has a name, otherwise returns the ID
 */
export declare function getEntitySlug(entity: SURefEntity): string;
//# sourceMappingURL=slug.d.ts.map
// === lib/types/index.d.ts ===
/**
 * TypeScript type exports
 *
 * NOTE: All types are now inferred from Zod schemas in lib/schemas/
 * This file re-exports them for backward compatibility
 */
export type * from '../schemas/index.js';
import type { SURefAbility, SURefChassis, SURefClass, SURefCrawler, SURefCrawlerBay, SURefCreature, SURefDistance, SURefDrone, SURefEquipment, SURefFaction, SURefKeyword, SURefMeld, SURefMetaAbilityTreeRequirement, SURefMetaAction, SURefMetaCrawlerTechLevel, SURefModule, SURefNPC, SURefRollTable, SURefSource, SURefTechLevel, SURefSquad, SURefSystem, SURefBioTitan, SURefTrait, SURefVehicle } from '../schemas/index.js';
export type SURefEntity = SURefAbility | SURefChassis | SURefClass | SURefCrawler | SURefCrawlerBay | SURefCreature | SURefDistance | SURefDrone | SURefEquipment | SURefFaction | SURefKeyword | SURefMeld | SURefModule | SURefNPC | SURefRollTable | SURefSource | SURefSquad | SURefSystem | SURefTechLevel | SURefBioTitan | SURefTrait | SURefVehicle;
export type SURefMetaEntity = SURefAbility | SURefChassis | SURefClass | SURefCrawler | SURefCrawlerBay | SURefCreature | SURefDistance | SURefDrone | SURefEquipment | SURefFaction | SURefKeyword | SURefMeld | SURefMetaAbilityTreeRequirement | SURefMetaAction | SURefMetaCrawlerTechLevel | SURefModule | SURefNPC | SURefRollTable | SURefSource | SURefTechLevel | SURefBioTitan | SURefSquad | SURefSystem | SURefTrait | SURefVehicle;
//# sourceMappingURL=index.d.ts.map
// === lib/utilities.d.ts ===
/**
 * Utility functions for Salvage Union entities
 * Type guards and property extractors
 */
import type { SURefMetaEntity, SURefMetaAction, SURefObjectGrant, SURefEntity, SURefObjectSystemModule, SURefObjectTable, SURefObjectTrait, SURefObjectChoice, SURefObjectActionOptions } from './types/index.js';
import type { SURefAbility, SURefChassis, SURefClass, SURefKeyword, SURefModule, SURefSystem, SURefObjectAdvancedClass, SURefObjectFormationMech, SURefObjectNpc, SURefObjectPattern } from './types/index.js';
/**
 * Base URL of the Netlify-hosted artwork CDN (the su-assets site, backed by a
 * Netlify Blobs store). Asset URLs are derived from this base plus the entity's
 * schema name and slug — see getAssetUrl().
 */
export declare const ASSET_BASE_URL = "https://assets.salvageunion.io";
/** Clear the cached action map so the next lookup reads fresh data. Called by `preload()`. */
export declare function invalidateActionMap(): void;
export type ItemCondition = 'intact' | 'damaged' | 'destroyed';
export type ParentType = 'pilot' | 'mech' | 'crawler';
/**
 * Extract tech level from an entity
 * @param entity - The entity to extract from
 * @returns The tech level (number, 'B', 'N') or undefined
 */
export declare function getTechLevel(entity: SURefMetaEntity): number | 'B' | 'N' | undefined;
/**
 * Extract tech level from an entity as a numeric value
 * Normalizes 'B' and 'N' to 1 for math operations
 * @param entity - The entity to extract from
 * @returns The tech level as a number or undefined
 */
export declare function getTechLevelNumber(entity: SURefMetaEntity): number | undefined;
/**
 * Extract salvage value from an entity
 * @param entity - The entity to extract from
 * @returns The salvage value or undefined
 */
export declare function getSalvageValue(entity: SURefMetaEntity): number | undefined;
/**
 * Extract slots required from an entity
 * @param entity - The entity to extract from
 * @returns The slots required or undefined
 */
export declare function getSlotsRequired(entity: SURefMetaEntity): number | undefined;
/**
 * Extract page reference from an entity
 * @param entity - The entity to extract from
 * @returns The page number or undefined
 */
export declare function getPageReference(entity: SURefMetaEntity): number | undefined;
/**
 * Extract actions from an entity
 * Resolves action names to full action objects from actions schema
 * @param entity - The entity to extract from
 * @returns The actions array or undefined
 */
export declare function extractActions(entity: SURefMetaEntity): SURefMetaAction[] | undefined;
/**
 * Extract visible (non-hidden) actions from an entity
 * @param entity - The entity to extract from
 * @returns The visible actions array or undefined
 */
export declare function extractVisibleActions(entity: SURefMetaEntity): SURefMetaAction[] | undefined;
/**
 * Extract chassis abilities from a chassis
 * Resolves ability names to full ability objects from actions schema
 * @param entity - The entity to extract from
 * @returns The chassis abilities array or undefined
 */
export declare function getChassisAbilities(entity: SURefMetaEntity): SURefMetaAction[] | undefined;
/**
 * Extract structure points from an entity
 * @param entity - The entity to extract from
 * @returns The structure points or undefined
 */
export declare function getStructurePoints(entity: SURefMetaEntity): number | undefined;
/**
 * Extract energy points from an entity
 * @param entity - The entity to extract from
 * @returns The energy points or undefined
 */
export declare function getEnergyPoints(entity: SURefMetaEntity): number | undefined;
/**
 * Extract heat capacity from an entity
 * @param entity - The entity to extract from
 * @returns The heat capacity or undefined
 */
export declare function getHeatCapacity(entity: SURefMetaEntity): number | undefined;
/**
 * Extract system slots from an entity
 * @param entity - The entity to extract from
 * @returns The number of system slots or undefined
 */
export declare function getSystemSlots(entity: SURefMetaEntity): number | undefined;
/**
 * Extract module slots from an entity
 * @param entity - The entity to extract from
 * @returns The number of module slots or undefined
 */
export declare function getModuleSlots(entity: SURefMetaEntity): number | undefined;
/**
 * Extract cargo capacity from an entity
 * @param entity - The entity to extract from
 * @returns The cargo capacity or undefined
 */
export declare function getCargoCapacity(entity: SURefMetaEntity): number | undefined;
/**
 * Extract hit points from an entity
 * Used for NPCs, Creatures, Squads, and Meld
 * @param entity - The entity to extract from
 * @returns The hit points or undefined
 */
export declare function getHitPoints(entity: SURefMetaEntity): number | undefined;
/**
 * Derive an entity's asset URL from its schema name and slug.
 *
 * Artwork is unified on WebP, so the whole URL is inferred:
 * `{ASSET_BASE_URL}/{schemaName}/{slug}.webp`. The boolean `hasArtwork` flag
 * marks which entities have artwork; the slug matches `getEntitySlug`, so the
 * artwork path lines up with the entity's canonical reference path.
 *
 * @param entity - The entity to derive from (must carry a stamped `schemaName`)
 * @returns The asset URL, or undefined if the entity has no artwork
 */
export declare function getAssetUrl(entity: SURefMetaEntity): string | undefined;
/**
 * Extract blackMarket flag from an entity
 * @param entity - The entity to extract from
 * @returns True if the entity is from the Black Market, false if not, undefined if not present
 */
export declare function getBlackMarket(entity: SURefMetaEntity): boolean | undefined;
/**
 * Extract content from an entity
 * @param entity - The entity to extract from
 * @returns The content or undefined
 */
export declare function getContent(entity: SURefMetaEntity): unknown | undefined;
/**
 * Extract name from an entity
 * @param entity - The entity to extract from
 * @returns The name or undefined
 */
export declare function getName(entity: SURefMetaEntity): string | undefined;
/**
 * Extract source from an entity
 * @param entity - The entity to extract from
 * @returns The source or undefined
 */
export declare function getSource(entity: SURefMetaEntity): string | undefined;
/**
 * Extract booklet code from an entity (e.g. "CR" / "PH" / "PC" / "CB" for SUSS).
 * Only meaningful when the primary source is a multi-booklet product.
 * @param entity - The entity to extract from
 * @returns The booklet code or undefined
 */
export declare function getBooklet(entity: SURefMetaEntity): string | undefined;
/**
 * Extract npc from an entity
 * @param entity - The entity to extract from
 * @returns The npc or undefined
 */
export declare function getNpc(entity: SURefMetaEntity): SURefObjectNpc | undefined;
/**
 * Extract tree from an entity
 * @param entity - The entity to extract from
 * @returns The tree or undefined
 */
export declare function getTree(entity: SURefMetaEntity): unknown | undefined;
/**
 * Extract requirement from an entity
 * @param entity - The entity to extract from
 * @returns The requirement or undefined
 */
export declare function getRequirement(entity: SURefMetaEntity): string[] | undefined;
/**
 * Extract patterns from an entity
 * @param entity - The entity to extract from
 * @returns The patterns or undefined
 */
export declare function getPatterns(entity: SURefMetaEntity): SURefObjectPattern[] | undefined;
/**
 * Extract goals from an entity
 * @param entity - The entity to extract from
 * @returns The goals or undefined
 */
export declare function getGoals(entity: SURefMetaEntity): string | undefined;
/**
 * Extract assets from an entity
 * @param entity - The entity to extract from
 * @returns The assets or undefined
 */
export declare function getAssets(entity: SURefMetaEntity): string | undefined;
/**
 * Extract weaknesses from an entity
 * @param entity - The entity to extract from
 * @returns The weaknesses or undefined
 */
export declare function getWeaknesses(entity: SURefMetaEntity): string | undefined;
/**
 * Extract formation from an entity
 * @param entity - The entity to extract from
 * @returns The formation or undefined
 */
export declare function getFormation(entity: SURefMetaEntity): SURefObjectFormationMech[] | undefined;
/**
 * Extract bioSalvageValue from an entity
 * @param entity - The entity to extract from
 * @returns The bioSalvageValue or undefined
 */
export declare function getBioSalvageValue(entity: SURefMetaEntity): number | undefined;
/**
 * Extract recommended flag from an entity
 * @param entity - The entity to extract from
 * @returns True if the entity is recommended, false if not, undefined if not present
 */
export declare function getRecommended(entity: SURefMetaEntity): boolean | undefined;
/**
 * Resolve a formation member to its entity, supporting chassis+pattern and standalone entity types.
 * For chassis: resolves chassis and optionally its pattern.
 * For other schemas (vehicles, drones, squads, npcs): resolves by name.
 * @param member - The formation member from faction data
 * @returns The resolved entity (with optional pattern for chassis), or undefined
 */
export declare function resolveFormationMember(member: SURefObjectFormationMech): {
    entity: SURefEntity;
    pattern?: SURefObjectPattern;
} | undefined;
/**
 * Type guard to distinguish SURefEntity (structured data with id/name/source/page)
 * from SURefMetaAction or other object types (which lack these fields)
 * @param data - Entity, action, or other object to check
 * @returns True if the data has id, name, source, and page fields
 */
export declare function isEntityData<T extends object>(data: T): data is T & SURefEntity & {
    id: string;
    name: string;
    source: string;
    page: number;
};
/**
 * Type guard to check if an entity has a techLevel property
 * @param entity - The entity to check
 * @returns True if the entity has a techLevel property
 */
export declare function hasTechLevel(entity: SURefMetaEntity): entity is SURefMetaEntity & {
    techLevel: number | 'B' | 'N';
};
/**
 * Type guard to check if an entity has traits
 * @param entity - The entity to check
 * @returns True if the entity has a traits property (either at base level or in action property)
 */
export declare function hasTraits(entity: SURefMetaEntity): entity is SURefMetaEntity & {
    traits?: unknown[];
};
/**
 * Type guard to check if an entity is an Ability
 * @param entity - The entity to check
 * @returns True if the entity is an Ability
 */
export declare function isAbility(entity: SURefMetaEntity): entity is SURefAbility;
/**
 * Type guard to check if an entity is a System
 * Note: Systems and Modules share the same schema, so this checks for
 * the presence of required system/module properties
 * @param entity - The entity to check
 * @returns True if the entity is a System
 */
export declare function isSystem(entity: SURefMetaEntity): entity is SURefSystem;
/**
 * Type guard to check if an entity is a Module
 * Note: Systems and Modules share the same schema, so this checks for
 * the presence of required system/module properties
 * @param entity - The entity to check
 * @returns True if the entity is a Module
 */
export declare function isModule(entity: SURefMetaEntity): entity is SURefModule;
/**
 * Type guard to check if an entity is a Chassis
 * @param entity - The entity to check
 * @returns True if the entity is a Chassis
 */
export declare function isChassis(entity: SURefMetaEntity): entity is SURefChassis;
/**
 * Type guard to check if an entity is a Keyword
 * @param entity - The entity to check
 * @returns True if the entity is a Keyword
 */
export declare function isKeyword(entity: SURefMetaEntity): entity is SURefKeyword;
/**
 * Type guard to check if an entity is a Core Class
 * @param entity - The entity to check
 * @returns True if the entity is a Core Class
 */
export declare function isCoreClass(entity: SURefMetaEntity): entity is SURefClass & {
    coreTrees: string[];
};
/**
 * Type guard to check if an entity is an Advanced Class
 * @param entity - The entity to check
 * @returns True if the entity is an Advanced Class
 */
export declare function isBaseAdvancedClass(entity: SURefMetaEntity): entity is SURefObjectAdvancedClass;
/**
 * Type guard to check if an entity is a Hybrid Class
 * Note: This is also exported from helpers.ts, but we keep it here for backwards compatibility
 * @param entity - The entity to check
 * @returns True if the entity is a Hybrid Class
 */
export declare function isHybridClass(entity: SURefMetaEntity): entity is SURefObjectAdvancedClass;
/**
 * Type guard to check if an entity is a class (any type)
 * @param entity - The entity to check
 * @returns True if the entity is a Core, Advanced, or Hybrid class
 */
export declare function isClass(entity: SURefMetaEntity): entity is SURefClass;
/**
 * Type guard to check if an entity is a System or Module
 * @param entity - The entity to check
 * @returns True if the entity is a System or Module
 */
export declare function isSystemOrModule(entity: SURefMetaEntity): entity is SURefSystem | SURefModule;
/**
 * Get display name from an entity
 * Falls back to name if displayName is not provided
 * @param entity - The entity to extract display name from
 * @returns The display name or name, or undefined if neither is present
 */
export declare function getReferenceEntityName(entity: SURefMetaEntity): string | undefined;
/**
 * Get description from an entity
 * @param entity - The entity to extract description from
 * @returns The description or undefined if not an ability
 */
export declare function getDescription(entity: SURefMetaEntity): string | undefined;
/**
 * Check if an entity is a system module (has actions but no id)
 * System modules are used in custom system options and pattern system modules
 * @param entity - The entity to check
 * @returns True if the entity is a system module
 */
export declare function isSystemModule(entity: SURefMetaEntity): boolean;
/**
 * Get entity name from a system module
 * Extracts the name from the first visible action in the system module
 * @param entity - The system module entity
 * @returns The entity name or undefined if not found
 */
export declare function getEntityNameFromSystemModule(entity: SURefObjectSystemModule): string | undefined;
/**
 * Normalize pattern name by removing " Pattern" suffix
 * @param patternName - The pattern name to normalize
 * @returns The normalized pattern name
 */
export declare function normalizePatternName(patternName: string): string;
/**
 * Filter actions excluding a specific name
 * Used to filter out actions where the action name matches the entity name
 * @param actions - The actions array to filter
 * @param excludeName - The name to exclude
 * @returns Filtered actions array
 */
export declare function filterActionsExcludingName(actions: SURefMetaAction[], excludeName: string): SURefMetaAction[];
type DamageValue = {
    damageType: string;
    amount: number | string;
};
export declare function getActivationCost(entity: SURefMetaEntity): number | string | undefined;
/**
 * Get action type from an entity (self-action fallback).
 */
export declare function getActionType(entity: SURefMetaEntity): string | undefined;
/**
 * Get range from an entity (self-action fallback).
 */
export declare function getRange(entity: SURefMetaEntity): string[] | undefined;
/**
 * Get damage from an entity (self-action fallback).
 */
export declare function getDamage(entity: SURefMetaEntity): DamageValue | undefined;
/**
 * Get traits from an entity
 * Checks base level first, then action if action name matches entity name
 * @param entity - The entity to extract traits from
 * @returns The traits array or undefined if not present
 */
export declare function getTraits(entity: SURefMetaEntity): SURefObjectTrait[] | undefined;
/**
 * Get the number of inventory slots an equipment entity occupies.
 * Default is 1. Heavy or Portable traits make it 2.
 */
export declare function getInventorySlots(entity: SURefMetaEntity): number;
/**
 * Get effects from an entity
 * Note: Effects only exist at base level, not in actions
 * @param entity - The entity to extract effects from
 * @returns The effects array or undefined if not present
 */
export declare function getEffects(entity: SURefMetaEntity): Array<{
    label?: string;
    value: string;
}> | undefined;
/**
 * Get table from an entity
 * Checks base level, nested action property, and tableName references
 * @param entity - The entity to extract table from
 * @returns The table object or undefined if not present
 */
export declare function getTable(entity: SURefMetaEntity): SURefObjectTable | undefined;
/**
 * Get options from an entity
 * Checks both base level and nested action property
 * @param entity - The entity to extract options from
 * @returns The options array or undefined if not present
 */
export declare function getOptions(entity: SURefMetaEntity): SURefObjectActionOptions | undefined;
/**
 * Get choices from an entity
 * Checks action choices first (if action name matches entity name), then root-level choices
 * If both base entity and a granted entity have actions with the same name, action choices
 * are filtered out (handled by grantable UI) but root-level choices are still returned
 * @param entity - The entity to extract choices from
 * @returns The choices array or undefined if not present
 */
export declare function getChoices(entity: SURefMetaEntity): SURefObjectChoice[] | undefined;
/**
 * Get grants from an entity
 * @param entity - The entity to extract grants from
 * @returns The grants array or undefined if not present
 */
export declare function getGrants(entity: SURefMetaEntity): SURefObjectGrant[] | undefined;
/**
 * Get required traits from an action
 * @param action - The action to extract required traits from
 * @returns Array of required trait type strings, or empty array if none
 */
export declare function getRequiredTraits(action: SURefMetaAction): string[];
/**
 * Represents a parsed trait reference from text
 */
export type ParsedTraitReference = {
    /** The full matched text including brackets */
    fullMatch: string;
    /** The trait name (e.g., "Hot", "Burn", "Explosive") */
    traitName: string;
    /** The parameter if present (e.g., "3", "X", "2") */
    parameter?: string;
    /** The start index of the match in the original text */
    startIndex: number;
    /** The end index of the match in the original text */
    endIndex: number;
};
/**
 * Parse trait references from text
 * Handles both simple [[TraitName]] and parameterized [[[TraitName] (param)]] formats
 * @param text - The text to parse for trait references
 * @returns Array of parsed trait references
 *
 * @example
 * const text = "This has the [[Shield]] Trait and [[[Hot] (3)]] Trait"
 * const refs = parseTraitReferences(text)
 * // => [
 * //   { fullMatch: "[[Shield]]", traitName: "Shield", startIndex: 13, endIndex: 23 },
 * //   { fullMatch: "[[[Hot] (3)]]", traitName: "Hot", parameter: "3", startIndex: 35, endIndex: 48 }
 * // ]
 */
export declare function parseTraitReferences(text: string): ParsedTraitReference[];
export {};
//# sourceMappingURL=utilities.d.ts.map
// === lib/utils/resultForTable.d.ts ===
import type { SURefObjectTable, SURefObjectTableContent } from '../types/index.js';
/**
 * Result type for columns table roll resolution (two d20 rolls)
 */
export type ColumnsTableRollResult = {
    success: boolean;
    columnKey: string;
    entryKey: string;
    result: SURefObjectTableContent;
};
/**
 * Checks whether a table is a columns-type table (multi-column, two-roll)
 */
export declare function isColumnsTable(table: SURefObjectTable | undefined): boolean;
/**
 * Resolves two d20 rolls against a columns-type table
 *
 * @param table - The roll table data
 * @param columnRoll - First d20 roll to select a column (1-20)
 * @param entryRoll - Second d20 roll to select an entry within the column (1-20)
 * @returns Object with success flag, column key, entry key, and result
 */
export declare function resultForColumnsTable(table: SURefObjectTable | undefined, columnRoll: number, entryRoll: number): ColumnsTableRollResult;
/**
 * Result type for table roll resolution
 */
export type TableRollResult = {
    success: boolean;
    result: SURefObjectTableContent;
    key: string;
};
/**
 * Resolves a d20 roll against a table to get the result
 *
 * @param table - The roll table data (SURefRollTable['table'] | SURefSystem['table'] | undefined)
 * @param roll - The d20 roll result (1-20)
 * @returns Object with success flag and result object containing optional label and required value
 *
 * @example
 * const rollTable = SalvageUnionReference.RollTables.findByName('Core Mechanic');
 * const result = resultForTable(rollTable?.table, 15);
 * if (result.success) {
 *   console.log(result.result.value); // "You have achieved your goal..."
 *   console.log(result.result.label); // "Success" (if present)
 * }
 */
export declare function resultForTable(table: SURefObjectTable | undefined, roll: number): TableRollResult;
//# sourceMappingURL=resultForTable.d.ts.map
// === lib/zod.d.ts ===
/**
 * Pre-configured Zod instance.
 *
 * Disables Zod v4's JIT object parser. The JIT path compiles validators with
 * `new Function`, and a `new Function("")` eval feature-detect (`allowsEval`)
 * runs at schema *construction* time. Both trip a strict `script-src`
 * Content-Security-Policy with no `unsafe-eval` (see apps/srd/netlify.toml),
 * surfacing as console CSP violations in the browser. The jitless interpreted
 * parser produces identical results, just slightly slower.
 *
 * Import `z` from this module (never directly from `zod`) anywhere schemas are
 * constructed or parsed, so `z.config` runs before the first `z.object()` call.
 */
import { z } from 'zod';
export { z };
//# sourceMappingURL=zod.d.ts.map