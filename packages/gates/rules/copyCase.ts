/** How the copy rule reads a term's casing (`copyTerms.ts`). */

/**
 * `term(s)`, any casing, words joined by any whitespace. A hyphen, a slash or
 * a dot joined to a word on either side is a slug, a class name or a host
 * (`su-mech-card`, `/schema/mech/`, `salvageunion.io/build`), not a word.
 */
export function termPattern(term: string): RegExp {
  const body = term
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('\\s+')
  return new RegExp(`(?<![\\w/-]|\\w\\.)${body}s?(?![\\w/-]|\\.\\w)`, 'gi')
}

/** Every word of the match starts upper case ("Mech", "Hit Points", "Bio-Titan", "MECH"). */
export const isCapitalised = (match: string) => match.split(/[\s-]+/).every((w) => /^[A-Z]/.test(w))

/**
 * The genre's name, not the game's noun: "a post-apocalyptic mech TTRPG" (the
 * home's pitch, About, llms.txt) names the kind of game, as "mech tabletop RPG"
 * does, so its "mech" keeps the sentence's case. Only that phrase: every other
 * lower-case "mech" is still the noun.
 */
export const GENRE_AFTER = /^\s+(?:TTRPG|tabletop RPG)(?![\w-])/

export const titleCase = (term: string) =>
  term.replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
