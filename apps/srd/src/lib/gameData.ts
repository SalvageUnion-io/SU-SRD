/**
 * Game data preload for Astro SSG.
 *
 * Import this module before using SalvageUnionReference in any .astro file.
 * The top-level await ensures data is loaded before any ORM calls.
 * Re-exports commonly used functions so consumers only need one import.
 */
import { SalvageUnionReference } from 'salvageunion-reference'

// This module is imported only by .astro pages and server route files
// (*.json.ts, llms.txt.ts, etc.) — never by a client island — so this eager
// `preload('all')` runs at BUILD time during static generation and never ships
// to a browser bundle. Client islands load reference data via the separate,
// already-lazy `useGameData.tsx` path (per-schema dynamic import). Keeping the
// full preload here is correct: it makes ORM lookups synchronous during SSG.
if (!SalvageUnionReference.isLoaded('chassis')) {
  await SalvageUnionReference.preload('all')
}

export {
  extractStaticEntitySummary,
  getEntitySchemas,
  getModel,
  getReferenceEntityData,
  getSchemaCatalog,
  getUniqueSources,
  getUniqueTechLevels,
  getUniqueTrees,
} from 'salvageunion-reference'
export { SalvageUnionReference }
