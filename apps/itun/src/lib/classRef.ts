import { SalvageUnionReference } from 'salvageunion-reference'
import { readReference } from './readReference'

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
  const match = readReference(
    'resolveClassName',
    () =>
      SalvageUnionReference.Classes.all().find(
        (c) => c.id === ref || c.name === ref || c.name.toLowerCase() === ref.toLowerCase()
      ),
    undefined
  )
  return match?.name ?? ref
}
