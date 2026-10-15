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
import type { RefEnumSchemaName, RefMetaEntity } from '../../schemas/index'
import type { DiscordCard } from '../discordCard'
import {
  DISCORD_TONE_ACCENT,
  discordCard,
  discordCardParts,
  linkTraitReferences,
} from '../discordCard'
import { ACTION_TYPE_LABELS } from '../parts/facts'
import { splitSentences } from '../parts/paragraphs'
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

const partsFor = (schemaName: RefEnumSchemaName, slug: string) =>
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
      '**Tech Level** 1 · **Salvage Value** 7',
      '**Structure Points** 12 · **Energy Points** 4',
      '**System Slots** 16 · **Module Slots** 2',
    ])
    expect(parts.thumbnail?.url).toContain('mule')
    expect(parts.cite).toBe(
      '-# Workshop Manual · p.100 · Also in Salvage Union Starter Set (PC) · p.12'
    )
  })

  test('a chassis carries its abilities as actions, and the drones they name', () => {
    expect(partsFor('chassis', 'mule').actions.map((action) => action.name)).toEqual([
      'Integrated Cargo Bay',
    ])
    const sestra = partsFor('chassis', 'little-sestra')
    expect(sestra.actions.map((action) => action.name)).toEqual(['Sestra Drone Controller'])
    expect(sestra.children.map((group) => group.label)).toEqual(['Drones', 'Patterns'])
    expect(sestra.children[0]?.line).toBe(
      '[Sestra Drone](https://salvageunion.io/drones/sestra-drone)'
    )
  })

  test('a chassis links its patterns by name and nothing more', () => {
    const patterns = need(
      partsFor('chassis', 'mule').children.find((group) => group.label === 'Patterns'),
      'patterns'
    )
    expect(patterns.line).toContain('[Hauler](https://salvageunion.io/chassis/mule/pattern/hauler)')
    expect(patterns.items.every((item) => item.pattern === item.name)).toBe(true)
  })

  test('an ability leads with its tier; its chips run type, facts, traits, cost last', () => {
    const parts = partsFor('abilities', 'counter-hacking')
    expect(parts.head[0]).toStartWith('## 2 · [Counter-Hacking](')
    expect(parts.head[1]).toBe('**Reaction** · **Range** Medium')
    expect(parts.head[2]).toBe(
      '[Hacking](https://salvageunion.io/traits/hacking) · `1 Ability Point`'
    )
    expect(parts.table?.rows.map((row) => row.key)).toEqual(['20', '11-19', '6-10', '2-5', '1'])
  })

  test("a system's chips open with TL, then its action type as the book prints it", () => {
    const head = partsFor('systems', '50-cal-machine-gun').head
    expect(head[0]).toStartWith('## [.50 Cal Machine Gun](')
    expect(head[1]).toBe('**Tech Level** 1 · **Slots Required** 2 · **Salvage Value** 2')
    expect(head[2]).toBe('**Turn Action** · **Range** Close · **Damage** 2 Structure Points')
  })

  test("an action band's chips end on its cost", () => {
    const patch = need(
      partsFor('systems', 'fabrication-arm').actions.find((action) => action.name === 'Patch'),
      'patch'
    )
    expect(patch.text).toStartWith(
      '### Patch\n-# **Turn Action** · **Range** Close · `2 Energy Points`'
    )
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
    // Its host's ability is the host card's, never repeated here.
    expect(parts.actions).toEqual([])
  })

  test('a class lists its Core trees in level order', () => {
    const engineer = discordCardParts(
      toEntityModel(need(findEntityBySlug('classes', 'engineer'), 'engineer'))
    )
    expect(engineer.children.map((group) => group.label)).toEqual([
      'Mechanical Knowledge',
      'Forging',
      'Mech-Tech',
    ])
    expect(engineer.children[0]?.items.map((item) => item.name)).toEqual([
      'Engineering Expertise',
      'Talk Shop',
      'Mech Acquisition',
    ])
    expect(engineer.children[0]?.line).toStartWith(
      '[Engineering Expertise](https://salvageunion.io/abilities/engineering-expertise)'
    )
    // A Hybrid Class: its own tree; never its Legendary tree.
    const fabricator = discordCardParts(
      toEntityModel(need(findEntityBySlug('classes', 'fabricator'), 'fabricator'))
    )
    expect(fabricator.children.map((group) => group.label)).toEqual(['Fabricator'])
  })

  test('a class heads its card with its ability limit, then the classes it advances into', () => {
    const parts = (slug: string) =>
      discordCardParts(toEntityModel(need(findEntityBySlug('classes', slug), slug)))
    const engineer = parts('engineer')
    expect(engineer.head.slice(1)).toEqual([
      '**Abilities** Up to 10',
      '**Advances into** [Fabricator](https://salvageunion.io/classes/fabricator) · [Union Rep](https://salvageunion.io/classes/union-rep)',
    ])
    expect(engineer.headLinks.map((ref) => ref.name)).toEqual(['Fabricator', 'Union Rep'])
    // A Hybrid Class: its requirement, then its limit; it advances no further.
    const fabricator = parts('fabricator')
    expect(fabricator.head.slice(1)).toEqual([
      '**Requires** Forging or Electronics',
      '**Abilities** Up to 10',
    ])
    expect(fabricator.headLinks).toEqual([])
    // The Salvager advances into nothing.
    expect(parts('salvager').head.slice(1)).toEqual(['**Abilities** Up to 12'])
  })

  test('a paragraph prints one sentence to a line, the words unchanged', () => {
    const salvager = need(findEntityBySlug('classes', 'salvager'), 'salvager')
    const [paragraph] = discordCardParts(toEntityModel(salvager)).prose
    const lines = paragraph?.split('\n') ?? []
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(line).toMatch(/[.!?]['"]?$/)
    const source = salvager.content?.[0]?.value
    expect(lines.join(' ')).toBe(typeof source === 'string' ? source.trim() : '')
  })

  test('an abbreviation or a page cite never breaks a sentence', () => {
    expect(splitSentences('See p.23 for e.g. a Mech. Then roll.')).toEqual([
      'See p.23 for e.g. a Mech.',
      'Then roll.',
    ])
  })

  test('renders every entity without throwing, and never leaves raw [[ markup', () => {
    for (const schemaName of EntitySchemaNames) {
      for (const entity of (getModel(schemaName)?.all() ?? []) as RefMetaEntity[]) {
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
    expect(text(card)).toContain(
      '[The full entry on salvageunion.io](https://salvageunion.io/systems/mechapult)'
    )
  })
})

describe('discordCard — a rolled table', () => {
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
    join(import.meta.dir, '../../../../../apps/web/src/ui/styles/theme.css'),
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
