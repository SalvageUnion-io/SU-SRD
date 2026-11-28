/**
 * One of the Mediator's own designed NPCs on the field (ADR-067 §1): the tray
 * row is a snapshot of its stat block, and reads back as an `npcs` entity so
 * its card and actions draw as a book NPC's do.
 */

import { describe, expect, test } from 'bun:test'
import { EncounterNpcSchema } from 'game-domain/schemas/encounterNpc'
import { npcActions, npcKind } from '../npcActions.model'
import { newBuiltTrayNpc, readTrayNpc } from '../opposition.model'

const NOW = '2026-11-21T12:00:00.000Z'
const KESSLER = {
  id: 'npc-1',
  name: 'Sergeant Kessler',
  hitPoints: 9,
  damageType: 'HP' as const,
  actions: ['rifle'],
  traits: [{ type: 'armoured' }],
}

describe('a designed NPC on the field', () => {
  test('is a snapshot at full HP, named apart, and parses as a tray NPC', () => {
    const body = newBuiltTrayNpc(KESSLER, ['Sergeant Kessler'], NOW)
    expect(body.name).toBe('Sergeant Kessler 2')
    expect(body.currentHp).toBe(9)
    expect(body.built).toEqual({
      npcId: 'npc-1',
      name: 'Sergeant Kessler',
      actions: ['rifle'],
      traits: [{ type: 'armoured' }],
    })
    expect(EncounterNpcSchema.safeParse({ ...body, id: 't1' }).success).toBe(true)
  })

  test('a typed name wins', () => {
    expect(newBuiltTrayNpc(KESSLER, [], NOW, ' Red Leader ').name).toBe('Red Leader')
  })

  test('reads back with its own actions and its design as its source', () => {
    const npc = readTrayNpc({ _id: 't1', body: newBuiltTrayNpc(KESSLER, [], NOW) })
    expect(npc.builtFrom).toBe('npc-1')
    expect(npc.maxHp).toBe(9)
    expect(npc.entity && 'name' in npc.entity ? npc.entity.name : null).toBe('Sergeant Kessler')
    expect(npcActions(npc).map((a) => a.name)).toEqual(['Rifle'])
  })

  test('a row with no snapshot is not one', () => {
    const npc = readTrayNpc({
      _id: 't2',
      body: { name: 'Raider', refSchema: 'npcs', refSlug: 'raider', maxHp: 4 },
    })
    expect(npc.builtFrom).toBeNull()
  })

  // MD2-15: a design built from a Bio-Titan lost its kind on the field.
  test('keeps the kind it was built from, and what it leaves', () => {
    const lurker = {
      ...KESSLER,
      id: 'npc-2',
      name: 'The Relay Lurker',
      hitPoints: 39,
      damageType: 'SP' as const,
      templateRef: { schema: 'bio-titans' as const, slug: 'scylla' },
    }
    const body = newBuiltTrayNpc(lurker, [], NOW)
    expect(body.built?.kind).toBe('bio-titans')
    expect(body.statKind).toBe('sp')
    expect(EncounterNpcSchema.safeParse({ ...body, id: 't3' }).success).toBe(true)
    const npc = readTrayNpc({ _id: 't3', body })
    expect(npcKind(npc)).toBe('Bio-Titan')
    // A design from a book NPC, a crew slot or nothing is an NPC.
    expect(npcKind(readTrayNpc({ _id: 't1', body: newBuiltTrayNpc(KESSLER, [], NOW) }))).toBe('NPC')
    const crew = { ...KESSLER, templateRef: { schema: 'crawler-bays' as const, slug: 'med-bay' } }
    expect(newBuiltTrayNpc(crew, [], NOW).built?.kind).toBeUndefined()
    const fed = newBuiltTrayNpc({ ...KESSLER, bioSalvageValue: 3 }, [], NOW)
    expect(fed.built?.bioSalvageValue).toBe(3)
  })
})
