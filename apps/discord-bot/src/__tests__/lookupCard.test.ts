/**
 * The `/su lookup` card: an entry's one Discord card (`discordEntryCard`, the
 * SRD's Component Embed too), plus its linked-entries menu and Roll buttons.
 *
 * The load-bearing tests are the exhaustive passes: EVERY entry in EVERY
 * schema, and every pattern, goes through lookupCard. The container guard must
 * have nothing to shed, and the card must be, block for block, the card a
 * pasted salvageunion.io link draws, with nothing but controls under it. We can't see replies in Discord, so this
 * is what proves a lookup arrives whole and matches the link, not the few we'd
 * pick by hand.
 */
import { describe, expect, test } from 'bun:test'
import type { SURefEntity, SURefEnumSchemaName, SURefMetaEntity } from 'salvageunion-reference'
import {
  discordEntryCard,
  findEntityBySlug,
  getDataMaps,
  getPatterns,
  getSchemaCatalog,
  isSchemaName,
  SalvageUnionReference,
} from 'salvageunion-reference'
import type { ButtonSpec, ContainerBlock, ContainerData } from '../container'
import { enforceContainerLimits } from '../container'
import { NEUTRAL_ACCENT } from '../format'
import type { LookupHit } from '../lookupCard'
import { entityFromKey, lookupCard, lookupKey, openCard, patternOf, readCard } from '../lookupCard'
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

const hit = (schemaName: SURefEnumSchemaName, slug: string): LookupHit => ({
  schemaName,
  entity: entity(schemaName, slug),
})

const buttonsOf = (data: ContainerData): ButtonSpec[] =>
  data.blocks.flatMap((block) => (block.kind === 'buttons' ? block.buttons : []))

const labels = (data: ContainerData): string[] => buttonsOf(data).map((button) => button.label)

/** The linked-entries menu, if the card has one. */
const menuOf = (data: ContainerData) =>
  data.blocks.find(
    (block): block is Extract<ContainerBlock, { kind: 'select' }> => block.kind === 'select'
  )

/** The card without its controls: the blocks a pasted link draws. */
const cardBlocks = (data: ContainerData): ContainerBlock[] =>
  data.blocks.filter((block) => block.kind !== 'buttons' && block.kind !== 'select')

// One test per schema, so no one test carries the whole dataset's cost.
describe('lookupCard — exhaustive across the whole dataset', () => {
  const { dataMap } = getDataMaps()
  let entries = 0
  let patterns = 0
  let menus = 0
  for (const schema of getSchemaCatalog().schemas.filter((s) => !s.meta)) {
    const schemaName = schema.id
    test(`every ${schemaName} entry and pattern renders whole, never in rust, and IS its pasted link’s card`, () => {
      if (!isSchemaName(schemaName)) throw new Error(`non-canonical schema id: ${schemaName}`)
      for (const raw of (dataMap[schemaName] as SURefEntity[] | undefined) ?? []) {
        const withSchema: Entity = { ...raw, schemaName }
        const hits: LookupHit[] = [
          { schemaName, entity: withSchema },
          ...(getPatterns(raw) ?? []).map((pattern) => ({
            schemaName,
            entity: withSchema,
            pattern,
          })),
        ]
        for (const one of hits) {
          const label = `${schemaName}/${raw.id}${one.pattern ? ` pattern ${one.pattern.name}` : ''}`
          const card = lookupCard(one)
          assertFits(card, label)
          // Rust means action, and only action (ruleset §3.1).
          expect(card.accent).not.toBe(NEUTRAL_ACCENT)
          expect(cardText(card)).not.toContain('[[')
          // The pasted link's card, block for block, its shed link included.
          const embed = discordEntryCard(withSchema as SURefMetaEntity, one.pattern)
          expect(cardBlocks(card), `${label}: differs from its Component Embed`).toEqual(
            embed.blocks.map((block) =>
              block.kind === 'text' ? { kind: 'text', content: block.content } : block
            )
          )
          // Controls only: rolls, never a store link or a second copy of the link.
          for (const name of labels(card)) expect(name, label).toStartWith('Roll ')
          // Every option of the linked-entries menu opens a card.
          for (const option of menuOf(card)?.options ?? []) {
            expect(openCard(option.value), `${label}: ${option.value}`).not.toBeNull()
            menus++
          }
          if (one.pattern) patterns++
          else entries++
        }
      }
    })
  }
  test('the loop checked the whole dataset', () => {
    // Guard against the loop silently checking nothing (accessor drift).
    expect(entries).toBeGreaterThan(800)
    expect(patterns).toBeGreaterThan(100)
    expect(menus).toBeGreaterThan(500)
  })
})

describe('lookupCard — the card', () => {
  test('a chassis wears its tone and prints its facts label first', () => {
    const card = lookupCard(hit('chassis', 'goliath'))
    expect(card.accent).toBe(0x7a978a)
    const text = cardText(card)
    expect(text).toContain('## [Goliath](https://salvageunion.io/chassis/goliath)')
    // A line to each stat group, Tech Level first, every label spelled out;
    // Cargo and Heat are its Page's.
    expect(text).toContain(
      '**Tech Level** 2 · **Salvage Value** 8\n**Structure Points** 13 · **Energy Points** 11\n**System Slots** 18 · **Module Slots** 3'
    )
    expect(text).not.toContain('**Cargo')
    // Its chassis ability prints whole, as an action does.
    expect(text).toContain('### Scrap Plating\n-# **Passive**\nThe Goliath counts as having')
  })

  test('a chassis links the drone its ability names, and the menu opens it', () => {
    const card = lookupCard(hit('chassis', 'little-sestra'))
    expect(cardText(card)).toContain('### Sestra Drone Controller')
    expect(cardText(card)).toContain('-# DRONES (1)')
    expect(cardText(card)).toContain('-# PATTERNS (3)')
    expect(menuOf(card)?.options.map((option) => option.value)).toContain('drones::sestra-drone')
    expect(cardText(openCard('drones::sestra-drone') ?? { accent: 0, blocks: [] })).toContain(
      '## [Sestra Drone](https://salvageunion.io/drones/sestra-drone)'
    )
  })

  test('a weapon system prints its facets as label-first chips and its traits as links', () => {
    const text = cardText(lookupCard(hit('systems', '50-cal-machine-gun')))
    expect(text).toContain(
      '## [.50 Cal Machine Gun](https://salvageunion.io/systems/50-cal-machine-gun)'
    )
    expect(text).toContain('**Range** Close · **Damage** 2 Structure Points')
    expect(text).toContain('[Ballistic](https://salvageunion.io/traits/ballistic)')
    expect(text.toLowerCase()).toContain('ballistic weapon')
  })

  test('an owner strips the redundant " (Owner)" suffix from its own actions', () => {
    const text = cardText(lookupCard(hit('systems', 'multi-function-repair-arm')))
    expect(text).toContain('Chassis Repair')
    expect(text).not.toContain('(Multi-Function Repair Arm)')
  })

  test('a chassis card never leaks the [(CHASSIS)] placeholder', () => {
    for (const chassis of SalvageUnionReference.Chassis.all()) {
      const text = cardText(
        lookupCard({ schemaName: 'chassis', entity: { ...chassis, schemaName: 'chassis' } })
      )
      expect(text, `${chassis.name} leaks the placeholder`).not.toContain('[(CHASSIS)]')
    }
  })

  test('[[Trait]] references in body text become links', () => {
    const text = cardText(lookupCard(hit('abilities', 'overpower')))
    expect(text).toContain('[Vulnerable](https://salvageunion.io/traits/vulnerable)')
  })
})

describe('lookupCard — the linked-entries menu', () => {
  test('a pattern lists its systems then its modules as links, each in the menu', () => {
    const kelpie = hit('chassis', 'kelpie')
    const pattern = patternOf(kelpie.entity, 'sifter')
    if (!pattern) throw new Error('fixture missing: Kelpie Sifter')
    const card = lookupCard({ ...kelpie, pattern })
    const text = cardText(card)
    expect(text).toContain('-# SYSTEMS (3)')
    expect(text).toContain('[Nanite Sifter](https://salvageunion.io/systems/nanite-sifter)')
    expect(menuOf(card)?.options.map((option) => option.value)).toEqual([
      'systems::nanite-sifter',
      'systems::cryopod-system',
      'systems::floodlights',
      'modules::comms-module',
      'modules::heating-unit',
      'modules::reactor-flare',
    ])
    expect(card.blocks.some((block) => block.kind === 'section' && block.button)).toBe(false)
  })

  test('a menu answers for linked entries that are not systems or modules', () => {
    const card = lookupCard(hit('abilities', 'teleport-beacon'))
    expect(menuOf(card)?.options.map((option) => option.value)).toEqual([
      'equipment::teleport-beacon',
    ])
  })

  test('a card that links nothing has no menu', () => {
    expect(menuOf(lookupCard(hit('systems', '50-cal-machine-gun')))).toBeUndefined()
  })

  test('openCard answers with the entry’s own card, and null for one that is gone', () => {
    expect(cardText(openCard('systems::nanite-sifter') ?? { accent: 0, blocks: [] })).toContain(
      '## [Nanite Sifter](https://salvageunion.io/systems/nanite-sifter)'
    )
    expect(openCard('systems::no-such-system')).toBeNull()
  })
})

describe('lookupCard — tables and roll buttons', () => {
  test('a roll table prints every band and offers to roll it', () => {
    const card = lookupCard(hit('roll-tables', 'reactor-overload'))
    const text = cardText(card)
    expect(text).toContain('-# ROLL THE DIE:')
    expect(text).toContain('`20` **Reactor Overdrive**')
    expect(text).toContain('`11–19` **Reactor Overheat**')
    expect(labels(card)).toEqual(['Roll the Die'])
  })

  test('a two-roll table prints each column with its entries', () => {
    const card = lookupCard(hit('roll-tables', 'callsign-table'))
    const text = cardText(card)
    expect(text).toContain('-# ROLL THE DIE: Two rolls: the column, then the entry.')
    expect(text).toContain('**1–4**: `1` Sparkles · `2` Apex')
  })

  test('an ability that rolls a table carries that roll as one tap', () => {
    const card = lookupCard(hit('abilities', 'counter-hacking'))
    // Counter-Hacking is Advanced: the Advanced and Hybrid rust (tier-hybrid).
    expect(card.accent).toBe(0xb7410e)
    // E17: the cost closes the chips, under the title.
    expect(cardText(card)).toContain('**Reaction** · **Range** Medium')
    expect(cardText(card)).toContain('[Hacking](https://salvageunion.io/traits/hacking) · `1 AP`')
    expect(labels(card)).toEqual(['Roll Counter-Hacking'])
  })
})

describe('lookupCard — patterns are entries of their own', () => {
  test('a host’s card links its patterns by name only, and has no tabs', () => {
    const card = lookupCard(hit('chassis', 'mule'))
    const text = cardText(card)
    expect(text).toContain(
      '-# PATTERNS (6)\n[Hauler](https://salvageunion.io/chassis/mule/pattern/hauler) · '
    )
    expect(card.blocks.some((block) => block.kind === 'section' && block.button)).toBe(false)
    expect(menuOf(card)?.options.map((option) => option.value)).toContain('chassis::mule::hauler')
    expect(labels(card)).not.toContain('Overview')
  })

  test('a pattern looked up is its own card', () => {
    const one = entityFromKey('chassis::mule::hauler')
    if (!one) throw new Error('no Hauler')
    expect(one.pattern?.name).toBe('Hauler')
    const text = cardText(lookupCard(one))
    expect(text).toContain('-# PATTERN OF MULE')
    expect(text).toContain('[Rigging Arm](https://salvageunion.io/systems/rigging-arm)')
    // Its host's ability is the host card's, never repeated here.
    expect(text).not.toContain('Integrated Cargo Bay')
  })

  test('a Bio-Titan pattern shows the rules it adds', () => {
    const one = entityFromKey('bio-titans::typhon::hill-worm')
    if (!one) throw new Error('no Hill Worm')
    const text = cardText(lookupCard(one))
    expect(text).toContain('### Metallic Reconstitution')
  })

  test('keys round-trip, a retired slug answers with its pattern, and nonsense is refused', () => {
    const mule = hit('chassis', 'mule')
    expect(lookupKey(mule)).toBe('chassis::mule')
    const hauler = entityFromKey('chassis::mule::hauler')
    expect(hauler && lookupKey(hauler)).toBe('chassis::mule::hauler')
    expect(entityFromKey('bio-titans::hill-worm-pattern-typhon')?.pattern?.name).toBe('Hill Worm')
    expect(entityFromKey('chassis::mule::no-such-pattern')).toBeNull()
    expect(entityFromKey('chassis::mule::hauler::extra')).toBeNull()
    expect(entityFromKey('nonsense::mule')).toBeNull()
  })
})

describe('lookupCard — no store link', () => {
  test('an entry from a book for sale has no Buy button', () => {
    expect(labels(lookupCard(hit('chassis', 'mule')))).not.toContain('Buy')
    expect(labels(lookupCard(hit('bio-titans', 'ygdriss')))).not.toContain('Buy')
  })
})

/**
 * escapeMarkdownLabel (salvageunion-reference) guards every markdown label the
 * card emits. It escapes `\ [ ] ( )` in one pass. The backslash must be in that
 * class: a literal backslash left alone pairs with the one escaping adds —
 * `\]` becomes `\\]`, an ESCAPED BACKSLASH followed by an UNESCAPED `]` that
 * closes the label early and lets the rest of the name leak out as raw
 * markdown (CodeQL js/incomplete-sanitization). Driven black-box through a
 * pattern's name, its card's title.
 */
describe('markdown label escaping', () => {
  const cardWith = ([pattern]: { name: string; systems: never[]; modules: never[] }[]) =>
    lookupCard({
      schemaName: 'chassis',
      entity: { ...entity('chassis', 'goliath'), patterns: [pattern] } as Entity,
      pattern: pattern as never,
    })

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
    // A title always stays, so a 50,000-character name cannot fit any message:
    // the container guard trims it rather than sending an invalid reply.
    expect(enforceContainerLimits(card).blocks.length).toBeGreaterThan(0)
  })
})

describe('lookupCard — an entry and its self-action', () => {
  test('a paragraph both carry prints once', () => {
    const text = cardText(lookupCard(hit('equipment', 'hacking-kit')))
    const lead = 'You acquire and train in the use of a Hacking Kit'
    expect(text.split(lead)).toHaveLength(2)
  })
})

describe('lookupCard — a long card is whole, as its pasted link draws it', () => {
  test('every action keeps its rules on the card; there are no Read rows', () => {
    const card = lookupCard(hit('bio-titans', 'cortex-bio-titan'))
    const text = cardText(card)
    expect(text).toContain('A Bio-Titan developed by the Red Mesa researchers')
    expect(text).toContain('pierce through the cockpit')
    expect(card.blocks.some((block) => block.kind === 'section' && block.button)).toBe(false)
  })

  // Older messages keep their Read buttons: they still answer.
  test('Read answers with the whole action under its entry, and refuses what is gone', () => {
    const read = readCard('bio-titans::cortex-bio-titan|proboscis')
    if (!read) throw new Error('no Proboscis')
    expect(read.accent).toBe(lookupCard(hit('bio-titans', 'cortex-bio-titan')).accent)
    const text = cardText(read)
    expect(text).toContain(
      '-# [Cortex Bio-Titan](https://salvageunion.io/bio-titans/cortex-bio-titan)'
    )
    expect(text).toContain('### Proboscis\n-# **Turn Action** · **Range** Close')
    expect(text).toContain('pierce through the cockpit')
    expect(text).toContain('-# We Were Here First! · p.56')
    expect(readCard('bio-titans::cortex-bio-titan|nope')).toBeNull()
    expect(readCard('bio-titans::nope|proboscis')).toBeNull()
    expect(readCard('no-separator')).toBeNull()
  })
})
