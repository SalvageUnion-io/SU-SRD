/**
 * Which of the Workshop Manual's censor marks an art-less catalog index Compact wears,
 * and how its torn edge is drawn. The mark stands in for art only in a catalog
 * that has some (`CompactIndex`'s `missingArt`), so the index Compacts keep one height.
 */

import { assetUrl } from 'salvageunion-reference'
import { fnv1a } from '../../../lib/fnv1a'

/** The manual's three marks: a torn ink patch, a torn strip, a REMOVED stamp. */
type CensorVariant = 'file' | 'row' | 'removed'

export type CensorMark = {
  variant: CensorVariant
  /** The patch's code line, after the manual's `UNION_REG._398.73`: "P.012". */
  code: string
  /** Tears the edge the same way on every render. */
  seed: number
  /** The master URL of the faded blueprint drawn behind the mark. */
  backdrop: string
}

const VARIANTS: readonly CensorVariant[] = ['file', 'row', 'removed']

/** Rainmaker's chassis blueprints, the faded drawing behind every mark. Seven,
 * coprime with the three marks, so a run's neighbours differ in both. */
const BLUEPRINTS: readonly string[] = [
  'wader',
  'stolas',
  'paladin',
  'ravager',
  'agares',
  'black-dragon',
  'cerberus',
].map((slug) => assetUrl(`chassis/${slug}.webp`))

/**
 * The mark for one entity: `ordinal` is its place among the catalog's art-less
 * entities, so the marks and blueprints turn in listing order and neighbours
 * differ; `key` (schema and id) seeds the tear.
 */
export function censorMark(key: string, ordinal: number, page: number | undefined): CensorMark {
  return {
    variant: VARIANTS[ordinal % VARIANTS.length] ?? 'file',
    code: `P.${page === undefined ? '000' : String(page).padStart(3, '0')}`,
    seed: fnv1a(key),
    backdrop: BLUEPRINTS[ordinal % BLUEPRINTS.length] ?? '',
  }
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
  seed: number,
  { depth, steps, sides }: { depth: number; steps: number; sides: 'all' | 'long' }
): string {
  const rand = seeded(seed)
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
