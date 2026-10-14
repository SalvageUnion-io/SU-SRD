/**
 * The Discord card: what a `/su lookup` reply and a pasted salvageunion.io
 * link both draw. Pins the book's devices (label-first chips in E17's order,
 * the cost last, linked traits, the table) and the fit rule (whole parts shed, the page
 * linked), plus the accent mirror of `theme.css`.
 */

import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getModel } from '../../helpers'
import { EntitySchemaNames, findEntityBySlug } from '../../index'
import { getPatterns } from '../../patterns'
import type { SURefEnumSchemaName, SURefMetaEntity } from '../../schemas/index'
import type { DiscordCard } from '../discordCard'
import {
  DISCORD_TONE_ACCENT,
  discordCard,
  discordCardParts,
  linkTraitReferences,
} from '../discordCard'
import { discordRowSummary } from '../discordRowSummary'
import { ACTION_TYPE_LABELS } from '../parts/facts'
import { formatActionType } from '../parts/traits'
import { toEntityModel } from '../toEntityModel'

/** Rendered characters, as Discord counts them across every text display. */
function discordCardTextLength(card: DiscordCard): number {
  return card.blocks.reduce((n, block) => {
    if (block.kind === 'text') return n + block.content.length
    if (block.kind === 'section') return n + block.text.reduce((m, t) => m + t.length, 0)
    return n
  }, 0)
}

const need = <T>(value: T | undefined | null, label: string): T => {
  if (value == null) throw new Error(`fixture missing: ${label}`)
  return value
}

const partsFor = (schemaName: SURefEnumSchemaName, slug: string) =>
  discordCardParts(toEntityModel(need(findEntityBySlug(schemaName, slug), slug)))

const text = (card: DiscordCard): string =>
  card.blocks
    .map((block) =>
      block.kind === 'text'
        ? block.content
        : block.kind === 'section'
          ? block.text.join('\n')
          : '---'
    )
    .join('\n')

describe('discordCardParts', () => {
  test('a chassis prints its facts label first, a line to each stat group', () => {
    const parts = partsFor('chassis', 'mule')
    expect(parts.tone).toBe('mech')
    // No kicker: a chassis has no parent, and the kind is never one.
    expect(parts.head[0]).toBe('## [Mule](https://salvageunion.io/chassis/mule)')
    expect(parts.head.slice(1)).toEqual([
      '**TL** 1 · **SV** 7',
      '**SP** 12 · **EP** 4',
      '**SYS** 16 · **MODS** 2',
    ])
    expect(parts.thumbnail?.url).toContain('mule')
    expect(parts.cite).toBe(
      '-# Workshop Manual · p.100 · Also in Salvage Union Starter Set (PC) · p.12'
    )
  })

  test('an ability leads with its tier; its chips run type, facts, traits, cost last', () => {
    const parts = partsFor('abilities', 'counter-hacking')
    expect(parts.head[0]).toStartWith('## 2 · [Counter-Hacking](')
    expect(parts.head[1]).toBe('**Reaction** · **RNG** Medium')
    expect(parts.head[2]).toBe('[Hacking](https://salvageunion.io/traits/hacking) · `1 AP`')
    expect(parts.table?.rows.map((row) => row.key)).toEqual(['20', '11-19', '6-10', '2-5', '1'])
  })

  test("a system's chips open with TL, then its action type as the book prints it", () => {
    const head = partsFor('systems', '50-cal-machine-gun').head
    expect(head[0]).toStartWith('## [.50 Cal Machine Gun](')
    expect(head[1]).toBe('**TL** 1 · **Slots** 2 · **SV** 2')
    expect(head[2]).toBe('**Turn Action** · **RNG** Close · **DMG** 2 SP')
  })

  test("an action band's chips end on its cost", () => {
    const patch = need(
      partsFor('systems', 'fabrication-arm').actions.find((action) => action.name === 'Patch'),
      'patch'
    )
    expect(patch.summary).toBe('**Patch**\n-# **Turn Action** · **RNG** Close · `2 EP`')
  })

  test('the action types read as the Core Book prints them (pp.23, 237-238)', () => {
    expect(Object.keys(ACTION_TYPE_LABELS).map((type) => formatActionType(type))).toEqual([
      'Turn Action',
      'Free Action',
      'Short Action',
      'Long Action',
      'Downtime Action',
      'Reaction',
      'Passive',
    ])
  })

  test('a lower-case glossary name is set as the book prints it', () => {
    expect(partsFor('traits', 'vulnerable').head[0]).toStartWith('## [Vulnerable](')
  })

  test('a pattern names its chassis and lists its loadout as links', () => {
    const mule = need(findEntityBySlug('chassis', 'mule'), 'mule')
    const hauler = need(
      getPatterns(mule)?.find((pattern) => pattern.name === 'Hauler'),
      'hauler'
    )
    const parts = discordCardParts(toEntityModel(mule, undefined, { pattern: hauler }))
    expect(parts.head[0]).toBe('-# PATTERN OF MULE')
    expect(parts.url).toBe('https://salvageunion.io/chassis/mule/pattern/hauler')
    const systems = need(
      parts.children.find((group) => group.label === 'Systems'),
      'systems'
    )
    expect(systems.count).toBe(7)
    expect(systems.line).toContain('[Rigging Arm](https://salvageunion.io/systems/rigging-arm)')
    // The chassis ability shows only on the chassis and pattern pages.
    expect(parts.actions).toEqual([])
  })

  test('renders every entity without throwing, and never leaves raw [[ markup', () => {
    for (const schemaName of EntitySchemaNames) {
      for (const entity of (getModel(schemaName)?.all() ?? []) as SURefMetaEntity[]) {
        const card = discordCard(discordCardParts(toEntityModel(entity)))
        expect(text(card)).not.toContain('[[')
      }
    }
  })
})

describe('linkTraitReferences', () => {
  test('links a known trait and keeps its parameter', () => {
    expect(linkTraitReferences('gains the [[Vulnerable]] Trait')).toBe(
      'gains the [Vulnerable](https://salvageunion.io/traits/vulnerable) Trait'
    )
  })
})

describe('discordCard', () => {
  test('sheds a long table whole, keeps the head and the cite, and links the table', () => {
    const parts = partsFor('roll-tables', 'anomalous-zone')
    const card = discordCard(parts, { fits: (c) => discordCardTextLength(c) <= 1500 })
    const body = text(card)
    expect(discordCardTextLength(card)).toBeLessThanOrEqual(1500)
    expect(body).toContain('## [Anomalous Zone](')
    expect(body).toContain('[See the whole table on salvageunion.io](')
    expect(body).toContain(parts.cite)
    // Never its top rows alone: the whole table goes.
    expect(body).not.toContain('ROLL THE DIE')
    expect(body).not.toContain('`20` **MELD BEHEMOTH**')
  })

  test('a card that sheds more than its table links the full entry', () => {
    const parts = partsFor('systems', 'mechapult')
    expect(parts.prose.length).toBeGreaterThan(0)
    const card = discordCard(parts, { fits: (c) => discordCardTextLength(c) <= 300 })
    expect(text(card)).not.toContain('ROLL THE DIE')
    expect(text(card)).toContain('[The full entry on salvageunion.io](')
    // The bot draws the same link as its footer button.
    expect(card.blocks.find((block) => block.kind === 'text' && block.more)).toMatchObject({
      more: { label: 'Full entry', url: 'https://salvageunion.io/systems/mechapult' },
    })
  })

  test('the children block carries its groups, for the bot to draw as rows', () => {
    const parts = partsFor('drones', 'the-iron-lady')
    const block = discordCard(parts).blocks.find((one) => one.kind === 'text' && one.children)
    expect(block?.kind === 'text' ? block.children?.map((group) => group.label) : []).toEqual([
      'Modules',
    ])
  })
})

describe('discordRowSummary', () => {
  test('a system reads as an action row: linked name, type, label-first range and damage, traits', () => {
    const railgun = need(findEntityBySlug('systems', 'railgun'), 'railgun')
    expect(
      discordRowSummary({ schemaName: 'systems', id: railgun.id, slug: 'railgun', name: 'Railgun' })
    ).toBe(
      [
        '**[Railgun](https://salvageunion.io/systems/railgun)**',
        '-# Turn Action · **RNG** Long · **DMG** 9 SP',
        '[Ballistic](https://salvageunion.io/traits/ballistic) · [Hot](https://salvageunion.io/traits/hot) 2',
      ].join('\n')
    )
  })

  test('a module shows its cost last; a synthetic or missing record has no row', () => {
    const firewall = need(findEntityBySlug('modules', 'firewall'), 'firewall')
    expect(
      discordRowSummary({
        schemaName: 'modules',
        id: firewall.id,
        slug: 'firewall',
        name: 'Firewall',
      })
    ).toContain(
      '-# Reaction · **RNG** Medium\n[Hacking](https://salvageunion.io/traits/hacking) · `2 EP`'
    )
    expect(
      discordRowSummary({ schemaName: 'modules', id: 'x', slug: 'x', name: 'X', synthetic: true })
    ).toBeNull()
    expect(
      discordRowSummary({ schemaName: 'modules', id: 'nope', slug: 'nope', name: 'Nope' })
    ).toBeNull()
  })

  test('marks the rolled row and keeps it while shedding', () => {
    const parts = partsFor('roll-tables', 'anomalous-zone')
    const card = discordCard(parts, {
      markedRow: '1',
      markedNote: 'ROLLED 1 · Alex',
      fits: (c) => discordCardTextLength(c) <= 1500,
    })
    expect(text(card)).toContain('> **▶** `1`')
    expect(text(card)).toContain('> -# ROLLED 1 · Alex')
  })
})

describe('DISCORD_TONE_ACCENT', () => {
  const css = readFileSync(
    join(import.meta.dir, '../../../../component-lib/src/styles/theme.css'),
    'utf8'
  )
  const token = (name: string): number => {
    const match = css.match(new RegExp(`--color-${name}:\\s*rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)`))
    if (!match) throw new Error(`--color-${name} not in theme.css`)
    const [, r, g, b] = match.map(Number)
    return ((r ?? 0) << 16) | ((g ?? 0) << 8) | (b ?? 0)
  }

  test('mirrors theme.css, except ink (the rules blue) and crawler (its band)', () => {
    for (const [tone, accent] of Object.entries(DISCORD_TONE_ACCENT)) {
      const source =
        tone === 'ink' || tone === 'ink-2' ? 'wk-line' : tone === 'crawler' ? 'crawler-band' : tone
      expect([tone, accent]).toEqual([tone, token(source)])
    }
  })
})
