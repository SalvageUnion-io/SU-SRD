import { Entity } from 'component-lib'
import type { SURefAbility } from 'salvageunion-reference'
import { getEntitySlug, toEntityModel } from 'salvageunion-reference'
import { itemHref } from '../lib/entityHref'

/**
 * Which track a tree draws (ruleset "Where the screen departs from print": the
 * ability-tree track stays a diagram). Core and Advanced/Hybrid trees are
 * trained in order — each Ability needs the one before it — so their three
 * tiers hang off one thick track in the tier's hue (Core = pilot orange,
 * Advanced and Hybrid = rust), each tier's numeral on it beside its banner. A
 * Legendary tree is a pick-one, not a sequence: its track runs in its pink with
 * no numerals, an "or" stamp on it between each pick.
 */
export type TreeTrack = 'core' | 'advanced' | 'hybrid' | 'legendary'

/** The track each banner tone draws (`abilityTierTone` in salvageunion-reference);
 * Advanced and Hybrid share the rust, so the tree's name tells them apart. */
function trackForTone(tone: string | undefined, tree: string): TreeTrack | undefined {
  if (tone === 'pilot') return 'core'
  if (tone === 'crawler') return 'legendary'
  if (tone === 'tier-hybrid') return tree.includes('Advanced') ? 'advanced' : 'hybrid'
  return undefined
}

/**
 * The track a tree's Abilities draw, read off its first Ability's banner:
 * none for a tree with no tiers that is not a pick-one (the Generic
 * Abilities, which any class takes in any order).
 */
export function trackForTree(abilities: readonly SURefAbility[]): TreeTrack | undefined {
  const first = abilities[0]
  if (!first) return undefined
  const model = toEntityModel(first)
  const track = trackForTone(model.tone, first.tree)
  return track === 'legendary' || model.tier ? track : undefined
}

/**
 * The tree's slab names the kind, so its Rows drop the type stamp; every tree
 * is on a track, whose numeral (or "or") sits outside the banner.
 */
const OMIT_KIND_TIER = ['kind', 'tier'] as const

const abilityHref = (ability: SURefAbility) => itemHref('abilities', getEntitySlug(ability))

/**
 * A tree's Abilities as Rows on its track, in tree order: a Row in link mode
 * is a real same-tab link to the ability's page (the listing row's shape,
 * `EntityListingRow`). Its banner wears its tier (EDL E12: Core orange,
 * Advanced and Hybrid rust, Legendary pink), the hue of its track; the
 * Row leaves its numeral to the track, and Peeks the full ability on hover,
 * focus or a long press. The class page and the abilities listing draw the
 * same track.
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
    <ol className="srd-ability-tree__track" data-track={track}>
      {abilities.map((ability, index) => {
        const pick = track === 'legendary'
        const tier = pick ? undefined : toEntityModel(ability).tier
        return (
          <li key={ability.id} className="srd-ability-tree__tier">
            {tier && (
              // The list's order already says the tier; the numeral is the print's mark.
              <span className="srd-ability-tree__numeral" aria-hidden="true">
                {tier}
              </span>
            )}
            <Entity
              form="row"
              entity={ability}
              mode={{ kind: 'link', href: abilityHref(ability) }}
              omit={OMIT_KIND_TIER}
              lead
              peek
              titleAs={titleAs}
            />
            {pick && index < abilities.length - 1 && (
              // A pick-one tree: an "or" on its track between this pick and the
              // next, never a numeral.
              <span className="srd-ability-tree__or">or</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
