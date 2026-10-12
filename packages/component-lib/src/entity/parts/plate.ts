/** The schemas whose entity IS a tech level: their plate is the numeral. */
export const TECH_LEVEL_SCHEMAS: ReadonlySet<string> = new Set([
  'tech-levels',
  'crawler-tech-levels',
])

/**
 * The plate of a tile with no art place that is not a tech level (a crawler
 * type, a distance, a faction): the initials of the name's first two words that open
 * on a letter — "Trade Caravan" TC, "Close" C, "Crawler #693 Salvagers" CS.
 */
export function monogram(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => /^\p{L}/u.test(word))
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
}
