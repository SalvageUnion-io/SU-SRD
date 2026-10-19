/**
 * A container as a Row draws it (ruleset §1.9: a Game is a Row that links),
 * wherever one is listed: the Play hub's Your Games, and the places a unit can
 * move to (`ContainerPicker`'s `list`). Synthetic models: a Game and the
 * Hangar are no reference entities, so neither Peeks.
 */

import { nameToSlug } from 'salvageunion-reference'
import type { EntityRowModel } from '../../components/index'

/** A Game: its name on the crawler's tone, as its band wears it. */
export function gameRowModel(name: string): EntityRowModel {
  const slug = nameToSlug(name)
  return {
    ref: { schemaName: 'crawlers', id: `game/${slug}`, slug, name, synthetic: true },
    title: name,
    kind: { stamp: 'Game', type: 'Game', domain: 'crawler', nature: 'have' },
    tone: 'crawler',
    facts: [],
    traits: [],
    art: { kind: 'none' },
  }
}

/**
 * The Hangar, a unit's place out of every Game: Shelves ink (ruleset, the
 * book's colour map), under the name its list gives it ("Not in a Game").
 */
export function hangarRowModel(name: string): EntityRowModel {
  const slug = nameToSlug(name)
  return {
    ref: { schemaName: 'crawlers', id: `hangar/${slug}`, slug, name, synthetic: true },
    title: name,
    kind: { stamp: 'Hangar', type: 'Hangar', domain: 'crawler', nature: 'have' },
    tone: 'ink',
    facts: [],
    traits: [],
    art: { kind: 'none' },
  }
}
