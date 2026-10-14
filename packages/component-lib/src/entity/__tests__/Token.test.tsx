/**
 * A Token carries a short chip set after its name (E17's order): its one
 * action's type or how many it has (its own counted), an ability's tree and
 * level, TL, its slots, HP or SP, then the cost box, the same in every
 * context. A chassis keeps its one chip set in every form.
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
  test('a system with several actions counts them all, its own included, first (E17)', () => {
    expect(chipsOf('systems', 'Fabrication Arm')).toEqual(['4 Actions', 'TL3', 'Slots3'])
  })

  test('one action leads with its type, then the facts, then the cost box last (E17)', () => {
    expect(chipsOf('systems', 'Electro-Magnetic Shield Projector')).toEqual([
      'Reaction',
      'TL3',
      'Slots2',
      '2 EP',
    ])
  })

  test('an ability shows its tree and level after its action type', () => {
    expect(chipsOf('abilities', 'Union Engineer')).toEqual(['2 Actions', 'Advanced Engineer1'])
    expect(chipsOf('abilities', 'Tip Top Shape')).toContain('Legendary EngineerL')
  })

  test('a chassis shows its one chip set: TL, SP, EP, SV, SYS, MODS', () => {
    expect(chipsOf('chassis', 'Mule')).toEqual(['TL1', 'SP12', 'EP4', 'SV7', 'SYS16', 'MODS2'])
  })

  test('an NPC shows its HP and its action count', () => {
    expect(chipsOf('npcs', 'Saboteur')).toEqual(['8 Actions', 'HP6'])
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
