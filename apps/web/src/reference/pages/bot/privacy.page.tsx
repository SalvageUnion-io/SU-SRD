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

const LAST_UPDATED = '22 October 2026'

function page(): PageResult {
  return {
    meta: {
      title: pageTitle('Discord Bot Privacy Policy'),
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
                <code>{pagesCopy('suLookup')}</code>): nothing about you. They answer in real time
                and keep no record. Buttons such as “Roll again” carry the table or dice in the
                button itself.
              </li>
              <li>
                <strong>{pagesCopy('usageCounts')}</strong> {pagesCopy('forEveryCommandAWeekly')}
              </li>
              <li>
                <strong>{pagesCopy('feedback')}</strong> (<code>{pagesCopy('suFeedback')}</code>
                {pagesCopy('feedbackBecomesAnIssue')}
              </li>
              <li>
                <strong>{pagesCopy('yourLinkedAccount')}</strong> when you sign in to
                salvageunion.io with Discord, your account keeps your Discord user ID, name and
                avatar. The Bot uses that ID to recognise you in <code>{pagesCopy('suMe')}</code>,{' '}
                <code>{pagesCopy('suGames')}</code> and <code>{pagesCopy('suSheet')}</code>, and
                shows only what your account may see.
              </li>
              <li>
                <strong>{pagesCopy('boundChannels')}</strong> (<code>{pagesCopy('suBind')}</code>):
                the channel’s ID and name, the Game it posts for (or none, for solo play), who bound
                it and when. <code>{pagesCopy('suUnbind')}</code> deletes it.
              </li>
              <li>
                <strong>{pagesCopy('rollsFromPlay')}</strong> a roll made on salvageunion.io is
                posted to the bound channel as a card naming the roller. Its buttons carry the
                roller’s Discord ID so that only they can use them.
              </li>
            </ul>
            <p style={AFTER_LIST}>
              The Bot requests only the “Guilds” gateway intent. It does{' '}
              <strong>{pagesCopy('not')}</strong> read message content, and it never stores your
              messages.
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
                <strong>{pagesCopy('discord')}</strong> — your use of the Bot is also governed by
                Discord’s Privacy Policy.
              </li>
              <li>
                <strong>{pagesCopy('cloudflare')}</strong> — hosts the Bot and salvageunion.io, and
                logs their errors.
              </li>
              <li>
                <strong>{pagesCopy('convex')}</strong> — stores salvageunion.io accounts, Games and
                bound channels.
              </li>
              <li>
                <strong>{pagesCopy('github')}</strong> {pagesCopy('hostsThePublicIssues')}
              </li>
            </ul>
          </div>

          <div>
            <Slab as="h2" label={pagesCopy('yourData')} />
            <p>
              Signed in at salvageunion.io,{' '}
              <InlineRef href={appPath('/settings')} style={BOLD}>
                {pagesCopy('settings')}
              </InlineRef>{' '}
              lets you export everything your account holds or delete the account. Deleting it
              removes your Discord link, your solo channel and any feedback not yet posted. A Game’s
              bound channel stays with the Game until someone runs{' '}
              <code>{pagesCopy('suUnbind')}</code>. For anything else, contact{' '}
              <InlineRef href="mailto:privacy@salvageunion.io" style={BOLD}>
                {pagesCopy('privacySalvageunionIo')}
              </InlineRef>
              .
            </p>
          </div>

          <p style={SMALL_PRINT}>
            See also the{' '}
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
