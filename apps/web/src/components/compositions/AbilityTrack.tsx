import type { ReactNode } from 'react'
import type { RefAbility } from 'salvageunion-reference'
import { toEntityModel } from 'salvageunion-reference'
import type { TreeTrack } from './treeTrack'

/**
 * A tree's Abilities on its track, in the order given: the track draws each
 * tier's numeral (or a pick-one's "or") outside the Ability, and frames the
 * Ability's Row in the track's hue (`--su-row-frame`). The caller draws each
 * Ability — the SRD a Row that links to its page, the Cantina's pilot sheet a Row
 * with the sheet's controls under it — and leaves the Row's own numeral to the
 * track (`omit: ['tier']`). The class page, the abilities listing and the
 * pilot sheet draw the same track.
 */
export function AbilityTrack({
  abilities,
  track,
  renderAbility,
}: {
  abilities: readonly RefAbility[]
  track: TreeTrack
  renderAbility: (ability: RefAbility) => ReactNode
}) {
  return (
    <ol className="su-ability-track" data-track={track}>
      {abilities.map((ability, index) => {
        const pick = track === 'legendary'
        const tier = pick ? undefined : toEntityModel(ability).tier
        return (
          <li key={ability.id} className="su-ability-track__tier">
            {tier && (
              // The list's order already says the tier; the numeral is the print's mark.
              <span className="su-ability-track__numeral" aria-hidden="true">
                {tier}
              </span>
            )}
            {renderAbility(ability)}
            {pick && index < abilities.length - 1 && (
              // A pick-one tree: an "or" on its track between this pick and the
              // next, never a numeral.
              <span className="su-ability-track__or">or</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
