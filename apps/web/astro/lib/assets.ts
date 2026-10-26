/**
 * assets — what a page's head links and addresses: the shared base
 * stylesheet (`virtual:base-stylesheet`,
 * `astro/build/appPlugins.ts`), and the files under `src/assets/`, imported
 * for their hashed URLs.
 */

import base from 'virtual:base-stylesheet'
import eldridgeCoastMap from '../../src/assets/eldridge-coast-map.webp?url'
import { ELDRIDGE_COAST_MAP } from '../../src/lib/builtAssets'
import type { BuiltAssets } from '../../src/reference/types'

export const BUILT_ASSETS: BuiltAssets = { [ELDRIDGE_COAST_MAP]: eldridgeCoastMap }

export const BASE_STYLESHEET = base
