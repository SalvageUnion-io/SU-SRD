import { resolveEntityPageMeta } from 'component-lib'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Footer } from './Footer'
import type { NEWFooterCitation } from './NEWFooter'
import { NEWFooter } from './NEWFooter'

export default {
  title: 'Compositions/Shell/NEW Footer',
}

/**
 * The footer refresh, L2: three variants beside the live `Footer`, for the
 * owner to pick one. Real data: the citations come from
 * `resolveEntityPageMeta`, the tone from the chapter the SRD files each schema
 * under. The mark is the app's public asset, which the catalog also serves.
 */

const MARK = '/Powered_by_Salvage_Black.webp'

const STACK = { display: 'flex', flexDirection: 'column', gap: '2rem' } satisfies CSSProperties

/** An entity page's citation, as the page module would hand it to the layout. */
function citationFor(
  entity: Parameters<typeof resolveEntityPageMeta>[0] | undefined,
  tone: NEWFooterCitation['tone']
): NEWFooterCitation | undefined {
  if (!entity) return undefined
  const { page, citation } = resolveEntityPageMeta(entity)
  return { tone, page, citation }
}

/** A — origin-faithful: board 06's slim rules-blue band, on every page. */
export const NEWFooterOrigin = () => <NEWFooter variant="origin" poweredBySalvageUrl={MARK} />

/**
 * B — chapter foot: A on home and listings; on an entity page the chapter's
 * foot band (board 07) carries the page cite and the book, and the legal row
 * follows in the same tone. Shown on the Gopher (Mech Workshop).
 */
export const NEWFooterChapter = () => (
  <NEWFooter
    variant="chapter"
    poweredBySalvageUrl={MARK}
    citation={citationFor(SalvageUnionReference.Chassis.getByName('Gopher'), 'mech')}
  />
)

/** C — ink: a dark foot that bookends the Union bar, paper flecks and paper text. */
export const NEWFooterInk = () => <NEWFooter variant="ink" poweredBySalvageUrl={MARK} />

/** The live footer and the three variants, one above the other, with B in three tones. */
export const NEWFooterCompare = () => {
  const bioTitan = SalvageUnionReference.BioTitans.all()[0]
  const crawler = SalvageUnionReference.Crawlers.all()[0]
  return (
    <div style={STACK}>
      <div>
        <Caption>before — the live Footer</Caption>
        <Footer poweredBySalvageUrl={MARK} />
      </div>
      <div>
        <Caption>A · origin — every page</Caption>
        <NEWFooterOrigin />
      </div>
      <div>
        <Caption>B · chapter — home and listings (as A)</Caption>
        <NEWFooter variant="chapter" poweredBySalvageUrl={MARK} />
      </div>
      <div>
        <Caption>B · chapter — an entity page: Gopher (mech)</Caption>
        <NEWFooterChapter />
      </div>
      <div>
        <Caption>B · chapter — a Denizens page: the navy band carries paper</Caption>
        <NEWFooter
          variant="chapter"
          poweredBySalvageUrl={MARK}
          citation={citationFor(bioTitan, 'denizen')}
        />
      </div>
      <div>
        <Caption>B · chapter — a Union Crawler page: the deeper pink carries paper</Caption>
        <NEWFooter
          variant="chapter"
          poweredBySalvageUrl={MARK}
          citation={citationFor(crawler, 'crawler')}
        />
      </div>
      <div>
        <Caption>C · ink — every page</Caption>
        <NEWFooterInk />
      </div>
    </div>
  )
}
