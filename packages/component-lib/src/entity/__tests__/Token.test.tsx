/**
 * A Token carries a short chip set after its name (E17's order): its one
 * action's type or how many it lists (`ACTIONS | 3`, its folded self-action
 * not counted), TL, its slots, HP or SP, its range's code
 * (`RNG | C`), then the cost box, the same in every context. A chassis keeps its one chip set in every form. An ability's tier
 * numeral leads its name instead of a chip.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { SURefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { Entity } from '../Entity'
import { formFacts } from '../parts/factCells'

const get = (schema: string, name: string) => {
  const entity = SalvageUnionReference.getByNameIn(schema as never, name)
  if (!entity) throw new Error(`fixture missing: ${schema} ${name}`)
  return entity as SURefMetaEntity
}

/** Each chip's text, and the cost box's, in order. */
const chipsOf = (schema: string, name: string) => {
  const { container } = render(<Entity form="token" entity={get(schema, name)} />)
  const chips = container.querySelector('.su-entity-token__pill > .su-entity-token__chips')
  return Array.from(chips?.children ?? []).map((chip) =>
    (chip.textContent ?? '').replace(/\s+/g, ' ').trim()
  )
}

describe('Token chips', () => {
  test('a system with several actions counts those it lists, label first, first (E17)', () => {
    expect(chipsOf('systems', 'Fabrication Arm')).toEqual(['Actions3', 'TL3', 'Slots3'])
    const { container } = render(<Entity form="token" entity={get('systems', 'Fabrication Arm')} />)
    const count = container.querySelector('.su-entity-token__chips > :first-child')
    expect(count?.firstElementChild?.textContent).toBe('Actions')
  })

  test('one action leads with its type, then the facts, then the cost box last (E17)', () => {
    expect(chipsOf('systems', 'Electro-Magnetic Shield Projector')).toEqual([
      'Reaction',
      'TL3',
      'Slots2',
      'RNGC',
      '2 EP',
    ])
  })

  test('an ability sets its tier numeral before its name, never a tree chip', () => {
    const { container } = render(<Entity form="token" entity={get('abilities', 'Jury Rig')} />)
    const pill = container.querySelector('.su-entity-token__pill')
    const tier = pill?.querySelector('.su-entity-token__tier')
    expect(tier?.textContent).toBe('1')
    expect(tier?.nextElementSibling?.className).toBe('su-entity-token__notch')
    expect(chipsOf('abilities', 'Jury Rig').some((chip) => chip.startsWith('Forging'))).toBe(false)
    // A Legendary has no numeral, as on its band.
    const legendary = render(<Entity form="token" entity={get('abilities', 'Tip Top Shape')} />)
    expect(legendary.container.querySelector('.su-entity-token__tier')).toBeNull()
    expect(chipsOf('abilities', 'Tip Top Shape').some((chip) => chip.startsWith('Legendary'))).toBe(
      false
    )
  })

  test("a range is the book's code", () => {
    expect(chipsOf('systems', 'Red Laser')).toEqual(['Turn Action', 'TL1', 'Slots3', 'RNGC'])
  })

  test('a chassis shows its one chip set: TL, SP, EP, SV, SYS, MODS', () => {
    expect(chipsOf('chassis', 'Mule')).toEqual(['TL1', 'SP12', 'EP4', 'SV7', 'SYS16', 'MODS2'])
  })

  test('an NPC shows its HP and its action count', () => {
    expect(chipsOf('npcs', 'Saboteur')).toEqual(['Actions8', 'HP6'])
  })

  test("a host's trailing chip comes last, after the cost box", () => {
    const { container } = render(
      <Entity
        form="token"
        entity={get('systems', 'Electro-Magnetic Shield Projector')}
        trailing={<span>Damaged</span>}
      />
    )
    const chips = container.querySelector('.su-entity-token__pill > .su-entity-token__chips')
    expect(chips?.children[chips.children.length - 2]?.textContent).toBe('2 EP')
    expect(chips?.lastElementChild?.textContent).toBe('Damaged')
  })

  test('a trailing chip alone still draws the chip group', () => {
    const { container } = render(
      <Entity
        form="token"
        entity={get('crawler-bays', 'Mech Bay')}
        trailing={<span>Damaged</span>}
      />
    )
    const chips = container.querySelector('.su-entity-token__chips')
    expect(chips?.lastElementChild?.textContent).toBe('Damaged')
  })
})

describe('formFacts — one chassis chip set in every form', () => {
  test('a chassis keeps TL, SP, EP, SV, SYS, MODS; Cargo and Heat are its Page’s', () => {
    const model = toEntityModel(get('chassis', 'Mule'))
    expect(formFacts(model).map((fact) => fact.short)).toEqual([
      'TL',
      'SP',
      'EP',
      'SV',
      'SYS',
      'MODS',
    ])
  })

  test("a player's mech (a synthetic chassis ref) keeps its live readings", () => {
    const facts = [{ key: 'SP', label: 'SP', short: 'SP', value: '6/9' }]
    const unit = { ref: { schemaName: 'chassis', synthetic: true as const }, facts }
    expect(formFacts(unit)).toEqual(facts)
  })

  test('any other entity keeps every fact', () => {
    const model = toEntityModel(get('systems', 'Electro-Magnetic Shield Projector'))
    expect(formFacts(model)).toEqual(model.facts)
  })
})

describe('a down Token', () => {
  const pill = (condition?: 'damaged' | 'destroyed') =>
    render(
      <Entity
        form="token"
        entity={get('systems', 'Red Laser')}
        instance={condition ? { condition } : undefined}
      />
    ).container

  test('tells its Peek how it is down, so the Peek paints the same way', () => {
    expect(pill().querySelector('[data-peek]')?.getAttribute('data-peek-down')).toBeNull()
    expect(pill('damaged').querySelector('[data-peek]')?.getAttribute('data-peek-down')).toBe(
      'damaged'
    )
    expect(pill('destroyed').querySelector('[data-peek]')?.getAttribute('data-peek-down')).toBe(
      'destroyed'
    )
  })
})
