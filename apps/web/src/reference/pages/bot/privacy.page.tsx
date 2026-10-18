/**
 * `/bot/privacy` — Discord bot privacy policy.
 *
 * A plain static document: no islands, no data, no structured data.
 */

import type { PageModule, PageResult } from '../../../../ssg/types'
import { InlineRef, Slab } from '../../../components/index'
import { space } from '../../../design/tokens'
import { BOLD, bulletList, proseColumn, SMALL_PRINT } from '../../../lib/docPageStyles'
import { pageTitle } from '../../../lib/pageTitle'
import { DocPage } from '../../DocPage'

const BODY = proseColumn(space[16])
const LIST = bulletList(space[4], 'padding')
const LIST_AFTER_PROSE = { ...LIST, marginTop: space[8] }

const LAST_UPDATED = '6 July 2026'

function page(): PageResult {
  return {
    meta: {
      title: pageTitle('Discord Bot Privacy Policy'),
      description:
        'Privacy Policy for the Salvage Union Discord bot. The Bot is stateless and stores no personal data.',
    },
    children: (
      <DocPage title="Salvage Union Bot — Privacy Policy" measure="48rem" gap={space[24]}>
        <p style={SMALL_PRINT}>Last updated: {LAST_UPDATED}</p>

        <section style={BODY}>
          <p style={BOLD}>
            Short version: the Bot does not have a database and does not store your personal data.
          </p>

          <div>
            <Slab as="h2" variant="solid" label="What we collect" />
            <p>
              Nothing persistent. The Bot is stateless. It responds to slash-command and button
              interactions in real time and keeps no record of them afterward.
            </p>
            <ul style={LIST_AFTER_PROSE}>
              <li>
                The Bot requests only the “Guilds” gateway intent. It does <strong>not</strong> read
                message content.
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
              To keep the Bot reliable, unexpected errors are logged by our hosting provider
              (Cloudflare). These logs can include technical details about the error and the
              interaction that triggered it. They are used only to diagnose and fix bugs and are
              retained per that provider’s standard retention.
            </p>
          </div>

          <div>
            <Slab as="h2" variant="solid" label="Third parties" />
            <ul style={LIST}>
              <li>
                <strong>Discord</strong> — your use of the Bot is also governed by Discord’s Privacy
                Policy.
              </li>
              <li>
                <strong>Cloudflare</strong> — hosts the Bot and logs its errors, as described above.
              </li>
            </ul>
          </div>

          <div>
            <Slab as="h2" variant="solid" label="Data requests" />
            <p>
              Because we store no personal data, there is nothing to export or delete. For any
              privacy questions, contact{' '}
              <InlineRef href="mailto:privacy@salvageunion.io" style={BOLD}>
                privacy@salvageunion.io
              </InlineRef>
              .
            </p>
          </div>

          <p style={SMALL_PRINT}>
            See also the{' '}
            <InlineRef href="/bot/terms/" style={BOLD}>
              Terms of Service
            </InlineRef>
            .
          </p>
        </section>
      </DocPage>
    ),
  }
}

export const botPrivacyPage: PageModule = {
  pattern: '/bot/privacy',
  page,
}
