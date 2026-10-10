/**
 * `/changelog` — the site's history.
 *
 * Rendered at BUILD time from `main`'s history: `readChangelog` keeps the
 * `feat`/`fix`/`perf` squash titles scoped `srd` (ADR-041). Never a client
 * fetch — only the rendered entries ship.
 */

import { Changelog, InlineRef, PageHeading } from 'component-lib'
import { readChangelog } from 'component-lib/changelog/git'
import type { PageModule, PageResult } from '../../ssg/types'
import { SITE_URL, TITLE_SUFFIX } from '../lib/constants'

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
      <div className="flex w-full flex-1 flex-col py-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6">
          <PageHeading>Changelog</PageHeading>

          <p className="text-sm leading-relaxed">
            Features, fixes and speed-ups to the SRD site, newest first. For full commit history see
            the{' '}
            <InlineRef
              href="https://github.com/SalvageUnion-io/SU-SRD/commits/main"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold"
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
