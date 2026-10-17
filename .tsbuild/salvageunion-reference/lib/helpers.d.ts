/**
 * Helper functions for common operations on Salvage Union reference data
 * These functions provide convenient access patterns used by consuming applications
 */
import type { ModelWithMetadata } from './BaseModel';
import type { EnhancedSchemaMetadata } from './ModelFactory';
import type { RefEntity, RefEnumSchemaName, RefObjectAdvancedClass } from './schemas/index';
import type { TableRow } from './utils/tableRows';
/**
 * Get the display name for a schema
 * @param schemaName - The schema name
 * @returns The display name or the schema name if not found
 */
export declare function getDisplayName(schemaName: RefEnumSchemaName): string;
/**
 * Get a model by schema name
 * @param schemaName - The schema name
 * @returns The model instance or undefined if not found
 */
export declare function getModel(schemaName: string | RefEnumSchemaName): ModelWithMetadata<RefEntity> | undefined;
/**
 * Resolve an entity's `grants` into the granted entities, skipping `choice`
 * grants (handled separately). Single source of truth for the grant-resolution
 * walk — used by the display layer (Grants block) and any tooling.
 */
export declare function resolveGrantedEntities(entity: RefEntity): RefEntity[];
/**
 * Get all hybrid classes (classes with hybrid=true)
 * @returns Array of hybrid classes
 */
export declare function getHybridClasses(): (RefObjectAdvancedClass & {
    schemaName: string;
})[];
/**
 * Resolve the activation currency for a given schema/entity category.
 * Mech-level sources (chassis, systems, modules) cost EP; variable-cost abilities
 * cost XP; everything else costs AP.
 */
export declare function resolveActivationCurrency(schemaName: RefEnumSchemaName | 'actions' | undefined, variable?: boolean): 'AP' | 'EP' | 'XP';
/**
 * Get all entity schemas (non-meta schemas)
 * Filters out meta schemas like actions, ability-tree-requirements, etc.
 * @returns Array of entity schema metadata
 */
export declare function getEntitySchemas(): EnhancedSchemaMetadata[];
/**
 * Sort rank for a Tech Level: the numeric tiers 1–6 keep their own value, then
 * Bio ('B') at 7 and Nanite ('N') at 8.
 *
 * This ordering is a property of the game's TAXONOMY, not of any one widget, so
 * it lives here and every sorter composes it (`techLevelRank(a) -
 * techLevelRank(b)`) rather than re-deriving it. A missing Tech Level ranks
 * last — an entity with no TL has no place among the tiers, and Infinity keeps
 * it out of the way of both the numeric run and B/N without inventing a tier
 * for it.
 *
 * @param techLevel - A Tech Level (as returned by `getTechLevel`), or undefined
 * @returns The sort rank
 */
export declare function techLevelRank(techLevel: number | 'B' | 'N' | undefined): number;
/**
 * The canonical "Tech Level, then name" comparator.
 *
 * Do not compare with `Number(techLevel)`: `Number('B')` is `NaN`, the `||`
 * falls through to the name tiebreak, and Bio and Nanite items end up
 * interleaved by name among the numeric tiers instead of sorted after them.
 * Use {@link techLevelRank}.
 *
 * **One hand-rolled comparator is deliberately NOT folded in.**
 * `apps/web/src/components/compositions/EntitySearcher.tsx` composes
 * `techLevelRank` correctly — no NaN — but short-circuits to the name tiebreak
 * whenever EITHER side's Tech Level is `undefined`, where this ranks `undefined`
 * last. That is a real behavioural difference on TL-less entities, so switching
 * it is a decision about search ordering rather than a de-duplication.
 *
 * @param a - Entity-shaped value carrying a Tech Level and a name
 * @param b - The value to compare against
 * @returns Negative, zero or positive, per Array#sort
 */
export declare function byTechLevelThenName(a: {
    techLevel?: number | 'B' | 'N';
    name: string;
}, b: {
    techLevel?: number | 'B' | 'N';
    name: string;
}): number;
/**
 * Get unique tech levels from an array of entities, sorted correctly
 * Numeric levels ascending, then 'B', then 'N'
 * @param entities - Array of entities to extract tech levels from
 * @returns Sorted array of unique tech levels
 */
export declare function getUniqueTechLevels(entities: RefEntity[]): (number | 'B' | 'N')[];
/**
 * Get unique source strings from an array of entities.
 * "Salvage Union Workshop Manual" is always first; the rest are sorted alphabetically.
 * @param entities - Array of entities to extract sources from
 * @returns Sorted array of unique source strings
 */
export declare function getUniqueSources(entities: RefEntity[]): string[];
/**
 * Get unique ability-tree strings from an array of entities, sorted alphabetically.
 * Only abilities carry a `tree`; entities without one are skipped.
 * @param entities - Array of entities to extract trees from
 * @returns Sorted array of unique tree strings
 */
export declare function getUniqueTrees(entities: RefEntity[]): string[];
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
export declare function getReferenceEntityData(entity: RefEntity): ReferenceEntityData;
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
    /**
     * Named prose sections BELOW the entity's own content — currently a guide's
     * `steps`, which hold most of a guide's text. Without these the no-JS/crawler
     * rendering of a guide is its title and one intro paragraph.
     *
     * Empty for every entity that has no such sections.
     */
    sections: {
        name: string;
        paragraphs: string[];
    }[];
    /**
     * A roll table's outcome rows, highest roll first. Without these the
     * no-JS/crawler rendering of a roll-table page (what a reader-mode view or an
     * LLM following `llms.txt` receives) lacks the table, which is the entire
     * reason the page exists.
     *
     * `columns` tables are deliberately absent. Each of their buckets holds a
     * further 1–20 mapping, so a flat row list would misrepresent a two-roll
     * table as a one-roll one — worse than rendering nothing, because it would
     * look right. They keep the island rendering until the static path grows a
     * two-roll shape.
     *
     * Empty for every entity that is not a roll table.
     */
    table: TableRow[];
};
/**
 * Extract a static summary from an entity for server-side rendering (SEO)
 * Collects text content, numeric stats, and trait names into a flat structure
 * suitable for rendering as static HTML at build time.
 * @param entity - The entity to extract a summary from
 * @param options.keepReferences - Keep the prose's `[[Trait]]` markup, for a
 *   renderer that draws each reference as a Mention (the SRD's static
 *   fallback). By default the references read as plain words, for every
 *   surface that prints text (meta descriptions, the roll-table page's note).
 * @returns Static summary data
 */
export declare function extractStaticEntitySummary(entity: RefEntity, options?: {
    keepReferences?: boolean;
}): StaticEntitySummary;
