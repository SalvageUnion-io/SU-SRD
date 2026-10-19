import type { RefAbility } from 'salvageunion-reference'
import { getEntitySlug } from 'salvageunion-reference'
import { itemHref } from '../lib/entityHref'
import type { TreeTrack } from './index'
import { AbilityTrack, Entity } from './index'

/**
 * The tree's slab names the kind, so its Rows drop the type stamp; each keeps
 * its tier numeral in its band, as it reads everywhere else.
 */
const OMIT_KIND = ['kind'] as const

/** A contentful Token's body: the ability's text, its lead (N3). */
const ABILITY_TEXT = { text: true } as const

const abilityHref = (ability: RefAbility) => itemHref('abilities', getEntitySlug(ability))

/**
 * A tree's Abilities on its track (the UI library's `AbilityTrack`), in tree
 * order, each a real same-tab link to the ability's page that Peeks the full
 * ability on hover, focus or a long press. Its tier (EDL E12: Core orange,
 * Advanced and Hybrid rust, Legendary pink) is the hue of its track, its
 * numeral before its name.
 *
 * At level 1 (the class page's own trees, the abilities listing) each is a
 * Row (the listing row's shape, `EntityListingRow`). Inside a class page's
 * path card, a level-1 frame, the track is level 2, so each is a contentful
 * Token (`form="token"`, N1, N3): its one-row head (tier, name, chips), then
 * its text, held by a border in its tone.
 */
export function ReferenceAbilityTrack({
  abilities,
  track,
  titleAs,
  form = 'row',
}: {
  abilities: readonly RefAbility[]
  track: TreeTrack
  /** Row only: each Ability's title element. */
  titleAs?: 'h3'
  /** `token` where the track sits inside a level-1 frame (a path card). */
  form?: 'row' | 'token'
}) {
  return (
    <AbilityTrack
      abilities={abilities}
      track={track}
      renderAbility={(ability) =>
        form === 'token' ? (
          <Entity
            form="token"
            context="play"
            entity={ability}
            mode={{ kind: 'link', href: abilityHref(ability) }}
            omit={OMIT_KIND}
            body={ABILITY_TEXT}
          />
        ) : (
          <Entity
            form="row"
            entity={ability}
            mode={{ kind: 'link', href: abilityHref(ability) }}
            omit={OMIT_KIND}
            lead
            peek
            titleAs={titleAs}
          />
        )
      }
    />
  )
}
