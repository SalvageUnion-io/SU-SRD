/**
 * Registry manifest — the single source of truth for every schema (entity
 * type) the salvageunion-reference package exposes.
 *
 * Adding a new schema type means:
 *   1. Writing the Zod schema in lib/schemas/entities.ts (exported from the
 *      lib/schemas barrel).
 *   2. Adding the data file (data/<id>.json). The schemas/index.json catalog
 *      entry is generated (prose from the Zod `.describe()`, `meta` below).
 *   3. Adding ONE entry to the array below.
 *   4. Running `bun run build:package`.
 *
 * Everything else — the Ref* entity type aliases and the RefEntity /
 * RefMetaEntity unions (membership decided by `entity` / `excludeFromEntityUnion` below),
 * ModelFactory's dataLoaders /
 * zodSchemaMap / schemaDisplayNames, index.ts's LazyModel instances /
 * lazyModelMap / SchemaToEntityMap / SCHEMA_REGISTRY / static accessors — is
 * generated from this manifest by tools/generateRegistry.ts into
 * lib/generated/*.generated.ts (and, for the static accessors, injected into
 * lib/index.ts between the `GENERATED:BEGIN`/`GENERATED:END` markers).
 * lib/__tests__/registryConsistency.test.ts independently verifies every generated
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
    /** Ref* type name to generate, e.g. "RefChassis" — `z.infer` of `zodExportName` */
    typeName: string;
    /** Exported Zod schema variable name from lib/schemas/entities.ts, e.g. "ChassisSchema" */
    zodExportName: string;
    /** Singular display name, e.g. "Chassis" */
    singular: string;
    /** Plural display name, e.g. "Chassis" */
    plural: string;
    /**
     * Set to `false` for non-entity metadata schemas (e.g. catalog-categories):
     * excluded from EntitySchemaNames and from BOTH generated unions
     * (RefEntity and RefMetaEntity). Defaults to an entity schema (`true`)
     * when omitted.
     */
    entity?: boolean;
    /**
     * Set to `true` for the rules-metadata schemas (actions, ability-tree
     * requirements, crawler tech levels): they are entities, so they stay in
     * RefMetaEntity and EntitySchemaNames, but they are left out of the
     * narrower RefEntity union. (Unrelated to `meta` below, which is a
     * different set.)
     */
    excludeFromEntityUnion?: boolean;
    /**
     * Set to `true` to mark the schema's schemas/index.json catalog entry
     * `meta`: kept out of search and the catalog listing.
     */
    meta?: boolean;
    /**
     * Set to `true` to also generate the schema's LIST projection
     * (`lib/generated/<id>.list.generated.json`, rows without their prose — see
     * `lib/listProjection.ts`), loadable with `preload(ids, { projection: 'list' })`.
     */
    listProjection?: boolean;
};
export declare const registry: RegistryEntry[];
