/**
 * Build-time name-reference index: every entity with a page, by its name, for
 * the prose that names it in plain words (`findNameRefs`). The server renders
 * against the whole index; an island gets just the names its page's prose
 * uses (`nameRefsFor`), so the browser resolves a name without loading
 * another schema.
 *
 * When kinds share a name, the order below decides the default: the glossary
 * the rules text leans on first (ranges, traits, keywords), then the units and
 * gear a reader looks up, abilities and roll tables last — a roll table named
 * for its system ("Reactor Overload") is the system unless the prose says
 * "… Table". Two entries of the SAME kind sharing a name are ambiguous: that
 * name links nowhere (`ambiguousNames`, held by its test).
 */

import type { EntityRef, RefEntity } from 'salvageunion-reference'
import { getEntitySlug, isSchemaName } from 'salvageunion-reference'
import type { NameRefCandidate, NameRefIndex } from '../components/index'
import { findNameRefs } from '../components/index'
import { getEntitySchemas, SalvageUnionReference } from './gameData'

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

function build(): Built {
  if (built) return built
  const pages = new Set(getEntitySchemas().map((schema) => schema.id))
  const byName = new Map<string, NameRefCandidate[]>()
  const ambiguous = new Map<string, EntityRef[]>()
  for (const kind of KINDS) {
    const schemaName = kind.schema
    if (!pages.has(schemaName) || !isSchemaName(schemaName)) continue
    const own = new Map<string, EntityRef[]>()
    for (const entity of SalvageUnionReference.findAllIn(schemaName, () => true)) {
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

/** The whole index, for the server's render. */
export function nameRefIndex(): NameRefIndex {
  return build().index
}

/** The names two entries of one kind share: they link nowhere. */
export function ambiguousNames(): ReadonlyMap<string, readonly EntityRef[]> {
  return build().ambiguous
}

const perEntity = new Map<string, NameRefIndex>()

/** The whole index less `id`'s own name: an entity's prose never links its own page. */
export function nameRefIndexWithout(id: string | undefined): NameRefIndex {
  const { index } = build()
  if (!id) return index
  const known = perEntity.get(id)
  if (known) return known
  const own = Object.entries(index).filter(([, candidates]) =>
    candidates.some((candidate) => candidate.ref.id === id)
  )
  if (own.length === 0) return index
  // Its own name in its own prose is itself, never a namesake ("If the Trading
  // Bay becomes damaged" is the bay), unless its noun says so ("roll on the
  // Trading Bay Table" is the table).
  const without: NameRefIndex = { ...index }
  for (const [key, candidates] of own) {
    const namesakes = candidates
      .filter((candidate) => candidate.ref.id !== id && candidate.noun)
      .map((candidate) => ({ ...candidate, needsNoun: true }))
    if (namesakes.length > 0) without[key] = namesakes
    else delete without[key]
  }
  perEntity.set(id, without)
  return without
}

/**
 * The part of `index` that `texts` use: what an island needs to resolve the
 * same names in the browser, or `undefined` when they name nothing.
 */
function nameRefSubset(index: NameRefIndex, texts: readonly string[]): NameRefIndex | undefined {
  const used = new Set<string>()
  for (const text of texts) {
    for (const match of findNameRefs(text, index)) used.add(match.ref.name.trim().toLowerCase())
  }
  if (used.size === 0) return undefined
  return Object.fromEntries([...used].flatMap((key) => (index[key] ? [[key, index[key]]] : [])))
}

/** Every string a record holds, for the names its prose may use. */
function proseOf(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') into.push(value)
  else if (Array.isArray(value)) for (const item of value) proseOf(item, into)
  else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) proseOf(item, into)
  }
  return into
}

/**
 * The names an island's card resolves in the browser: those its own record's
 * prose and the card's rendered `text` use (the card also draws what it
 * carries: a class's ability tree, a chassis's patterns), less itself.
 */
export function nameRefsFor(
  item: RefEntity,
  text: readonly string[] = []
): NameRefIndex | undefined {
  return nameRefSubset(nameRefIndexWithout(item.id), [...proseOf(item), ...text])
}
