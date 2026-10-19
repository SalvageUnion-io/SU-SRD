/**
 * The Mediator's table and the Opposition's actions as Play reads them
 * (play.md §10), pure: the seats in join order with presence, every live
 * vital and the one needing the Mediator ▲; "3 of 4 here"; who is done with
 * a Downtime step; the bar's Downtime option; and an NPC's actions flattened
 * and sorted by action type.
 */

import { describe, expect, test } from 'bun:test'
import { findEntityBySlug } from 'salvageunion-reference'
import {
  doneOf,
  downtimeOptionLabel,
  hereOf,
  mediatorSeats,
  seatDone,
  seatStepLine,
} from '../mediator/mediatorTable.model'
import { npcActions, npcKind } from '../mediator/npcActions.model'
import { MEDIATOR_MEMBERS, MEDIATOR_SEATS, mediatorCrewAt } from './mediatorFixture'

const NOW = 1_800_000_000_000
const seats = mediatorSeats(mediatorCrewAt(NOW), MEDIATOR_SEATS, MEDIATOR_MEMBERS, NOW)
const seat = (name: string) => {
  const found = seats.find((s) => s.name === name)
  if (found === undefined) throw new Error(`no seat for ${name}`)
  return found
}

describe('mediatorSeats', () => {
  test('one seat per claimed pilot, in the order their players joined; a pre-gen is no seat', () => {
    expect(seats.map((s) => s.name)).toEqual(['Bonesaw', 'Mags', 'Rook', 'Wren'])
    expect(seat('Bonesaw').rowId).toBe('row-bonesaw')
  })

  test('presence comes from the seat’s heartbeat: Wren is away', () => {
    expect(seats.map((s) => s.present)).toEqual([true, true, true, false])
  })

  test('aboard, every live vital: HP, AP, SP, EP and Heat', () => {
    expect(seat('Bonesaw').vitals.map((v) => `${v.label} ${v.value}`)).toEqual([
      'HP 7/10',
      'AP 3/5',
      'SP 14/20',
      'EP 4/6',
      'Heat 3/10',
    ])
    expect(seat('Bonesaw').mount).toBe('Boarded · Buzzard')
    expect(seat('Bonesaw').mech).toEqual({ name: 'Buzzard', sp: '14/20', boarded: true })
  })

  test('on foot, the pilot’s own; the vital that needs the Mediator is flagged', () => {
    const rook = seat('Rook')
    expect(rook.mount).toBe('On foot')
    expect(rook.vitals.map((v) => `${v.label} ${v.value}`)).toEqual(['HP 4/10', 'AP 1/5'])
    expect(rook.attention).toBe(true)
    expect(rook.vitals.find((v) => v.label === 'HP')?.attention).toBe(true)
    expect(rook.problem).toBe('Injured')
    expect(seat('Mags').attention).toBe(false)
    expect(seat('Mags').problem).toBeNull()
  })

  test('what they are doing now, and the whole line read aloud', () => {
    expect(seat('Bonesaw').resolving).toBe('Bonesaw is resolving 120mm Cannon: activated')
    expect(seat('Rook').label).toContain('Rook, here, HP 4 of 10')
    expect(seat('Wren').label).toContain('Wren, away')
  })

  test('nothing until the crew read arrives', () => {
    expect(mediatorSeats(null, [], [], NOW)).toEqual([])
  })

  test('"3 of 4 here"', () => {
    expect(hereOf(seats)).toEqual({ here: 3, of: 4 })
  })
})

describe('Downtime at the table', () => {
  const completed = [{ userId: 'u-mags' }, { userId: 'u-rook' }]

  test('who is done with the step, and the step box’s "2 of 4 done"', () => {
    expect(seatDone(seat('Mags'), completed)).toBe(true)
    expect(seatDone(seat('Bonesaw'), completed)).toBe(false)
    expect(doneOf(seats, completed)).toEqual({ done: 2, of: 4 })
  })

  test('a seat’s step line', () => {
    expect(seatStepLine(2, true, true)).toBe('Step 3 · done ✓')
    expect(seatStepLine(2, false, true)).toBe('Step 3 · working')
    expect(seatStepLine(2, false, false)).toBe('Step 3 · away')
  })

  test('the bar’s option: Begin Downtime, or the step it is on', () => {
    expect(downtimeOptionLabel(false, null)).toBe('Begin Downtime')
    expect(downtimeOptionLabel(true, 2)).toBe('Downtime · Step 3')
  })
})

describe('npcActions', () => {
  test('flattened and sorted by action type, as the player list: Turn, Reaction, Free', () => {
    const entity = findEntityBySlug('npcs', 'super-android-strikebreaker')
    expect(entity).not.toBeNull()
    const actions = npcActions({ id: 'n1', entity, pattern: null })
    expect(actions.map((a) => a.type)).toEqual(['Turn', 'Reaction', 'Free'])
    expect(actions[0]?.name).toContain('Hooves and Clubs')
    expect(new Set(actions.map((a) => a.key)).size).toBe(actions.length)
  })

  test('a mech drawn as a pattern lists its Systems’ and Modules’ actions too', () => {
    const mule = findEntityBySlug('chassis', 'mule')
    if (mule === null || !('patterns' in mule) || !mule.patterns?.[0]) throw new Error('no Mule')
    const bare = npcActions({ id: 'm1', entity: mule, pattern: null })
    const hauler = npcActions({ id: 'm1', entity: mule, pattern: mule.patterns[0] })
    expect(hauler.length).toBeGreaterThan(bare.length)
    expect(hauler.some((a) => a.source === '.50 Cal Machine Gun')).toBe(true)
  })

  test('a saved pattern’s items read by name, whether a name or an installed item', () => {
    const mule = findEntityBySlug('chassis', 'mule')
    if (mule === null) throw new Error('no Mule')
    const bare = npcActions({ id: 'm1', entity: mule, pattern: null })
    const saved = {
      name: 'Red Leader',
      systems: [{ name: '.50 Cal Machine Gun' }, 7, { slot: 1 }],
      modules: 'none',
    } as unknown as Parameters<typeof npcActions>[0]['pattern']
    const actions = npcActions({ id: 'm1', entity: mule, pattern: saved })
    expect(actions.filter((a) => a.source === '.50 Cal Machine Gun').length).toBe(
      actions.length - bare.length
    )
    expect(actions.length).toBeGreaterThan(bare.length)
  })

  test('a row whose reference no longer resolves has none', () => {
    expect(npcActions({ id: 'x', entity: null, pattern: null })).toEqual([])
  })

  test('what the box calls it', () => {
    expect(npcKind({ refSchema: 'npcs' })).toBe('NPC')
    expect(npcKind({ refSchema: 'chassis' })).toBe('Mech')
    expect(npcKind({ refSchema: 'bio-titans' })).toBe('Bio-Titan')
    expect(npcKind({ refSchema: 'squads' })).toBe('Squad')
    expect(npcKind({ refSchema: 'creatures' })).toBe('Creature')
    expect(npcKind({ refSchema: 'vehicles' })).toBe('Vehicle')
    expect(npcKind({ refSchema: 'meld' })).toBe('Meld')
    expect(npcKind({ refSchema: null })).toBe('NPC')
  })
})
