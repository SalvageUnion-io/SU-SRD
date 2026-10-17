/**
 * Search functionality for Salvage Union data
 */
import type { RefEntity, RefEnumSchemaName } from './schemas/index';
/**
 * Type guard: is this string a canonical, indexable schema name?
 *
 * Membership is the NON-META schema catalog — exactly the set entity pages, the
 * search index and catalog tiles are generated from, and a strict subset of the
 * `SchemaNameSchema` enum (which also carries the meta-only
 * `ability-tree-requirements`). Narrowing on the catalog rather than the enum is
 * what makes this usable as an untrusted-input guard.
 *
 * The canonical implementation, and the ONLY one: every consumer imports this.
 *
 * `getSchemaCatalog()` reads the static schema index and needs no `preload()`,
 * so this is safe from any build-time or test context.
 */
export declare function isSchemaName(id: string): id is RefEnumSchemaName;
export type SearchOptions = {
    query: string;
    schemas?: RefEnumSchemaName[];
    limit?: number;
};
/** Reset the lazy index — called by preload() so an index built before data
 *  loaded never survives a successful preload. */
export declare function invalidateSearchIndex(): void;
/**
 * A host's PATTERNS as searchable text: each visible pattern's name, its prose,
 * and the rules of the actions it adds. A pattern has no row of its own, so it
 * is found through its host — "Hill Worm" finds Typhon, "Hauler" the Mule.
 * Shared with srd's compact index (`searchIndexBuild.ts`), which mirrors this.
 */
export declare function patternSearchText(entity: RefEntity): string;
export type SearchResult = {
    schemaName: RefEnumSchemaName;
    schemaTitle: string;
    entity: RefEntity & {
        schemaName: RefEnumSchemaName;
    };
    entityId: string;
    entityName: string;
    matchedFields: string[];
    matchScore: number;
};
/**
 * Extract all text from content blocks recursively.
 *
 * The canonical implementation of "flatten a ContentBlock tree to searchable
 * text"; `apps/web/src/lib/searchIndexBuild.ts` imports it.
 */
export declare function extractContentText(content: unknown): string;
/**
 * Search across all or specific schemas
 */
export declare function search(options: SearchOptions): SearchResult[];
/**
 * Search within a specific schema
 */
export declare function searchIn<T extends RefEntity>(schemaName: RefEnumSchemaName, query: string, options?: {
    limit?: number;
}): (T & {
    schemaName: RefEnumSchemaName;
})[];
