import type { RefClass } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { readReference } from './readReference'

/**
 * Resolve a pilot's stored class reference to its class. `classRef` may be a
 * class id (UUID, as written by the wizard), a name, or a slug.
 *
 * Classes may not be preloaded in every context (e.g. published snapshots that
 * only hydrate abilities/equipment), so an unloaded catalog resolves to
 * `undefined` rather than throwing.
 */
export function resolveClass(ref: string): RefClass | undefined {
  return readReference(
    'resolveClass',
    () =>
      SalvageUnionReference.Classes.all().find(
        (c) => c.id === ref || c.name === ref || c.name.toLowerCase() === ref.toLowerCase()
      ),
    undefined
  )
}

/**
 * Resolve a pilot's stored class reference to its display name, falling back
 * to the raw ref when no class matches so nothing is lost.
 */
export function resolveClassName(ref: string): string {
  return resolveClass(ref)?.name ?? ref
}
