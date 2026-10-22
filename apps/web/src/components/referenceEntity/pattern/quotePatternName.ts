/**
 * A pattern's title is its name in typographic quotes — “TOW RIG”, never
 * "TOW RIG". Every surface that titles a pattern — the card, the
 * shelf row, the Save preview, the public pattern band — routes through here.
 */
export function quotePatternName(name: string): string {
  return `“${name}”`
}
