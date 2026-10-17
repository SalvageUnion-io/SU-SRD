/**
 * Model Factory - Auto-generates models from schema catalog
 * Uses lazy (dynamic) imports for JSON data files so consumers
 * can code-split the ~1.1 MB data corpus via SalvageUnionReference.preload().
 *
 * The registries it reads (dataLoaders, schemaDisplayNames) are generated from
 * lib/schemas/registry.ts by tools/generateRegistry.ts into lib/generated/ —
 * run `bun run build:package` to regenerate after editing the manifest.
 *
 * ## The trusted load path
 *
 * The data files are committed, and CI parses every one of them with its Zod
 * schema and proves the parse returns each file UNCHANGED
 * (`lib/__tests__/dataCanonical.test.ts`: no defaults left to fill, no unknown
 * keys to strip). Re-running `z.array(schema).parse` on every load would be
 * pure repetition.
 *
 * So every load is trusted: this module never imports Zod or the schema map,
 * which keeps both out of client bundles (`lib/__tests__/loadPathBundle.test.ts`).
 */
import { BaseModel } from './BaseModel';
import { schemaDisplayNames } from './generated/modelFactoryRegistry.generated';
import { toPascalCase } from './naming';
export { schemaDisplayNames, toPascalCase };
/** Which copy of a schema to load: every field, or a listing's projection. */
export type LoadProjection = 'full' | 'list';
/**
 * Returns true if the given schema ID has been loaded via preload() — in
 * full, or (with `projection: 'list'`) at least as its list projection.
 */
export declare function isSchemaLoaded(schemaId: string, projection?: LoadProjection): boolean;
/**
 * Load the given schemas (or all schemas if 'all' is passed).
 * Idempotent: already-loaded schemas are skipped.
 * Returns a Promise that resolves when all requested schemas are loaded.
 *
 * With `projection: 'list'`, a schema that has a list projection loads that
 * instead (the rest load in full), unless it is already loaded. A full load
 * of a list-loaded schema replaces the projection.
 */
export declare function loadSchemas(schemas: string[] | 'all', projection?: LoadProjection): Promise<void>;
/**
 * Install schemas from rows the caller has already imported, synchronously.
 * Idempotent like {@link loadSchemas}: an already-loaded schema is skipped.
 *
 * For a runtime that cannot run the loaders' dynamic `import()`: Convex's
 * default runtime throws "dynamic module import unsupported", so a Convex
 * module imports the data files statically and hands them here. The rows are
 * trusted exactly as a loaded file is, so pass the committed files unchanged.
 *
 * @returns the schema ids this call installed (none when all were loaded)
 */
export declare function installSchemas(data: Readonly<Partial<Record<string, readonly unknown[]>>>): string[];
/**
 * Get a loaded model by PascalCase property name.
 * Throws with a descriptive error if the schema hasn't been loaded yet.
 */
export declare function getLoadedModel(schemaId: string, propertyName: string): BaseModel<unknown>;
/**
 * Get a loaded model by its kebab-case schema id, or `undefined` if that
 * schema has not been preloaded.
 *
 * The non-throwing sibling of {@link getLoadedModel}, for callers whose
 * contract is "return nothing when the schema isn't there" — `lib/slug.ts`'s
 * `findEntityBySlug`. Going through the model reaches its name/slug indexes
 * rather than linear-scanning the raw rows of {@link getDataMaps}.
 */
export declare function getLoadedModelBySchemaId(schemaId: string): BaseModel<unknown> | undefined;
/**
 * Reset all load state. Exposed for testing only.
 * In production, schemas are loaded once and kept for the lifetime of the process.
 */
export declare function resetLoadStateForTesting(): void;
/**
 * Get the loaded data map (synchronous).
 * Only returns data for schemas that have been preloaded.
 * Exposed for client use (e.g. resolveActions in index.ts).
 */
export declare function getDataMaps(): {
    dataMap: Record<string, unknown[]>;
};
/**
 * Registry key set, exported for the consistency test ONLY — the loader map
 * itself stays private (it must remain static-literal for bundler-analyzable
 * dynamic imports). lib/__tests__/registryConsistency.test.ts checks it against
 * zodSchemaMap, which it imports from the generated module directly: a
 * static import of that module here would put the schemas back in every
 * client bundle.
 */
export declare const _registryKeySets: {
    dataLoaders: string[];
    listDataLoaders: string[];
};
/**
 * Enhanced schema metadata interface
 */
export type EnhancedSchemaMetadata = {
    id: string;
    title: string;
    description: string;
    comment?: string;
    dataFile: string;
    schemaFile: string;
    itemCount: number;
    displayName: string;
    displayNamePlural: string;
    meta?: boolean;
};
/**
 * Get schema catalog with enhanced metadata
 * Exposed for client use
 *
 * No `version` field: see the note on `SchemaIndex` in tools/generateDocs.ts.
 */
export declare function getSchemaCatalog(): {
    $schema: string;
    title: string;
    description: string;
    schemas: EnhancedSchemaMetadata[];
};
