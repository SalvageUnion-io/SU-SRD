/**
 * `/changelog` — the app's history, the reference pages and the Cantina in one
 * stream (ADR-041, ADR-050).
 *
 * Rendered at BUILD time from `main`'s history: `readChangelog` keeps the
 * app's `feat`/`fix`/`perf` squash titles, one entry per day. Never a client
 * fetch — only the rendered entries ship.
 */

import { PRODUCT } from 'game-domain/product'
import type { PageModule, PageResult } from '../../../ssg/types'
import { InlineRef } from '../../components/index'
import { space } from '../../design/tokens'
import { SITE_URL, SRD_CRUMB, WEBSITE } from '../../lib/constants'
import { BOLD, PROSE } from '../../lib/docPageStyles'
import { readChangelog } from '../../lib/gitChangelog'
import { pageTitle } from '../../lib/pageTitle'
import { Changelog } from '../Changelog'
import { DocPage } from '../DocPage'

const TITLE = pageTitle('Changelog')
const DESCRIPTION = `Changes to the salvageunion.io reference site and ${PRODUCT.name} over time.`

function page(): PageResult {
  const entries = readChangelog()

  return {
    meta: {
      title: TITLE,
      description: DESCRIPTION,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: TITLE,
        description: DESCRIPTION,
        url: `${SITE_URL}/changelog/`,
        isPartOf: WEBSITE,
      },
      breadcrumbs: [SRD_CRUMB, { name: 'Changelog', url: `${SITE_URL}/changelog/` }],
    },
    children: (
      <DocPage title="Changelog" measure="48rem" gap={space[32]}>
        <p style={PROSE}>
          Features, fixes and speed-ups to the SRD site and {PRODUCT.name}, newest first. For full
          commit history see the{' '}
          <InlineRef
            href="https://github.com/SalvageUnion-io/SU-SRD/commits/main"
            target="_blank"
            rel="noopener noreferrer"
            style={BOLD}
          >
            GitHub repository
          </InlineRef>
          .
        </p>

        <Changelog entries={entries} />
      </DocPage>
    ),
  }
}

export const changelogPage: PageModule = {
  pattern: '/changelog',
  page,
}
