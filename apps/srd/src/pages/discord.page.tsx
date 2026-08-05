/**
 * `/discord` — the Discord bot landing page. Port of `discord.astro`.
 */

import { buttonVariants, cn, PageHeading, Panel, Slab } from 'component-lib'
import type { PageModule, PageResult } from '../../ssg/types'
import { ITUN_URL, SITE_URL } from '../lib/constants'

const TITLE = 'Discord Bot - Salvage Union System Reference Document'
const DESCRIPTION =
  'Add the SURef bot to your Discord server: roll on every Salvage Union table and look up any chassis, system, module, or piece of equipment with /su.'

// The install CTA is an <a> styled as THE primary (rust) action — the lib
// Button recipe as a class string (buttonVariants), keeping the condensed
// uppercase treatment this hero link uses.
const installButtonClass = cn(
  buttonVariants({ variant: 'primary' }),
  'font-cond text-base uppercase tracking-caps-snug'
)

// The client id is public by design — it appears in every Discord invite
// URL. The bot itself authenticates with its token, never this id.
const DISCORD_CLIENT_ID = '1442878052823470172'
const INSTALL_URL = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&scope=bot%20applications.commands&permissions=0`

function page(): PageResult {
  return {
    meta: {
      title: TITLE,
      description: DESCRIPTION,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'SURef Discord Bot',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Discord',
        description:
          'Roll on Salvage Union tables and look up any game entity without leaving your Discord server.',
        url: `${SITE_URL}/discord/`,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        isPartOf: {
          '@type': 'WebSite',
          name: 'Salvage Union System Reference Document',
          url: `${SITE_URL}/`,
        },
      },
      breadcrumbs: [
        { name: 'Home', url: `${SITE_URL}/` },
        { name: 'Discord Bot', url: `${SITE_URL}/discord/` },
      ],
    },
    children: (
      <div className="flex w-full flex-1 flex-col py-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6">
          <PageHeading>Discord Bot</PageHeading>

          {/* Overview + install */}
          <section className="flex flex-col gap-4 text-sm leading-relaxed">
            <p>
              The SURef bot brings this reference to your table&rsquo;s Discord server: roll on
              every Salvage Union table and look up any game entity — chassis, systems, modules,
              equipment, keywords, and more — without leaving the conversation. Results link back to
              the full entry on this site.
            </p>
            <p>
              It asks for no server permissions — it only ever replies to slash commands. Free, no
              account, no configuration.
            </p>
            <p>
              <a
                href={INSTALL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={installButtonClass}
              >
                Add to your Discord server
              </a>
            </p>
          </section>

          {/* Commands */}
          <section className="flex flex-col gap-6">
            <Slab as="h2" variant="solid" label="Commands" />

            <Panel soft>
              <div className="border-b-chrome border-wk-faint px-5 py-3">
                <p className="mt-1 font-body text-base font-bold">
                  /su roll <span className="text-rust">[table]</span>
                </p>
              </div>
              <div className="flex flex-col gap-3 px-5 py-4 text-sm leading-relaxed">
                <p>
                  Rolls a d20 on any Salvage Union table. Leave{' '}
                  <code className="rounded-card bg-wk-bg px-1 py-0.5">table</code> empty to roll on
                  the <strong>Core Mechanic</strong> table — the game&rsquo;s basic d20 resolution
                  roll.
                </p>
                <p>
                  Start typing a table name and autocomplete suggests matches from all 96 tables —
                  Critical Damage, Reactor Overload, Area Salvage, NPC generators, Keepsakes,
                  Mottos, and every table from the expansions. Column tables (like the NPC tables)
                  roll two d20s: one for the column, one for the entry.
                </p>
                <p>
                  <strong>Examples:</strong>
                </p>
                <ul className="ml-5 flex list-disc flex-col gap-1">
                  <li>
                    <code className="rounded-card bg-wk-bg px-1 py-0.5">/su roll</code> — Core
                    Mechanic d20
                  </li>
                  <li>
                    <code className="rounded-card bg-wk-bg px-1 py-0.5">
                      /su roll table: Critical Damage
                    </code>{' '}
                    — what happens at 0 SP
                  </li>
                  <li>
                    <code className="rounded-card bg-wk-bg px-1 py-0.5">
                      /su roll table: Group Initiative
                    </code>{' '}
                    — who acts first
                  </li>
                </ul>
              </div>
            </Panel>

            <Panel soft>
              <div className="border-b-chrome border-wk-faint px-5 py-3">
                <p className="mt-1 font-body text-base font-bold">
                  /su lookup <span className="text-rust">entity</span>
                </p>
              </div>
              <div className="flex flex-col gap-3 px-5 py-4 text-sm leading-relaxed">
                <p>
                  Looks up any entity in the reference — the same search as this site&rsquo;s
                  <kbd className="rounded-card border border-wk-faint bg-wk-bg px-1.5 py-0.5 font-body text-xs">
                    Cmd&nbsp;K
                  </kbd>{' '}
                  box. Autocomplete searches as you type (multi-word queries and small typos are
                  fine); the reply shows the entity&rsquo;s key stats and links to its full page
                  here.
                </p>
                <p>
                  <strong>Examples:</strong>
                </p>
                <ul className="ml-5 flex list-disc flex-col gap-1">
                  <li>
                    <code className="rounded-card bg-wk-bg px-1 py-0.5">
                      /su lookup entity: heavy laser
                    </code>
                  </li>
                  <li>
                    <code className="rounded-card bg-wk-bg px-1 py-0.5">
                      /su lookup entity: iron mongrel
                    </code>
                  </li>
                  <li>
                    <code className="rounded-card bg-wk-bg px-1 py-0.5">
                      /su lookup entity: overheat
                    </code>
                  </li>
                </ul>
              </div>
            </Panel>
          </section>

          {/* Notes */}
          <section className="flex flex-col gap-3 text-sm leading-relaxed">
            <Slab as="h2" variant="solid" label="Good to know" />
            <ul className="ml-5 flex list-disc flex-col gap-2">
              <li>
                Typing <code className="rounded-card bg-wk-bg px-1 py-0.5">/su</code> filters
                Discord&rsquo;s command picker to just this bot — no more fishing your roll out of a
                pile of identically-named commands from other bots.
              </li>
              <li>
                The bot serves the same dataset as this site, including expansion content and the
                community Mech Monday patterns. It updates automatically when the reference does.
              </li>
              <li>
                It never reads messages — its only Discord capability is answering slash commands.
              </li>
            </ul>
            <p className="rounded-panel border-l-4 border-rust bg-wk-bg px-4 py-3">
              <strong>Running a campaign?</strong> Pair the bot with{' '}
              <a
                href={ITUN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-rust hover:underline"
              >
                In The Union Now
              </a>
              , the no-account character builder &amp; game manager — sheets can be shared into
              Discord as snapshot links.
            </p>
          </section>

          {/* Attribution */}
          <p className="border-t border-wk-faint pt-6 text-center text-xs text-wk-muted">
            Dice rolling powered by{' '}
            <a
              href="https://randsum.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-rust hover:underline"
            >
              Randsum.dev
            </a>
            .
          </p>

          {/* Legal */}
          <p className="text-center text-xs text-wk-muted">
            <a href="/bot/terms" className="underline hover:text-rust">
              Terms of Service
            </a>
            <span className="px-1.5 text-wk-faint">·</span>
            <a href="/bot/privacy" className="underline hover:text-rust">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    ),
  }
}

export const discordPage: PageModule = {
  pattern: '/discord',
  page,
}
