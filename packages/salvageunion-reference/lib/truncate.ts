/**
 * Cap `text` at `max` characters, ellipsis included, cutting at the last word
 * boundary when one falls in the final 40% of the budget and mid-word only when
 * none does (one very long word).
 *
 * Shared by the Discord bot (embed limits) and srd (meta descriptions).
 */
export function truncate(text: string, max: number): string {
  if (max <= 0) return ''
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max - 1)}…`
}
