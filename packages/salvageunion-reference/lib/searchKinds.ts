/**
 * A kind's word inside a query ("engineer class"): the listing it names, and
 * the query without it, which each matcher also searches in that listing
 * (r8 G1). Pure, as `searchRanking.ts` is: it costs a browser bundle nothing
 * but these lines.
 */

import type { RefEnumSchemaName } from './schemas/index'
import type { SearchQuery } from './searchRanking'
import { withoutSentenceMarks } from './searchRanking'

/**
 * The words that name a kind of entry, by the listing they name: "engineer
 * class" asks for the Engineer of the Classes listing (r8 G1). Search's own
 * list, as the aliases are.
 */
const KIND_WORDS: Readonly<Partial<Record<RefEnumSchemaName, readonly string[]>>> = {
  abilities: ['ability', 'abilities'],
  'bio-titans': ['bio-titan', 'bio-titans', 'biotitan', 'biotitans'],
  chassis: ['chassis'],
  classes: ['class', 'classes'],
  crawlers: ['crawler', 'crawlers'],
  creatures: ['creature', 'creatures'],
  drones: ['drone', 'drones'],
  equipment: ['equipment'],
  factions: ['faction', 'factions'],
  keywords: ['keyword', 'keywords'],
  modules: ['module', 'modules'],
  npcs: ['npc', 'npcs'],
  'roll-tables': ['table', 'tables'],
  squads: ['squad', 'squads'],
  systems: ['system', 'systems'],
  traits: ['trait', 'traits'],
  vehicles: ['vehicle', 'vehicles'],
}

/**
 * A query of a name and a word naming its kind ("engineer class", "hot
 * trait"): the kind's listing, and the query without that word. Each matcher
 * also searches that listing for the rest, so the word that names a kind
 * never hides the thing it names. `null` when no word names a kind, or the
 * kind word is all there is.
 */
export function searchKindQuery(
  parsed: SearchQuery | null
): { schemaName: RefEnumSchemaName; query: string } | null {
  if (!parsed || parsed.tokens.length < 2) return null
  for (const [i, token] of parsed.tokens.entries()) {
    const word = withoutSentenceMarks(token)
    const kind = (Object.keys(KIND_WORDS) as RefEnumSchemaName[]).find((name) =>
      KIND_WORDS[name]?.includes(word)
    )
    if (!kind) continue
    return { schemaName: kind, query: parsed.tokens.filter((_, j) => j !== i).join(' ') }
  }
  return null
}
