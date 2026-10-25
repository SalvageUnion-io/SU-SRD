/** The expansion resources' names on the crawler sheet, by pool bucket. */

import type { ExoticKey } from '../../lib/rules/exoticSalvage'
import { buildSheetCopy } from '../../messages/build-sheet'

export const EXOTIC_NAME: Record<ExoticKey, string> = {
  bio: buildSheetCopy('bioSalvage'),
  chimerium: buildSheetCopy('chimerium'),
  inertNanites: buildSheetCopy('inertNanites'),
  activeNanites: buildSheetCopy('activeNanites'),
}
