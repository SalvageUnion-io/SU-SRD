import { resolveEntityPageMeta } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { chapterForSchema } from '../lib/chapters'
import { entityPageFoot } from './EntityPageFrame'
import { Footer } from './Footer'

export default {
  title: 'Compositions/Shell/Footer',
}

/**
 * Where every SRD page ends. Real data: each book page's foot is built the way
 * its page module builds it — `chapterForSchema` for the tone,
 * `resolveEntityPageMeta` for the citation, `entityPageFoot` to join them. The
 * mark is the app's public asset, which the catalog also serves.
 */

const MARK = '/Powered_by_Salvage_Black.webp'

function footFor(
  schemaId: Parameters<typeof chapterForSchema>[0],
  entity: Parameters<typeof resolveEntityPageMeta>[0] | undefined
) {
  return entity
    ? entityPageFoot(chapterForSchema(schemaId).tone, resolveEntityPageMeta(entity))
    : undefined
}

/** Home, listings, guides and the site's own pages: the slim rules-blue band (board 06). */
export const Rules = () => <Footer poweredBySalvageUrl={MARK} />

/** A Mech Workshop page (board 07): the Gopher's citation in the mech band, ink text. */
export const Mech = () => (
  <Footer
    poweredBySalvageUrl={MARK}
    foot={footFor('chassis', SalvageUnionReference.Chassis.getByName('Gopher'))}
  />
)

/** A Denizens page: the navy band carries paper text, and the mark reverses to paper. */
export const Denizen = () => (
  <Footer
    poweredBySalvageUrl={MARK}
    foot={footFor('bio-titans', SalvageUnionReference.BioTitans.all()[0])}
  />
)

/** A Union Crawler page: the deeper crawler pink carries paper text (ruleset §3.8). */
export const Crawler = () => (
  <Footer
    poweredBySalvageUrl={MARK}
    foot={footFor('crawlers', SalvageUnionReference.Crawlers.all()[0])}
  />
)
