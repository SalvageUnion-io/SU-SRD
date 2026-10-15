/**
 * `/changelog` — the app's history, the reference pages and the Cantina in one
 * stream (ADR-041, ADR-050).
 *
 * Rendered at BUILD time from `main`'s history: `readChangelog` keeps the
 * app's `feat`/`fix`/`perf` squash titles, one entry per day. Never a client
 * fetch — only the rendered entries ship.
 */

import { PRODUCT } from 'cantina-domain/product'
import type { PageModule, PageResult } from '../../ssg/types'
import { Changelog } from '../components/Changelog'
import { DocPage } from '../components/DocPage'
import { InlineRef } from '../components/index'
import { space } from '../design/tokens'
import { CONTENTS_CRUMB, SITE_URL, TITLE_SUFFIX } from '../lib/constants'
import { BOLD, PROSE } from '../lib/docPageStyles'
import { readChangelog } from '../lib/gitChangelog'

const TITLE = `Changelog${TITLE_SUFFIX}`
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
        name: 'Changelog - Salvage Union SRD',
        description: DESCRIPTION,
        url: `${SITE_URL}/changelog/`,
        isPartOf: {
          '@type': 'WebSite',
          name: 'Salvage Union System Reference Document',
          url: `${SITE_URL}/`,
        },
      },
      breadcrumbs: [CONTENTS_CRUMB, { name: 'Changelog', url: `${SITE_URL}/changelog/` }],
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
