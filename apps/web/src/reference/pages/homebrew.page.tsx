/**
 * `/homebrew` — Homebrew (ADR-056): every mech pattern a player shares with
 * "Anyone with the link", under the hatched band players' own things wear.
 * The page is static; its list is `HomebrewIsland`, read from the Worker on
 * load, so a pattern shared a minute ago is here without a rebuild.
 */

import type { PageModule, PageResult } from '../../../ssg/types'
import { HomebrewIsland } from '../../components/islands/HomebrewIsland'
import { space } from '../../design/tokens'
import { SITE_URL, SRD_CRUMB, WEBSITE } from '../../lib/constants'
import { PROSE } from '../../lib/docPageStyles'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import { Island } from '../../runtime/Island'
import { DocPage } from '../DocPage'

function page(): PageResult {
  const title = pageTitle(pagesCopy('homebrew'))
  const description = pagesCopy('homebrewDescription')
  const url = `${SITE_URL}/homebrew/`
  return {
    meta: {
      title,
      description,
      canonical: url,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: title,
        description,
        url,
        isPartOf: WEBSITE,
      },
      breadcrumbs: [SRD_CRUMB, { name: pagesCopy('homebrew'), url }],
    },
    children: (
      <DocPage title={pagesCopy('homebrew')} measure="64rem" gap={space[24]} userMade>
        <p style={PROSE}>{pagesCopy('homebrewLede')}</p>
        <Island name="HomebrewIsland" client="load" props={{}}>
          <HomebrewIsland />
        </Island>
      </DocPage>
    ),
  }
}

export const homebrewPage: PageModule = {
  pattern: '/homebrew',
  page,
}
