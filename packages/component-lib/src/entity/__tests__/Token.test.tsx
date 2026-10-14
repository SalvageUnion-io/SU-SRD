/**
 * A Token carries a short chip set after its name: an ability's tree and
 * level, TL, its slots, HP or SP, then its one action's type or how many it
 * has (its own counted), then the cost box, the same in every context.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { SURefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Entity } from '../Entity'

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
  test('a system with several actions counts them all, its own included', () => {
    expect(chipsOf('systems', 'Fabrication Arm')).toEqual(['TL3', 'Slots3', '4 Actions'])
  })

  test('one action shows its type, then the cost box last', () => {
    expect(chipsOf('systems', 'Electro-Magnetic Shield Projector')).toEqual([
      'TL3',
      'Slots2',
      'Reaction',
      '2 EP',
    ])
  })

  test('an ability leads with its tree and level', () => {
    expect(chipsOf('abilities', 'Union Engineer')).toEqual(['Advanced Engineer1', '2 Actions'])
    expect(chipsOf('abilities', 'Tip Top Shape')[0]).toBe('Legendary EngineerL')
  })

  test('a chassis shows TL, SP and its system and module slots', () => {
    expect(chipsOf('chassis', 'Mule')).toEqual(['TL1', 'SP12', 'SYS16', 'MODS2'])
  })

  test('an NPC shows its HP and its action count', () => {
    expect(chipsOf('npcs', 'Saboteur')).toEqual(['HP6', '8 Actions'])
  })
})
