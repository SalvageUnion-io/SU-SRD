import type { TreeTrack } from 'component-lib'
import { Entity, AbilityTrack as Track } from 'component-lib'
import type { SURefAbility } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { itemHref } from '../lib/entityHref'

/**
 * The tree's slab names the kind, so its Rows drop the type stamp; every tree
 * is on a track, whose numeral (or "or") sits outside the banner.
 */
const OMIT_KIND_TIER = ['kind', 'tier'] as const

const abilityHref = (ability: SURefAbility) => itemHref('abilities', getEntitySlug(ability))

/**
 * A tree's Abilities as Rows on its track (component-lib's `AbilityTrack`), in
 * tree order: a Row in link mode is a real same-tab link to the ability's page
 * (the listing row's shape, `EntityListingRow`). Its banner wears its tier
 * (EDL E12: Core orange, Advanced and Hybrid rust, Legendary pink), the hue of
 * its track; the Row leaves its numeral to the track, and Peeks the full
 * ability on hover, focus or a long press. The class page and the abilities
 * listing draw the same track.
 */
export function AbilityTrack({
  abilities,
  track,
  titleAs,
}: {
  abilities: readonly SURefAbility[]
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
          omit={OMIT_KIND_TIER}
          lead
          peek
          titleAs={titleAs}
        />
      )}
    />
  )
}
