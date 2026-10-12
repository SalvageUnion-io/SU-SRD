/**
 * `/discord` — the Discord bot landing page.
 */

import { buttonVariants, ChapterBand, InlineRef, Panel, Slab } from 'component-lib'
import { borderWidth, color, font, fontSize, space, tracking } from 'component-lib/design/tokens'
import { PRODUCT } from 'component-lib/product'
import type { CSSProperties } from 'react'
import type { PageModule, PageResult } from '../../ssg/types'
import { DISCORD_INSTALL_URL, ITUN_URL, SITE_URL, TITLE_SUFFIX } from '../lib/constants'
import {
  ASIDE,
  BOLD,
  bulletList,
  column,
  DOC_PAGE,
  docMeasure,
  ITALIC,
  inlineCode,
  PANEL_BODY,
  PANEL_HEAD,
  PANEL_TITLE,
  proseColumn,
} from '../lib/docPageStyles'
import { SalvageUnionReference } from '../lib/gameData'

/**
 * Both values are DERIVED, and both are built inside `page()`.
 *
 * the `noModuleScopeReferenceCall` Biome plugin forbids a module-scope `SalvageUnionReference` call —
 * it would run at import time, before the build's `preload()` bootstrap, and
 * throw "Schema not loaded".
 *
 * What they replaced:
 *
 * - the table count was the literal `96`. True at the time, and it would have
 *   gone quietly false the first time a table was added, with nothing anywhere
 *   to notice.
 * - the lookup example was "iron mongrel", a chassis that has never existed —
 *   the same fiction the `/api` page documented. Anyone who typed the example
 *   command got nothing back.
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

const TITLE = `Discord Bot${TITLE_SUFFIX}`
const DESCRIPTION =
  'Add the SURef bot to your Discord server: roll on every Salvage Union table and look up any chassis, system, module, or piece of equipment with /su.'

// The install CTA is an <a> styled as THE primary (rust) action — the lib
// Button recipe as a class string (buttonVariants), keeping the condensed
// uppercase treatment this hero link uses. None of those four properties
// changes on hover, so they sit inline over the recipe.
const installButtonClass = buttonVariants({ variant: 'primary' })

const INSTALL_TYPE = {
  fontFamily: font.cond,
  fontSize: fontSize.base,
  letterSpacing: tracking.capsSnug,
  lineHeight: 1.5,
  textTransform: 'uppercase',
} satisfies CSSProperties

const MEASURE = docMeasure('48rem', space[32])
const PROSE_12 = proseColumn(space[12])
const PROSE_16 = proseColumn(space[16])
const COLUMN_24 = column(space[24])
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
  color: color.wkMuted,
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

function page(): PageResult {
  const examples = buildExamples()

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
      <div style={DOC_PAGE}>
        <ChapterBand measure="48rem">Discord Bot</ChapterBand>
        <div style={MEASURE}>
          {/* Overview + install */}
          <section style={PROSE_16}>
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
                href={DISCORD_INSTALL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={installButtonClass}
                style={INSTALL_TYPE}
              >
                Add to your Discord server
              </a>
            </p>
          </section>

          {/* Commands */}
          <section style={COLUMN_24}>
            <Slab as="h2" variant="solid" label="Commands" />

            <Panel soft>
              <div style={PANEL_HEAD}>
                <p style={PANEL_TITLE}>
                  /su roll <span style={ITALIC}>[table]</span>
                </p>
              </div>
              <div style={PANEL_BODY}>
                <p>
                  Rolls a d20 on any Salvage Union table. Leave <code style={CODE}>table</code>{' '}
                  empty to roll on the <strong>Core Mechanic</strong> table — the game&rsquo;s basic
                  d20 resolution roll.
                </p>
                <p>
                  Start typing a table name and autocomplete suggests matches from all{' '}
                  {examples.rollTableCount} tables — Critical Damage, Reactor Overload, Area
                  Salvage, NPC generators, Keepsake, Motto, and every table from the expansions.
                  Column tables (like the NPC tables) roll two d20s: one for the column, one for the
                  entry.
                </p>
                <p>
                  <strong>Examples:</strong>
                </p>
                <ul style={LIST_4}>
                  <li>
                    <code style={CODE}>/su roll</code> — Core Mechanic d20
                  </li>
                  <li>
                    <code style={CODE}>/su roll table: Critical Damage</code> — what happens at 0 SP
                  </li>
                  <li>
                    <code style={CODE}>/su roll table: Group Initiative</code> — who acts first
                  </li>
                </ul>
              </div>
            </Panel>

            <Panel soft>
              <div style={PANEL_HEAD}>
                <p style={PANEL_TITLE}>
                  /su lookup <span style={ITALIC}>entity</span>
                </p>
              </div>
              <div style={PANEL_BODY}>
                <p>
                  Looks up any entity in the reference — the same search as this site&rsquo;s
                  <kbd style={KEY_CAP}>Cmd&nbsp;K</kbd> box. Autocomplete searches as you type
                  (multi-word queries and small typos are fine); the reply shows the entity&rsquo;s
                  key stats and links to its full page here.
                </p>
                <p>
                  <strong>Examples:</strong>
                </p>
                <ul style={LIST_4}>
                  <li>
                    <code style={CODE}>/su lookup entity: green laser</code>
                  </li>
                  <li>
                    <code style={CODE}>
                      /su lookup entity: {examples.lookupExample.toLowerCase()}
                    </code>
                  </li>
                  <li>
                    <code style={CODE}>/su lookup entity: overheat</code>
                  </li>
                </ul>
              </div>
            </Panel>
          </section>

          {/* Notes */}
          <section style={PROSE_12}>
            <Slab as="h2" variant="solid" label="Good to know" />
            <ul style={LIST_8}>
              <li>
                Typing <code style={CODE}>/su</code> filters Discord&rsquo;s command picker to just
                this bot — no more fishing your roll out of a pile of identically-named commands
                from other bots.
              </li>
              <li>
                The bot serves the same dataset as this site, including expansion content and the
                community Mech Monday patterns. It updates automatically when the reference does.
              </li>
              <li>
                It never reads messages — its only Discord capability is answering slash commands.
              </li>
            </ul>
            <p style={ASIDE}>
              <strong>Running a campaign?</strong> Pair the bot with{' '}
              <InlineRef href={ITUN_URL} target="_blank" rel="noopener noreferrer" style={BOLD}>
                {PRODUCT.name}
              </InlineRef>
              {/*
                "no-account" means usable without one: signed out, ITUN is
                read-only, and building needs an account (ADR-034). It must
                never be reworded to claim building or keeping work without one.
              */}
              , the no-account character builder &amp; game manager — sheets can be shared into
              Discord as live public links.
            </p>
          </section>

          {/* Attribution */}
          <p style={ATTRIBUTION}>
            Dice rolling powered by{' '}
            <InlineRef
              href="https://randsum.dev"
              target="_blank"
              rel="noopener noreferrer"
              style={BOLD}
            >
              Randsum.dev
            </InlineRef>
            .
          </p>

          {/* Legal */}
          <p style={LEGAL}>
            <InlineRef href="/bot/terms">Terms of Service</InlineRef>
            <span style={LEGAL_DOT}>·</span>
            <InlineRef href="/bot/privacy">Privacy Policy</InlineRef>
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
