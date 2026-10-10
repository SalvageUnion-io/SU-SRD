import { resolveEntityPageMeta } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntityCardStatic } from './EntityCardStatic'
import { EntityPageFrame } from './EntityPageFrame'

export default {
  title: 'Compositions/Entity/Entity Page Frame',
}

/**
 * An SRD entity page (boards 07, 08): the Gopher's Mech Workshop band with its
 * type stamps, the card as the page's body (`presentation="page"`) — line art,
 * chassis ability, prose, the book's stat column and the pattern rows — and
 * the citation on the foot band. Narrow the viewport for the phone (board 08).
 */
export const Chassis = () => {
  const gopher = SalvageUnionReference.Chassis.getByName('Gopher')
  if (!gopher) return null
  return (
    <EntityPageFrame title={gopher.name} tone="mech" meta={resolveEntityPageMeta(gopher)}>
      <EntityCardStatic item={gopher} />
    </EntityPageFrame>
  )
}

/** An ability: an ink "do" entity with no art — its tier, tree and cost stamped on the band. */
export const Ability = () => {
  const ability = SalvageUnionReference.Abilities.getByName('Auto-Turret')
  if (!ability) return null
  return (
    <EntityPageFrame title={ability.name} tone="pilot" meta={resolveEntityPageMeta(ability)}>
      <EntityCardStatic item={ability} />
    </EntityPageFrame>
  )
}
