/**
 * Schema-id naming helpers.
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
