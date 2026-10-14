/**
 * A Token carries a short chip set after its name: TL, its slots, HP or SP,
 * then its one action's type or how many it lists (`ACTIONS | 3`, its folded
 * self-action not counted), then the cost box, the same in every context. An
 * ability's tier numeral leads its name instead of a chip.
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
  test('a system with several actions counts those it lists, label first', () => {
    expect(chipsOf('systems', 'Fabrication Arm')).toEqual(['TL3', 'Slots3', 'Actions3'])
    const { container } = render(<Entity form="token" entity={get('systems', 'Fabrication Arm')} />)
    const count = container.querySelector('.su-entity-token__chips > :last-child')
    expect(count?.firstElementChild?.textContent).toBe('Actions')
  })

  test('one action shows its type, then the cost box last', () => {
    expect(chipsOf('systems', 'Electro-Magnetic Shield Projector')).toEqual([
      'TL3',
      'Slots2',
      'Reaction',
      '2 EP',
    ])
  })

  test('an ability sets its tier numeral before its name, never a tree chip', () => {
    const { container } = render(<Entity form="token" entity={get('abilities', 'Jury Rig')} />)
    const pill = container.querySelector('.su-entity-token__pill')
    const tier = pill?.querySelector('.su-entity-token__tier')
    expect(tier?.textContent).toBe('1')
    expect(tier?.nextElementSibling?.className).toBe('su-entity-token__name')
    expect(chipsOf('abilities', 'Jury Rig').some((chip) => chip.startsWith('Forging'))).toBe(false)
    // A Legendary has no numeral, as on its band.
    const legendary = render(<Entity form="token" entity={get('abilities', 'Tip Top Shape')} />)
    expect(legendary.container.querySelector('.su-entity-token__tier')).toBeNull()
    expect(chipsOf('abilities', 'Tip Top Shape').some((chip) => chip.startsWith('Legendary'))).toBe(
      false
    )
  })

  test('a chassis shows TL, SP and its system and module slots', () => {
    expect(chipsOf('chassis', 'Mule')).toEqual(['TL1', 'SP12', 'SYS16', 'MODS2'])
  })

  test('an NPC shows its HP and its action count', () => {
    expect(chipsOf('npcs', 'Saboteur')).toEqual(['HP6', 'Actions8'])
  })
})
