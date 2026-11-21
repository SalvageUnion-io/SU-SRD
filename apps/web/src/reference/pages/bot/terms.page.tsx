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
      title: pageTitle(pagesCopy('discordBotTermsTitle')),
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
              {pagesCopy('theBotProvidesDiceRolling')}
              <code>{pagesCopy('su')}</code>
              {pagesCopy('withASalvageunionIoAccount')}
            </p>
          </div>

          <div>
            <Slab as="h2" label={pagesCopy('acceptableUse')} />
            <p>{pagesCopy('dontUseTheBotTo')}</p>
          </div>

          <div>
            <Slab as="h2" label={pagesCopy('intellectualProperty')} />
            <p>
              {pagesCopy('salvageUnionIsCopyrightedBy')}{' '}
              <InlineRef
                href="https://leyline.press"
                target="_blank"
                rel="noopener noreferrer"
                style={BOLD}
              >
                {pagesCopy('leylinePress')}
              </InlineRef>
              {pagesCopy('theBotIsAnUnofficial')}{' '}
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
              {pagesCopy('questionsAboutTheseTerms')}{' '}
              <InlineRef href="mailto:privacy@salvageunion.io" style={BOLD}>
                {pagesCopy('privacySalvageunionIo')}
              </InlineRef>
              .
            </p>
          </div>

          <p style={SMALL_PRINT}>
            {pagesCopy('seeAlsoThe')}{' '}
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
