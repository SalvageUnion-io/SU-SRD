/**
 * `/bot/privacy` — Discord bot privacy policy. Port of `bot/privacy.astro`.
 *
 * A plain static document: no islands, no data, no structured data.
 */

import { PageHeading, Slab } from 'component-lib'
import type { PageModule, PageResult } from '../../../ssg/types'

const LAST_UPDATED = '6 July 2026'

function page(): PageResult {
  return {
    meta: {
      title: 'Discord Bot Privacy Policy - Salvage Union SRD',
      description:
        'Privacy Policy for the Salvage Union Discord bot. The Bot is stateless and stores no personal data.',
    },
    children: (
      <div className="flex w-full flex-1 flex-col py-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6">
          <PageHeading>Salvage Union Bot — Privacy Policy</PageHeading>
          <p className="text-xs uppercase tracking-caps-snug text-ink/60">
            Last updated: {LAST_UPDATED}
          </p>

          <section className="flex flex-col gap-4 text-sm leading-relaxed">
            <p className="font-bold">
              Short version: the Bot does not have a database and does not store your personal data.
            </p>

            <div>
              <Slab as="h2" variant="solid" label="What we collect" />
              <p>
                Nothing persistent. The Bot is stateless. It responds to slash-command and button
                interactions in real time and keeps no record of them afterward.
              </p>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                <li>
                  The Bot requests only the “Guilds” gateway intent. It does <strong>not</strong>{' '}
                  read message content.
                </li>
                <li>
                  It does not store your messages, user ID, server data, dice results, or command
                  history in any database.
                </li>
                <li>
                  Interactive buttons (“Roll again,” “See table”) work by encoding the table name or
                  dice notation into the button itself — not by storing anything on a server.
                </li>
              </ul>
            </div>

            <div>
              <Slab as="h2" variant="solid" label="Error diagnostics" />
              <p>
                To keep the Bot reliable, unexpected errors may be sent to our error-monitoring
                provider (Sentry). These reports can include technical details about the error and
                the interaction that triggered it. They are used only to diagnose and fix bugs and
                are retained per that provider’s standard retention.
              </p>
            </div>

            <div>
              <Slab as="h2" variant="solid" label="Third parties" />
              <ul className="flex list-disc flex-col gap-1 pl-5">
                <li>
                  <strong>Discord</strong> — your use of the Bot is also governed by Discord’s
                  Privacy Policy.
                </li>
                <li>
                  <strong>Sentry</strong> — used for error monitoring, as described above.
                </li>
              </ul>
            </div>

            <div>
              <Slab as="h2" variant="solid" label="Data requests" />
              <p>
                Because we store no personal data, there is nothing to export or delete. For any
                privacy questions, contact{' '}
                <a
                  href="mailto:privacy@salvageunion.io"
                  className="font-bold text-rust hover:underline"
                >
                  privacy@salvageunion.io
                </a>
                .
              </p>
            </div>

            <p className="text-xs text-ink/60">
              See also the{' '}
              <a href="/bot/terms" className="font-bold text-rust hover:underline">
                Terms of Service
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    ),
  }
}

export const botPrivacyPage: PageModule = {
  pattern: '/bot/privacy',
  page,
}
