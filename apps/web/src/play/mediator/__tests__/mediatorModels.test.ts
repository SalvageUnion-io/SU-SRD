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
  PROPOSAL_FIELDS,
  proposalTargets,
} from 'game-domain/games/proposals'
import { SalvageUnionReference } from 'salvageunion-reference'
import { mediatorSeats } from '../mediatorTable.model'
import {
  firstToNumber,
  groupRoll,
  newTrayNpc,
  readSavedPattern,
  readTrayNpc,
  sinkDowned,
  trayEntries,
} from '../opposition.model'
import type { SentProposal } from '../proposalLine.model'
import { hitDamageOf, hitTargets, proposalAfter, proposalLine } from '../proposalLine.model'
import { choiceLine, runChoices } from '../runEncounter.model'
import { setbackDraft } from '../setbacks.model'
import { TABLE_CREW, TABLE_MEMBERS, TABLE_SEATS } from './tableFixture'

describe('the seats, in one layer over the crew lines', () => {
  const seats = mediatorSeats(TABLE_CREW, TABLE_SEATS, TABLE_MEMBERS, null)

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
    const judge = mediatorSeats(crew, TABLE_SEATS, TABLE_MEMBERS, null).find(
      (c) => c.name === 'Judge'
    )
    expect(judge?.problem).toBe('Injured +1')
  })

  test('nothing to show before the crew arrives', () => {
    expect(mediatorSeats(null, [], [], null)).toEqual([])
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
    expect(fieldLabel('currentEP')).toBe('EP')
  })

  test('a Mech can be proposed EP as well as SP and Heat (r4 D2)', () => {
    expect(PROPOSAL_FIELDS.mech.map((f) => f.label)).toEqual(['SP', 'EP', 'Heat'])
    const spectrum = targets.find((t) => t.label === "Pickle's Spectrum")
    expect(spectrum?.readings.currentEP).toBeDefined()
  })

  test('a hit is a plain number of HP or SP; a variable amount offers nothing', () => {
    expect(hitDamageOf({ damage: { damageType: 'HP', amount: 3 } })).toEqual({
      damageType: 'HP',
      amount: 3,
    })
    expect(hitDamageOf({ damage: { damageType: 'SP', amount: 'X' } })).toBeNull()
    expect(hitDamageOf({ damage: { damageType: 'SP', amount: 0 } })).toBeNull()
    expect(hitDamageOf({})).toBeNull()
  })

  test('HP damage is offered to the Pilots, SP damage to the Mechs, each with what it leaves', () => {
    const hp = hitTargets({ damageType: 'HP', amount: 3 }, targets)
    expect(hp.every((h) => h.target.kind === 'pilot' && h.field === 'currentHP')).toBe(true)
    expect(hp.every((h) => h.after === Math.max(0, h.before - 3))).toBe(true)
    const sp = hitTargets({ damageType: 'SP', amount: 4 }, targets)
    expect(sp.map((h) => h.target.kind)).toEqual(sp.map(() => 'mech'))
    expect(sp.find((h) => h.target.label === "Pickle's Spectrum")).toMatchObject({
      field: 'currentSP',
      before: 6,
      after: 2,
    })
    // A hit never takes a vital below 0.
    expect(hitTargets({ damageType: 'SP', amount: 99 }, targets).every((h) => h.after === 0)).toBe(
      true
    )
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
      // The chassis first, so the field names the Mech that was picked (r4 D5).
      name: 'Mule · Hauler',
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
      name: 'Mule · Red Leader',
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
    expect(named.name).toBe('Red Leader 2')
    expect(newTrayNpc('squads', squad, [], NOW, { name: '   ' }).name).toBe(squad.name)
  })

  test('numbered names skip the ones taken', () => {
    expect(instanceName('Raider Band', [])).toBe('Raider Band')
    expect(instanceName('Raider Band', ['Raider Band', 'Raider Band 2'])).toBe('Raider Band 3')
  })

  test('a second on the field numbers the first: the one called Raider is to read Raider 1 (r4 D5)', () => {
    const raider = { id: 'b', name: 'Raider' }
    const field = [{ id: 'a', name: 'Scylla' }, raider]
    expect(firstToNumber(field, 'Raider 2')).toEqual({ npc: raider, name: 'Raider 1' })
    // Nothing to number: a first of its kind, or a first already numbered.
    expect(firstToNumber(field, 'Rifle Squad')).toBeNull()
    expect(firstToNumber([{ id: 'b', name: 'Raider 1' }], 'Raider 2')).toBeNull()
    expect(firstToNumber([{ id: 'b', name: 'Raider' }], 'Raider')).toBeNull()
  })

  test('a named pattern on any other host keeps the pattern’s own name', () => {
    const typhon = SalvageUnionReference.BioTitans.all().find((t) => (t.patterns?.length ?? 0) > 0)
    const pattern = typhon?.patterns?.[0]
    if (typhon === undefined || pattern === undefined) return
    expect(newTrayNpc('bio-titans', typhon, [], NOW, { pattern }).name).toBe(pattern.name)
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

describe('groups on the tray (ADR-059 §5)', () => {
  const row = (id: string, group?: { id: string; name: string }, rolledAt?: string) =>
    readTrayNpc({
      _id: id,
      body: {
        name: id,
        refSchema: 'npcs',
        refSlug: 'raider',
        currentHp: 3,
        maxHp: 3,
        ...(group ? { group } : {}),
        ...(rolledAt
          ? { lastMediatorRoll: { table: 'reaction', roll: 4, value: rolledAt, rolledAt } }
          : {}),
      },
    })
  const band = { id: 'band', name: 'Raider Band' }

  test('a group sits where its first member stands, holding its members in order', () => {
    const entries = trayEntries([row('a'), row('b', band), row('c'), row('d', band)])
    expect(
      entries.map((e) => (e.kind === 'alone' ? e.npc.id : e.members.map((m) => m.id)))
    ).toEqual(['a', ['b', 'd'], 'c'])
  })

  // MD6-16: downed mooks kept full cards among the living.
  test('the downed sink below the living, alone and inside a group (r6 B8)', () => {
    const down = (id: string, group?: { id: string; name: string }) =>
      readTrayNpc({
        _id: id,
        body: { name: id, refSchema: 'npcs', refSlug: 'raider', currentHp: 0, maxHp: 3, group },
      })
    const entries = sinkDowned(
      trayEntries([
        down('a'),
        row('b', band),
        down('c', band),
        row('d'),
        down('e', band),
        row('f', band),
      ])
    )
    expect(
      entries.map((e) => (e.kind === 'alone' ? e.npc.id : e.members.map((m) => m.id)))
    ).toEqual([['b', 'f', 'c', 'e'], 'd', 'a'])
  })

  test('a malformed group reads as none', () => {
    expect(readTrayNpc({ _id: 'x', body: { name: 'x', group: { id: 'band' } } }).group).toBeNull()
  })

  test("a group's last roll is the newest of its members'", () => {
    const members = [
      row('a', band, '2026-10-26T00:00:00.000Z'),
      row('b', band, '2026-10-26T01:00:00.000Z'),
    ]
    expect(groupRoll(members)?.value).toBe('2026-10-26T01:00:00.000Z')
    expect(groupRoll([row('c', band)])).toBeNull()
  })
})

describe('proposalAfter (the Propose dock’s number)', () => {
  test('Set to is the value itself, within the field', () => {
    expect(proposalAfter('set', '5', 8, 10)).toBe(5)
    expect(proposalAfter('set', '14', 8, 10)).toBe(10)
    expect(proposalAfter('set', '', 8, 10)).toBeNull()
  })
  test('Take and Add change what the sheet has: "you take 3 damage" is 8 → 5', () => {
    expect(proposalAfter('take', '3', 8, 10)).toBe(5)
    expect(proposalAfter('take', '30', 8, 10)).toBe(0)
    expect(proposalAfter('add', '2', 4, 6)).toBe(6)
    expect(proposalAfter('add', '9', 4, 6)).toBe(6)
  })
  test('an amount needs a current value to change', () => {
    expect(proposalAfter('take', '3', null, 10)).toBeNull()
  })
})

describe('Run an encounter lists this Game’s first (MD2-17)', () => {
  const e = (id: string, gameId?: string) => ({ id, gameId, opposition: [], tables: [] })
  const names = (id: string) => (id === 'g2' ? 'Rust Run' : null)

  test('this Game’s, then the Kit’s, then another Game’s, which is named', () => {
    const list = runChoices(
      [e('other', 'g2'), e('kit'), e('here', 'g1'), e('lost', 'g9')],
      'g1',
      names
    )
    expect(list.map((c) => [c.encounter.id, c.otherGame])).toEqual([
      ['here', null],
      ['kit', null],
      ['other', 'Rust Run'],
      ['lost', 'another Game'],
    ])
    expect(choiceLine(list[0] as never)).toBe('0 opposition · 0 tables')
    expect(choiceLine(list[2] as never)).toBe('0 opposition · 0 tables · prepared for Rust Run')
  })
})
