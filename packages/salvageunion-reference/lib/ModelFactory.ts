/**
 * Model Factory - Auto-generates models from schema catalog
 * Uses lazy (dynamic) imports for JSON data files so consumers
 * can code-split the ~1.1 MB data corpus via SalvageUnionReference.preload().
 *
 * The registries it reads (dataLoaders, schemaDisplayNames, and — only on a
 * validating load — zodSchemaMap) are generated from lib/schemas/registry.ts
 * by tools/generateRegistry.ts into lib/generated/ — run
 * `bun run build:package` to regenerate after editing the manifest.
 *
 * ## The trusted load path (audit PK-04)
 *
 * The data files are committed, and CI validates every one of them against
 * its Zod schema (`validate:schemas`) and proves that a Zod parse returns each
 * file UNCHANGED (`lib/dataCanonical.test.ts`: no defaults left to fill, no
 * unknown keys to strip). Re-running `z.array(schema).parse` on every load was
 * therefore pure repetition — and it was most of the cost: ~87% of a
 * `preload('all')`, in every browser tab and every Worker isolate, plus the
 * entity schemas in both client bundles.
 *
 * So a load is trusted by default. `{ validate: true }` restores the Zod
 * pass, and reaches it (`validateData.ts`, which holds the schema map) through
 * a dynamic `import()` so that a bundler never links Zod or the schemas into a
 * chunk a trusted load needs.
 */

import schemaIndex from '../schemas/index.json' with { type: 'json' }
import { BaseModel } from './BaseModel.js'
import { dataLoaders, schemaDisplayNames } from './generated/modelFactoryRegistry.generated.js'
import { toPascalCase } from './naming.js'

export { schemaDisplayNames, toPascalCase }

/** Options for {@link loadSchemas} / `SalvageUnionReference.preload()`. */
export type LoadOptions = {
  /**
   * Re-validate each loaded file against its Zod schema. Off by default: the
   * committed data is validated in CI and proven parse-stable, so the trusted
   * path returns exactly what a validating load would. Turn it on for data you
   * have not validated yourself (a hand-edited checkout mid-change, a tool
   * that wants the loud failure). The first validating load fetches the
   * schema module, so it is async in the same way the data is.
   */
  validate?: boolean
}

// ---------------------------------------------------------------------------
// Load state
// ---------------------------------------------------------------------------

/** Set of schema IDs that have been successfully loaded */
const loadedSchemas = new Set<string>()

/** Live model registry — populated by preload(), keyed by PascalCase property name */
const modelRegistry: Record<string, BaseModel<unknown>> = {}

// ---------------------------------------------------------------------------
// Public load-state API (consumed by SalvageUnionReference)
// ---------------------------------------------------------------------------

/**
 * Returns true if the given schema ID has been loaded via preload().
 */
export function isSchemaLoaded(schemaId: string): boolean {
  return loadedSchemas.has(schemaId)
}

/**
 * Load the given schemas (or all schemas if 'all' is passed).
 * Idempotent: already-loaded schemas are skipped.
 * Returns a Promise that resolves when all requested schemas are loaded.
 */
export async function loadSchemas(
  schemas: string[] | 'all',
  options: LoadOptions = {}
): Promise<void> {
  const ids = schemas === 'all' ? Object.keys(dataLoaders) : schemas

  // Only load schemas not yet loaded
  const pending = ids.filter((id) => !loadedSchemas.has(id))
  if (pending.length === 0) return

  for (const id of pending) {
    if (!dataLoaders[id]) throw new Error(`No loader found for schema ID: ${id}`)
  }

  const validate = options.validate ? await loadValidator() : null
  await Promise.all(pending.map((id) => loadSingleSchema(id, validate)))
}

type Validator = (schemaId: string, rawData: unknown[]) => unknown[]

/**
 * Fetch the validating parse. A dynamic import on purpose — see the module
 * header, and `validateData.ts` for why the boundary is that module rather
 * than `zod.ts` itself.
 */
async function loadValidator(): Promise<Validator> {
  const { validateRows } = await import('./validateData.js')
  return validateRows
}

async function loadSingleSchema(schemaId: string, validate: Validator | null): Promise<void> {
  const dataLoader = dataLoaders[schemaId]
  if (!dataLoader) throw new Error(`No loader found for schema ID: ${schemaId}`)

  const rawData = await dataLoader()

  // Trusted: the committed file IS the parsed form (lib/dataCanonical.test.ts).
  const validatedData = validate ? validate(schemaId, rawData) : rawData
  const displayNameValue = schemaDisplayNames[schemaId]?.singular ?? schemaId
  const model = new BaseModel(validatedData, schemaId, displayNameValue)

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

  const propertyName = toPascalCase(schemaId)
  modelRegistry[propertyName] = model
  loadedSchemas.add(schemaId)
}

/**
 * Get a loaded model by PascalCase property name.
 * Throws with a descriptive error if the schema hasn't been loaded yet.
 */
export function getLoadedModel(schemaId: string, propertyName: string): BaseModel<unknown> {
  if (!loadedSchemas.has(schemaId)) {
    throw new Error(
      `Schema "${schemaId}" not loaded. Call SalvageUnionReference.preload(['${schemaId}']) or SalvageUnionReference.preload('all') first.`
    )
  }
  const model = modelRegistry[propertyName]
  if (!model) {
    throw new Error(`Model for schema "${schemaId}" not found after loading. This is a bug.`)
  }
  return model
}

/**
 * Get a loaded model by its kebab-case schema id, or `undefined` if that
 * schema has not been preloaded.
 *
 * The non-throwing sibling of {@link getLoadedModel}, for callers whose
 * contract is "return nothing when the schema isn't there" — `lib/slug.ts`'s
 * `findEntityBySlug`, which used to read the raw row array out of
 * {@link getDataMaps} and linear-scan it. Going through the model instead
 * reaches its name/slug indexes.
 */
export function getLoadedModelBySchemaId(schemaId: string): BaseModel<unknown> | undefined {
  if (!loadedSchemas.has(schemaId)) return undefined
  return modelRegistry[toPascalCase(schemaId)]
}

/**
 * Reset all load state. Exposed for testing only.
 * In production, schemas are loaded once and kept for the lifetime of the process.
 */
export function resetLoadStateForTesting(): void {
  loadedSchemas.clear()
  for (const key of Object.keys(modelRegistry)) {
    delete modelRegistry[key]
  }
}

// ---------------------------------------------------------------------------
// Existing synchronous API — kept for getDataMaps() consumers (e.g. action map)
// ---------------------------------------------------------------------------

/**
 * Get the loaded data map (synchronous).
 * Only returns data for schemas that have been preloaded.
 * Exposed for client use (e.g. resolveActions in index.ts).
 */
export function getDataMaps(): {
  dataMap: Record<string, unknown[]>
} {
  const dataMap: Record<string, unknown[]> = {}

  for (const schemaId of loadedSchemas) {
    const propName = toPascalCase(schemaId)
    const model = modelRegistry[propName]
    if (model) {
      dataMap[schemaId] = model.all()
    }
  }

  return { dataMap }
}

// ---------------------------------------------------------------------------
// Helper utilities
// ---------------------------------------------------------------------------

/**
 * Registry key set, exported for the consistency test ONLY — the loader map
 * itself stays private (it must remain static-literal for bundler-analyzable
 * dynamic imports). lib/registryConsistency.test.ts checks it against
 * zodSchemaMap, which it imports from the generated module directly: a
 * static import of that module here would put the schemas back in every
 * client bundle.
 */
export const _registryKeySets = {
  dataLoaders: Object.keys(dataLoaders),
}

/**
 * Enhanced schema metadata interface
 */
export type EnhancedSchemaMetadata = {
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
 *
 * No `version` — see the note on `SchemaIndex` in tools/generateDocs.ts for why
 * embedding the package version in this generated catalog broke every release
 * PR, and why re-adding it would break them again.
 */
export function getSchemaCatalog(): {
  $schema: string
  title: string
  description: string
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
