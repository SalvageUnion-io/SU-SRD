/**
 * Where a Page's actions stand (`CardPage`, a Page with no art): the actions
 * an entity holds within it are the side track's, beside its words. A Page
 * that is mostly actions (a short line over several of them) splits them
 * between the tracks instead, the first in the main track under the words and
 * the rest in the side track, so neither track runs long while the other
 * stands empty.
 */

/** Keys that are a record's identity or its links, never words a reader reads. */
const NOT_WORDS = new Set(['id', 'name', 'source', 'page', 'slug', 'actions', 'schemaName'])

/** How many characters of words a record carries: every string under it, less its identity. */
export function wordCount(value: unknown): number {
  if (typeof value === 'string') return value.length
  if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + wordCount(item), 0)
  if (value && typeof value === 'object') {
    let sum = 0
    for (const [key, item] of Object.entries(value)) {
      if (!NOT_WORDS.has(key)) sum += wordCount(item)
    }
    return sum
  }
  return 0
}

export type ActionSplit<T> = { main: T[]; side: T[] }

/**
 * The actions in two runs, book order kept: `main` under the words, `side` in
 * the side track. A Page whose actions outweigh its words twice over (and has
 * two or more) is mostly actions: the main track takes actions until it holds
 * about half the Page's words, the side the rest, never none. Any other Page
 * keeps them all in the side track.
 */
export function splitActions<T>(entity: unknown, actions: readonly T[]): ActionSplit<T> {
  const own = wordCount(entity)
  const sizes = actions.map((action) => wordCount(action))
  const acts = sizes.reduce((sum, size) => sum + size, 0)
  if (actions.length < 2 || acts <= own * 2) return { main: [], side: [...actions] }
  const half = (own + acts) / 2
  let main = own
  let cut = 0
  // An action joins the main track while its middle still falls in the first half.
  while (cut < actions.length - 1 && main + (sizes[cut] ?? 0) / 2 < half) {
    main += sizes[cut] ?? 0
    cut += 1
  }
  return { main: actions.slice(0, cut), side: actions.slice(cut) }
}
