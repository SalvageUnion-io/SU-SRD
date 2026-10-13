import { Footer, resolveEntityPageMeta } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { buildLinkFor } from '../lib/buildLink'
import { SITE_LINKS } from '../lib/constants'
import { EntityCardStatic } from './EntityCardStatic'
import { EntityPageFrame, entityPageFoot } from './EntityPageFrame'

export default {
  title: 'Compositions/Entity/Entity Page Frame',
}

/**
 * An SRD entity page (boards 07, 08): the Gopher's Mech Workshop band with its
 * type stamps, the card as the page's body (`presentation="page"`) — line art,
 * chassis ability, prose, the book's stat column and the pattern rows — and
 * the site `Footer` the layout closes it on, carrying the citation in the
 * same band. The stamps sit at the band's far end and the art is cropped to its
 * line work; narrow the viewport for the phone (board 08), which keeps the
 * same order. The Gopher is Tech 2, so it offers no "Build with this".
 */
export const Chassis = () => {
  const gopher = SalvageUnionReference.Chassis.getByName('Gopher')
  if (!gopher) return null
  const meta = resolveEntityPageMeta(gopher)
  return (
    <>
      <EntityPageFrame
        title={gopher.name}
        tone="mech"
        meta={meta}
        build={buildLinkFor('chassis', gopher)}
      >
        <EntityCardStatic item={gopher} />
      </EntityPageFrame>
      <Footer
        links={SITE_LINKS}
        poweredBySalvageUrl="/Powered_by_Salvage_Black.webp"
        foot={entityPageFoot('mech', meta)}
      />
    </>
  )
}

/**
 * A Tech 1 chassis (the Mule): one the mech wizard can start from, so the body
 * opens on "Build a mech with this", the deep link into ITUN (`buildLinkFor`).
 */
export const BuildWithThis = () => {
  const mule = SalvageUnionReference.Chassis.getByName('Mule')
  if (!mule) return null
  const meta = resolveEntityPageMeta(mule)
  return (
    <EntityPageFrame
      title={mule.name}
      tone="mech"
      meta={meta}
      build={buildLinkFor('chassis', mule)}
    >
      <EntityCardStatic item={mule} />
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

/**
 * A long name: the stamps stay right of it, wrapping within their cluster, and
 * on a phone they follow it below the band, never above (EDL E20); the title
 * stays on the band's foot. The art fills its canvas,
 * so its crop is a hair.
 */
export const LongName = () => {
  const titan = SalvageUnionReference.BioTitans.getByName('Electrophorus')
  if (!titan) return null
  return (
    <EntityPageFrame title={titan.name} tone="denizen" meta={resolveEntityPageMeta(titan)}>
      <EntityCardStatic item={titan} />
    </EntityPageFrame>
  )
}
