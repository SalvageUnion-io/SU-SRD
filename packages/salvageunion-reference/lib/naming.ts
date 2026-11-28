/**
 * Naming helpers: schema ids, and entity names as the book prints them.
 *
 * Zero imports by design: both tools/generateRegistry.ts (a build-time
 * script that must run before any generated code exists) and runtime code
 * (lib/ModelFactory.ts, lib/index.ts) depend on this module, so it must not
 * pull in Zod, data, or any generated file — that would create a bootstrap
 * dependency of codegen on its own output.
 */

/**
 * Convert a kebab-case schema id to its PascalCase model property name.
 * Examples:
 *   abilities -> Abilities
 *   ability-tree-requirements -> AbilityTreeRequirements
 *   classes -> Classes (irregular: stays as-is, not re-pluralized)
 *   npcs -> NPCs (irregular: acronym casing)
 */
export function toPascalCase(id: string): string {
  if (id === 'classes') return 'Classes'
  if (id === 'npcs') return 'NPCs'
  return id
    .split(/[-.]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

/**
 * A name for plain text — a page `<title>`, meta and JSON-LD, a link preview,
 * a Discord heading — which cannot carry the web's CSS caps. A lower-case name
 * (a stored NPC type, a hand-typed one) is title-cased; a name with any
 * capital is already as written and is left alone (the glossaries open theirs
 * on a capital: "Bio-titan").
 *   bio-titan -> Bio-Titan
 *   Mule -> Mule
 */
export function displayTitle(title: string): string {
  return title === title.toLowerCase() ? title.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : title
}
