/**
 * What a schema's listing lists: every entry, except on the roll tables, which
 * list only the top-level tables (`topLevelRollTables`), and granted-only gear,
 * which only its grantor gives (`isGrantedOnly`, R63). A table an ability,
 * action or bay prints as its own roll, or an item a class ability grants,
 * keeps its page, its search entry and its place in the sitemap; it is reached
 * from the entry that prints or grants it.
 *
 * Reads the ORM across every schema: build time only (`gameData` preloads
 * them all), never from an island. The page hands the island the ids.
 */

import type { EntitySchemaName, RefEntity } from 'salvageunion-reference'
import {
  EntitySchemaNames,
  SalvageUnionReference,
  topLevelRollTables,
} from 'salvageunion-reference'
import { isGrantedOnly } from 'salvageunion-reference/rules'

export function listingEntries(schemaId: string, data: RefEntity[]): RefEntity[] {
  if (schemaId !== 'roll-tables') {
    const listed = data.filter((entity) => !isGrantedOnly(schemaId, entity))
    return listed.length === data.length ? data : listed
  }
  const others = [...EntitySchemaNames].filter(
    (name): name is Exclude<EntitySchemaName, 'roll-tables'> => name !== 'roll-tables'
  )
  const records = SalvageUnionReference.getAllBySchemaNames(others).map(({ entity }) => entity)
  return topLevelRollTables(data, records)
}
