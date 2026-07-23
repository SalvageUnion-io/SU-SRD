/**
 * Runtime guard for canonical schema names — the set of non-meta schemas
 * search() indexes, which is exactly what can appear in an autocomplete
 * choice value (`schemaName::slug`) or the schema catalog. Narrows an
 * untrusted string (Discord clients can send arbitrary option values)
 * by membership check instead of a blind assertion.
 *
 * `getSchemaCatalog()` reads only the static schema index and needs no
 * preload, so the lazily-built set is safe to construct at first use even
 * before the bot's startup preload completes.
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
