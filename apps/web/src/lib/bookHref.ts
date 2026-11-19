import type { EntityPrinting, EntityRef } from 'salvageunion-reference'
import { entityRef, SalvageUnionReference } from 'salvageunion-reference'
import { srdHrefFor } from './entityHref'

/**
 * Each printing's BOOK PAGE (ruleset Source 2): the Sources record its
 * `source` names, through `hrefFor` (a surface's routes; the reference
 * site's by default). A printing with no source, or a surface with no routes,
 * gets none, and its cite stays text. So does every printing where the
 * books are not loaded (an app surface that never asks for them).
 */
export function bookHrefs(
  printings: readonly EntityPrinting[],
  hrefFor: (ref: EntityRef) => string | undefined = srdHrefFor
): (string | undefined)[] {
  if (!SalvageUnionReference.isLoaded('sources', { projection: 'list' })) return []
  return printings.map(({ source }) => {
    const book = source ? SalvageUnionReference.Sources.getByName(source) : undefined
    return book ? hrefFor(entityRef(book)) : undefined
  })
}
