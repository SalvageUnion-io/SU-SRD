import { describe, expect, test } from 'bun:test'
import type { RefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { choicesOf, chosenChips, equipmentColumns, openChoices } from '../pickColumns'

function equipment(name: string): RefMetaEntity {
  const found = SalvageUnionReference.Equipment.getByName(name)
  if (!found) throw new Error(`no equipment named ${name}`)
  return found as RefMetaEntity
}

function choiceId(entity: RefMetaEntity, name: string): string {
  const found = choicesOf(entity).find((choice) => choice.name === name)
  if (!found) throw new Error(`no choice named ${name}`)
  return found.id
}

function read(entity: RefMetaEntity, picks?: Record<string, string[]>) {
  const columns = equipmentColumns<RefMetaEntity>(picks ? () => picks : undefined)
  return Object.fromEntries(columns.map((column) => [column.key, String(column.value(entity))]))
}

// Hard rule R60: a made choice reads as made, in the row as on the card.
describe('a picker row reads the options chosen on the item', () => {
  const launcher = equipment('Custom Missile Launcher')
  const rifle = equipment('Custom Sniper Rifle')

  test('unchosen, the row says what the item prints', () => {
    expect(read(launcher)).toMatchObject({ range: 'Medium', damage: '3 SP' })
    expect(read(launcher, {})).toMatchObject({ range: 'Medium', damage: '3 SP' })
  })

  test('a modification that sets the range changes the range column and nothing else', () => {
    const picks = { [choiceId(launcher, 'Modification')]: ['Rangefinder'] }
    const row = read(launcher, picks)
    expect(row.range).toBe('Long')
    expect(row.damage).toBe('3 SP')
    expect(row.traits).toBe(read(launcher).traits)
  })

  test('a modification with no effect leaves the printed range', () => {
    const picks = { [choiceId(launcher, 'Modification')]: ['Laser Guidance'] }
    expect(read(launcher, picks).range).toBe('Medium')
  })

  test('a chosen weapon type joins the traits once', () => {
    expect(read(rifle).traits).not.toContain('Energy')
    const picks = { [choiceId(rifle, 'Weapon Type')]: ['Energy'] }
    const traits = read(rifle, picks).traits ?? ''
    expect(traits.split(', ').filter((name) => name === 'Energy')).toHaveLength(1)
  })

  test('the action column is the one a phone keeps', () => {
    const [action, ...rest] = equipmentColumns<RefMetaEntity>()
    expect(action?.phone).toBe(true)
    expect(rest.some((column) => column.phone)).toBe(false)
  })
})

describe('the choices an item still wants', () => {
  const rifle = equipment('Custom Sniper Rifle')

  test('every choice is open until it has a pick', () => {
    const all = choicesOf(rifle).length
    expect(all).toBeGreaterThan(1)
    expect(openChoices(rifle, undefined)).toBe(all)
    expect(openChoices(rifle, { [choiceId(rifle, 'Weapon Type')]: ['Energy'] })).toBe(all - 1)
    expect(openChoices(rifle, { [choiceId(rifle, 'Weapon Type')]: [] })).toBe(all)
  })

  test('no chips while nothing is chosen', () => {
    expect(chosenChips(rifle, undefined)).toBeUndefined()
    expect(chosenChips(rifle, { [choiceId(rifle, 'Weapon Type')]: [] })).toBeUndefined()
    expect(chosenChips(rifle, { [choiceId(rifle, 'Weapon Type')]: ['Energy'] })).toHaveLength(1)
  })
})
