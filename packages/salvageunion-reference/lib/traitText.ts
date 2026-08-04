/**
 * Trait-reference markup in rules text: `[[TraitName]]` and
 * `[[[TraitName] (param)]]`.
 *
 * Pure string work — nothing here touches entities or the ORM. Split out of the
 * old `lib/utilities.ts` grab bag; still re-exported from there (and from the
 * package barrel), so this is an internal home, not a new public surface.
 */

/**
 * Represents a parsed trait reference from text
 */

export type ParsedTraitReference = {
  /** The full matched text including brackets */
  fullMatch: string

  /** The trait name (e.g., "Hot", "Burn", "Explosive") */
  traitName: string

  /** The parameter if present (e.g., "3", "X", "2") */
  parameter?: string

  /** The start index of the match in the original text */
  startIndex: number

  /** The end index of the match in the original text */
  endIndex: number
}

/**
 * Parse trait references from text
 * Handles both simple [[TraitName]] and parameterized [[[TraitName] (param)]] formats
 * @param text - The text to parse for trait references
 * @returns Array of parsed trait references
 *
 * @example
 * const text = "This has the [[Shield]] Trait and [[[Hot] (3)]] Trait"
 * const refs = parseTraitReferences(text)
 * // => [
 * //   { fullMatch: "[[Shield]]", traitName: "Shield", startIndex: 13, endIndex: 23 },
 * //   { fullMatch: "[[[Hot] (3)]]", traitName: "Hot", parameter: "3", startIndex: 35, endIndex: 48 }
 * // ]
 */

export function parseTraitReferences(text: string): ParsedTraitReference[] {
  const references: ParsedTraitReference[] = []

  // The name/param classes exclude their own OPENING delimiter as well as the
  // closing one, so every scan is bounded at the next `[` / `(` instead of
  // running to end-of-string from each of many `[[` starts (quadratic).
  //
  // The word-shape requirement that used to live in the regex
  // (`[A-Z][A-Za-z-]+(?:\s+[A-Z][A-Za-z-]+)*`) moved to `isTraitName` below:
  // as a regex it nested a quantifier inside a quantifier, which backtracks
  // quadratically on input like `[[[Aa Aa Aa Aa …`. The predicate is a linear
  // scan and accepts exactly the same set of names.

  // Pattern for parameterized traits: [[[TraitName] (param)]]
  const paramPattern = /\[\[\[([^\][]+)\]\s+\(([^)(]+)\)\]\]/g

  // Pattern for simple traits: [[TraitName]]
  const simplePattern = /\[\[([^\][]+)\]\]/g

  // Find all parameterized trait references first
  let match = paramPattern.exec(text)
  while (match !== null) {
    const traitName = match[1]
    const parameter = match[2]
    if (traitName && parameter) {
      references.push({
        fullMatch: match[0],
        traitName,
        parameter,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      })
    }
    match = paramPattern.exec(text)
  }

  // Find all simple trait references
  match = simplePattern.exec(text)
  while (match !== null) {
    const current = match

    // Skip if this position is already covered by a parameterized match
    const isAlreadyMatched = references.some(
      (ref) => current.index >= ref.startIndex && current.index < ref.endIndex
    )

    if (!isAlreadyMatched) {
      const traitName = current[1]
      if (traitName) {
        references.push({
          fullMatch: current[0],
          traitName,
          startIndex: current.index,
          endIndex: current.index + current[0].length,
        })
      }
    }
    match = simplePattern.exec(text)
  }

  // Sort by start index
  references.sort((a, b) => a.startIndex - b.startIndex)

  return references
}
