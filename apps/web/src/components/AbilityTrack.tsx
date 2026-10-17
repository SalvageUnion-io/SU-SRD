import type { RefAbility } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { itemHref } from '../lib/entityHref'
import type { TreeTrack } from './index'
import { Entity, AbilityTrack as Track } from './index'

/**
 * The tree's slab names the kind, so its Rows drop the type stamp; each keeps
 * its tier numeral in its band, as it reads everywhere else.
 */
const OMIT_KIND = ['kind'] as const

const abilityHref = (ability: RefAbility) => itemHref('abilities', getEntitySlug(ability))

/**
 * A tree's Abilities as Rows on its track (the UI library's `AbilityTrack`), in
 * tree order: a Row in link mode is a real same-tab link to the ability's page
 * (the listing row's shape, `EntityListingRow`). Its banner wears its tier
 * (EDL E12: Core orange, Advanced and Hybrid rust, Legendary pink), the hue of
 * its track; the Row sets its numeral in its band, and Peeks the full
 * ability on hover, focus or a long press. The class page and the abilities
 * listing draw the same track.
 */
export function AbilityTrack({
  abilities,
  track,
  titleAs,
}: {
  abilities: readonly RefAbility[]
  track: TreeTrack
  titleAs?: 'h3'
}) {
  return (
    <Track
      abilities={abilities}
      track={track}
      renderAbility={(ability) => (
        <Entity
          form="row"
          entity={ability}
          mode={{ kind: 'link', href: abilityHref(ability) }}
          omit={OMIT_KIND}
          lead
          peek
          titleAs={titleAs}
        />
      )}
    />
  )
}
