/**
 * The NAME INDEX: every entry by its name, for prose and chat that name it in
 * plain words. The SRD's in-prose Mentions (`findNameRefs`, apps/web) and the
 * bot's "Look up in Salvage Union" (`termFinder`) both read it, so a phrase
 * means the same entry on both.
 *
 * When kinds share a name, the order below decides the default: the glossary
 * the rules text leans on first (ranges, traits, keywords), then the units and
 * gear a reader looks up, abilities and roll tables last — a roll table named
 * for its system ("Reactor Overload") is the system unless the prose says
 * "… Table". Two entries of the SAME kind sharing a name are ambiguous: that
 * name means neither (`ambiguous`).
 *
 * Read after the data is loaded (`SalvageUnionReference.preload`); built once.
 */

import { getDataMaps, getSchemaCatalog } from './ModelFactory'
import type { RefEntity } from './schemas/index'
import { isSchemaName } from './search'
import { getEntitySlug } from './slug'
import type { EntityRef } from './view/types'

/** One entry a name may mean, and how prose names it. */
export type NameRefCandidate = {
  ref: EntityRef
  /** The noun the prose follows this kind's name with ("Trait", "Table"). */
  noun?: string
  /** The noun joins the link: a table is "the Critical Damage Table". */
  nounInLink?: boolean
  /** Links only followed by its noun. */
  needsNoun?: boolean
  /** A range: links followed by its noun or after a preposition ("within Close"). */
  range?: boolean
}

/** Name (lower case) → the entries it may mean, the default first. */
export type NameRefIndex = Record<string, NameRefCandidate[]>

/** How each kind's names link, in default order. */
const KINDS: readonly {
  schema: string
  noun?: string
  /** Links only with its noun: always, or when the name is one word. */
  needsNoun?: 'always' | 'one-word'
  range?: boolean
  /** The noun joins the link ("Critical Damage Table"). */
  nounInLink?: boolean
}[] = [
  { schema: 'distances', noun: 'Range', range: true },
  { schema: 'traits', noun: 'Trait' },
  { schema: 'keywords' },
  { schema: 'chassis', noun: 'Chassis' },
  { schema: 'crawlers', noun: 'Crawler' },
  { schema: 'crawler-bays' },
  { schema: 'classes', noun: 'Class' },
  { schema: 'systems', noun: 'System' },
  { schema: 'modules', noun: 'Module' },
  { schema: 'equipment' },
  { schema: 'drones', noun: 'Drone' },
  { schema: 'vehicles', noun: 'Vehicle' },
  { schema: 'npcs' },
  { schema: 'squads', noun: 'Squad' },
  { schema: 'creatures' },
  { schema: 'bio-titans' },
  { schema: 'meld' },
  { schema: 'factions', noun: 'Faction' },
  { schema: 'crawler-tech-levels' },
  { schema: 'tech-levels' },
  { schema: 'abilities', noun: 'Ability', needsNoun: 'one-word' },
  { schema: 'roll-tables', noun: 'Table', needsNoun: 'one-word', nounInLink: true },
  { schema: 'guides', needsNoun: 'always' },
]

type Built = { index: NameRefIndex; ambiguous: Map<string, EntityRef[]> }

let built: Built | undefined

/** The index, and the names two entries of one kind share. Built once. */
export function nameRefIndex(): Readonly<Built> {
  if (built) return built
  const entities = new Set(getSchemaCatalog().schemas.flatMap((s) => (s.meta ? [] : [s.id])))
  const { dataMap } = getDataMaps()
  const byName = new Map<string, NameRefCandidate[]>()
  const ambiguous = new Map<string, EntityRef[]>()
  for (const kind of KINDS) {
    const schemaName = kind.schema
    if (!entities.has(schemaName) || !isSchemaName(schemaName)) continue
    const own = new Map<string, EntityRef[]>()
    for (const entity of (dataMap[schemaName] as RefEntity[] | undefined) ?? []) {
      if (!('id' in entity) || !entity.id || typeof entity.name !== 'string') continue
      const key = entity.name.trim().toLowerCase()
      if (key.length < 3) continue
      const ref: EntityRef = {
        schemaName,
        id: entity.id,
        slug: getEntitySlug(entity),
        name: entity.name,
      }
      own.set(key, [...(own.get(key) ?? []), ref])
    }
    for (const [key, refs] of own) {
      const [ref] = refs
      if (!ref) continue
      if (refs.length > 1) {
        ambiguous.set(key, [...(ambiguous.get(key) ?? []), ...refs])
        continue
      }
      const oneWord = !key.includes(' ')
      const needsNoun = kind.needsNoun === 'always' || (kind.needsNoun === 'one-word' && oneWord)
      const candidate: NameRefCandidate = {
        ref,
        ...(kind.noun ? { noun: kind.noun } : {}),
        ...(needsNoun ? { needsNoun: true } : {}),
        ...(kind.range ? { range: true } : {}),
        ...(kind.nounInLink ? { nounInLink: true } : {}),
      }
      byName.set(key, [...(byName.get(key) ?? []), candidate])
    }
  }
  built = { index: Object.fromEntries(byName), ambiguous }
  return built
}
