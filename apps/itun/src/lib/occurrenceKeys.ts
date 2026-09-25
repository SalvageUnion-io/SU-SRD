/**
 * React keys for a list whose values may repeat — a mech can install the same
 * system twice, so its slug alone is not a unique key.
 *
 * The obvious fix, `${slug}-${index}`, keys by POSITION: removing the first
 * item renumbers every item after it, so each one remounts and loses its local
 * state (an open repair prompt, a pending confirm), and with duplicates the
 * state of the removed card is inherited by its neighbour. Keying by
 * OCCURRENCE instead — the second copy of a slug is `slug#1` wherever it sits —
 * keeps every other item's key unchanged when one is removed, and only copies
 * of the same slug, which are interchangeable, ever trade keys.
 */
export function occurrenceKeys(values: readonly string[]): string[] {
  const seen = new Map<string, number>()
  return values.map((value) => {
    const n = seen.get(value) ?? 0
    seen.set(value, n + 1)
    return `${value}#${n}`
  })
}
