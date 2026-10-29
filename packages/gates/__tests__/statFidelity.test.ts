import { afterAll, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { LockFile } from '../lib/proseFidelity'
import { compareWithLock, proseHash, serializeLock } from '../lib/proseFidelity'
import type { StatItem } from '../lib/statFidelity'
import {
  collectStats,
  parsePages,
  partKey,
  renderStatLine,
  sameStatLine,
  statContext,
  statTokens,
  statVerdict,
} from '../lib/statFidelity'

/**
 * The stat half of `fidelity.lock.json`: which numbers are held, how each
 * block is keyed and rendered, and how the Core Book extractors read a page.
 * The pages here are invented in the books' layouts — no book text.
 */

const fixtures: string[] = []
afterAll(() => {
  for (const dir of fixtures) rmSync(dir, { recursive: true, force: true })
})

const CORE = 'Salvage Union Workshop Manual'

function fixture(files: Record<string, unknown[]>): string {
  const dir = mkdtempSync(join(tmpdir(), 'stat-fidelity-'))
  fixtures.push(dir)
  for (const [name, rows] of Object.entries(files))
    writeFileSync(join(dir, name), JSON.stringify(rows))
  return dir
}

const DATA = fixture({
  'chassis.json': [
    {
      id: 'ch-1',
      name: 'Tortoise',
      source: CORE,
      page: 10,
      structurePoints: 12,
      energyPoints: 4,
      heatCapacity: 6,
      systemSlots: 16,
      moduleSlots: 2,
      cargoCapacity: 16,
      techLevel: 1,
      salvageValue: 7,
      patterns: [
        {
          name: 'Plodder',
          source: CORE,
          page: 11,
          systems: [{ name: 'Rivet Driver', count: 2 }, { name: 'Loudspeakers' }],
          modules: [{ name: 'Comms Module' }, { name: 'Adv. Signal Booster' }],
        },
        {
          name: 'Sprinter',
          source: CORE,
          page: 11,
          systems: [{ name: 'Mech Melee Armament' }, { name: 'Loudspeakers' }],
          modules: [{ name: 'Comms Module' }],
        },
        {
          name: 'Expansion',
          source: 'False Flag',
          page: 50,
          systems: [{ name: 'Loudspeakers' }],
          modules: [],
        },
      ],
    },
  ],
  'systems.json': [
    {
      id: 'sys-1',
      name: 'Rivet Driver',
      source: CORE,
      page: 20,
      techLevel: 2,
      slotsRequired: 3,
      salvageValue: 2,
      actions: ['Rivet Driver', 'Patch (Rivet Driver)'],
    },
    {
      id: 'sys-2',
      name: 'Loudspeakers',
      source: CORE,
      page: 20,
      techLevel: 1,
      slotsRequired: 1,
      salvageValue: 1,
      recommended: true,
      actions: ['Loudspeakers'],
    },
    {
      id: 'sys-3',
      name: 'Mech Melee Armament',
      source: CORE,
      page: 21,
      techLevel: 3,
      slotsRequired: 4,
      salvageValue: 3,
      actions: ['Mech Melee Armament'],
    },
    {
      id: 'sys-4',
      name: 'Hover Skids',
      source: CORE,
      page: 21,
      techLevel: 4,
      slotsRequired: 5,
      salvageValue: 4,
      actions: ['Hover Skids'],
    },
  ],
  'modules.json': [
    {
      id: 'mod-1',
      name: 'Comms Module',
      source: CORE,
      page: 30,
      techLevel: 1,
      slotsRequired: 1,
      salvageValue: 1,
      actions: [],
    },
    {
      id: 'mod-2',
      name: 'Adv. Signal Booster',
      source: 'False Flag',
      page: 60,
      techLevel: 3,
      slotsRequired: 1,
      salvageValue: 2,
      actions: [],
    },
  ],
  'actions.json': [
    {
      id: 'a-1',
      name: 'Rivet Driver',
      actionType: 'Turn',
      range: ['Close'],
      damage: { damageType: 'SP', amount: 3 },
      traits: [{ type: 'ballistic' }, { type: 'hot', amount: 2 }],
    },
    {
      id: 'a-2',
      name: 'Patch (Rivet Driver)',
      actionType: 'Turn',
      activationCost: 2,
      range: ['Close'],
    },
    { id: 'a-3', name: 'Loudspeakers', actionType: 'Free', range: ['Medium'] },
    { id: 'a-4', name: 'Mech Melee Armament', range: ['Close'], traits: [{ type: 'melee' }] },
    { id: 'a-5', name: 'Hover Skids', actionType: 'Passive' },
    {
      id: 'a-6',
      name: 'Bash (Thug)',
      displayName: 'Bash',
      actionType: 'Turn',
      range: ['Close'],
      damage: { damageType: 'HP', amount: 2 },
    },
    { id: 'a-7', name: 'Pockets (NPC)', displayName: 'Pockets' },
    { id: 'a-8', name: 'Tinker', actionType: 'Turn', activationCost: 1 },
    { id: 'a-9', name: 'Overclock', actionType: 'Long', activationCost: 'X', range: ['Close'] },
  ],
  'drones.json': [
    {
      id: 'dr-1',
      name: 'Gnat Drone',
      source: CORE,
      page: 40,
      structurePoints: 2,
      techLevel: 1,
      salvageValue: 1,
      systems: ['Hover Skids', 'Rivet Driver', 'Rivet Driver'],
    },
  ],
  'npcs.json': [
    {
      id: 'npc-1',
      name: 'Thug',
      source: CORE,
      page: 41,
      hitPoints: 3,
      actions: ['Bash (Thug)', 'Pockets (NPC)'],
    },
  ],
  'squads.json': [
    {
      id: 'sq-1',
      name: 'Thug Gang',
      source: 'Rainmaker',
      page: 70,
      hitPoints: 8,
      damageType: 'SP',
      actions: ['Bash (Thug)'],
    },
  ],
  'abilities.json': [
    { id: 'ab-1', name: 'Tinker', source: CORE, page: 5, actions: ['Tinker'] },
    { id: 'ab-2', name: 'Overclock', source: CORE, page: 5, actions: ['Overclock'] },
  ],
})

const items = collectStats(DATA)
const byKey = (k: string) => {
  const i = items.find((x) => x.key === k)
  if (!i) throw new Error(`no stat block ${k}`)
  return i
}

describe('collectStats', () => {
  test('keys every block by entity id and path, apart from prose keys', () => {
    expect(items.map((i) => i.key)).toEqual([
      'chassis.json#ch-1@stat',
      'chassis.json#ch-1.patterns[0]@stat',
      'chassis.json#ch-1.patterns[1]@stat',
      'chassis.json#ch-1.patterns[2]@stat',
      'systems.json#sys-1@stat',
      'systems.json#sys-1.actions[0]@stat',
      'systems.json#sys-1.actions[1]@stat',
      'systems.json#sys-2@stat',
      'systems.json#sys-2.actions[0]@stat',
      'systems.json#sys-3@stat',
      'systems.json#sys-3.actions[0]@stat',
      'systems.json#sys-4@stat',
      'systems.json#sys-4.actions[0]@stat',
      'modules.json#mod-1@stat',
      'modules.json#mod-2@stat',
      'drones.json#dr-1@stat',
      'npcs.json#npc-1@stat',
      'npcs.json#npc-1.actions[0]@stat',
      'squads.json#sq-1@stat',
      'squads.json#sq-1.actions[0]@stat',
      'abilities.json#ab-1.actions[0]@stat',
      'abilities.json#ab-2.actions[0]@stat',
    ])
  })

  test("a chassis' eight stats in the book's order", () => {
    expect(byKey('chassis.json#ch-1@stat').text).toBe(
      'SP: 12 | EP: 4 | Heat: 6 | System Slots: 16 | Module Slots: 2 | Cargo: 16 | TL: 1 | SV: 7'
    )
  })

  test("a pattern's parts with counts, and its own citation and slot", () => {
    const p = byKey('chassis.json#ch-1.patterns[1]@stat')
    expect(p.name).toBe('Sprinter')
    expect(p.slot).toBe(1)
    expect(byKey('chassis.json#ch-1.patterns[0]@stat').text).toBe(
      'Systems: Rivet Driver x 2, Loudspeakers | Modules: Comms Module, Adv. Signal Booster'
    )
    expect(byKey('chassis.json#ch-1.patterns[2]@stat').anchors).toEqual([
      { source: 'False Flag', page: 50 },
    ])
  })

  test('an action line as the book sets it, the owner suffix dropped', () => {
    expect(byKey('systems.json#sys-1.actions[1]@stat')).toMatchObject({
      name: 'Patch',
      text: 'Line: 2EP Turn Action // Range: Close',
    })
    expect(byKey('systems.json#sys-2.actions[0]@stat').text).toBe(
      'Line: Free Action // Range: Medium // Recommended System'
    )
    expect(byKey('abilities.json#ab-2.actions[0]@stat').text).toBe(
      'Line: XAP Long Action // Range: Close'
    )
  })

  test('skips an action with no stat line, and a drone repeats as a count', () => {
    expect(items.some((i) => i.key === 'npcs.json#npc-1.actions[1]@stat')).toBe(false)
    expect(byKey('drones.json#dr-1@stat').text).toBe(
      'SP: 2 | TL: 1 | SV: 1 | Systems: Hover Skids, Rivet Driver x 2'
    )
    expect(byKey('squads.json#sq-1@stat').text).toBe('SP: 8')
  })

  test('the lock gate holds stat blocks like prose: an edited number is unverified', () => {
    const comment = JSON.parse(serializeLock({ editions: {}, entries: {} })).$comment as string
    const entries = Object.fromEntries(
      items.map((i) => [i.key, `${proseHash(i.text)} 000000000000 verbatim`])
    )
    const file = { $comment: comment, editions: {}, entries } as LockFile
    expect(compareWithLock(items, file).unverified).toEqual([])
    const edited = items.map((i) =>
      i.key === 'chassis.json#ch-1@stat' ? { ...i, text: i.text.replace('SP: 12', 'SP: 13') } : i
    )
    expect(compareWithLock(edited, file).unverified.map((u) => u.item.key)).toEqual([
      'chassis.json#ch-1@stat',
    ])
  })
})

describe('stat lines', () => {
  test('render costs, ranges, damage and trait amounts', () => {
    expect(
      renderStatLine(
        {
          activationCost: 3,
          actionType: 'Short',
          range: ['Close', 'Long'],
          damage: { amount: 4, damageType: 'SP' },
          traits: [{ type: 'multi-attack', amount: 2 }, { type: 'anti-organic' }],
        },
        'EP'
      )
    ).toBe(
      '3EP Short Action // Range: Close/Long // Damage: 4 SP // Multi-Attack (2) // Anti-Organic'
    )
  })

  test('tokens survive the raw layer dropping spaces and breaking words', () => {
    expect(statTokens('2EP ShortAction//Range:Long//Explo-sive (1)')).toEqual([
      'cost:2ep',
      'type:short',
      'range:long',
      'explosive(1)',
    ])
  })

  test('compare order-free, with an implied action type and an unprinted damage type', () => {
    expect(sameStatLine('Turn Action // Range: Close // Hot (2)', 'Hot (2) // Range: Close')).toBe(
      true
    )
    expect(sameStatLine('Damage: 2d20 SP // Energy', 'Damage: 2d20 // Energy')).toBe(true)
    expect(sameStatLine('Passive // Uses (Destroy)', 'Passive')).toBe(true)
    expect(sameStatLine('Range: Close // Hot (2)', 'Range: Close // Hot (3)')).toBe(false)
    expect(sameStatLine('1EP Turn Action', '2EP Turn Action')).toBe(false)
    expect(sameStatLine('Turn Action', 'Reaction')).toBe(false)
  })

  test("partKey reads a pattern list's spellings as the part's name", () => {
    expect(partKey('Loudspeaker')).toBe(partKey('Loudspeakers'))
    expect(partKey('Self-Destruct Module')).toBe(partKey('Self-Destruct'))
    expect(partKey('Advanced Targeting Array')).toBe(partKey('Adv. Targeting Array'))
    expect(partKey('Mech Melee Armament (Iron Spear)')).toBe(partKey('Mech Melee Armament'))
    expect(partKey('Advanced Targeting')).toBe(partKey('Adv. Targeting Array'))
  })
})

/** Invented pages in the Core Book's raw-layer layouts. */
const PAGES = parsePages(
  [
    '<!-- page 5 -->',
    '5',
    '1Tinker',
    '1AP Turn Action',
    'Overclock',
    'is named in this text before its heading.',
    '2Overclock',
    'XAP Long Action // Range: Close',
    '<!-- page 10 -->',
    '10',
    'TORTOISE',
    'SALVAGE',
    'VALUE',
    'M',
    'ODULE',
    'SLOTS',
    '12',
    '4',
    '6',
    '16',
    '2',
    '16',
    '1',
    '7 CHASSIS',
    'ABILITY',
    '<!-- page 11 -->',
    'PLODDER',
    'PATTERN',
    'A slow pattern.',
    'SYSTEMS',
    'Rivet Driver × 2',
    'Loudspeaker',
    'MODULES',
    'Comms Module',
    'Advanced Signal',
    'Booster',
    'A quick pattern.',
    'SYSTEMS',
    'Mech Melee Arma-',
    'ment (Iron Spear)',
    'Loudspeakers',
    'Hover Skids',
    'MODULES',
    'Comms Module',
    'Rivet Driver',
    '<!-- page 20 -->',
    '20 T1 Tech Level 1 Slots Required 1 Salvage Value',
    'TECH 2 Rivet Driver',
    'Range: Close // Damage: 3 SP // Ballistic //',
    'Hot (2)',
    'Bolts things together.',
    '2EP Patch',
    'Range: Close //Turn Action',
    'You restore SP.',
    'T2',
    '3',
    '2 Loudspeakers',
    'Free Action // Range: Medium //',
    'Recommended System',
    'Loud.',
    'T1',
    '1',
    '1',
    '<!-- page 21 -->',
    'Mech Melee Armament',
    'Range: Close // Melee',
    'Hits things.',
    'T3',
    '4',
    '9',
    'Skids for hovering.',
    'T4',
    '5',
    '4',
    'Hover Skids',
    'Passive',
    'TECH 5',
    '<!-- page 40 -->',
    'A small drone.',
    'Hover Skids',
    'Rivet Driver x 2',
    'Range: Close // Damage: 3 SP',
    'Gnat Drone',
    'SP 2',
    'T1',
    '1',
    '<!-- page 41 -->',
    'Thug',
    'A bruiser.',
    'Bash',
    'Range: Close // Damage: 2 HP',
    'Pockets',
    'HP 3',
  ].join('\n')
)

const ctx = statContext(PAGES, DATA)
const verdict = (k: string) => statVerdict(ctx, byKey(k))

describe('Core Book extractors', () => {
  test('read every block the fixture prints, verbatim', () => {
    for (const k of [
      'chassis.json#ch-1@stat',
      'chassis.json#ch-1.patterns[0]@stat',
      'systems.json#sys-1@stat',
      'systems.json#sys-1.actions[0]@stat',
      'systems.json#sys-1.actions[1]@stat',
      'systems.json#sys-2@stat',
      'systems.json#sys-2.actions[0]@stat',
      'systems.json#sys-3.actions[0]@stat',
      'systems.json#sys-4@stat',
      'systems.json#sys-4.actions[0]@stat',
      'drones.json#dr-1@stat',
      'npcs.json#npc-1@stat',
      'npcs.json#npc-1.actions[0]@stat',
      'abilities.json#ab-1.actions[0]@stat',
      'abilities.json#ab-2.actions[0]@stat',
    ])
      expect([k, verdict(k)]).toMatchObject([k, { verdict: 'verbatim' }])
  })

  test('a number that differs is a stat-mismatch, with both sides in the diff', () => {
    expect(verdict('systems.json#sys-3@stat')).toEqual({
      item: byKey('systems.json#sys-3@stat'),
      verdict: 'unverified',
      reason: 'stat-mismatch',
      diff: 'SV: data[3] book[9]',
    })
  })

  test("an NPC's damage track is held too: data SP where the book prints HP is a stat-mismatch", () => {
    const [sp] = collectStats(
      fixture({
        'npcs.json': [
          { id: 'npc-sp', name: 'Thug', source: CORE, page: 41, hitPoints: 3, damageType: 'SP' },
        ],
      })
    )
    if (!sp) throw new Error('no stat block for npc-sp')
    expect(sp.text).toBe('SP: 3')
    expect(statVerdict(ctx, sp)).toMatchObject({
      verdict: 'unverified',
      reason: 'stat-mismatch',
      diff: 'SP: data[3] book[HP 3]',
    })
  })

  test('a pattern list that differs is a stat-mismatch; its modules end at the first non-module', () => {
    expect(verdict('chassis.json#ch-1.patterns[1]@stat')).toMatchObject({
      reason: 'stat-mismatch',
      diff: 'Systems: data[Mech Melee Armament, Loudspeakers] book[Mech Melee Armament (Iron Spear), Loudspeakers, Hover Skids]',
    })
  })

  test('a block the extractor cannot find is no-match', () => {
    expect(verdict('modules.json#mod-1@stat')).toMatchObject({
      verdict: 'unverified',
      reason: 'no-match',
    })
  })

  test('a block cited outside the Core Book, or with no book at hand, is unverified-source', () => {
    expect(verdict('chassis.json#ch-1.patterns[2]@stat').verdict).toBe('unverified-source')
    expect(verdict('squads.json#sq-1@stat').verdict).toBe('unverified-source')
    const item: StatItem = byKey('chassis.json#ch-1@stat')
    expect(statVerdict(undefined, item).verdict).toBe('unverified-source')
  })
})
