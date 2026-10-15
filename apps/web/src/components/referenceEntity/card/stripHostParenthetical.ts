/**
 * Strip an action name's ` (Host)` disambiguation suffix when — and only when —
 * it renders nested inside that host's own card.
 *
 * The DATA is correct and stays untouched: several different systems each carry
 * an action named e.g. "Refine", so action names are disambiguated in the
 * dataset as "Refine (Nanite Sifter)" — a uniqueness convention the
 * action-reference validation depends on. But inside the Nanite Sifter card the
 * parent is already established by context, and "REFINE (NANITE SIFTER)" reads
 * as a redundant echo of the card it sits in.
 *
 * Everywhere the host is NOT the established context (the action's own page,
 * search results, listings) the full name must keep rendering — hence the
 * FULL, case-insensitive match of the parenthetical against the host name,
 * never a blanket "strip any trailing parenthetical", which would eat
 * legitimate suffixes like "Beta Fission Gun (Elite Beam Squad)" wherever its
 * squad is not the host.
 */
export function stripHostParenthetical(name: string, hostName: string | undefined): string {
  if (!hostName) return name
  // Trailing `(…)` only (no nested parens inside it); a mid-name parenthetical
  // ("Foo (Bar) Baz") never matches. The base must be non-empty so a name that
  // IS just a parenthetical is left alone.
  const match = name.match(/^(.*\S)\s*\(([^()]+)\)\s*$/)
  if (!match) return name
  const [, base, paren] = match
  if (!base || !paren) return name
  return paren.trim().toLowerCase() === hostName.trim().toLowerCase() ? base : name
}
