import { getEntitySchemas } from 'salvageunion-reference'
import { schemaHref } from './entityHref'

/** A listing a missed address was aiming at: its name and its page. */
export type ListingGuess = { schemaId: string; label: string; href: string }

/** How many listings a miss is offered. */
const LIMIT = 2

const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/** The edits (insert, delete, swap one letter) between two short words, capped at `max + 1`. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) {
      const swap = (row[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)
      next.push(Math.min(swap, (row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1))
    }
    row = next
  }
  return row[b.length] ?? max + 1
}

/** How far a path segment is from a listing's id or name: 0 the same, up to a typo or two. */
function distanceTo(segment: string, names: readonly string[]): number {
  // A short word forgives one slip, a longer one two.
  const max = segment.length <= 5 ? 1 : 2
  return Math.min(...names.map((name) => editDistance(segment, name, max)))
}

/**
 * The listings a missed address names, nearest first: each path segment read
 * against every listing's id and name, a typo or two forgiven (`/chasis/` is
 * Chassis, `/chassis/atlas/patterns/` is Chassis too). None for an address
 * that names no listing.
 */
export function listingGuessesFor(pathname: string): ListingGuess[] {
  const segments = pathname
    .split('/')
    .map(squash)
    .filter((segment) => segment.length >= 3)
  if (segments.length === 0) return []
  const scored = getEntitySchemas().flatMap((schema) => {
    const names = [schema.id, schema.displayName, schema.displayNamePlural].map(squash)
    const distance = Math.min(...segments.map((segment) => distanceTo(segment, names)))
    const allowed = Math.max(...segments.map((segment) => (segment.length <= 5 ? 1 : 2)))
    return distance <= allowed
      ? [
          {
            distance,
            schemaId: schema.id,
            label: schema.displayNamePlural,
            href: schemaHref(schema.id),
          },
        ]
      : []
  })
  // Only the nearest: a listing two slips away is noise beside an exact one.
  const nearest = Math.min(...scored.map((guess) => guess.distance))
  return scored
    .filter((guess) => guess.distance === nearest)
    .slice(0, LIMIT)
    .map(({ distance: _distance, ...guess }) => guess)
}

/**
 * The entry a missed address sits under: `/chassis/atlas/patterns/` names the
 * Chassis listing and then `atlas`, so Atlas is the page the reader was on
 * the way to. Its schema and slug, or none.
 */
export function ancestorOf(pathname: string): { schemaId: string; slug: string } | undefined {
  const [first, second, third] = pathname.split('/').filter(Boolean)
  if (!first || !second || !third) return undefined
  const schema = getEntitySchemas().find((entry) => entry.id === first.toLowerCase())
  return schema ? { schemaId: schema.id, slug: second.toLowerCase() } : undefined
}
