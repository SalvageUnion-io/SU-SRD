/**
 * Model Factory - Auto-generates models from schema catalog
 * Uses lazy (dynamic) imports for JSON data files so consumers
 * can code-split the ~1.1 MB data corpus via SalvageUnionReference.preload().
 *
 * The three registries below (dataLoaders, zodSchemaMap, schemaDisplayNames)
 * are generated from lib/schemas/registry.ts by
 * tools/generateRegistry.ts into lib/generated/modelFactoryRegistry.generated.ts
 * — run `bun run build:package` to regenerate after editing the manifest.
 */

import schemaIndex from '../schemas/index.json' with { type: 'json' }
import { BaseModel } from './BaseModel.js'
import {
  dataLoaders,
  schemaDisplayNames,
  zodSchemaMap,
} from './generated/modelFactoryRegistry.generated.js'
import { toPascalCase } from './naming.js'
import { z } from './zod.js'

export { schemaDisplayNames, toPascalCase, zodSchemaMap }

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
export async function loadSchemas(schemas: string[] | 'all'): Promise<void> {
  const ids = schemas === 'all' ? Object.keys(dataLoaders) : schemas

  // Only load schemas not yet loaded
  const pending = ids.filter((id) => !loadedSchemas.has(id))
  if (pending.length === 0) return

  await Promise.all(pending.map((id) => loadSingleSchema(id)))
}

async function loadSingleSchema(schemaId: string): Promise<void> {
  const dataLoader = dataLoaders[schemaId]
  const zodSchema = zodSchemaMap[schemaId]

  if (!dataLoader || !zodSchema) {
    throw new Error(`No loader found for schema ID: ${schemaId}`)
  }

  const rawData = await dataLoader()

  const validatedData = validateAndParseData(schemaId, rawData, zodSchema)
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
 * Registry key sets, exported for the consistency test ONLY — the loader
 * maps themselves stay private (they must remain static-literal for
 * bundler-analyzable dynamic imports). Every map here must cover exactly
 * the same schema ids; lib/registryConsistency.test.ts enforces it.
 */
export const _registryKeySets = {
  dataLoaders: Object.keys(dataLoaders),
  zodSchemaMap: Object.keys(zodSchemaMap),
}

/**
 * Validate and parse data using Zod schema
 */
function validateAndParseData<T>(
  schemaId: string,
  rawData: unknown[],
  zodSchema: z.ZodType<T>
): T[] {
  try {
    return z.array(zodSchema).parse(rawData)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error(`Validation error for schema ${schemaId}:`, error.issues)
      throw new Error(
        `Data validation failed for ${schemaId}: ${error.issues.map((e: { message: string }) => e.message).join(', ')}`,
        { cause: error }
      )
    }
    throw error
  }
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
 */
export function getSchemaCatalog(): {
  $schema: string
  title: string
  description: string
  version: string
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
