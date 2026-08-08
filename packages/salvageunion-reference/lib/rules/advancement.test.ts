/**
 * Unit tests for advancement.ts — pilot class advancement (Core Book pp. 22-23,
 * 26, 224, 321).
 *
 * Uses REAL data from salvageunion-reference, because the whole point of this
 * module is that the ring is DERIVED rather than stored: a test over fixtures
 * would verify the derivation against itself. Every edge below is checked
 * against the published book text, so if a data edit ever breaks the derivation
 * these fail rather than silently returning an empty option list.
 *
 * No `preload()` here on purpose — `test/reference-preload.ts` already loads the
 * whole dataset for this workspace.
 */
import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from '../index.js'
import type { SURefAbility, SURefClass } from '../schemas/index.js'
import type { AdvancementDataset } from './advancement.js'
import {
  advancementOptionsFor,
  gateTreeFor,
  hybridGrantedTrees,
  inferOriginClass,
  originsForHybrid,
  resolveAdvancementTrees,
} from './advancement.js'

const data: AdvancementDataset = {
  classes: (SalvageUnionReference.Classes.all() as SURefClass[]).map((c) => ({
    name: c.name,
    coreTrees: 'coreTrees' in c ? c.coreTrees : undefined,
    advancedTree: 'advancedTree' in c ? c.advancedTree : undefined,
    legendaryTree: 'legendaryTree' in c ? c.legendaryTree : undefined,
    hybrid: 'hybrid' in c ? c.hybrid : undefined,
    advanceable: 'advanceable' in c ? c.advanceable : undefined,
  })),
  requirements: SalvageUnionReference.AbilityTreeRequirements.all().map((r) => ({
    name: r.name,
    requirement: r.requirement,
  })),
}

/** The ring, straight from the book. Each hybrid bridges two Core classes. */
const RING: ReadonlyArray<{
  hybrid: string
  edges: ReadonlyArray<{ origin: string; gate: string; granted: string; sealed: string[] }>
}> = [
  {
    hybrid: 'Fabricator',
    edges: [
      {
        origin: 'Engineer',
        gate: 'Forging',
        granted: 'Electronics',
        sealed: ['Mechanical Knowledge', 'Mech-Tech'],
      },
      {
        origin: 'Hacker',
        gate: 'Electronics',
        granted: 'Forging',
        sealed: ['Hacking', 'Augmentation'],
      },
    ],
  },
  {
    hybrid: 'Cyborg',
    edges: [
      {
        origin: 'Hacker',
        gate: 'Augmentation',
        granted: 'Gladiatorial Combat',
        sealed: ['Hacking', 'Electronics'],
      },
      {
        origin: 'Soldier',
        gate: 'Gladiatorial Combat',
        granted: 'Augmentation',
        sealed: ['Survivalist', 'Tactical Warfare'],
      },
    ],
  },
  {
    hybrid: 'Ranger',
    edges: [
      {
        origin: 'Soldier',
        gate: 'Survivalist',
        granted: 'Sniper',
        sealed: ['Gladiatorial Combat', 'Tactical Warfare'],
      },
      { origin: 'Scout', gate: 'Sniper', granted: 'Survivalist', sealed: ['Recon', 'Sleuth'] },
    ],
  },
  {
    hybrid: 'Smuggler',
    edges: [
      { origin: 'Scout', gate: 'Sleuth', granted: 'Salvaging', sealed: ['Recon', 'Sniper'] },
      { origin: 'Hauler', gate: 'Salvaging', granted: 'Sleuth', sealed: ['Trading', 'Leadership'] },
    ],
  },
  {
    hybrid: 'Union Rep',
    edges: [
      {
        origin: 'Hauler',
        gate: 'Leadership',
        granted: 'Mechanical Knowledge',
        sealed: ['Salvaging', 'Trading'],
      },
      {
        origin: 'Engineer',
        gate: 'Mechanical Knowledge',
        granted: 'Leadership',
        sealed: ['Forging', 'Mech-Tech'],
      },
    ],
  },
]

describe('the advancement ring', () => {
  it('has exactly five hybrids, each reachable from exactly two Core classes', () => {
    const hybrids = data.classes.filter((c) => c.hybrid === true).map((c) => c.name)
    expect(hybrids.sort()).toEqual(['Cyborg', 'Fabricator', 'Ranger', 'Smuggler', 'Union Rep'])
    for (const { hybrid, edges } of RING) {
      expect(originsForHybrid(data, hybrid).slice().sort()).toEqual(
        edges.map((e) => e.origin).sort()
      )
    }
  })

  it('gates each edge on the tree the origin contributes', () => {
    for (const { hybrid, edges } of RING) {
      for (const { origin, gate } of edges) {
        expect(gateTreeFor(data, origin, hybrid)).toBe(gate)
      }
    }
  })

  it('confers the same trees whichever end you came from', () => {
    for (const { hybrid, edges } of RING) {
      const granted = hybridGrantedTrees(data, hybrid).slice().sort()
      expect(granted).toContain(hybrid)
      for (const { gate, granted: gained } of edges) {
        expect(granted).toContain(gate)
        expect(granted).toContain(gained)
      }
    }
  })

  it('excludes the Salvager, which owns every tree but cannot advance', () => {
    const salvager = data.classes.find((c) => c.name === 'Salvager')
    expect(salvager?.advanceable).toBe(false)
    expect(salvager?.coreTrees).toHaveLength(15)
    for (const { hybrid } of RING) {
      expect(originsForHybrid(data, hybrid)).not.toContain('Salvager')
    }
    expect(advancementOptionsFor(data, 'Salvager')).toEqual([])
  })
})

describe('advancementOptionsFor', () => {
  it('offers every advanceable Core class exactly three destinations', () => {
    for (const name of ['Engineer', 'Hacker', 'Hauler', 'Scout', 'Soldier']) {
      const options = advancementOptionsFor(data, name)
      expect(options).toHaveLength(3)
      expect(options.filter((o) => o.kind === 'advanced')).toHaveLength(1)
      expect(options.filter((o) => o.kind === 'hybrid')).toHaveLength(2)
    }
  })

  it('gates the Advanced tree on the class’s remaining "inner" tree', () => {
    // Engineer reaches Fabricator via Forging and Union Rep via Mechanical
    // Knowledge, so the tree left over — Mech-Tech — is what specialising costs.
    const advanced = advancementOptionsFor(data, 'Engineer').find((o) => o.kind === 'advanced')
    expect(advanced?.name).toBe('Advanced Engineer')
    expect(advanced?.gateTree).toBe('Mech-Tech')
  })

  it('seals nothing when specialising — every core tree stays open', () => {
    for (const name of ['Engineer', 'Hacker', 'Hauler', 'Scout', 'Soldier']) {
      const advanced = advancementOptionsFor(data, name).find((o) => o.kind === 'advanced')
      expect(advanced?.sealedTrees).toEqual([])
    }
  })

  it('seals exactly the two core trees a hybrid cannot reach', () => {
    for (const { hybrid, edges } of RING) {
      for (const { origin, sealed } of edges) {
        const option = advancementOptionsFor(data, origin).find((o) => o.name === hybrid)
        expect(option?.sealedTrees.slice().sort()).toEqual(sealed.slice().sort())
      }
    }
  })
})

describe('resolveAdvancementTrees', () => {
  it('keeps one, gains one, seals two — from either end of every edge', () => {
    for (const { hybrid, edges } of RING) {
      for (const { origin, gate, granted, sealed } of edges) {
        const trees = resolveAdvancementTrees(data, origin, hybrid)
        expect(trees.originUnresolved).toBe(false)
        expect(trees.gate).toBe(gate)
        expect(trees.open).toContain(gate) // kept
        expect(trees.open).toContain(granted) // gained
        expect(trees.open).toContain(hybrid)
        expect(trees.sealed.slice().sort()).toEqual(sealed.slice().sort()) // sealed
        expect(trees.sealed).toHaveLength(2)
      }
    }
  })

  it('leaves every core tree open for a pilot who has not advanced', () => {
    const trees = resolveAdvancementTrees(data, undefined, 'Hacker')
    expect(trees.sealed).toEqual([])
    expect(trees.open).toEqual([
      'Hacking',
      'Electronics',
      'Augmentation',
      'Advanced Hacking',
      'Legendary Hacker',
    ])
  })

  it('seals NOTHING when the origin is unknown, rather than guessing a pair', () => {
    const trees = resolveAdvancementTrees(data, undefined, 'Cyborg')
    expect(trees.originUnresolved).toBe(true)
    expect(trees.sealed).toEqual([])
    // The hybrid's own grants are still correct without an origin.
    expect(trees.open.slice().sort()).toEqual(
      ['Augmentation', 'Cyborg', 'Gladiatorial Combat', 'Legendary Cyborg'].sort()
    )
  })

  it('treats an origin that cannot reach the destination as no origin at all', () => {
    // Engineer sits on the far side of the ring from Cyborg.
    const trees = resolveAdvancementTrees(data, 'Engineer', 'Cyborg')
    expect(trees.originUnresolved).toBe(true)
    expect(trees.sealed).toEqual([])
  })
})

describe('inferOriginClass', () => {
  const treesOf = (names: string[]): string[] => {
    const abilities = SalvageUnionReference.Abilities.all() as SURefAbility[]
    return names.map((n) => {
      const a = abilities.find((x) => x.name === n)
      if (a === undefined) throw new Error(`no such ability: ${n}`)
      return a.tree
    })
  }

  it('recovers the origin of any rules-legal pilot, from either end', () => {
    // The guarantee: 6 core abilities = 3 in the gate tree (which the hybrid
    // grants, so it proves nothing) + 3 more that only the origin owns.
    for (const { hybrid, edges } of RING) {
      for (const { origin, gate, sealed } of edges) {
        const held = [gate, gate, gate, ...sealed]
        const result = inferOriginClass(data, hybrid, held)
        expect(result.state).toBe('determined')
        expect(result.origin).toBe(origin)
      }
    }
  })

  it('resolves from a single exclusive ability', () => {
    // One Hacking ability is enough: no Soldier could ever hold it.
    const result = inferOriginClass(data, 'Cyborg', treesOf(['Hacking Kit']))
    expect(result.state).toBe('determined')
    expect(result.origin).toBe('Hacker')
  })

  it('is ambiguous when every held tree is one the hybrid grants anyway', () => {
    // Augmentation and Gladiatorial Combat are both conferred BY Cyborg, so
    // holding them says nothing about which side the pilot came from.
    const result = inferOriginClass(data, 'Cyborg', ['Augmentation', 'Gladiatorial Combat'])
    expect(result.state).toBe('ambiguous')
    expect(result.origin).toBeUndefined()
    expect(result.candidates.slice().sort()).toEqual(['Hacker', 'Soldier'])
  })

  it('is ambiguous for a pilot with no abilities at all', () => {
    expect(inferOriginClass(data, 'Cyborg', []).state).toBe('ambiguous')
  })

  it('is contradictory when both origins are evidenced', () => {
    // Only reachable by free editing — no legal pilot holds both.
    const result = inferOriginClass(data, 'Cyborg', ['Hacking', 'Tactical Warfare'])
    expect(result.state).toBe('contradictory')
    expect(result.origin).toBeUndefined()
  })

  it('reports unexplained trees without letting them override real evidence', () => {
    // A Hacker-turned-Cyborg who free-edited in a Forging ability is still,
    // evidently, a Hacker. The stray tree is surfaced, not weighted.
    const result = inferOriginClass(data, 'Cyborg', ['Hacking', 'Electronics', 'Forging'])
    expect(result.state).toBe('determined')
    expect(result.origin).toBe('Hacker')
    expect(result.unexplainedTrees).toEqual(['Forging'])
  })

  it('returns no candidates for a class that is not a hybrid', () => {
    expect(inferOriginClass(data, 'Hacker', ['Hacking']).candidates).toEqual([])
  })
})

describe('the exclusivity guarantee inference rests on', () => {
  it('gives each hybrid two origins whose remaining core trees are disjoint', () => {
    // If these ever overlap, inferOriginClass silently becomes a coin flip.
    for (const { hybrid } of RING) {
      const granted = hybridGrantedTrees(data, hybrid)
      const exclusive = originsForHybrid(data, hybrid).map((name) =>
        (data.classes.find((c) => c.name === name)?.coreTrees ?? []).filter(
          (t) => !granted.includes(t)
        )
      )
      expect(exclusive).toHaveLength(2)
      const a = exclusive[0] ?? []
      const b = exclusive[1] ?? []
      expect(a.filter((t) => b.includes(t))).toEqual([])
      // Two exclusive trees each is what makes 3 non-gate core picks decisive.
      expect(a).toHaveLength(2)
      expect(b).toHaveLength(2)
    }
  })
})

describe('the class flags are filled, and load-bearing', () => {
  it('states hybrid / advanceable / maxAbilities on every class record', () => {
    // None of these is inferred from absence any more. A missing one is now a
    // parse failure rather than a silent `undefined` that reads as "no".
    // Asserted on the RECORDS, not on `data` — `AdvancementDataset` narrows to
    // the primitives these rules read, and `maxAbilities` is not one of them.
    const records = SalvageUnionReference.Classes.all() as SURefClass[]
    expect(records).toHaveLength(11)
    for (const cls of records) {
      expect(typeof (cls as { hybrid?: unknown }).hybrid).toBe('boolean')
      expect(typeof (cls as { advanceable?: unknown }).advanceable).toBe('boolean')
      expect(typeof (cls as { maxAbilities?: unknown }).maxAbilities).toBe('number')
    }
  })

  it('marks every hybrid as already advanced, so it cannot advance again', () => {
    // "Once a Pilot has chosen their Hybrid Class they cannot advance into any
    // other Hybrid Class or Advanced Tree" (p. 321).
    const records = SalvageUnionReference.Classes.all() as SURefClass[]
    for (const { hybrid } of RING) {
      const cls = records.find((c) => c.name === hybrid) as
        | { hybrid?: boolean; advanceable?: boolean; maxAbilities?: number }
        | undefined
      expect(cls?.hybrid).toBe(true)
      expect(cls?.advanceable).toBe(false)
      expect(cls?.maxAbilities).toBe(10)
    }
  })

  it('keeps the Salvager the only class with a raised cap', () => {
    const raised = (SalvageUnionReference.Classes.all() as SURefClass[])
      .filter((c) => ((c as { maxAbilities?: number }).maxAbilities ?? 0) > 10)
      .map((c) => c.name)
    expect(raised).toEqual(['Salvager'])
  })

  it('leaves advancement reachability unchanged by the fill', () => {
    // `advanceable: false` on hybrids must not make them look like Salvagers to
    // anything deriving the ring — they were never origins to begin with.
    for (const { hybrid, edges } of RING) {
      expect(originsForHybrid(data, hybrid).slice().sort()).toEqual(
        edges.map((e) => e.origin).sort()
      )
    }
  })
})
