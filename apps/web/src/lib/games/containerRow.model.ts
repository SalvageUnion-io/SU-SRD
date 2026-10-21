/**
 * A container as a Compact draws it (ruleset §1.9: a Game is a Compact that links),
 * wherever one is listed: the Play hub's Your Games, and the places a unit can
 * move to (`ContainerPicker`'s `list`). Synthetic models: a Game and the
 * Training Bay are no reference entities, so neither Peeks.
 */

import { PRODUCT } from 'game-domain/product'
import { nameToSlug } from 'salvageunion-reference'
import type { EntityFormModel } from '../../components/index'
import { syntheticModel } from '../units/syntheticModel'

/** A Game: its name on the crawler's tone, as its band wears it. */
export function gameRowModel(name: string): EntityFormModel {
  const slug = nameToSlug(name)
  return syntheticModel({
    schemaName: 'crawlers',
    id: `game/${slug}`,
    slug,
    name,
    kind: { label: 'Game', domain: 'crawler' },
    tone: 'crawler',
  })
}

/**
 * The Training Bay, a unit's place out of every Game, in ink, under the name
 * its list gives it ("Not in a Game"). Its id is `hangar/` plus that name.
 */
export function hangarRowModel(name: string): EntityFormModel {
  const slug = nameToSlug(name)
  return syntheticModel({
    schemaName: 'crawlers',
    id: `hangar/${slug}`,
    slug,
    name,
    kind: { label: PRODUCT.build, domain: 'crawler' },
    tone: 'ink',
  })
}
