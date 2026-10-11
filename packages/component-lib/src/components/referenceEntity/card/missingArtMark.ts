import type { SURefMetaEntity } from 'salvageunion-reference'
import {
  getAssetUrl,
  getModel,
  getPageReference,
  getTechLevel,
  SalvageUnionReference,
} from 'salvageunion-reference'

/**
 * Which of the Workshop Manual's three censor marks stands in for an entity's
 * missing artwork, and the torn edge it is cut with (`MissingArt`).
 *
 * - `file`: the redaction patch over a censored system (p.85, p.182);
 * - `row`: the torn strip across a contents row (p.163);
 * - `removed`: the contents' red Removed mark (p.163), set as a rubber stamp.
 */
export type MissingArtVariant = 'file' | 'row' | 'removed'

const VARIANTS: readonly MissingArtVariant[] = ['file', 'row', 'removed']

/** A string's FNV-1a hash: the seed for everything derived per entity. */
function hash(text: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** The entity's stable key: its schema and id. */
function entityKey(entity: SURefMetaEntity): string {
  const schema = 'schemaName' in entity ? String(entity.schemaName) : ''
  return `${schema}/${entity.id}`
}

/**
 * Each art-less entity's place in its schema's art-less run, by tech level then
 * book order, cached per loaded dataset array (a reload is a new array).
 */
/** A tech level to sort by; a lettered one (B, N) or none sorts first. */
function tier(entity: SURefMetaEntity): number {
  const level = getTechLevel(entity)
  return typeof level === 'number' ? level : 0
}

const ordinals = new WeakMap<readonly SURefMetaEntity[], Map<string, number>>()

function artlessOrdinal(entity: SURefMetaEntity): number | undefined {
  const schema = 'schemaName' in entity ? entity.schemaName : undefined
  if (typeof schema !== 'string' || !SalvageUnionReference.isLoaded(schema)) return undefined
  const all = getModel(schema)?.all()
  if (!all) return undefined
  let order = ordinals.get(all)
  if (!order) {
    order = new Map()
    const run = all.filter((item) => !getAssetUrl(item))
    // A stable sort: book order within each tech level, as a listing groups them.
    run.sort((a, b) => tier(a) - tier(b))
    for (const item of run) order.set(item.id, order.size)
    ordinals.set(all, order)
  }
  return order.get(entity.id)
}

/**
 * The mark an entity wears. The schema's art-less entities take the three in
 * turn, in listing order (tech level, then book order), so neighbours differ; the choice reads only the
 * dataset, so the listing and the entity's page always agree. An entity
 * outside a loaded schema falls back to its hash.
 */
export function missingArtVariant(entity: SURefMetaEntity): MissingArtVariant {
  const index = artlessOrdinal(entity) ?? hash(entityKey(entity))
  return VARIANTS[index % VARIANTS.length] ?? 'file'
}

/** The patch's code line, after the manual's `UNION_REG._398.73`. */
export function missingArtCode(entity: SURefMetaEntity): { code: string; short: string } {
  const page = getPageReference(entity)
  const padded = page === undefined ? '000' : String(page).padStart(3, '0')
  return { code: `UNION_ARCHIVE._${padded}`, short: `P.${padded}` }
}

/** A small seeded generator (mulberry32): the same entity tears the same way. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pct = (n: number) => `${Math.round(n * 10) / 10}%`

/**
 * A torn edge as a `clip-path` polygon over the element's own box: each torn
 * side bites up to `depth` percent inward, in `steps` jagged points. `sides`
 * picks which edges tear (a strip tears top and bottom; a patch all four).
 */
export function tornEdge(
  entity: SURefMetaEntity,
  { depth, steps, sides }: { depth: number; steps: number; sides: 'all' | 'long' }
): string {
  const rand = seeded(hash(entityKey(entity)))
  const across = () => rand() * depth
  const down = sides === 'all' ? across : () => 0
  const points: string[] = []
  for (let i = 0; i <= steps; i++) points.push(`${pct((i / steps) * 100)} ${pct(across())}`)
  for (let i = 1; i < steps / 2; i++)
    points.push(`${pct(100 - down())} ${pct((i / (steps / 2)) * 100)}`)
  for (let i = steps; i >= 0; i--) points.push(`${pct((i / steps) * 100)} ${pct(100 - across())}`)
  for (let i = Math.ceil(steps / 2) - 1; i > 0; i--)
    points.push(`${pct(down())} ${pct((i / (steps / 2)) * 100)}`)
  return `polygon(${points.join(', ')})`
}
