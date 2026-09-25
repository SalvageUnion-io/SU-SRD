/**
 * The validating half of `preload()` — reached ONLY through a dynamic
 * `import()` from `ModelFactory.loadSchemas` when a caller passes
 * `{ validate: true }` (audit PK-04).
 *
 * It is a module of its own, rather than a dynamic import of `zod.ts` and the
 * schema map inside ModelFactory, for a bundle-size reason: a dynamically
 * imported module is used as a whole namespace, which bundlers cannot tree-
 * shake. `await import('./zod.js')` would hand over the entire `z` namespace
 * and drag every Zod locale into the shared Zod chunk (~100 KB, measured in
 * itun). Here `z` is imported statically and used through plain member
 * accesses, so the unused parts of Zod stay out, and only this module's one
 * export is the dynamic boundary.
 */
import { zodSchemaMap } from './generated/zodSchemaMap.generated.js'
import { z } from './zod.js'

/** Parse one data file through its schema; throw a readable error if it fails. */
export function validateRows(schemaId: string, rawData: unknown[]): unknown[] {
  const zodSchema = zodSchemaMap[schemaId]
  if (!zodSchema) throw new Error(`No Zod schema found for schema ID: ${schemaId}`)
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
