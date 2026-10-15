import type { RefAbility } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'

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
export function trackForTree(abilities: readonly RefAbility[]): TreeTrack | undefined {
  const first = abilities[0]
  if (!first) return undefined
  const model = toEntityModel(first)
  const track = trackForTone(model.tone, first.tree)
  return track === 'legendary' || model.tier ? track : undefined
}
