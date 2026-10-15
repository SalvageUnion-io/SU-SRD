/**
 * `/changelog` — the history of both tools, the one changelog they share
 * (The Cantina links here and keeps no copy).
 *
 * Rendered at BUILD time from `main`'s history: `readChangelog` keeps the
 * `feat`/`fix`/`perf` squash titles scoped `srd` (the Site) and `cantina` (the
 * App), each day's entries stamped with their area (ADR-041). Never a client
 * fetch — only the rendered entries ship.
 */

import { InlineRef } from 'component-lib'
import { space } from 'component-lib/design/tokens'
import { PRODUCT } from 'component-lib/product'
import type { PageModule, PageResult } from '../../ssg/types'
import { Changelog } from '../components/Changelog'
import { DocPage } from '../components/DocPage'
import { CONTENTS_CRUMB, SITE_URL, TITLE_SUFFIX } from '../lib/constants'
import { BOLD, PROSE } from '../lib/docPageStyles'
import { readChangelog } from '../lib/gitChangelog'

const TITLE = `Changelog${TITLE_SUFFIX}`
const DESCRIPTION = `Changes to the salvageunion.io reference site and ${PRODUCT.name} over time.`

function page(): PageResult {
  // Newest day first; on a day both changed, the Site's entry comes first.
  const entries = [...readChangelog('srd', 'Site'), ...readChangelog('cantina', 'App')].sort(
    (a, b) => b.date.localeCompare(a.date)
  )

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
