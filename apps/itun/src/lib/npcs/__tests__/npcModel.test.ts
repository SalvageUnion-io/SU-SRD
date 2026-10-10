import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { crawlerFixture, npcFixture, softLinkFixture } from '../../../components/__tests__/fixtures'
import {
  assignmentFor,
  crewAssignmentsOf,
  crewLinkFor,
  crewSlotsOf,
  isNpcDown,
  npcAsReferenceEntity,
  npcIdentityLine,
  npcKicker,
  slotFromParam,
  slotParam,
  statFillFromReference,
} from '../npcModel'

/**
 * A built NPC read against the reference (ADR-043): slugs on the record,
 * names in the card; the crew slots a crawler has; when an NPC is down.
 */

function veteran() {
  const ref = SalvageUnionReference.NPCs.getByName('Veteran')
  if (!ref) throw new Error('Veteran is in npcs.json')
  return ref
}

describe('a reference template fills the stat block, actions as slugs (Q3)', () => {
  test('the Veteran', () => {
    const fill = statFillFromReference(veteran())
    expect(fill).toEqual({
      templateRef: { schema: 'npcs', slug: 'veteran' },
      hitPoints: 9,
      damageType: 'HP',
      actions: ['green-laser-rifle-veteran', 'portable-comms-unit-npc'],
      traits: [],
    })
  })

  test('an SP template keeps its damage type and its traits, amounts and all', () => {
    const ref = SalvageUnionReference.NPCs.getByName('Super Android Strikebreaker')
    if (!ref) throw new Error('in npcs.json')
    const fill = statFillFromReference(ref)
    expect(fill.damageType).toBe('SP')
    expect(fill.traits).toEqual([{ type: 'fast' }])
  })
})

describe('the NPC as an npcs entity', () => {
  test('its action slugs resolve back to the book’s names', () => {
    const entity = npcAsReferenceEntity({
      ...npcFixture({ id: 'n1' }),
      actions: ['green-laser-rifle-veteran', 'portable-comms-unit-npc'],
    })
    expect(entity.schemaName).toBe('npcs')
    expect(entity.actions).toEqual(['Green Laser Rifle (Veteran)', 'Portable Comms Unit (NPC)'])
    expect(entity.hitPoints).toBe(9)
  })

  test('only the player’s own words become its content (D5)', () => {
    expect(npcAsReferenceEntity(npcFixture({ id: 'n1' })).content).toBeUndefined()
    expect(
      npcAsReferenceEntity(npcFixture({ id: 'n1', description: 'Steady hands.' })).content
    ).toEqual([{ type: 'paragraph', value: 'Steady hands.' }])
  })

  test('the kicker names what it was built from (D9)', () => {
    expect(npcKicker({ templateRef: { schema: 'npcs', slug: 'veteran' } })).toBe(
      'NPC · from Veteran'
    )
    expect(npcKicker({ templateRef: { schema: 'crawler-bays', slug: 'med-bay' } })).toBe(
      'Crawler crew · Med Bay'
    )
    expect(npcKicker({})).toBe('NPC')
  })

  test('the identity line, in the book’s "//" voice', () => {
    expect(
      npcIdentityLine({
        ...npcFixture({ id: 'n1' }),
        position: 'Doc',
        keepsake: 'a dented tin of boiled sweets',
        motto: 'Bleed later.',
      })
    ).toBe('Position: Doc // Keepsake: a dented tin of boiled sweets // Motto: Bleed later.')
  })
})

describe('down (ADR-007; D2)', () => {
  test('at 0 of ≥1 HP an NPC is down', () => {
    expect(isNpcDown({ hitPoints: 4, currentHP: 0 })).toBe(true)
    expect(isNpcDown({ hitPoints: 4 })).toBe(false)
  })

  test('an NPC with no HP to lose — the Augmented A.I. — is never down', () => {
    expect(isNpcDown({ hitPoints: 0 })).toBe(false)
    expect(isNpcDown({ hitPoints: 0, currentHP: 0 })).toBe(false)
  })
})

describe('a crawler’s crew slots', () => {
  const crawler = crawlerFixture({
    id: 'c1',
    type: 'augmented',
    crawlerBays: [
      { bayRef: 'command-bay', npcName: 'Ilsa Varn' },
      { bayRef: 'med-bay' },
      { bayRef: 'med-bay' },
    ],
  })

  test('the type first, then one per bay, a bay listed twice once', () => {
    const slots = crewSlotsOf(crawler)
    expect(slots.map((s) => s.label)).toEqual(['Type · Augmented', 'Command Bay', 'Med Bay'])
    expect(slots[0]).toMatchObject({ position: 'Union Crawler A.I.', hitPoints: 0 })
    expect(slots[1]).toMatchObject({ position: 'Princeps', hitPoints: 4, bookName: 'Ilsa Varn' })
    expect(slots[2]?.choices.map((c) => c.name)).toEqual([
      'Name',
      'Description',
      'Keepsake',
      'Motto',
    ])
  })

  test('the A.I. has a table to roll on; a bay’s Keepsake does not (D1)', () => {
    const [type, , med] = crewSlotsOf(crawler)
    expect(type?.choices.find((c) => c.name === 'A.I. Personality')?.source).toMatchObject({
      kind: 'table',
      rollTable: 'A.I. Personality',
    })
    expect(med?.choices.find((c) => c.name === 'Keepsake')?.source?.kind).toBe('text')
  })

  test('an untyped crawler has no type slot', () => {
    expect(crewSlotsOf({ crawlerBays: [{ bayRef: 'med-bay' }] }).map((s) => s.label)).toEqual([
      'Med Bay',
    ])
  })

  test('the link filling a slot, and the assignment it makes', () => {
    const link = softLinkFixture('npc-to-crawler', 'n1', 'c1')
    const npc = npcFixture({ id: 'n1', name: 'Doc Ambrose' })
    expect(crewLinkFor([link], 'c1', { kind: 'bay', bayRef: 'med-bay' })).toBe(link)
    expect(crewLinkFor([link], 'c1', { kind: 'type' })).toBeUndefined()

    const crew = crewAssignmentsOf([link], 'c1', (id) => (id === 'n1' ? npc : null))
    expect(assignmentFor(crew, { kind: 'bay', bayRef: 'med-bay' })?.npc?.name).toBe('Doc Ambrose')
    // A link whose NPC cannot be read stays an assignment, with no NPC.
    expect(crewAssignmentsOf([link], 'c1', () => null)[0]?.npc).toBeNull()
  })

  test('a slot round-trips through its URL param (D8)', () => {
    expect(slotFromParam('med-bay')).toEqual({ kind: 'bay', bayRef: 'med-bay' })
    expect(slotFromParam('type')).toEqual({ kind: 'type' })
    expect(slotFromParam(undefined)).toBeUndefined()
    expect(slotParam({ kind: 'bay', bayRef: 'med-bay' })).toBe('med-bay')
  })
})
