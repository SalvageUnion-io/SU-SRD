/**
 * refCatalog — defensive reads over the reference models for control pickers
 * (audit item 24). Previously copy-pasted byte-identical into SalvageControl
 * and CraftingControl (lib/rules/scrapMech.ts carries its own copy — rules
 * modules stay dependency-free of component helpers per ADR-006).
 */

/** Minimal shape read off the reference models for picker/catalog entries. */
export type RefItem = {
  id: string
  name: string
  techLevel?: unknown
  salvageValue?: unknown
}

/** Read a reference model defensively — empty when data isn't preloaded (tests). */
export function loadRef(all: () => ReadonlyArray<unknown>): RefItem[] {
  try {
    return (all() as ReadonlyArray<RefItem>).slice()
  } catch {
    return []
  }
}

/** Numeric Tech Level 1-6, else undefined (Bio/Nanite and junk filtered out). */
export function numericTl(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 6
    ? value
    : undefined
}
