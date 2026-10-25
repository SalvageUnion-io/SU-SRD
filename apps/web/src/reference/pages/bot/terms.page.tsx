/**
 * `/bot/terms` — Discord bot terms of service.
 *
 * A plain static document: no islands, no data, no structured data.
 */

import { InlineRef, Slab } from '../../../components/index'
import { space } from '../../../design/tokens'
import { BOLD, proseColumn, SMALL_PRINT } from '../../../lib/docPageStyles'
import { pageTitle } from '../../../lib/pageTitle'
import { pagesCopy } from '../../../messages/reference-pages'
import { DocPage } from '../../DocPage'
import type { PageModule, PageResult } from '../../types'

const BODY = proseColumn(space[16])

const LAST_UPDATED = '21 October 2026'

function page(): PageResult {
  return {
    meta: {
      title: pageTitle('Discord Bot Terms of Service'),
      description: pagesCopy('termsOfServiceForThe'),
    },
    children: (
      <DocPage title={pagesCopy('salvageUnionBotTermsOf')} measure="48rem" gap={space[24]}>
        <p style={SMALL_PRINT}>{pagesCopy('lastUpdated', { lastUpdated: LAST_UPDATED })}</p>

        <section style={BODY}>
          <p>{pagesCopy('byAddingOrUsingThe')}</p>

          <div>
            <Slab as="h2" label={pagesCopy('theService')} />
            <p>
              The Bot provides dice-rolling and reference lookups for the Salvage Union tabletop
              roleplaying game via Discord slash commands (<code>{pagesCopy('su')}</code>). With a
              salvageunion.io account signed in with Discord, it also shows your account, Games and
              sheets, and posts Play’s rolls to a channel you bind. It is provided free of charge,
              “as is,” without warranty of any kind. We may change, suspend, or discontinue the Bot
              at any time.
            </p>
          </div>

          <div>
            <Slab as="h2" label={pagesCopy('acceptableUse')} />
            <p>{pagesCopy('dontUseTheBotTo')}</p>
          </div>

          <div>
            <Slab as="h2" label={pagesCopy('intellectualProperty')} />
            <p>
              Salvage Union is copyrighted by{' '}
              <InlineRef
                href="https://leyline.press"
                target="_blank"
                rel="noopener noreferrer"
                style={BOLD}
              >
                {pagesCopy('leylinePress')}
              </InlineRef>
              . The Bot is an unofficial, community reference tool and is not affiliated with or
              endorsed by Leyline Press. Game data is drawn from the community reference at{' '}
              <InlineRef href="/" style={BOLD}>
                {pagesCopy('salvageunionIo')}
              </InlineRef>
              .
            </p>
          </div>

          <div>
            <Slab as="h2" label={pagesCopy('liability')} />
            <p>{pagesCopy('toTheMaximumExtentPermitted')}</p>
          </div>

          <div>
            <Slab as="h2" label={pagesCopy('contact')} />
            <p>
              Questions about these terms:{' '}
              <InlineRef href="mailto:privacy@salvageunion.io" style={BOLD}>
                {pagesCopy('privacySalvageunionIo')}
              </InlineRef>
              .
            </p>
          </div>

          <p style={SMALL_PRINT}>
            See also the{' '}
            <InlineRef href="/bot/privacy/" style={BOLD}>
              {pagesCopy('privacyPolicy')}
            </InlineRef>
            .
          </p>
        </section>
      </DocPage>
    ),
  }
}

export const botTermsPage: PageModule = {
  pattern: '/bot/terms',
  page,
}
