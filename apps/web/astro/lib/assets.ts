/**
 * assets — the emitted URLs a page addresses: the preloaded faces
 * (`ssg/fontPreloads.ts` names them) and the files under `src/assets/`.
 *
 * Under Astro a module imports an asset and gets its hashed URL, so the
 * manifest round trip `ssg/` needed is gone.
 */

import barlow400 from '@fontsource/barlow/files/barlow-latin-400-normal.woff2?url'
import barlow500 from '@fontsource/barlow/files/barlow-latin-500-normal.woff2?url'
import semi600 from '@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-600-normal.woff2?url'
import semi700 from '@fontsource/barlow-semi-condensed/files/barlow-semi-condensed-latin-700-normal.woff2?url'
import caveat600 from '@fontsource/caveat/files/caveat-latin-600-normal.woff2?url'
import eldridgeCoastMap from '../../src/assets/eldridge-coast-map.webp?url'
import { ELDRIDGE_COAST_MAP } from '../../src/lib/builtAssets'
import type { BuiltAssets } from '../../ssg/types'

export const BUILT_ASSETS: BuiltAssets = { [ELDRIDGE_COAST_MAP]: eldridgeCoastMap }

export const FONT_PRELOADS = { every: [barlow400, barlow500, semi600, semi700], script: caveat600 }
