/**
 * Unit tests for pilotSnapshot.ts — `enrichPilotSnapshot` (M4, REQ-NF-21).
 *
 * `enrichPilotSnapshot` is the one rule utility in `src/lib/rules/` that lacked
 * a dedicated test file. It resolves a stored `Pilot`-shaped object (string[]
 * ability refs + a class ref) into the `PilotSnapshot` that `evaluateSoftWarnings`
 * consumes: each ability classified into a core/advanced/legendary tier, plus the
 * pilot's class tier / Salvager flag.
 *
 * These tests run against REAL salvageunion-reference data (preloading
 * 'abilities' + 'classes', mirroring derivedStats.test.ts) so the tier
 * classification is pinned to the shipped dataset, not a hand-rolled fixture.
 *
 * Rules pinned (Salvage Union Core Book Digital Edition 2.0a, p.23 "Gaining
 * Abilities"): Core Abilities sit in a class's Core trees; Advanced/Hybrid
 * Abilities sit in an Advanced/Hybrid tree; Legendary Abilities sit in a
 * Legendary tree (and are always level 'L'). The Salvager (p.44) is the only
 * class drawing from Core trees alone with a 12-ability cap.
 */
import { beforeAll, describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { enrichPilotSnapshot } from '../pilotSnapshot'

beforeAll(async () => {
  await SalvageUnionReference.preload(['abilities', 'classes'])
})

// ---------------------------------------------------------------------------
// Known reference data (verified against abilities.json / classes.json):
//   "Jury Rig"        — Forging tree, level 1            → tier 'core'
//   "Union Engineer"  — Advanced Engineer tree, level 1 → tier 'advanced'
//   "Tip Top Shape"   — Legendary Engineer tree, level L → tier 'legendary'
//   "Area Salvage"    — Generic tree, level 'G'          → tier undefined
//   Engineer  — core class (coreTrees present)           → classTier 'base'
//   Cyborg    — Hybrid specialisation (no coreTrees)     → 'advanced-hybrid'
//   Salvager  — core trees only, 12-ability cap          → isSalvager true
// ---------------------------------------------------------------------------

describe('enrichPilotSnapshot — ability tier classification', () => {
  it('classifies a Core-tree ability (Forging) as tier "core"', () => {
    const snap = enrichPilotSnapshot({ abilities: ['Jury Rig'] })
    expect(snap.abilities).toHaveLength(1)
    expect(snap.abilities[0]).toMatchObject({
      ref: 'Jury Rig',
      name: 'Jury Rig',
      tree: 'Forging',
      level: 1,
      tier: 'core',
    })
  })

  it('classifies an Advanced-tree ability (Advanced Engineer) as tier "advanced"', () => {
    const snap = enrichPilotSnapshot({ abilities: ['Union Engineer'] })
    expect(snap.abilities[0]).toMatchObject({
      ref: 'Union Engineer',
      tree: 'Advanced Engineer',
      tier: 'advanced',
    })
  })

  it('classifies a level-"L" ability as "legendary" (regardless of tree lookup)', () => {
    const snap = enrichPilotSnapshot({ abilities: ['Tip Top Shape'] })
    expect(snap.abilities[0]).toMatchObject({
      ref: 'Tip Top Shape',
      level: 'L',
      tier: 'legendary',
    })
  })

  it('leaves tier undefined for an ability whose tree is unclassified (Generic, level "G")', () => {
    const snap = enrichPilotSnapshot({ abilities: ['Area Salvage'] })
    expect(snap.abilities[0]?.ref).toBe('Area Salvage')
    expect(snap.abilities[0]?.level).toBe('G')
    expect(snap.abilities[0]?.tier).toBeUndefined()
  })

  it('resolves an ability by id as well as by name', () => {
    const jr = SalvageUnionReference.Abilities.find((a) => a.name === 'Jury Rig')
    expect(jr).toBeDefined()
    if (!jr) return
    const snap = enrichPilotSnapshot({ abilities: [jr.id] })
    expect(snap.abilities[0]).toMatchObject({
      ref: jr.id,
      name: 'Jury Rig',
      tier: 'core',
    })
  })
})

describe('enrichPilotSnapshot — unknown ability refs', () => {
  it('survives an unknown ref as a bare { ref } with no fabricated tier', () => {
    const snap = enrichPilotSnapshot({ abilities: ['not-a-real-ability'] })
    expect(snap.abilities).toHaveLength(1)
    expect(snap.abilities[0]).toEqual({ ref: 'not-a-real-ability' })
    expect(snap.abilities[0]?.tier).toBeUndefined()
    expect(snap.abilities[0]?.tree).toBeUndefined()
  })

  it('preserves order and mixes known + unknown refs without dropping either', () => {
    const snap = enrichPilotSnapshot({
      abilities: ['Jury Rig', 'phantom-slug', 'Union Engineer'],
    })
    expect(snap.abilities.map((a) => a.ref)).toEqual(['Jury Rig', 'phantom-slug', 'Union Engineer'])
    expect(snap.abilities[0]?.tier).toBe('core')
    expect(snap.abilities[1]?.tier).toBeUndefined()
    expect(snap.abilities[2]?.tier).toBe('advanced')
  })
})

describe('enrichPilotSnapshot — class resolution', () => {
  it('resolves a class by id', () => {
    const cls = SalvageUnionReference.Classes.find((c) => c.name === 'Engineer')
    expect(cls).toBeDefined()
    if (!cls) return
    const snap = enrichPilotSnapshot({ abilities: [], classRef: cls.id })
    expect(snap.className).toBe('Engineer')
    expect(snap.classTier).toBe('base')
  })

  it('resolves a class by exact name', () => {
    const snap = enrichPilotSnapshot({ abilities: [], classRef: 'Engineer' })
    expect(snap.className).toBe('Engineer')
    expect(snap.classTier).toBe('base')
  })

  it('resolves a class by case-insensitive name', () => {
    const snap = enrichPilotSnapshot({ abilities: [], classRef: 'eNgInEeR' })
    expect(snap.className).toBe('Engineer')
    expect(snap.classTier).toBe('base')
  })
})

describe('enrichPilotSnapshot — class tier and Salvager flag', () => {
  it('classTier "base" for a core class with coreTrees (Engineer)', () => {
    const snap = enrichPilotSnapshot({ abilities: [], classRef: 'Engineer' })
    expect(snap.classTier).toBe('base')
    expect(snap.isSalvager).toBeUndefined()
  })

  it('classTier "advanced-hybrid" for a specialisation class (Cyborg, no coreTrees)', () => {
    const snap = enrichPilotSnapshot({ abilities: [], classRef: 'Cyborg' })
    expect(snap.classTier).toBe('advanced-hybrid')
    expect(snap.className).toBe('Cyborg')
    expect(snap.isSalvager).toBeUndefined()
  })

  it('classTier undefined when the class cannot be resolved', () => {
    const snap = enrichPilotSnapshot({ abilities: [], classRef: 'no-such-class' })
    expect(snap.classTier).toBeUndefined()
    expect(snap.className).toBeUndefined()
    expect(snap.isSalvager).toBeUndefined()
  })

  it('isSalvager only set for the Salvager class (core trees only, 12-cap — p.44)', () => {
    const salvager = enrichPilotSnapshot({ abilities: [], classRef: 'Salvager' })
    expect(salvager.isSalvager).toBe(true)
    // Salvager DOES carry coreTrees in the dataset, so it classifies as 'base'.
    expect(salvager.classTier).toBe('base')

    const engineer = enrichPilotSnapshot({ abilities: [], classRef: 'Engineer' })
    expect(engineer.isSalvager).toBeUndefined()
  })
})

describe('enrichPilotSnapshot — empty / missing inputs', () => {
  it('empty abilities + missing classRef yields an empty, unclassified snapshot', () => {
    const snap = enrichPilotSnapshot({ abilities: [] })
    expect(snap.abilities).toEqual([])
    expect(snap.classTier).toBeUndefined()
    expect(snap.className).toBeUndefined()
    expect(snap.isSalvager).toBeUndefined()
  })

  it('abilities resolve even when classRef is absent', () => {
    const snap = enrichPilotSnapshot({ abilities: ['Jury Rig'] })
    expect(snap.abilities[0]?.tier).toBe('core')
    expect(snap.classTier).toBeUndefined()
  })
})
