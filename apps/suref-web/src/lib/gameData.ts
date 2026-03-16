/**
 * Game data preload for Astro SSG.
 *
 * Import this module before using SalvageUnionReference in any .astro file.
 * The top-level await ensures data is loaded before any ORM calls.
 * Re-exports commonly used functions so consumers only need one import.
 */
import { SalvageUnionReference } from 'salvageunion-reference'

if (!SalvageUnionReference.isLoaded('chassis')) {
  await SalvageUnionReference.preload('all')
}

export { SalvageUnionReference }
export {
  getSchemaCatalog,
  getReferenceEntityData,
  getModel,
  getEntitySchemas,
  getJsonSchemaDefinition,
  getUniqueTechLevels,
  getUniqueSources,
  extractStaticEntitySummary,
} from 'salvageunion-reference'
