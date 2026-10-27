/**
 * The three wizard routes' shared definition — `/pilots/new`, `/mechs/new`,
 * `/crawlers/new` (`/npcs/new` is the NPC designer, its own). Only what a
 * route DEFINITION needs lives here; the page body is
 * `build/wizard/NewUnitRoute.tsx`, in each route's lazy chunk.
 *
 * No loader: the wizard renders inside GameDataReady, whose preload('all') is
 * already the gate for every route.
 */
import { PRODUCT } from 'game-domain/product'
import { areaTitle } from './pageTitle'
import type { CreateMode } from './wizard/createMode'
import { parseCreateMode } from './wizard/createMode'
import { parseGameParam } from './wizard/fromGame'
import { parseSlugParam } from './wizard/preselect'

export type NewUnitSearch<K extends string = never> = {
  mode: CreateMode
  game?: string | undefined
} & { [P in K]?: string }

/**
 * - mode: absent → chooser · 'guided' → the wizard · 'blank' → blank dialog
 * - game: the Game it lands in, from that Game's page in Play (`lib/wizard/fromGame.ts`)
 * - each of `slugKeys`: a slug deep-linked from an SRD page's "Build with
 *   this" (`lib/wizard/preselect.ts`), kept only when slug-shaped
 */
export function newUnitSearch<K extends string>(
  search: Record<string, unknown>,
  ...slugKeys: K[]
): NewUnitSearch<K> {
  const slugs: Partial<Record<K, string>> = {}
  for (const key of slugKeys) {
    const slug = parseSlugParam(search[key])
    if (slug) slugs[key] = slug
  }
  return {
    mode: parseCreateMode(search.mode),
    // Always set: the root keeps the raw query, so an invalid `game` must be overwritten.
    game: parseGameParam(search.game),
    ...slugs,
  } as NewUnitSearch<K>
}

export function newUnitHead(title: string) {
  return { meta: [{ title: areaTitle(PRODUCT.build, title) }] }
}
