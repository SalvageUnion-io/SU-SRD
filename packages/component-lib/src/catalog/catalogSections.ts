/**
 * `buildCatalogSections` — the SRD catalog (the landing page's category
 * sections and their tiles), wired to the real ORM and the real tile colours.
 *
 * `buildCatalogCategories` stays dependency-injected so it can be unit-tested
 * without the ORM; this is the one place those dependencies are bound, so
 * every surface that shows the catalog — srd's landing page, its top nav, and
 * the Dashboard's SRD Explorer — renders the *same* sections from the *same*
 * source instead of each hand-listing schemas.
 *
 * Preload hazard: this reads the ORM, so call it only after
 * `SalvageUnionReference.preload('all')` has resolved (srd's build-time
 * `gameData` import, the Dashboard's readiness gate) — never at module scope.
 */

import {
  getReferenceEntityData,
  getSchemaCatalog,
  SalvageUnionReference,
} from 'salvageunion-reference'
import { getCatalogBg, getCatalogLabel } from './catalogColors'
import type { CatalogSection } from './catalogHelpers'
import { buildCatalogCategories } from './catalogHelpers'

export function buildCatalogSections(): CatalogSection[] {
  const schemas = getSchemaCatalog().schemas.filter((s) => !s.meta)
  return buildCatalogCategories({
    catalogCategories: SalvageUnionReference.CatalogCategories.all(),
    schemaMap: new Map(schemas.map((s) => [s.id, s])),
    findAllIn: (schemaName, pred) => SalvageUnionReference.findAllIn(schemaName, pred),
    getReferenceEntityData,
    getCatalogBg,
    getCatalogLabel,
  })
}
