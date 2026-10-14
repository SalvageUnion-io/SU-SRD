import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveEntityPageMeta } from '../referenceEntity/card/entityPage'
import type { FooterFoot } from './Footer'
import { Footer } from './Footer'

export default {
  title: 'Compositions/Shell/Footer',
}

/**
 * Where every page of both tools ends. Real data: each
 * book page's foot is its chapter tone and the citation
 * `resolveEntityPageMeta` gives the SRD's page for it. The links are each
 * tool's own; the mark is the apps' public asset, which the catalog also
 * serves.
 */

const MARK = '/Powered_by_Salvage_Black.webp'

const SRD_LINKS = [
  { label: 'Changelog', href: '/changelog/' },
  { label: 'API', href: '/api/' },
  { label: 'Discord', href: '/discord/' },
  { label: 'About', href: '/about/' },
]

/** ITUN keeps no doc pages of its own: it links to the SRD's. */
const ITUN_LINKS = SRD_LINKS.map((link) => ({
  ...link,
  href: `https://salvageunion.io${link.href}`,
}))

function footFor(
  tone: FooterFoot['tone'],
  entity: Parameters<typeof resolveEntityPageMeta>[0] | undefined
): FooterFoot | undefined {
  if (!entity) return undefined
  const meta = resolveEntityPageMeta(entity)
  return { tone, page: meta.page, citation: meta.citation, measure: '75rem' }
}

/** The SRD's home, listings, guides and own pages: the licence row alone, in the Union bar's ink. */
export const Site = () => <Footer links={SRD_LINKS} poweredBySalvageUrl={MARK} />

/** Every ITUN page: the same licence row and the same pages, on the SRD. */
export const Itun = () => <Footer links={ITUN_LINKS} poweredBySalvageUrl={MARK} />

/** A Mech Workshop page (board 07): the Gopher's citation in the mech band, over the licence row. */
export const Mech = () => (
  <Footer
    links={SRD_LINKS}
    poweredBySalvageUrl={MARK}
    foot={footFor('mech', SalvageUnionReference.Chassis.getByName('Gopher'))}
  />
)

/** A Denizens page: the citation's navy band carries paper text. */
export const Denizen = () => (
  <Footer
    links={SRD_LINKS}
    poweredBySalvageUrl={MARK}
    foot={footFor('denizen', SalvageUnionReference.BioTitans.all()[0])}
  />
)

/** A Union Crawler page: the deeper crawler pink carries paper text (ruleset §3.8). */
export const Crawler = () => (
  <Footer
    links={SRD_LINKS}
    poweredBySalvageUrl={MARK}
    foot={footFor('crawler', SalvageUnionReference.Crawlers.all()[0])}
  />
)
