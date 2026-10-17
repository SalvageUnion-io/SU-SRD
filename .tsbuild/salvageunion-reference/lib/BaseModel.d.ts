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
 * Performance: schemaName is stamped on each entity at construction time and an
 * ID map is built for O(1) `getById()`. `name` and `slug` are indexed too, but
 * LAZILY — the id map serves one caller (`SalvageUnionReference.get`) while name
 * and slug are how nearly every consumer actually addresses an entity, and a
 * model that is never looked up by name should not pay to slugify every row.
 * Reference data is immutable after load, so each map is built once on first use.
 */
export declare class BaseModel<T> {
    protected data: (T & {
        schemaName: string;
    })[];
    protected idMap: Map<string, T & {
        schemaName: string;
    }>;
    protected nameMap: Map<string, T & {
        schemaName: string;
    }> | null;
    protected slugMap: Map<string, T & {
        schemaName: string;
    }> | null;
    protected _schemaName: string;
    protected _displayName: string;
    constructor(data: T[], schemaName: string, displayName: string);
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
    /**
     * Get an entity by exact `name` in O(1) time.
     *
     * Exactly equivalent to `find((e) => e.name === name)`: rows whose `name` is
     * absent or not a string are not indexed, and on a duplicate name the FIRST
     * row in data order wins — the same answer `Array.prototype.find` gives.
     */
    getByName(name: string): (T & {
        schemaName: string;
    }) | undefined;
    /**
     * Get an entity by the slug derived from its `name`, in O(1) time.
     *
     * Exactly equivalent to `find((e) => nameToSlug(e.name) === slug)`, with the
     * same first-writer-wins collision rule as {@link getByName}.
     */
    getBySlug(slug: string): (T & {
        schemaName: string;
    }) | undefined;
    /**
     * Index every row carrying a string `name` under `key(name)`, skipping rows
     * for which `key` returns null. First writer wins, matching
     * `Array.prototype.find` order.
     */
    private buildKeyIndex;
}
