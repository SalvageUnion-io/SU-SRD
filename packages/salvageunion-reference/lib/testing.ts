/**
 * Typed test fixtures for reference entities — the `salvageunion-reference/testing`
 * entry point. Test code only: nothing in a runtime graph imports it.
 *
 * Tests across this package and component-lib used to build entities as object
 * literals cast through `as unknown as SURefEntity`. That cast accepts anything,
 * so a misspelled field (`techlevel`), a field from the wrong schema, or a value
 * of the wrong type compiled silently and the test exercised something other
 * than what it claimed (audit PK-14). There are two honest cases, and one helper
 * for each:
 *
 *   - {@link entityFixture} — a WELL-FORMED entity of one named schema. The
 *     overrides are type-checked against that schema's inferred type, and the
 *     fields every entity requires (`id`, `name`, `source`, `page`) are filled
 *     in, so the result genuinely is the type it claims to be.
 *   - {@link malformed} — a DELIBERATELY invalid value, for tests whose whole
 *     point is that a reader tolerates bad data (a nameless entity, a trait
 *     that is a bare string, `undefined` where a list belongs). The cast is the
 *     same as before; the difference is that it now says, by name, that the
 *     invalidity is intended — so it is greppable and cannot be mistaken for a
 *     lazy fixture.
 */

import type { EntitySchemaName, SchemaToEntityMap } from './generated/schemaRegistry.generated.js'

/** The fields BaseEntitySchema requires of every entity, defaulted per schema. */
function requiredEntityFields(schemaName: EntitySchemaName) {
  return {
    id: `fixture-${schemaName}`,
    name: `Fixture ${schemaName}`,
    source: 'Salvage Union Workshop Manual' as const,
    page: 1,
  }
}

/**
 * A minimal, well-formed entity of `schemaName`, with `fields` layered over the
 * defaulted required fields. Schema-specific required fields that have no
 * universal default (a chassis's stats, a system's slots) come from `fields`;
 * a fixture that omits them is still a `Partial` of the schema at runtime, but
 * every field it DOES set is checked against the schema.
 */
export function entityFixture<K extends EntitySchemaName>(
  schemaName: K,
  fields: Partial<SchemaToEntityMap[K]> = {}
): SchemaToEntityMap[K] {
  // The one cast this module exists to centralise: a Partial plus the base
  // fields is not provably the full schema type, and each schema's remaining
  // required fields are the test's business.
  return { ...requiredEntityFields(schemaName), ...fields } as SchemaToEntityMap[K]
}

/**
 * A deliberately invalid value, typed as `T` so it can be passed where a `T` is
 * expected. Use it only when the test is ABOUT invalid input; for a valid
 * entity use {@link entityFixture}.
 */
export function malformed<T>(value: unknown): T {
  return value as T
}
