/**
 * `/changelog` — the app's history, the reference pages and the app in one
 * stream (ADR-041, ADR-050).
 *
 * Rendered at BUILD time from `main`'s history: `readChangelog` keeps the
 * app's `feat`/`fix`/`perf` squash titles, one entry per day. Never a client
 * fetch — only the rendered entries ship.
 */

import { InlineRef } from '../../components/index'
import { space } from '../../design/tokens'
import { SITE_URL, SRD_CRUMB, WEBSITE } from '../../lib/constants'
import { BOLD, PROSE } from '../../lib/docPageStyles'
import { readChangelog } from '../../lib/gitChangelog'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import { Changelog } from '../Changelog'
import { DocPage } from '../DocPage'
import type { PageModule, PageResult } from '../types'

const TITLE = pageTitle(pagesCopy('changelog'))
const DESCRIPTION = `Changes to the salvageunion.io reference site and its app over time.`

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
      <DocPage title={pagesCopy('changelog')} measure="48rem" gap={space[32]}>
        <p style={PROSE}>
          Features, fixes and speed-ups to the Reference and the app, newest first. For full commit
          history see the{' '}
          <InlineRef
            href="https://github.com/SalvageUnion-io/SU-SRD/commits/main"
            target="_blank"
            rel="noopener noreferrer"
            style={BOLD}
          >
            {pagesCopy('githubRepository')}
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
