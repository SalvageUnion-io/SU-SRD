/**
 * `/bot/privacy` — Discord bot privacy policy.
 *
 * A plain static document: no islands, no data, no structured data.
 */

import type { PageModule, PageResult } from '../../../../ssg/types'
import { InlineRef, Slab } from '../../../components/index'
import { space } from '../../../design/tokens'
import { appPath } from '../../../lib/appBase'
import { BOLD, bulletList, proseColumn, SMALL_PRINT } from '../../../lib/docPageStyles'
import { pageTitle } from '../../../lib/pageTitle'
import { DocPage } from '../../DocPage'

const BODY = proseColumn(space[16])
const LIST = bulletList(space[4], 'padding')
const AFTER_LIST = { marginTop: space[8] }

const LAST_UPDATED = '22 October 2026'

function page(): PageResult {
  return {
    meta: {
      title: pageTitle('Discord Bot Privacy Policy'),
      description:
        'Privacy Policy for the Salvage Union Discord bot: what it stores when you link an account, bind a channel or send feedback, what it counts, and how to remove it.',
    },
    children: (
      <DocPage title="Salvage Union Bot — Privacy Policy" measure="48rem" gap={space[24]}>
        <p style={SMALL_PRINT}>Last updated: {LAST_UPDATED}</p>

        <section style={BODY}>
          <p style={BOLD}>
            Short version: rolling and looking things up store nothing about you; we count how often
            each command is used, and in how many servers. If you sign in to salvageunion.io with
            Discord, the Bot can show your account, Games and sheets, and post Play’s rolls to a
            channel you bind. We store only what those features need, and you can export or delete
            it from Settings.
          </p>

          <div>
            <Slab as="h2" label="What we collect" />
            <ul style={LIST}>
              <li>
                <strong>Rolls and lookups</strong> (<code>/su roll</code>, <code>/su lookup</code>):
                nothing about you. They answer in real time and keep no record. Buttons such as
                “Roll again” carry the table or dice in the button itself.
              </li>
              <li>
                <strong>Usage counts:</strong> for every command, a weekly count of how many times
                it was used, and the ID of each server it was used in, with when it was first and
                last used there. Never who ran it. These tell us how many tables the Bot serves.
              </li>
              <li>
                <strong>Feedback</strong> (<code>/su feedback</code>, and “Suggest or report” on
                salvageunion.io): your note is posted as a public issue on our GitHub repository,
                without your name or ID. Until it is posted we hold the note with your Discord user
                ID (or your account, from the site); once posted we delete the note’s text, and the
                rest within a day. We keep that day to limit how many notes one person sends.
              </li>
              <li>
                <strong>Your linked account:</strong> when you sign in to salvageunion.io with
                Discord, your account keeps your Discord user ID, name and avatar. The Bot uses that
                ID to recognise you in <code>/su me</code>, <code>/su games</code> and{' '}
                <code>/su sheet</code>, and shows only what your account may see.
              </li>
              <li>
                <strong>Bound channels</strong> (<code>/su bind</code>): the channel’s ID and name,
                the Game it posts for (or none, for solo play), who bound it and when.{' '}
                <code>/su unbind</code> deletes it.
              </li>
              <li>
                <strong>Rolls from Play:</strong> a roll made on salvageunion.io is posted to the
                bound channel as a card naming the roller. Its buttons carry the roller’s Discord ID
                so that only they can use them.
              </li>
            </ul>
            <p style={AFTER_LIST}>
              The Bot requests only the “Guilds” gateway intent. It does <strong>not</strong> read
              message content, and it never stores your messages.
            </p>
          </div>

          <div>
            <Slab as="h2" label="Error diagnostics" />
            <p>
              To keep the Bot reliable, unexpected errors are logged by our hosting provider
              (Cloudflare). These logs can include technical details about the error and the
              interaction that triggered it. They are used only to diagnose and fix bugs and are
              retained per that provider’s standard retention. Errors in the salvageunion.io backend
              are logged by Convex the same way.
            </p>
          </div>

          <div>
            <Slab as="h2" label="Third parties" />
            <ul style={LIST}>
              <li>
                <strong>Discord</strong> — your use of the Bot is also governed by Discord’s Privacy
                Policy.
              </li>
              <li>
                <strong>Cloudflare</strong> — hosts the Bot and salvageunion.io, and logs their
                errors.
              </li>
              <li>
                <strong>Convex</strong> — stores salvageunion.io accounts, Games and bound channels.
              </li>
              <li>
                <strong>GitHub</strong> — hosts the public issues your feedback becomes.
              </li>
            </ul>
          </div>

          <div>
            <Slab as="h2" label="Your data" />
            <p>
              Signed in at salvageunion.io,{' '}
              <InlineRef href={appPath('/settings')} style={BOLD}>
                Settings
              </InlineRef>{' '}
              lets you export everything your account holds or delete the account. Deleting it
              removes your Discord link, your solo channel and any feedback not yet posted. A Game’s
              bound channel stays with the Game until someone runs <code>/su unbind</code>. For
              anything else, contact{' '}
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
