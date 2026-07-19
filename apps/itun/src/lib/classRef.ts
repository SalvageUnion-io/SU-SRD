import { SalvageUnionReference } from 'salvageunion-reference'

/**
 * Resolve a pilot's stored class reference to its display name. `classRef` may
 * be a class id (UUID, as written by the wizard), a name, or a slug; fall back
 * to the raw ref when no class matches so nothing is lost.
 *
 * Classes may not be preloaded in every context (e.g. published snapshots that
 * only hydrate abilities/equipment). Fall back to the raw ref rather than
 * throwing if the schema isn't available.
 */
export function resolveClassName(ref: string): string {
  try {
    const all = SalvageUnionReference.Classes.all() as ReadonlyArray<{ id: string; name: string }>
    const match = all.find(
      (c) => c.id === ref || c.name === ref || c.name.toLowerCase() === ref.toLowerCase()
    )
    return match?.name ?? ref
  } catch {
    return ref
  }
}
