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
export declare function toPascalCase(id: string): string;
/**
 * A name as the book prints it. The glossaries (keywords, traits) store their
 * names lower-case ("bio-titan"); the web sets them in caps with CSS, which
 * plain text cannot carry — a page `<title>`, meta and JSON-LD, a link
 * preview, a Discord heading. A name with any capital is already as printed
 * and is left alone.
 *   bio-titan -> Bio-Titan
 *   Mule -> Mule
 */
export declare function displayTitle(title: string): string;
