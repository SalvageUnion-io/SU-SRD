/**
 * The `/su lookup` card: the shared Discord card (`discordCardParts`, from the
 * entity model) plus the bot's tabs, pages, pattern picker and roll buttons.
 *
 * The load-bearing test is the exhaustive pass: EVERY entity in EVERY schema,
 * on every tab and page it has, goes through lookupCard, and the container
 * guard must have nothing to shed. We can't see replies in Discord, so this is
 * what proves a lookup arrives whole across every schema, not the few we'd
 * pick by hand. The guard sheds whole blocks from the end, so an overrun would
 * leave a reply that is only its heading (#1124).
 */
import { describe, expect, test } from 'bun:test'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import {
  findEntityBySlug,
  getDataMaps,
  getPatterns,
  getSchemaCatalog,
  isSchemaName,
  SalvageUnionReference,
} from 'salvageunion-reference'
import type { ButtonSpec, ContainerData } from '../container'
import { enforceContainerLimits } from '../container'
import { NEUTRAL_ACCENT } from '../format'
import { lookupCard, parseViewPayload, patternPeek } from '../lookupCard'
import { cardText } from './cardText'

type Entity = SURefEntity & { schemaName: SURefEnumSchemaName }

/** The reply as sent must arrive whole: the container guard sheds no block. */
function assertFits(data: ContainerData, label: string): void {
  expect(enforceContainerLimits(data).blocks, `${label}: shed a block`).toEqual(data.blocks)
}

function entity(schemaName: SURefEnumSchemaName, slug: string): Entity {
  const found = findEntityBySlug(schemaName, slug)
  if (!found) throw new Error(`fixture missing: ${schemaName}/${slug}`)
  return { ...found, schemaName }
}

const buttonsOf = (data: ContainerData): ButtonSpec[] =>
  data.blocks.flatMap((block) => (block.kind === 'buttons' ? block.buttons : []))

const labels = (data: ContainerData): string[] => buttonsOf(data).map((button) => button.label)

describe('lookupCard — exhaustive validity across the whole dataset', () => {
  test('every entity, on every tab and page, renders whole and never in rust', () => {
    const schemas = getSchemaCatalog().schemas.filter((s) => !s.meta)
    const { dataMap } = getDataMaps()
    let checked = 0
    for (const schema of schemas) {
      if (!isSchemaName(schema.id)) throw new Error(`non-canonical schema id: ${schema.id}`)
      const entities = (dataMap[schema.id] as SURefEntity[] | undefined) ?? []
      for (const raw of entities) {
        const withSchema: Entity = { ...raw, schemaName: schema.id }
        const overview = lookupCard(withSchema, schema.id)
        assertFits(overview, `${schema.id}/${raw.id}`)
        // Rust means action, and only action (ruleset §3.1).
        expect(overview.accent).not.toBe(NEUTRAL_ACCENT)
        expect(cardText(overview)).not.toContain('[[')
        const pages = Math.ceil((getPatterns(raw)?.length ?? 0) / 2)
        for (let page = 0; page < pages; page++) {
          assertFits(
            lookupCard(withSchema, schema.id, { tab: 'patterns', page }),
            `${schema.id}/${raw.id} patterns ${page}`
          )
        }
        checked++
      }
    }
    // Guard against the loop silently checking nothing (accessor drift).
    expect(checked).toBeGreaterThan(800)
  })
})

describe('lookupCard — the card', () => {
  test('a chassis wears its tone and prints the book stat column', () => {
    const card = lookupCard(entity('chassis', 'goliath'), 'chassis')
    expect(card.accent).toBe(0x7a978a)
    const text = cardText(card)
    expect(text).toContain(
      '-# CHASSIS\n## [Goliath](https://salvageunion.io/schema/chassis/item/goliath)'
    )
    expect(text).toContain('`13` STRUCTURE PTS. · `11` ENERGY PTS. · `12` HEAT CAP.')
    expect(text).toContain('### Scrap Plating')
  })

  test('a weapon system prints its facets as cells and its traits as links', () => {
    const text = cardText(lookupCard(entity('systems', '50-cal-machine-gun'), 'systems'))
    expect(text).toContain(
      '## [.50 Cal Machine Gun](https://salvageunion.io/schema/systems/item/50-cal-machine-gun)'
    )
    expect(text).toContain('`Close` RANGE · `2 SP` DAMAGE')
    expect(text).toContain('[Ballistic](https://salvageunion.io/schema/traits/item/ballistic)')
    expect(text.toLowerCase()).toContain('ballistic weapon')
  })

  test('an owner strips the redundant " (Owner)" suffix from its own actions', () => {
    const text = cardText(lookupCard(entity('systems', 'multi-function-repair-arm'), 'systems'))
    expect(text).toContain('Chassis Repair')
    expect(text).not.toContain('(Multi-Function Repair Arm)')
  })

  test('chassis ability text never leaks the [(CHASSIS)] placeholder', () => {
    for (const chassis of SalvageUnionReference.Chassis.all()) {
      const text = cardText(lookupCard({ ...chassis, schemaName: 'chassis' }, 'chassis'))
      expect(text, `${chassis.name} leaks the placeholder`).not.toContain('[(CHASSIS)]')
    }
  })

  test('[[Trait]] references in body text become links', () => {
    const text = cardText(lookupCard(entity('abilities', 'overpower'), 'abilities'))
    expect(text).toContain('[Vulnerable](https://salvageunion.io/schema/traits/item/vulnerable)')
  })
})

describe('lookupCard — tables and roll buttons', () => {
  test('a roll table prints every band and offers to roll it', () => {
    const card = lookupCard(entity('roll-tables', 'reactor-overload'), 'roll-tables')
    const text = cardText(card)
    expect(text).toContain('-# ROLL THE DIE:')
    expect(text).toContain('`20` **Reactor Overdrive**')
    expect(text).toContain('`11–19` **Reactor Overheat**')
    expect(labels(card)).toEqual(['Roll on this table'])
  })

  test('a two-roll table prints each column with its entries', () => {
    const card = lookupCard(entity('roll-tables', 'callsign-table'), 'roll-tables')
    const text = cardText(card)
    expect(text).toContain('-# ROLL THE DIE: Two rolls: the column, then the entry.')
    expect(text).toContain('**1–4**: `1` Sparkles · `2` Apex')
  })

  test('an ability that rolls a table carries that roll as one tap', () => {
    const card = lookupCard(entity('abilities', 'counter-hacking'), 'abilities')
    expect(card.accent).toBe(0xef894f)
    expect(cardText(card)).toContain('-# ABILITY · ADVANCED HACKING TREE · REACTION · `1 AP`')
    expect(labels(card)).toEqual(['Roll Counter-Hacking'])
  })
})

describe('lookupCard — patterns', () => {
  test('the Overview lists every pattern, linked, with a picker and the tabs', () => {
    const card = lookupCard(entity('chassis', 'mule'), 'chassis')
    const text = cardText(card)
    expect(text).toContain('-# PATTERNS (6)')
    expect(text).toContain(
      '**[Hauler](https://salvageunion.io/schema/chassis/item/mule/pattern/hauler)** · `7` systems · `2` modules · legal starting'
    )
    const select = card.blocks.find((block) => block.kind === 'select')
    expect(select?.kind === 'select' ? select.customId : '').toBe('su:peek:chassis::mule')
    expect(select?.kind === 'select' ? select.options[0]?.value : '').toBe('hauler')
    expect(labels(card)).toEqual(['Overview', 'Patterns (6)'])
    expect(buttonsOf(card)[0]).toMatchObject({ disabled: true })
  })

  test('the Patterns tab pages through them, two at a time, with their loadouts', () => {
    const card = lookupCard(entity('chassis', 'mule'), 'chassis', { tab: 'patterns', page: 1 })
    const text = cardText(card)
    expect(text).toContain('-# PATTERNS (6) · PAGE 2 OF 3')
    expect(text).toContain('-# SYSTEMS (')
    expect(labels(card)).toEqual(['‹', '2 / 3', '›', 'Overview', 'Patterns (6)'])
  })

  test('a Bio-Titan pattern shows the rules it adds', () => {
    const text = cardText(
      lookupCard(entity('bio-titans', 'typhon'), 'bio-titans', { tab: 'patterns', page: 0 })
    )
    expect(text).toContain(
      '### [Hill Worm](https://salvageunion.io/schema/bio-titans/item/typhon/pattern/hill-worm)'
    )
    expect(text).toContain('### Metallic Reconstitution')
    expect(text).toContain('additional Armour Plating')
  })

  test('a pattern Peek is the pattern card, read-only and terminal', () => {
    const peek = patternPeek(entity('chassis', 'mule'), 'hauler')
    if (!peek) throw new Error('no Peek')
    const text = cardText(peek)
    expect(text).toContain('-# PATTERN · MULE')
    expect(text).toContain('[Rigging Arm](https://salvageunion.io/schema/systems/item/rigging-arm)')
    expect(peek.blocks.some((block) => block.kind === 'buttons' || block.kind === 'select')).toBe(
      false
    )
    expect(patternPeek(entity('chassis', 'mule'), 'no-such-pattern')).toBeNull()
  })

  test('a view payload round-trips, and nonsense is refused', () => {
    expect(parseViewPayload('chassis::mule|patterns|2')).toEqual({
      key: 'chassis::mule',
      view: { tab: 'patterns', page: 2 },
    })
    expect(parseViewPayload('chassis::mule|overview')?.view).toEqual({ tab: 'overview', page: 0 })
    expect(parseViewPayload('chassis::mule|nonsense')).toBeNull()
  })
})

/**
 * escapeMarkdownLabel (salvageunion-reference) guards every markdown label the
 * card emits. It escapes `\ [ ] ( )` in one pass. The backslash must be in that
 * class: a literal backslash left alone pairs with the one escaping adds —
 * `\]` becomes `\\]`, an ESCAPED BACKSLASH followed by an UNESCAPED `]` that
 * closes the label early and lets the rest of the name leak out as raw
 * markdown (CodeQL js/incomplete-sanitization). Driven black-box through a
 * pattern name, the label the bot itself builds.
 */
describe('markdown label escaping', () => {
  const cardWith = (patterns: unknown[]): ContainerData =>
    lookupCard({ ...entity('chassis', 'goliath'), patterns } as Entity, 'chassis')

  test('a literal backslash in a label is itself escaped', () => {
    const text = cardText(cardWith([{ name: 'Evil\\', systems: [], modules: [] }]))
    expect(text).toContain('Evil\\\\')
    expect(text).not.toContain('[Evil\\]')
  })

  test('brackets and parens in a label are escaped', () => {
    const text = cardText(cardWith([{ name: 'Brac[ke]t (s)', systems: [], modules: [] }]))
    expect(text).toContain('Brac\\[ke\\]t \\(s\\)')
  })

  test('escaping stays linear, and a pathological label still fits', () => {
    const start = performance.now()
    const card = cardWith([{ name: '['.repeat(50_000), systems: [], modules: [] }])
    expect(performance.now() - start).toBeLessThan(1000)
    assertFits(card, 'pathological pattern name')
  })
})
