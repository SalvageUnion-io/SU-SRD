import { describe, expect, test } from 'bun:test'
import { FIXTURE_NOW } from '../../../components/__tests__/fixtures'
import type { CrewSlot } from '../../schemas/softLink'
import { SoftLinkSchema } from '../../schemas/softLink'
import type { LinkShape } from '../linkRules'
import { conflictingLinks, linkKey, linkTypeFor, sameLink } from '../linkRules'

/**
 * `npc-to-crawler` (ADR-043): the slot lives on the link. An NPC fills one
 * slot; a slot holds one NPC; a crawler takes many NPCs, one per slot.
 */

const MED: CrewSlot = { kind: 'bay', bayRef: 'med-bay' }
const MECH: CrewSlot = { kind: 'bay', bayRef: 'mech-bay' }

function crew(npc: string, crawler: string, slot: CrewSlot): LinkShape {
  return {
    type: 'npc-to-crawler',
    from: { type: 'npc', id: npc },
    to: { type: 'crawler', id: crawler },
    slot,
  }
}

describe('the crew link', () => {
  test('an NPC joins a crawler by npc-to-crawler', () => {
    expect(linkTypeFor('npc', 'crawler')).toBe('npc-to-crawler')
    expect(linkTypeFor('npc', 'pilot')).toBeNull()
  })

  test('the slot is part of its identity', () => {
    expect(sameLink(crew('n1', 'c1', MED), crew('n1', 'c1', MED))).toBe(true)
    expect(sameLink(crew('n1', 'c1', MED), crew('n1', 'c1', MECH))).toBe(false)
    expect(linkKey(crew('n1', 'c1', MED))).not.toBe(linkKey(crew('n1', 'c1', MECH)))
  })

  test('moving an NPC to another slot replaces its old one', () => {
    const existing = [crew('n1', 'c1', MED)]
    expect(conflictingLinks(existing, crew('n1', 'c1', MECH))).toEqual(existing)
    expect(conflictingLinks(existing, crew('n1', 'c2', MED))).toEqual(existing)
  })

  test('a slot holds one NPC; another slot of the same crawler is free', () => {
    const existing = [crew('n1', 'c1', MED)]
    expect(conflictingLinks(existing, crew('n2', 'c1', MED))).toEqual(existing)
    expect(conflictingLinks(existing, crew('n2', 'c1', MECH))).toEqual([])
    expect(conflictingLinks(existing, crew('n2', 'c1', { kind: 'type' }))).toEqual([])
  })

  test('drawing the same link again is not a conflict', () => {
    expect(conflictingLinks([crew('n1', 'c1', MED)], crew('n1', 'c1', MED))).toEqual([])
  })
})

describe('the record: a crew link names its slot, and no other link may', () => {
  const base = { id: 'l1', createdAt: FIXTURE_NOW }

  test('a crew link with its slot parses', () => {
    expect(SoftLinkSchema.safeParse({ ...base, ...crew('n1', 'c1', MED) }).success).toBe(true)
  })

  test('a crew link without one is refused', () => {
    const { slot: _slot, ...noSlot } = crew('n1', 'c1', MED)
    expect(SoftLinkSchema.safeParse({ ...base, ...noSlot }).success).toBe(false)
  })

  test('a pilot link with one is refused', () => {
    const pilot = {
      ...base,
      type: 'pilot-to-crawler',
      from: { type: 'pilot', id: 'p1' },
      to: { type: 'crawler', id: 'c1' },
    }
    expect(SoftLinkSchema.safeParse(pilot).success).toBe(true)
    expect(SoftLinkSchema.safeParse({ ...pilot, slot: MED }).success).toBe(false)
  })
})
