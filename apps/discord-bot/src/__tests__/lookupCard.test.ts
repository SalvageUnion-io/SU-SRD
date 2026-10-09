/**
 * Rich /su lookup card tests.
 *
 * The load-bearing test is the exhaustive pass: EVERY entity in EVERY schema
 * goes through lookupCard, and the container guard must have nothing to shed. We can't see replies in Discord, so this is
 * what proves a lookup arrives whole (description, fields and footer) across
 * all 27 schemas, not the three we'd pick by hand. The guard sheds whole
 * blocks from the end, so a description that overruns the budget leaves a
 * reply that is only its heading (#1124).
 */
import { describe, expect, test } from 'bun:test'
import type { SURefEntity, SURefEnumSchemaName } from 'salvageunion-reference'
import {
  getDataMaps,
  getSchemaCatalog,
  isSchemaName,
  SalvageUnionReference,
  search,
} from 'salvageunion-reference'
import type { ContainerData } from '../container.js'
import { enforceContainerLimits } from '../container.js'
import { lookupCard } from '../lookupCard.js'
import { blockStarting, cardText, cardTexts, cardUrl } from './cardText.js'

type Entity = SURefEntity & { schemaName: SURefEnumSchemaName }

/** The reply as sent must arrive whole: the container guard sheds no block. */
function assertFits(data: ContainerData, label: string): void {
  expect(enforceContainerLimits(data).blocks, `${label}: shed a block`).toEqual(data.blocks)
}

describe('lookupCard — exhaustive validity across the whole dataset', () => {
  test('every entity in every non-meta schema renders whole, shedding no block', () => {
    const schemas = getSchemaCatalog().schemas.filter((s) => !s.meta)
    const { dataMap } = getDataMaps()
    let checked = 0
    for (const schema of schemas) {
      if (!isSchemaName(schema.id)) throw new Error(`non-canonical schema id: ${schema.id}`)
      const entities = (dataMap[schema.id] as SURefEntity[] | undefined) ?? []
      for (const entity of entities) {
        const withSchema: Entity = { ...entity, schemaName: schema.id }
        assertFits(lookupCard(withSchema, schema.id), `${schema.id}/${entity.id}`)
        checked++
      }
    }
    // Guard against the loop silently checking nothing (accessor drift).
    expect(checked).toBeGreaterThan(800)
  })
})

describe('lookupCard — content depth', () => {
  test('a weapon system renders its action text, stats, and linked traits', () => {
    const gun = SalvageUnionReference.Systems.getByName('.50 Cal Machine Gun')
    expect(gun).toBeDefined()
    if (!gun) throw new Error('expected the .50 Cal Machine Gun system')
    const e = lookupCard({ ...gun, schemaName: 'systems' }, 'systems')
    expect(cardUrl(e)).toBe('https://salvageunion.io/schema/systems/item/50-cal-machine-gun')
    expect(cardText(e)).toContain('## [.50 Cal Machine Gun](')
    expect(blockStarting(e, '**Type** System')).toBeDefined()
    // Action mechanical text is present (not just a summary).
    expect(cardText(e)).toContain('Range:')
    expect(cardText(e)).toContain('Damage:')
    // Traits link out to their glossary pages (nested-entity linking).
    expect(cardText(e)).toContain('/schema/traits/item/')
    // Flavor content from the action is inlined.
    expect(cardText(e).toLowerCase()).toContain('ballistic')
  })

  test('an owner strips the redundant " (Owner)" suffix from its own actions', () => {
    // "Multi-Function Repair Arm" owns "Chassis Repair (Multi-Function Repair
    // Arm)" et al. Inside its own lookup the parent is already established, so
    // the suffix is a redundant echo and must be stripped — mirroring the web's
    // stripHostParenthetical. The suffix stays in the DATA (uniqueness), only
    // the rendered title drops it.
    const arm = SalvageUnionReference.Systems.getByName('Multi-Function Repair Arm')
    expect(arm).toBeDefined()
    if (!arm) throw new Error('expected the Multi-Function Repair Arm system')
    const e = lookupCard({ ...arm, schemaName: 'systems' }, 'systems')
    expect(cardText(e)).toContain('Chassis Repair')
    expect(cardText(e)).not.toContain('Chassis Repair (Multi-Function Repair Arm)')
    expect(cardText(e)).not.toContain('(Multi-Function Repair Arm)')
  })

  test('a keyword renders its glossary definition', () => {
    const [hit] = search({ query: 'cover', schemas: ['keywords'], limit: 1 })
    expect(hit).toBeDefined()
    if (!hit) throw new Error('expected a keyword search hit')
    const e = lookupCard(hit.entity, 'keywords')
    // Heading, the definition, the Type rail and the footer: four texts.
    expect(cardTexts(e)).toHaveLength(4)
    expect(blockStarting(e, '**Type** Keyword')).toBeDefined()
  })

  test('a chassis renders its stat grid and links patterns without inlining them', () => {
    const goliath = SalvageUnionReference.Chassis.getByName('Goliath')
    expect(goliath).toBeDefined()
    if (!goliath) throw new Error('expected the Goliath chassis')
    const e = lookupCard({ ...goliath, schemaName: 'chassis' }, 'chassis')
    expect(cardText(e)).toContain('**Structure** ')
    expect(cardText(e)).toContain('**System Slots** ')
    // Goliath has 14+ community patterns — they're summarized, and the whole
    // thing still fits the budget (asserted by the exhaustive test too).
    expect(cardText(e)).toContain('Patterns')
  })

  test('chassis ability text resolves [(CHASSIS)] to the chassis name', () => {
    // Every chassis with a [(CHASSIS)] placeholder in its ability text must
    // render the name, never the literal token (regression: PR #336 review).
    const chassis = SalvageUnionReference.Chassis.all()
    for (const c of chassis) {
      const e = lookupCard({ ...c, schemaName: 'chassis' }, 'chassis')
      expect(cardText(e), `${c.name} leaks the placeholder`).not.toContain('[(CHASSIS)]')
    }
  })

  test('[[Trait]] references in body text become links, never literal brackets', () => {
    const overpower = SalvageUnionReference.Abilities.getByName('Overpower')
    expect(overpower).toBeDefined()
    if (!overpower) throw new Error('expected the Overpower ability')
    const e = lookupCard({ ...overpower, schemaName: 'abilities' }, 'abilities')
    // [[Vulnerable]] resolves to a masked link, and no raw bracket ref survives.
    expect(cardText(e)).toContain(
      '[Vulnerable](https://salvageunion.io/schema/traits/item/vulnerable)'
    )
    expect(cardText(e)).not.toContain('[[')
  })

  test('a standard roll-table inlines its full rows and keeps a roll hint', () => {
    const table = SalvageUnionReference.RollTables.all().find((t) => t.table.type === 'standard')
    if (!table) throw new Error('expected a standard roll-table')
    const e = lookupCard({ ...table, schemaName: 'roll-tables' }, 'roll-tables')
    // The roll hint survives, and every d20 bucket is inlined as a row (backtick key).
    expect(cardText(e)).toContain('/su roll')
    expect(cardText(e)).toContain('`20`')
    expect(cardText(e)).toContain('`11-19`')
    expect(cardText(e)).toContain('`1`')
  })

  test('a columns roll-table inlines each column bucket as a field', () => {
    const table = SalvageUnionReference.RollTables.all().find((t) => t.table.type === 'columns')
    if (!table) throw new Error('expected a columns roll-table')
    const e = lookupCard({ ...table, schemaName: 'roll-tables' }, 'roll-tables')
    expect(cardText(e)).toContain('**Roll 1-4** ')
    expect(cardText(e)).toContain('**Roll 17-20** ')
    // The entries within a column are listed (1-20), not just linked out.
    const text = cardText(e)
    expect(text.slice(text.indexOf('**Roll 1-4** '))).toContain('1.')
  })
})

/**
 * escapeLabel (module-private) guards every markdown label the card emits.
 * It escapes `\ [ ] ( )` in one pass. The backslash must be in that class: a
 * literal backslash left alone pairs with the one escaping adds — `\]` becomes
 * `\\]`, an ESCAPED BACKSLASH followed by an UNESCAPED `]` that closes the
 * label early and lets the rest of the name leak out as raw markdown (CodeQL
 * js/incomplete-sanitization).
 *
 * These drive it black-box through the two labels it guards: a chassis pattern
 * name (chassisSections) and a trait name inside body text (linkifyTraitRefs).
 */
describe('markdown label escaping', () => {
  /** A real chassis, used as the carrier for adversarial label content. */
  function goliath(): SURefEntity {
    const chassis = SalvageUnionReference.Chassis.getByName('Goliath')
    if (!chassis) throw new Error('expected the Goliath chassis')
    return chassis
  }

  function chassisWith(overrides: Record<string, unknown>): Entity {
    return { ...goliath(), schemaName: 'chassis', ...overrides } as Entity
  }

  function cardWith(overrides: Record<string, unknown>): ContainerData {
    return lookupCard(chassisWith(overrides), 'chassis')
  }

  test('real pattern names pass through untouched', () => {
    const e = lookupCard({ ...goliath(), schemaName: 'chassis' }, 'chassis')
    // Real SRD names carry no markdown metacharacters, so nothing is escaped.
    expect(cardText(e)).toContain('• **Scrapjack** — 7 systems, 3 modules')
    expect(cardText(e)).not.toContain('\\')
  })

  test('a literal backslash in a label is itself escaped', () => {
    const e = cardWith({ patterns: [{ name: 'Evil\\', systems: [], modules: [] }] })
    // Two backslashes: `\\` renders as one literal backslash and cannot pair
    // with whatever follows. A single `\` here is the breakout this pins
    // against.
    expect(cardText(e)).toContain('• **Evil\\\\** — 0 systems, 0 modules')
    expect(cardText(e)).not.toContain('**Evil\\** ')
  })

  test('brackets and parens in a label are escaped', () => {
    const e = cardWith({ patterns: [{ name: 'Brac[ke]t (s)', systems: [], modules: [] }] })
    expect(cardText(e)).toContain('• **Brac\\[ke\\]t \\(s\\)** — 0 systems, 0 modules')
  })

  test('a trailing backslash cannot break out of a markdown link label', () => {
    const e = cardWith({
      patterns: [],
      content: [{ type: 'paragraph', value: 'Gains the [[Vulnerable\\]] Trait.' }],
    })
    // The label must end `\\]` — an escaped backslash, then the REAL closing
    // bracket. A bare `\]` would escape the closing bracket instead, so the
    // link label would run on and Discord would render raw text.
    expect(cardText(e)).toContain(
      '[Vulnerable\\\\](https://salvageunion.io/schema/traits/item/vulnerable)'
    )
    expect(cardText(e)).not.toContain('[Vulnerable\\](')
  })

  test('escaping stays linear on a pathological label', () => {
    const pathological = '['.repeat(50_000)
    const start = performance.now()
    const overrides = { patterns: [{ name: pathological, systems: [], modules: [] }] }
    const e = cardWith(overrides)
    expect(performance.now() - start).toBeLessThan(1000)
    // Still arrives whole after the escape doubles the length (fit() trims).
    assertFits(e, 'pathological pattern name')
  })
})
