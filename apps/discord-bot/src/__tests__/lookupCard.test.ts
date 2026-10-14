/**
 * The `/su lookup` card: an entry's one Discord card (`discordEntryCard`, the
 * SRD's Component Embed too), plus its Roll buttons.
 *
 * The load-bearing tests are the exhaustive passes: EVERY entry in EVERY
 * schema, and every pattern, goes through lookupCard. The container guard must
 * have nothing to shed, and the card must be, block for block, the card a
 * pasted salvageunion.io link draws. We can't see replies in Discord, so this
 * is what proves a lookup arrives whole and matches the link, not the few we'd
 * pick by hand.
 */
import { describe, expect, test } from 'bun:test'
import type {
  DiscordBlock,
  SURefEntity,
  SURefEnumSchemaName,
  SURefMetaEntity,
} from 'salvageunion-reference'
import {
  discordEntryCard,
  discordEntryIndexCard,
  findEntityBySlug,
  getDataMaps,
  getPatterns,
  getSchemaCatalog,
  isSchemaName,
  SalvageUnionReference,
} from 'salvageunion-reference'
import type { ButtonSpec, ContainerBlock, ContainerData } from '../container'
import { containerTextLength, enforceContainerLimits } from '../container'
import { NEUTRAL_ACCENT } from '../format'
import type { LookupHit } from '../lookupCard'
import {
  buyLink,
  entityFromKey,
  INDEX_MIN_CHARS,
  lookupCard,
  lookupKey,
  openCard,
  patternOf,
  readCard,
} from '../lookupCard'
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

/** A section carrying a Read button, and the key that button reads. */
const readKey = (block: ContainerBlock): string | null =>
  block.kind === 'section' && block.button?.kind === 'action'
    ? block.button.customId.replace(/^su:read:/, '')
    : null

/** A long card's index rows: an action's Read button names the action after a `|`. */
const readRows = (data: ContainerData) =>
  data.blocks.filter(
    (block): block is Extract<ContainerBlock, { kind: 'section' }> =>
      readKey(block)?.includes('|') === true
  )

/** A card's nested systems and modules as rows: Read buttons that name a whole entry. */
const childRows = (data: ContainerData) =>
  data.blocks.filter(
    (block): block is Extract<ContainerBlock, { kind: 'section' }> =>
      readKey(block) !== null && readKey(block)?.includes('|') === false
  )

/** A nested-entity stamp (`-# SYSTEMS (3)`), and the names under it. */
const isStamp = (block: { kind: string; content?: string }): boolean =>
  block.kind === 'text' && /^-# [A-Z][^\n]* \(\d+\)/.test(block.content ?? '')

/**
 * A card with its nested entities and its shed link set aside, as plain
 * blocks: the bot draws those as rows and a button, the pasted link as text.
 */
const cardBody = (blocks: readonly (ContainerBlock | DiscordBlock)[]): unknown[] =>
  blocks
    .filter(
      (block) =>
        !isStamp(block) &&
        childRowKey(block) === null &&
        !(block.kind === 'text' && 'more' in block && block.more) &&
        block.kind !== 'buttons' &&
        block.kind !== 'select'
    )
    .map((block) => {
      if (block.kind === 'text') return { kind: 'text', content: block.content }
      if (block.kind === 'section' && ('action' in block || 'button' in block)) {
        return { kind: 'section', text: block.text }
      }
      return block
    })

/** A child row's key, or null for any other block. */
const childRowKey = (block: ContainerBlock | DiscordBlock): string | null => {
  const key =
    'button' in block || block.kind !== 'section' ? readKey(block as ContainerBlock) : null
  return key && !key.includes('|') ? key : null
}

describe('lookupCard — exhaustive across the whole dataset', () => {
  test('every entry and every pattern renders whole, never in rust, and IS its pasted link’s card', () => {
    const schemas = getSchemaCatalog().schemas.filter((s) => !s.meta)
    const { dataMap } = getDataMaps()
    let entries = 0
    let patterns = 0
    let indexed = 0
    let menus = 0
    let rows = 0
    for (const schema of schemas) {
      const schemaName = schema.id
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
          // The pasted link's card, block for block, but for its nested
          // systems and modules (Read rows here) and its shed link (a button);
          // a long card is the index of that card, every row a Read button.
          const embed = discordEntryCard(withSchema as SURefMetaEntity, one.pattern)
          if (readRows(card).length === 0) {
            expect(cardBody(card.blocks), `${label}: differs from its Component Embed`).toEqual(
              cardBody(embed.blocks)
            )
          } else {
            indexed++
            expect(
              containerTextLength({ accent: 0, blocks: embed.blocks }),
              `${label}: indexed a short card`
            ).toBeGreaterThan(INDEX_MIN_CHARS)
            const index = discordEntryIndexCard(withSchema as SURefMetaEntity, one.pattern)
            expect(cardBody(card.blocks), `${label}: differs from its index card`).toEqual(
              cardBody(index.blocks)
            )
          }
          for (const row of [...readRows(card), ...childRows(card)]) {
            expect(readCard(readKey(row) ?? ''), label).not.toBeNull()
            rows++
          }
          // A shed card's link is the Full entry (or Whole table) button.
          const more = embed.blocks.some((block) => block.kind === 'text' && block.more)
          expect(
            labels(card).some((name) => name === 'Full entry' || name === 'Whole table'),
            `${label}: full-entry button`
          ).toBe(more)
          // Every option of the linked-entries menu opens a card.
          for (const option of menuOf(card)?.options ?? []) {
            expect(openCard(option.value), `${label}: ${option.value}`).not.toBeNull()
            menus++
          }
          if (one.pattern) patterns++
          else entries++
        }
      }
    }
    // Guard against the loop silently checking nothing (accessor drift).
    expect(entries).toBeGreaterThan(800)
    expect(patterns).toBeGreaterThan(100)
    expect(indexed).toBeGreaterThan(10)
    expect(menus).toBeGreaterThan(100)
    expect(rows).toBeGreaterThan(500)
  })
})

describe('lookupCard — the card', () => {
  test('a chassis wears its tone and prints its facts label first', () => {
    const card = lookupCard(hit('chassis', 'goliath'))
    expect(card.accent).toBe(0x7a978a)
    const text = cardText(card)
    expect(text).toContain('## [Goliath](https://salvageunion.io/chassis/goliath)')
    expect(text).toContain('**TL** 2 · **SP** 13 · **EP** 11')
    expect(text).toContain('**Cargo** 6 · **Heat** 12')
    // The chassis ability shows only on the chassis and pattern pages.
    expect(text).not.toContain('Scrap Plating')
  })

  test('a weapon system prints its facets as label-first chips and its traits as links', () => {
    const text = cardText(lookupCard(hit('systems', '50-cal-machine-gun')))
    expect(text).toContain(
      '## [.50 Cal Machine Gun](https://salvageunion.io/systems/50-cal-machine-gun)'
    )
    expect(text).toContain('**RNG** Close · **DMG** 2 SP')
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
  test('a pattern draws its systems then its modules as rows, each Read opening that entry', () => {
    const kelpie = hit('chassis', 'kelpie')
    const pattern = patternOf(kelpie.entity, 'sifter')
    if (!pattern) throw new Error('fixture missing: Kelpie Sifter')
    const card = lookupCard({ ...kelpie, pattern })
    expect(childRows(card).map(readKey)).toEqual([
      'systems::nanite-sifter',
      'systems::cryopod-system',
      'systems::floodlights',
      'modules::comms-module',
      'modules::heating-unit',
      'modules::reactor-flare',
    ])
    expect(childRows(card)[0]?.text[0]).toStartWith(
      '**[Nanite Sifter](https://salvageunion.io/systems/nanite-sifter)**'
    )
    expect(cardText(card)).toContain('-# SYSTEMS (3)')
    expect(cardText(readCard('systems::nanite-sifter') ?? { accent: 0, blocks: [] })).toContain(
      '## [Nanite Sifter](https://salvageunion.io/systems/nanite-sifter)'
    )
    // Every linked entry is a row, so the menu has nothing left to open.
    expect(menuOf(card)).toBeUndefined()
  })

  test('rows stop at Discord’s ceiling; the rest stay linked and in the menu', () => {
    const cerberus = hit('chassis', 'cerberus')
    const pattern = patternOf(cerberus.entity, 'tac-os')
    if (!pattern) throw new Error('fixture missing: Cerberus Tac-Os')
    const card = lookupCard({ ...cerberus, pattern })
    assertFits(card, 'Tac-Os')
    const drawn = childRows(card).map(readKey)
    expect(drawn.length).toBeGreaterThan(3)
    const rest = menuOf(card)?.options.map((option) => option.value) ?? []
    expect(rest.length).toBeGreaterThan(0)
    expect(rest.filter((key) => drawn.includes(key))).toEqual([])
    // Each entry left over is still a link on the card.
    for (const key of rest) {
      expect(cardText(card)).toContain(`https://salvageunion.io/${key.replace('::', '/')})`)
    }
  })

  test('a menu answers for linked entries that are not systems or modules', () => {
    const card = lookupCard(hit('abilities', 'teleport-beacon'))
    expect(menuOf(card)?.options.map((option) => option.value)).toEqual([
      'equipment::teleport-beacon',
    ])
    expect(childRows(card)).toEqual([])
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
    expect(labels(card)).toEqual(['Roll the Die', 'Buy'])
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
    expect(cardText(card)).toContain('**Reaction** · **RNG** Medium')
    expect(cardText(card)).toContain('[Hacking](https://salvageunion.io/traits/hacking) · `1 AP`')
    expect(labels(card)).toEqual(['Roll Counter-Hacking', 'Buy'])
  })
})

describe('lookupCard — patterns are entries of their own', () => {
  test('a host’s card lists none of its patterns, and has no tabs or picker', () => {
    const card = lookupCard(hit('chassis', 'mule'))
    const text = cardText(card)
    expect(text).not.toContain('PATTERNS (')
    expect(text).not.toContain('/pattern/hauler')
    expect(labels(card)).not.toContain('Overview')
  })

  test('a pattern looked up is its own card', () => {
    const one = entityFromKey('chassis::mule::hauler')
    if (!one) throw new Error('no Hauler')
    expect(one.pattern?.name).toBe('Hauler')
    const text = cardText(lookupCard(one))
    expect(text).toContain('-# PATTERN OF MULE')
    expect(text).toContain('[Rigging Arm](https://salvageunion.io/systems/rigging-arm)')
  })

  test('a Bio-Titan pattern shows the rules it adds', () => {
    const one = entityFromKey('bio-titans::typhon::hill-worm')
    if (!one) throw new Error('no Hill Worm')
    const text = cardText(lookupCard(one))
    expect(text).toContain('**Metallic Reconstitution**')
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

describe('lookupCard — the Buy link', () => {
  const WORKSHOP_MANUAL =
    'https://leyline.press/products/salvage-union-core-book?variant=43991343956158'

  test('an entry from a Leyline Press book links its store page, after the rolls', () => {
    const card = lookupCard(hit('chassis', 'mule'))
    expect(buttonsOf(card).at(-1)).toEqual({ kind: 'link', url: WORKSHOP_MANUAL, label: 'Buy' })
  })

  test('an adventure module and a Starter Set booklet link their own store pages', () => {
    expect(buyLink(hit('bio-titans', 'apophis'))).toStartWith(
      'https://leyline.press/products/rainmaker-adventure-module'
    )
    expect(buyLink(hit('bio-titans', 'ygdriss'))).toBe(
      'https://www.backerkit.com/c/projects/leyline-press/salvage-union-starter-set'
    )
  })

  test('a pattern links the book it is printed in, not its host’s', () => {
    const hauler = entityFromKey('chassis::mule::hauler')
    if (!hauler) throw new Error('no Hauler')
    expect(buyLink(hauler)).toBe(WORKSHOP_MANUAL)
  })

  test('Mech Monday is not for sale, so it has no Buy link', () => {
    expect(labels(lookupCard(hit('sources', 'mech-monday')))).not.toContain('Buy')
    // Mech Monday patterns are hidden today, so only buyLink itself can see one.
    const mule = hit('chassis', 'mule')
    const all = ('patterns' in mule.entity ? mule.entity.patterns : undefined) ?? []
    const appleseed = all.find((pattern) => pattern.name === 'Appleseed')
    expect(appleseed?.source).toBe('Mech Monday')
    expect(buyLink({ ...mule, pattern: appleseed })).toBeNull()
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

describe('lookupCard — a long card is an index with Read buttons', () => {
  test('each action is its name and stat line, with a Read button; its rules are not on the card', () => {
    const card = lookupCard(hit('bio-titans', 'cortex-bio-titan'))
    const text = cardText(card)
    expect(text).toContain('A Bio-Titan developed by the Red Mesa researchers')
    expect(text).not.toContain('pierce through the cockpit')
    const proboscis = readRows(card).find((row) => row.text[0]?.startsWith('**Proboscis**'))
    expect(proboscis?.text[0]).toBe(
      '**Proboscis**\n-# **Turn Action** · **RNG** Close · [Melee](https://salvageunion.io/traits/melee)'
    )
    expect(proboscis?.button).toEqual({
      kind: 'action',
      customId: 'su:read:bio-titans::cortex-bio-titan|proboscis',
      label: 'Read',
    })
    expect(readRows(card).map((row) => row.text[0]?.split('\n')[0])).toEqual([
      '**One Step Ahead**',
      '**Proboscis**',
      '**Mutant Fanatics**',
      '**Probing Telepathy**',
      '**Titanic Actions**',
    ])
  })

  test('a short card stays whole', () => {
    expect(readRows(lookupCard(hit('chassis', 'mule')))).toHaveLength(0)
  })

  test('Read answers with the whole action under its entry, and refuses what is gone', () => {
    const read = readCard('bio-titans::cortex-bio-titan|proboscis')
    if (!read) throw new Error('no Proboscis')
    expect(read.accent).toBe(lookupCard(hit('bio-titans', 'cortex-bio-titan')).accent)
    const text = cardText(read)
    expect(text).toContain(
      '-# [Cortex Bio-Titan](https://salvageunion.io/bio-titans/cortex-bio-titan)'
    )
    expect(text).toContain('### Proboscis\n-# **Turn Action** · **RNG** Close')
    expect(text).toContain('pierce through the cockpit')
    expect(text).toContain('-# We Were Here First! · p.56')
    expect(readCard('bio-titans::cortex-bio-titan|nope')).toBeNull()
    expect(readCard('bio-titans::nope|proboscis')).toBeNull()
    expect(readCard('no-separator')).toBeNull()
  })
})
