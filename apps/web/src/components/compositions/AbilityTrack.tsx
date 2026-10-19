import type { ReactNode } from 'react'
import { Fragment } from 'react'
import type { RefAbility } from 'salvageunion-reference'
import { cn } from '../../lib/cn'
import { capsLabel } from '../atoms/capsLabel'
import type { TreeTrack } from './treeTrack'

/** The pick-one "or": 11px caps, snug (§4.2); its extrabold weight is the rule's. */
const OR_STAMP = cn(
  'su-ability-track__or-stamp',
  capsLabel({ weight: 'inherit', tracking: 'snug' })
)

/**
 * A tree's Abilities on its track, in the order given: the track joins each
 * Ability to the next with a stem (the book's chain, Core Book 2.0a p.33) and
 * frames each Ability's Row in the track's hue (`--su-row-frame`). A
 * sequential tree's numerals are the Abilities' own, in a Row's band or
 * before a Token's name; a pick-one tree has none, and an "or" stamp on the
 * stem between each pick, in a gap one Ability tall. The caller draws each
 * Ability — the SRD a Row that links to its page (inside a class page's path
 * card, level 2, a contentful Token: N1, N3), the app's pilot sheet a Row
 * with the sheet's controls under it. The class page, the abilities listing
 * and the pilot sheet draw the same track.
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
  const pick = track === 'legendary'
  return (
    <ol className="su-ability-track" data-track={track}>
      {abilities.map((ability, index) => (
        <Fragment key={ability.id}>
          {pick && index > 0 && (
            // A pick-one tree: an "or" on its stem between this pick and the
            // one before, never a numeral.
            <li className="su-ability-track__or">
              <span className={OR_STAMP}>or</span>
            </li>
          )}
          <li className="su-ability-track__tier">{renderAbility(ability)}</li>
        </Fragment>
      ))}
    </ol>
  )
}
