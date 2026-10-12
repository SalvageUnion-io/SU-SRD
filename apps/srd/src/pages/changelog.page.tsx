/**
 * `/changelog` — the site's history.
 *
 * Rendered at BUILD time from `main`'s history: `readChangelog` keeps the
 * `feat`/`fix`/`perf` squash titles scoped `srd` (ADR-041). Never a client
 * fetch — only the rendered entries ship.
 */

import { Changelog, ChapterBand, InlineRef } from 'component-lib'
import { readChangelog } from 'component-lib/changelog/git'
import { space } from 'component-lib/design/tokens'
import type { PageModule, PageResult } from '../../ssg/types'
import { SITE_URL, TITLE_SUFFIX } from '../lib/constants'
import { BOLD, DOC_PAGE, docMeasure, PROSE } from '../lib/docPageStyles'

const MEASURE = docMeasure('48rem', space[32])

const TITLE = `Changelog${TITLE_SUFFIX}`
const DESCRIPTION = 'Changes to the salvageunion.io reference site over time.'

function page(): PageResult {
  const entries = readChangelog('srd', 'Site')

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
      breadcrumbs: [
        { name: 'Home', url: `${SITE_URL}/` },
        { name: 'Changelog', url: `${SITE_URL}/changelog/` },
      ],
    },
    children: (
      <div style={DOC_PAGE}>
        <ChapterBand measure="48rem">Changelog</ChapterBand>
        <div style={MEASURE}>
          <p style={PROSE}>
            Features, fixes and speed-ups to the SRD site, newest first. For full commit history see
            the{' '}
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
        </div>
      </div>
    ),
  }
}

export const changelogPage: PageModule = {
  pattern: '/changelog',
  page,
}
