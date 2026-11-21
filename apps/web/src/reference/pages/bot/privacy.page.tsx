/**
 * `/bot/privacy` — Discord bot privacy policy.
 *
 * A plain static document: no islands, no data, no structured data.
 */

import { InlineRef, Slab } from '../../../components/index'
import { space } from '../../../design/tokens'
import { appPath } from '../../../lib/appBase'
import { BOLD, bulletList, proseColumn, SMALL_PRINT } from '../../../lib/docPageStyles'
import { pageTitle } from '../../../lib/pageTitle'
import { pagesCopy } from '../../../messages/reference-pages'
import { DocPage } from '../../DocPage'
import type { PageModule, PageResult } from '../../types'

const BODY = proseColumn(space[16])
const LIST = bulletList(space[4], 'padding')
const AFTER_LIST = { marginTop: space[8] }

const LAST_UPDATED = '29 October 2026'

function page(): PageResult {
  return {
    meta: {
      title: pageTitle(pagesCopy('discordBotPrivacyTitle')),
      description: pagesCopy('privacyPolicyForTheSalvage'),
    },
    children: (
      <DocPage title={pagesCopy('salvageUnionBotPrivacyPolicy')} measure="48rem" gap={space[24]}>
        <p style={SMALL_PRINT}>{pagesCopy('lastUpdated', { lastUpdated: LAST_UPDATED })}</p>

        <section style={BODY}>
          <p style={BOLD}>{pagesCopy('shortVersionRollingAndLooking')}</p>

          <div>
            <Slab as="h2" label={pagesCopy('whatWeCollect')} />
            <ul style={LIST}>
              <li>
                <strong>{pagesCopy('rollsAndLookups')}</strong> (<code>{pagesCopy('suRoll')}</code>,{' '}
                <code>{pagesCopy('suLookup')}</code>
                {pagesCopy('weKeepNoRecord')}
              </li>
              <li>
                <strong>{pagesCopy('usageCounts')}</strong> {pagesCopy('forEveryCommandAWeekly')}
              </li>
              <li>
                <strong>{pagesCopy('feedback')}</strong> (<code>{pagesCopy('suFeedback')}</code>
                {pagesCopy('feedbackBecomesAnIssue')}
              </li>
              <li>
                <strong>{pagesCopy('yourLinkedAccount')}</strong> {pagesCopy('whenYouSignInTo')}{' '}
                <code>{pagesCopy('suMe')}</code>, <code>{pagesCopy('suGames')}</code>{' '}
                {pagesCopy('and')} <code>{pagesCopy('suSheet')}</code>
                {pagesCopy('andShowsOnlyWhatYour')}
              </li>
              <li>
                <strong>{pagesCopy('boundChannels')}</strong> (<code>{pagesCopy('suBind')}</code>
                {pagesCopy('theChannelsIdAndName')} <code>{pagesCopy('suUnbind')}</code>{' '}
                {pagesCopy('deletesItRunByWhoever')}
              </li>
              <li>
                <strong>{pagesCopy('rollsFromPlay')}</strong> {pagesCopy('aRollMadeOnSalvageunion')}
              </li>
            </ul>
            <p style={AFTER_LIST}>
              {pagesCopy('theBotDoes')} <strong>{pagesCopy('not')}</strong>{' '}
              {pagesCopy('readMessageContentExcept')}
            </p>
          </div>

          <div>
            <Slab as="h2" label={pagesCopy('errorDiagnostics')} />
            <p>{pagesCopy('toKeepTheBotReliable')}</p>
          </div>

          <div>
            <Slab as="h2" label={pagesCopy('thirdParties')} />
            <ul style={LIST}>
              <li>
                <strong>{pagesCopy('discord')}</strong> {pagesCopy('yourUseOfTheBot')}
              </li>
              <li>
                <strong>{pagesCopy('cloudflare')}</strong> {pagesCopy('hostsTheBotAndSalvageunion')}
              </li>
              <li>
                <strong>{pagesCopy('github')}</strong> {pagesCopy('hostsThePublicIssues')}
              </li>
            </ul>
          </div>

          <div>
            <Slab as="h2" label={pagesCopy('yourData')} />
            <p>
              {pagesCopy('signedInAtSalvageunionIo')}{' '}
              <InlineRef href={appPath('/settings')} style={BOLD}>
                {pagesCopy('settings')}
              </InlineRef>{' '}
              {pagesCopy('letsYouExportEverything')} <code>{pagesCopy('suUnbind')}</code>
              {pagesCopy('forAnythingElseContact')}{' '}
              <InlineRef href="mailto:privacy@salvageunion.io" style={BOLD}>
                {pagesCopy('privacySalvageunionIo')}
              </InlineRef>
              .
            </p>
          </div>

          <p style={SMALL_PRINT}>
            {pagesCopy('seeAlsoThe')}{' '}
            <InlineRef href="/bot/terms/" style={BOLD}>
              {pagesCopy('termsOfService')}
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
