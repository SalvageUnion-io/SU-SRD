/**
 * The Mediator's pure halves in Play
 * (docs/architecture/play.md): the seats (§10), the proposal targets
 * and values (§15), how a sent proposal reads, and the Opposition's
 * instances (§15). The Morale roll and what an NPC tracks
 * are rules: `src/lib/rules/opposition.ts`.
 */

import { describe, expect, test } from 'bun:test'
import { instanceName } from 'game-domain/games/encounters'
import {
  clampProposalValue,
  fieldLabel,
  normalizeReason,
  proposalTargets,
} from 'game-domain/games/proposals'
import { SalvageUnionReference } from 'salvageunion-reference'
import { mediatorSeats } from '../mediatorTable.model'
import { newTrayNpc, readSavedPattern, readTrayNpc } from '../opposition.model'
import type { SentProposal } from '../proposalLine.model'
import { proposalLine } from '../proposalLine.model'
import { setbackDraft } from '../setbacks.model'
import { TABLE_CREW, TABLE_MEMBERS, TABLE_SEATS } from './tableFixture'

describe('the seats, in one layer over the crew lines', () => {
  const NOW = 0
  const seats = mediatorSeats(TABLE_CREW, TABLE_SEATS, TABLE_MEMBERS, NOW)

  test('one per claimed pilot, in join order — never re-sorted by the numbers', () => {
    // Hotdog is unassigned: an open seat on the Game page, not a seat here.
    expect(seats.map((c) => c.name)).toEqual(['Bonesaw', 'Pickle', 'Judge', 'Driftwood'])
  })

  test('the crew lines verbatim: where they are, then nothing wrong or the first problem', () => {
    const [bonesaw, pickle, judge, driftwood] = seats
    expect(bonesaw).toMatchObject({ problem: null, attention: false })
    expect(bonesaw?.label).toContain('HP 8 of 10, AP 3 of 5, On foot, Scrapper parked')
    expect(pickle).toMatchObject({ problem: 'Overheating' })
    expect(judge).toMatchObject({ mount: 'On foot', problem: 'Ejected', attention: true })
    expect(driftwood?.label).toContain('In Mazona, SP 9 of 9')
  })

  test('a tap targets the pilot row, and the seat reads its whole line aloud', () => {
    expect(seats[1]?.rowId).toBe('row-pickle')
    expect(seats[1]?.label).toBe(
      'Pickle, away, HP 10 of 10, AP 5 of 5, In Spectrum, SP 6 of 9, needs attention: overheating'
    )
  })

  test('more than one problem reads the first and how many more', () => {
    const crew = {
      ...TABLE_CREW,
      pilots: TABLE_CREW.pilots.map((p) =>
        p.name === 'Judge' ? { ...p, status: { dead: false, injured: true, ejected: true } } : p
      ),
    }
    const judge = mediatorSeats(crew, TABLE_SEATS, TABLE_MEMBERS, NOW).find(
      (c) => c.name === 'Judge'
    )
    expect(judge?.problem).toBe('Injured +1')
  })

  test('nothing to show before the crew arrives', () => {
    expect(mediatorSeats(null, [], [], NOW)).toEqual([])
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
})

describe('the Opposition tray', () => {
  const NOW = '2026-10-09T12:00:00.000Z'
  const squad = SalvageUnionReference.Squads.all()[0]

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

  test('a row drawn before the Hill Worm became a pattern resolves to Typhon’s pattern', () => {
    const npc = readTrayNpc({
      _id: 'n1',
      body: {
        refSchema: 'bio-titans',
        refSlug: 'hill-worm-pattern-typhon',
        name: 'Hill Worm Pattern Typhon',
        currentHp: 40,
        maxHp: 67,
        statKind: 'sp',
      },
    })
    expect(npc.entity?.name).toBe('Typhon')
    expect(npc.pattern?.name).toBe('Hill Worm')
    // The row's own name and track are untouched.
    expect(npc).toMatchObject({ name: 'Hill Worm Pattern Typhon', currentHp: 40, maxHp: 67 })
  })

  test('a mech drawn as a pattern keeps its chassis SP and reads back as that pattern', () => {
    const mule = SalvageUnionReference.Chassis.getByName('Mule')
    const hauler = mule?.patterns?.find((p) => p.name === 'Hauler')
    if (mule === undefined || hauler === undefined)
      throw new Error('no Mule Hauler in the reference')
    const body = newTrayNpc('chassis', mule, [], NOW, { pattern: hauler })
    expect(body).toMatchObject({
      refSchema: 'chassis',
      refSlug: 'mule',
      refPattern: 'hauler',
      refName: 'Hauler',
      name: 'Hauler',
      maxHp: mule.structurePoints,
      statKind: 'sp',
    })
    const npc = readTrayNpc({ _id: 'n1', body })
    expect(npc.entity?.name).toBe('Mule')
    expect(npc.pattern?.name).toBe('Hauler')
    // The bare chassis carries no pattern.
    const bare = readTrayNpc({ _id: 'n2', body: newTrayNpc('chassis', mule, [], NOW) })
    expect(bare).toMatchObject({ name: 'Mule', pattern: null, statKind: 'sp' })
  })

  test('an important mech reads its EP and Heat, frozen or from its chassis', () => {
    const mule = SalvageUnionReference.Chassis.getByName('Mule')
    if (mule === undefined) throw new Error('no Mule in the reference')
    const body = newTrayNpc('chassis', mule, [], NOW)
    // Not yet important: nothing more is tracked, but it could be.
    const plain = readTrayNpc({ _id: 'n1', body })
    expect(plain).toMatchObject({ important: false, reactor: null, lastImportantRoll: null })
    expect(plain.track?.critical).toBe('critical-damage')

    const marked = readTrayNpc({
      _id: 'n1',
      body: { ...body, important: true, currentEp: 2, currentHeat: 3 },
    })
    expect(marked.reactor).toEqual({
      ep: 2,
      maxEp: mule.energyPoints,
      heat: 3,
      heatCap: mule.heatCapacity,
    })
  })

  test('a Bio-Titan is never important, whatever its row says', () => {
    const npc = readTrayNpc({
      _id: 'n1',
      body: {
        refSchema: 'bio-titans',
        refSlug: 'typhon',
        name: 'Typhon',
        maxHp: 60,
        statKind: 'sp',
        important: true,
      },
    })
    expect(npc).toMatchObject({ important: false, track: null, reactor: null })
  })

  test('a saved pattern is copied onto the row and reads back with its loadout', () => {
    const mule = SalvageUnionReference.Chassis.getByName('Mule')
    if (mule === undefined) throw new Error('no Mule in the reference')
    const saved = readSavedPattern({
      appId: 'p1',
      madeBy: 'Player',
      body: { name: 'Red Leader', chassisRef: 'mule', systems: [], modules: [] },
    })
    if (saved === null) throw new Error('the saved pattern did not read')
    const body = newTrayNpc('chassis', mule, [], NOW, { saved })
    expect(body).toMatchObject({
      refSlug: 'mule',
      name: 'Red Leader',
      userPattern: { name: 'Red Leader', systems: [], modules: [] },
      maxHp: mule.structurePoints,
    })
    expect(body).not.toHaveProperty('refPattern')
    const npc = readTrayNpc({ _id: 'n1', body })
    expect(npc.entity?.name).toBe('Mule')
    expect(npc.pattern?.name).toBe('Red Leader')
    // A body with no loadout is not a pattern the picker can offer.
    expect(readSavedPattern({ appId: 'p2', madeBy: 'You', body: { name: 'Draft' } })).toBeNull()
  })

  test('a name the Mediator typed wins, trimmed and numbered like any other', () => {
    if (squad === undefined) throw new Error('no squads in the reference')
    const named = newTrayNpc('squads', squad, ['Red Leader'], NOW, { name: '  Red Leader ' })
    expect(named).toMatchObject({ name: 'Red Leader 2', refName: squad.name })
    expect(newTrayNpc('squads', squad, [], NOW, { name: '   ' }).name).toBe(squad.name)
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
    expect(legacy).toMatchObject({
      name: 'Scrap Hound',
      entity: null,
      pattern: null,
      down: false,
      lastRoll: null,
    })
  })
})

describe('a Setback in the Propose dock (Workshop Manual pp.253-254)', () => {
  const targets = proposalTargets(TABLE_CREW)
  const pilot = targets.find((t) => t.kind === 'pilot' && t.readings.currentHP?.current != null)
  const mech = targets.find((t) => t.kind === 'mech' && t.readings.currentSP?.current != null)
  if (pilot === undefined || mech === undefined) throw new Error('no pilot or mech in the fixture')

  test('2 damage is 2 HP to a pilot and 2 SP to a mech, never under 0', () => {
    const hp = pilot.readings.currentHP?.current ?? 0
    expect(setbackDraft('damage', pilot)).toEqual({
      field: 'currentHP',
      to: Math.max(0, hp - 2),
      reason: 'Setback: 2 HP damage',
    })
    const sp = mech.readings.currentSP?.current ?? 0
    expect(setbackDraft('damage', mech)).toMatchObject({
      field: 'currentSP',
      to: Math.max(0, sp - 2),
    })
  })

  test('+2 Heat is a mech’s alone, and stops at its Heat Cap', () => {
    expect(setbackDraft('heat', pilot)).toBeNull()
    const heat = mech.readings.currentHeat
    const draft = setbackDraft('heat', mech)
    if (heat?.current == null) expect(draft).toBeNull()
    else
      expect(draft).toEqual({
        field: 'currentHeat',
        to: Math.min(heat.max ?? Infinity, heat.current + 2),
        reason: 'Tough Choice: +2 Heat',
      })
  })

  test('with no target there is nothing to fill', () => {
    expect(setbackDraft('damage', null)).toBeNull()
  })
})
