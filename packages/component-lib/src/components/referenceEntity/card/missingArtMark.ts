/**
 * How a missing-art censor mark is DRAWN: its torn edge.
 *
 * Which mark an entity wears (`file` patch, `row` strip or `removed` stamp),
 * its code line and its seed are read from the dataset alone, so they live in
 * the entity model: `missingArt` in `salvageunion-reference`
 * (`lib/view/parts/art.ts`). This module only turns the seed into a shape.
 */

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
 * `seed` is the mark's own (`missingArt(entity).seed`).
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
