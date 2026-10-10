/**
 * The Mediator Dashboard's pure halves (issue 1278,
 * docs/architecture/mediator-dashboard.md): the seat cards (Q5), the
 * proposal targets and values (Q8), how a sent proposal reads, and the
 * Opposition tray's instances and Morale roll (Q9).
 */

import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import {
  clampProposalValue,
  fieldLabel,
  normalizeReason,
  proposalTargets,
} from '../../../lib/games/proposals'
import { instanceName, newTrayNpc, readTrayNpc, rollMorale, trackOf } from '../opposition'
import type { SentProposal } from '../proposalLine'
import { ago, proposalLine } from '../proposalLine'
import { seatSummary, tableSeats } from '../seatCards'
import { TABLE_CREW, TABLE_MEMBERS, TABLE_SEATS } from './tableFixture'

describe('the seat cards', () => {
  const cards = tableSeats(TABLE_CREW, TABLE_SEATS, TABLE_MEMBERS)

  test('one per claimed pilot, in join order — never re-sorted by the numbers', () => {
    // Hotdog is unclaimed: an open seat on the Game page, not a card here.
    expect(cards.map((c) => c.name)).toEqual(['Bonesaw', 'Pickle', 'Judge', 'Driftwood'])
  })

  test('crewLines verbatim: vitals, where they are, then Fine or the first problem', () => {
    const [bonesaw, pickle, judge, driftwood] = cards
    expect(bonesaw).toMatchObject({ hp: '8/10', ap: '3/5', status: 'Fine', attention: false })
    expect(bonesaw?.unit).toBe('On foot · Scrapper parked')
    expect(pickle).toMatchObject({ unit: 'In Spectrum · SP 6/9', status: 'Overheating' })
    expect(judge).toMatchObject({ unit: 'On foot', status: 'Ejected', attention: true })
    expect(driftwood?.unit).toBe('In Mazona · SP 9/9')
  })

  test('a tap targets the pilot row, and the card reads its whole line aloud', () => {
    expect(cards[1]?.rowId).toBe('row-pickle')
    expect(cards[1]?.label).toBe(
      'Pickle, HP 10 of 10, AP 5 of 5, In Spectrum, SP 6 of 9, needs attention: overheating'
    )
  })

  test('more than one problem reads the first and how many more', () => {
    const crew = {
      ...TABLE_CREW,
      pilots: TABLE_CREW.pilots.map((p) =>
        p.name === 'Judge' ? { ...p, status: { dead: false, injured: true, ejected: true } } : p
      ),
    }
    const judge = tableSeats(crew, TABLE_SEATS, TABLE_MEMBERS).find((c) => c.name === 'Judge')
    expect(judge?.status).toBe('Injured +1')
  })

  test('the rail counts seats and how many need attention', () => {
    expect(seatSummary(cards)).toBe('4 seats · 2 need attention')
    expect(seatSummary(cards.slice(0, 1))).toBe('1 seat · all fine')
  })

  test('nothing to show before the crew arrives', () => {
    expect(tableSeats(null, [], [])).toEqual([])
  })
})

describe('proposal targets and values', () => {
  const targets = proposalTargets(TABLE_CREW)

  test('claimed pilots, then claimed mechs labelled by their pilot', () => {
    expect(targets.map((t) => t.label)).toEqual([
      'Driftwood',
      'Pickle',
      'Bonesaw',
      'Judge',
      "Pickle's Spectrum",
      "Driftwood's Mazona",
      "Bonesaw's Scrapper",
    ])
    expect(targets.find((t) => t.label === "Pickle's Spectrum")?.readings.currentSP).toEqual({
      current: 6,
      max: 9,
    })
  })

  test('a value is a whole number from 0 to the field’s maximum', () => {
    expect(clampProposalValue('4', 9)).toBe(4)
    expect(clampProposalValue('12', 9)).toBe(9)
    expect(clampProposalValue('-3', 9)).toBe(0)
    expect(clampProposalValue('4.6', null)).toBe(5)
    expect(clampProposalValue('', 9)).toBeNull()
    expect(clampProposalValue('six', 9)).toBeNull()
  })

  test('a reason is trimmed, blank is none, and too long is refused rather than cut', () => {
    expect(normalizeReason('  Shrapnel ')).toBe('Shrapnel')
    expect(normalizeReason('   ')).toBeUndefined()
    expect(() => normalizeReason('x'.repeat(141))).toThrow(/140/)
  })

  test('fields read as the sheet labels them', () => {
    expect(fieldLabel('currentHP')).toBe('HP')
    expect(fieldLabel('currentHeat')).toBe('Heat')
  })
})

describe('a sent proposal', () => {
  const row: SentProposal = {
    _id: 'c1' as SentProposal['_id'],
    entityId: 'judge',
    entityType: 'pilot',
    targetName: 'Judge',
    field: 'currentHP',
    after: 4,
    reason: 'Ejection burn',
    state: 'proposed',
    ts: 0,
    mine: true,
    actorName: null,
  }

  test('names the target, the field, the value asked for and why — and no before', () => {
    expect(proposalLine(row)).toBe('Judge · HP → 4 · “Ejection burn”')
  })

  test('names its sender only when that is not the viewer', () => {
    expect(proposalLine({ ...row, mine: false, actorName: 'Alex', reason: null })).toBe(
      'Judge · HP → 4 · from Alex'
    )
  })

  test('says when, in words', () => {
    expect(ago(0, 30_000)).toBe('just now')
    expect(ago(0, 2 * 60_000)).toBe('2 min ago')
    expect(ago(0, 3 * 60 * 60_000)).toBe('3 h ago')
    expect(ago(0, 49 * 60 * 60_000)).toBe('2 days ago')
  })
})

describe('the Opposition tray', () => {
  const NOW = '2026-10-09T12:00:00.000Z'
  const squad = SalvageUnionReference.Squads.all()[0]
  const vehicle = SalvageUnionReference.Vehicles.all()[0]

  test('a new instance starts at full HP, by slug, with a numbered name when it repeats one', () => {
    if (squad === undefined) throw new Error('no squads in the reference')
    const body = newTrayNpc('squads', squad, [squad.name], NOW)
    expect(body).toMatchObject({
      refSchema: 'squads',
      refName: squad.name,
      name: `${squad.name} 2`,
      statKind: 'hp',
      conditions: [],
    })
    expect(body.currentHp).toBe(body.maxHp)
    expect(body.maxHp).toBeGreaterThan(0)
    // The stored slug resolves back to the entity it came from.
    expect(readTrayNpc({ _id: 'n1', body }).entity?.name).toBe(squad.name)
  })

  test('a vehicle tracks SP', () => {
    if (vehicle === undefined) throw new Error('no vehicles in the reference')
    expect(trackOf(vehicle).statKind).toBe('sp')
  })

  test('numbered names skip the ones taken', () => {
    expect(instanceName('Raider Band', [])).toBe('Raider Band')
    expect(instanceName('Raider Band', ['Raider Band', 'Raider Band 2'])).toBe('Raider Band 3')
  })

  test('at 0 an NPC is down; a row from before the tray took instances reads by its name', () => {
    expect(readTrayNpc({ _id: 'n1', body: { name: 'Wretch', currentHp: 0, maxHp: 6 } }).down).toBe(
      true
    )
    const legacy = readTrayNpc({ _id: 'n2', body: { name: 'Scrap Hound' } })
    expect(legacy).toMatchObject({ name: 'Scrap Hound', entity: null, down: false, lastRoll: null })
  })

  test('Morale is a d20 on the reference table (p.268)', () => {
    expect(rollMorale(() => 7, NOW)).toMatchObject({
      table: 'morale',
      roll: 7,
      label: 'Fighting Retreat',
      rolledAt: NOW,
    })
    expect(rollMorale(() => 20, NOW)?.label).toBe('Fight to the Death')
  })
})
