/**
 * `/bot` — the Discord bot landing page (`/discord` 301s here).
 *
 * The command list is the bot's own: `DISCORD_COMMANDS` is generated from the
 * registered `/su` builder (`apps/discord-bot/src/commandList.ts`), so every
 * subcommand is here under the name and description Discord shows. The
 * reference tools each get a panel with worked examples (`commandDetail`); the
 * app commands are listed under the account they need.
 */

import { PRODUCT } from 'game-domain/product'
import type { CSSProperties, ReactNode } from 'react'
import { Button, InlineRef, Slab, SlabSection, Stack } from '../../components/index'
import { borderWidth, color, font, fontSize, space } from '../../design/tokens'
import type { DiscordCommand } from '../../generated/discordCommands'
import { DISCORD_COMMANDS } from '../../generated/discordCommands'
import { DISCORD_SAMPLES } from '../../generated/discordSamples'
import { appPath } from '../../lib/appBase'
import { DISCORD_INSTALL_URL, SITE_URL, SRD_CRUMB, WEBSITE } from '../../lib/constants'
import {
  ASIDE,
  BOLD,
  BREAKABLE_BOLD,
  bulletList,
  ITALIC,
  inlineCode,
  PROSE_12,
  proseColumn,
} from '../../lib/docPageStyles'
import { SalvageUnionReference } from '../../lib/gameData'
import { pageTitle } from '../../lib/pageTitle'
import { pagesCopy } from '../../messages/reference-pages'
import { DiscordReply } from '../DiscordReply'
import { DocPage } from '../DocPage'
import { DocPanel } from '../DocPanel'
import type { PageModule, PageResult } from '../types'

/**
 * Both values are DERIVED, and both are built inside `page()`.
 *
 * the `noModuleScopeReferenceCall` Biome plugin forbids a module-scope `SalvageUnionReference` call —
 * it would run at import time, before the build's `preload()` bootstrap, and
 * throw "Schema not loaded".
 *
 * Derived from the data, so the table count and the lookup example never go
 * stale: the count is every roll table, and the example is a chassis that
 * exists, so the example command always answers.
 */
function buildExamples() {
  const rollTableCount = SalvageUnionReference.RollTables.all().length
  // Sorted for determinism: an unsorted `[0]` would change the page whenever
  // the data file's order changed.
  const lookupExample =
    [...SalvageUnionReference.Chassis.all()].sort((a, b) => a.name.localeCompare(b.name))[0]
      ?.name ?? 'Aegis'
  return { rollTableCount, lookupExample }
}

const TITLE = pageTitle(pagesCopy('discordBot'))
const DESCRIPTION =
  'Add the SalvageUnion.io bot to your Discord server: roll on every Salvage Union table and look up any chassis, system, module, or piece of equipment with /su.'

const PROSE_16 = proseColumn(space[16])
const CODE = inlineCode()
const LIST_4 = bulletList(space[4], 'margin')
const LIST_8 = bulletList(space[8], 'margin')

/** The site's search shortcut, as a key cap in prose. */
const KEY_CAP = {
  ...inlineCode(),
  borderColor: color.wkFaint,
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
  fontFamily: font.body,
  fontSize: fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
  paddingInline: space[6],
} satisfies CSSProperties

const LEGAL = {
  color: color.wkMuted, // design-tokens-ignore(muted-note): the legal line
  fontSize: fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
  textAlign: 'center',
} satisfies CSSProperties

const ATTRIBUTION = {
  ...LEGAL,
  borderColor: color.wkFaint,
  borderStyle: 'solid',
  borderWidth: `${borderWidth.hairline} 0 0`,
  paddingTop: space[24],
} satisfies CSSProperties

const LEGAL_DOT = { color: color.wkFaint, paddingInline: space[6] } satisfies CSSProperties

/** A command as Discord's picker spells it: optional options in brackets, every option italic. */
function Usage({ command }: { command: DiscordCommand }) {
  return (
    <>
      /su {command.name}
      {command.options.map((option) => (
        <span key={option.name} style={ITALIC}>
          {' '}
          {option.required ? option.name : `[${option.name}]`}
        </span>
      ))}
    </>
  )
}

/** The worked examples under a reference tool's panel, by subcommand. */
function commandDetail(
  name: string,
  examples: ReturnType<typeof buildExamples>
): ReactNode | undefined {
  switch (name) {
    case 'roll':
      return (
        <>
          <p>
            Rolls a d20 on any Salvage Union table. Leave{' '}
            <code style={CODE}>{pagesCopy('table')}</code> empty to roll on the{' '}
            <strong>{pagesCopy('coreMechanic')}</strong> table — the game&rsquo;s basic d20
            resolution roll.
          </p>
          <p>{pagesCopy('startTypingATableName', { rollTableCount: examples.rollTableCount })}</p>
          <p>
            <strong>{pagesCopy('examples')}</strong>
          </p>
          <ul style={LIST_4}>
            <li>
              <code style={CODE}>{pagesCopy('suRoll')}</code> — Core Mechanic d20
            </li>
            <li>
              <code style={CODE}>{pagesCopy('suRollTableCriticalDamage')}</code> — what happens at 0
              SP
            </li>
            <li>
              <code style={CODE}>{pagesCopy('suRollTableGroupInitiative')}</code> — who acts first
            </li>
          </ul>
        </>
      )
    case 'lookup':
      return (
        <>
          <p>
            Looks up any entity in the reference — the same search as this site&rsquo;s
            <kbd style={KEY_CAP}>{pagesCopy('cmdK')}</kbd> box. Autocomplete searches as you type
            (multi-word queries and small typos are fine); the reply shows the entity&rsquo;s key
            stats and links to its full page here.
          </p>
          <p>
            <strong>{pagesCopy('examples')}</strong>
          </p>
          <ul style={LIST_4}>
            <li>
              <code style={CODE}>{pagesCopy('suLookupEntityGreenLaser')}</code>
            </li>
            <li>
              <code style={CODE}>
                {pagesCopy('suLookupEntity', { lowerCase: examples.lookupExample.toLowerCase() })}
              </code>
            </li>
            <li>
              <code style={CODE}>{pagesCopy('suLookupEntityOverheat')}</code>
            </li>
          </ul>
        </>
      )
    default:
      return undefined
  }
}

function page(): PageResult {
  const examples = buildExamples()
  const reference = DISCORD_COMMANDS.filter((command) => !command.needsAccount)
  const withAccount = DISCORD_COMMANDS.filter((command) => command.needsAccount)

  return {
    meta: {
      title: TITLE,
      description: DESCRIPTION,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'SoftwareApplication',
        name: 'SalvageUnion.io Discord Bot',
        applicationCategory: 'UtilitiesApplication',
        operatingSystem: 'Discord',
        description: pagesCopy('rollOnSalvageUnionTables'),
        url: `${SITE_URL}/bot/`,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        isPartOf: WEBSITE,
      },
      breadcrumbs: [SRD_CRUMB, { name: 'Discord Bot', url: `${SITE_URL}/bot/` }],
    },
    children: (
      <DocPage
        title={pagesCopy('discordBot')}
        measure="48rem"
        gap={space[32]}
        // Discord's own colour, the band its page wears (R42), its install
        // button on it.
        fill={color.discord}
        sidebar={
          // What it sends: the bot's own replies, drawn from its builders,
          // in the page's sidebar.
          <Stack as="section" gap={16}>
            <Slab as="h2" label={pagesCopy('inYourServer')} />
            <DiscordReply sample={DISCORD_SAMPLES.roll} label={pagesCopy('theBotsReplyToSu')} />
            <DiscordReply sample={DISCORD_SAMPLES.lookup} label={pagesCopy('theBotsReplyToSu2')} />
          </Stack>
        }
        controls={
          <Button
            href={DISCORD_INSTALL_URL}
            target="_blank"
            rel="noopener noreferrer"
            variant="ink"
            size="full"
          >
            {pagesCopy('addToYourDiscordServer')}
          </Button>
        }
      >
        {/* Overview + install */}
        <section style={PROSE_16}>
          <p>{pagesCopy('theSalvageunionIoBotBrings')}</p>
          <p>{pagesCopy('itAsksForNoServer')}</p>
        </section>

        {/* Commands: every /su subcommand, from the bot's own builder */}
        <Stack as="section" gap={24}>
          <Slab as="h2" label={pagesCopy('commands')} />

          {reference.map((command) => (
            <DocPanel key={command.name} title={`/su ${command.name}`} tone="discord">
              <p style={BREAKABLE_BOLD}>
                <code>
                  <Usage command={command} />
                </code>
              </p>
              {commandDetail(command.name, examples) ?? <p>{command.description}.</p>}
            </DocPanel>
          ))}
        </Stack>

        <SlabSection as="h2" title={pagesCopy('withYourAccount')} bodyStyle={PROSE_12} page>
          <p>
            These read your {PRODUCT.wordmark} account and its Games.{' '}
            <InlineRef href={appPath('/')} style={BOLD}>
              {pagesCopy('signIn')}
            </InlineRef>{' '}
            with the same Discord account and the bot knows you; until then each one says how.
          </p>
          <ul style={LIST_8}>
            {withAccount.map((command) => (
              <li key={command.name}>
                <code style={CODE}>
                  <Usage command={command} />
                </code>{' '}
                — {command.description}
              </li>
            ))}
          </ul>
        </SlabSection>

        {/* Notes */}
        <SlabSection as="h2" title={pagesCopy('goodToKnow')} bodyStyle={PROSE_12} page>
          <ul style={LIST_8}>
            <li>
              Typing <code style={CODE}>{pagesCopy('su')}</code> filters Discord&rsquo;s command
              picker to just this bot — no more fishing your roll out of a pile of identically-named
              commands from other bots.
            </li>
            <li>{pagesCopy('theBotServesTheSame')}</li>
            <li>{pagesCopy('itNeverReadsMessagesIts')}</li>
          </ul>
          <p style={ASIDE}>
            <strong>{pagesCopy('runningACampaign')}</strong> Pair the bot with the app: the{' '}
            <InlineRef href={appPath('/')} style={BOLD}>
              {PRODUCT.build}
            </InlineRef>
            {/*
                Signed out, the app is read-only; building needs an account
                (ADR-034). Never reword this to claim building or keeping work
                without one.
              */}
            , the character builder, and{' '}
            <InlineRef href={appPath('/play/')} style={BOLD}>
              {PRODUCT.play}
            </InlineRef>
            , the Game table: read the Starter Set with no account, and sign in with Discord to
            build. Sheets can be shared into Discord as live public links.
          </p>
        </SlabSection>

        {/* Attribution */}
        <p style={ATTRIBUTION}>
          Dice rolling powered by{' '}
          <InlineRef
            href="https://randsum.dev"
            target="_blank"
            rel="noopener noreferrer"
            style={BOLD}
          >
            {pagesCopy('randsumDev')}
          </InlineRef>
          .
        </p>

        {/* Legal */}
        <p style={LEGAL}>
          <InlineRef href="/bot/terms/">{pagesCopy('termsOfService')}</InlineRef>
          <span style={LEGAL_DOT}>·</span>
          <InlineRef href="/bot/privacy/">{pagesCopy('privacyPolicy')}</InlineRef>
        </p>
      </DocPage>
    ),
  }
}

export const discordPage: PageModule = {
  pattern: '/bot',
  page,
}
