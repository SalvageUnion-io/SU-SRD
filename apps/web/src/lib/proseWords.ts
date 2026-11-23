/**
 * Rules text's trait markup read as its words — `[[Vulnerable]]` as
 * "Vulnerable", `[[[Hot] (3)]]` as "Hot (3)" — for a line that prints words
 * alone (a table notice, a toast), where a Mention cannot load: the root
 * layout's notices stay light (r8 B2). The grammar is the package's
 * (`parseTraitReferences`); a surface that links its names reads `TraitProse`.
 */
export function proseWords(text: string): string {
  if (!text.includes('[[')) return text
  return text
    .replace(/\[\[\[([^\][]+)\]\s*\(([^)(]+)\)\]\]/g, '$1 ($2)')
    .replace(/\[\[([^\][]+)\]\]/g, '$1')
}
