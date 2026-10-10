/**
 * `/bot/terms` — Discord bot terms of service.
 *
 * A plain static document: no islands, no data, no structured data.
 */

import { InlineRef, PageHeading, Slab } from 'component-lib'
import type { PageModule, PageResult } from '../../../ssg/types'
import { TITLE_SUFFIX } from '../../lib/constants'

const LAST_UPDATED = '6 July 2026'

function page(): PageResult {
  return {
    meta: {
      title: `Discord Bot Terms of Service${TITLE_SUFFIX}`,
      description:
        'Terms of Service for the Salvage Union Discord bot — an unofficial, community reference tool for the Salvage Union TTRPG.',
    },
    children: (
      <div className="flex w-full flex-1 flex-col py-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6">
          <PageHeading>Salvage Union Bot — Terms of Service</PageHeading>
          <p className="text-xs uppercase tracking-caps-snug text-ink/60">
            Last updated: {LAST_UPDATED}
          </p>

          <section className="flex flex-col gap-4 text-sm leading-relaxed">
            <p>
              By adding or using the Salvage Union bot (“the Bot”) in a Discord server or via user
              install, you agree to these terms.
            </p>

            <div>
              <Slab as="h2" variant="solid" label="The service" />
              <p>
                The Bot provides dice-rolling and reference lookups for the Salvage Union tabletop
                roleplaying game via Discord slash commands (<code>/su</code>). It is provided free
                of charge, “as is,” without warranty of any kind. We may change, suspend, or
                discontinue the Bot at any time.
              </p>
            </div>

            <div>
              <Slab as="h2" variant="solid" label="Acceptable use" />
              <p>
                Don’t use the Bot to break Discord’s Terms of Service or Community Guidelines, to
                abuse or overload the service, or for any unlawful purpose.
              </p>
            </div>

            <div>
              <Slab as="h2" variant="solid" label="Intellectual property" />
              <p>
                Salvage Union is copyrighted by{' '}
                <InlineRef
                  href="https://leyline.press"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold"
                >
                  Leyline Press
                </InlineRef>
                . The Bot is an unofficial, community reference tool and is not affiliated with or
                endorsed by Leyline Press. Game data is drawn from the community reference at{' '}
                <InlineRef href="/" className="font-bold">
                  salvageunion.io
                </InlineRef>
                .
              </p>
            </div>

            <div>
              <Slab as="h2" variant="solid" label="Liability" />
              <p>
                To the maximum extent permitted by law, the operators of the Bot are not liable for
                any damages arising from its use or unavailability.
              </p>
            </div>

            <div>
              <Slab as="h2" variant="solid" label="Contact" />
              <p>
                Questions about these terms:{' '}
                <InlineRef href="mailto:privacy@salvageunion.io" className="font-bold">
                  privacy@salvageunion.io
                </InlineRef>
                .
              </p>
            </div>

            <p className="text-xs text-ink/60">
              See also the{' '}
              <InlineRef href="/bot/privacy" className="font-bold">
                Privacy Policy
              </InlineRef>
              .
            </p>
          </section>
        </div>
      </div>
    ),
  }
}

export const botTermsPage: PageModule = {
  pattern: '/bot/terms',
  page,
}
