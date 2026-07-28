/**
 * Runtime guard for canonical schema names. The JSON schema catalog types
 * every schema `id` as plain `string`; instead of blindly asserting
 * `as SURefEnumSchemaName` at each use site, this narrows a string by
 * checking membership in the non-meta schema catalog — the same set entity
 * pages, the search index, and catalog tiles are generated from.
 *
 * Kept dependency-light (no `./gameData` import, which preloads the full ORM
 * at module load): `getSchemaCatalog()` reads only the static schema index
 * and needs no preload, so this is safe from any build-time or test context.
 */
import { getSchemaCatalog } from 'salvageunion-reference'
import type { SURefEnumSchemaName } from 'salvageunion-reference'

let knownSchemaNames: ReadonlySet<string> | null = null

export function isSchemaName(id: string): id is SURefEnumSchemaName {
  knownSchemaNames ??= new Set(
    getSchemaCatalog()
      .schemas.filter((s) => !s.meta)
      .map((s) => s.id)
  )
  return knownSchemaNames.has(id)
}
