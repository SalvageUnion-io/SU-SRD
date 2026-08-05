/**
 * `/changelog` — the release history. Port of `changelog.astro`.
 *
 * Rendered at BUILD time: the two `CHANGELOG.md` files are read off disk with
 * `node:fs` during the SSR pass and merged via the shared `parseChangelog` /
 * `mergeChangelogs` helpers. This is never a client fetch — the markdown is not
 * shipped to the browser at all, only the rendered entries are.
 *
 * The paths are resolved from `import.meta.url`, not `process.cwd()` as the
 * Astro version did. Astro guaranteed the cwd was the app root; `bun
 * ssg/build.ts` makes no such promise (`ssg/build.ts` itself derives its app
 * root the same way), and a wrong cwd would fail the build with an ENOENT far
 * from its cause. The read stays exactly as build-time as it was.
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Changelog, mergeChangelogs, PageHeading, parseChangelog } from 'component-lib'
import type { PageModule, PageResult } from '../../ssg/types'
import { SITE_URL } from '../lib/constants'

const TITLE = 'Changelog - Salvage Union System Reference Document'
const DESCRIPTION = 'Major changes to salvageunion.io and its companion tools over time.'

/** `apps/srd/CHANGELOG.md` — changes to this site and its companion tools. */
const SITE_CHANGELOG = fileURLToPath(new URL('../../CHANGELOG.md', import.meta.url))
/** `packages/salvageunion-reference/CHANGELOG.md` — game-data package changes. */
const DATA_CHANGELOG = fileURLToPath(
  new URL('../../../../packages/salvageunion-reference/CHANGELOG.md', import.meta.url)
)

function page(): PageResult {
  const entries = mergeChangelogs(
    parseChangelog(readFileSync(SITE_CHANGELOG, 'utf8'), 'Site'),
    parseChangelog(readFileSync(DATA_CHANGELOG, 'utf8'), 'Data')
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
            Major changes to the SRD site, the In The Union Now builder, and the Discord bot. For
            full commit history see the{' '}
            <a
              href="https://github.com/alxjrvs/SU-SRD/commits/main"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-rust hover:underline"
            >
              GitHub repository
            </a>
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
