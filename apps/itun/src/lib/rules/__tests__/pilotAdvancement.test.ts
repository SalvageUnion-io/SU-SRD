/**
 * Tests for pilotAdvancement.ts — resolving where a pilot sits on the ring.
 *
 * Real reference data throughout (the preload layer loads it): the derivation
 * is the thing under test, so fixtures would only check it against itself.
 */
import { describe, expect, it } from 'bun:test'
import type { SURefAbility, SURefClass } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolvePilotAdvancement } from '../pilotAdvancement'

const classId = (name: string): string => {
  const cls = (SalvageUnionReference.Classes.all() as SURefClass[]).find((c) => c.name === name)
  if (cls === undefined) throw new Error(`no such class: ${name}`)
  return cls.id
}

/** Ability ids for every ability in the given trees — how a real pilot reads. */
const abilitiesIn = (...trees: string[]): string[] =>
  (SalvageUnionReference.Abilities.all() as SURefAbility[])
    .filter((a) => trees.includes(a.tree))
    .map((a) => a.id)

describe('a pilot who has not advanced', () => {
  it('has every core tree open and nothing sealed', () => {
    const result = resolvePilotAdvancement({
      classRef: classId('Hacker'),
      abilities: abilitiesIn('Hacking'),
    })
    expect(result.isHybrid).toBe(false)
    expect(result.originState).toBe('not-hybrid')
    expect(result.sealed).toEqual([])
    expect(result.open).toContain('Hacking')
    expect(result.open).toContain('Advanced Hacking')
    expect(result.open).toContain('Legendary Hacker')
  })

  it('gives the Salvager all fifteen trees and no advancement', () => {
    const result = resolvePilotAdvancement({ classRef: classId('Salvager'), abilities: [] })
    expect(result.open).toHaveLength(15)
    expect(result.sealed).toEqual([])
    expect(result.isHybrid).toBe(false)
  })
})

describe('a hybrid pilot whose origin can be derived', () => {
  it('recovers the origin from held trees, with nothing stored', () => {
    // A rules-legal Hacker→Cyborg: 3 Augmentation (the gate) + 3 more that
    // only a Hacker could hold.
    const result = resolvePilotAdvancement({
      classRef: classId('Cyborg'),
      abilities: abilitiesIn('Augmentation', 'Hacking'),
    })
    expect(result.isHybrid).toBe(true)
    expect(result.origin).toBe('Hacker')
    expect(result.originSource).toBe('inferred')
    expect(result.originState).toBe('determined')
    expect(result.gate).toBe('Augmentation')
  })

  it('keeps one tree, gains one, and seals two', () => {
    const result = resolvePilotAdvancement({
      classRef: classId('Cyborg'),
      abilities: abilitiesIn('Augmentation', 'Hacking'),
    })
    expect(result.open).toContain('Augmentation') // kept
    expect(result.open).toContain('Gladiatorial Combat') // gained, Soldier's
    expect(result.open).toContain('Cyborg')
    expect(result.sealed.slice().sort()).toEqual(['Electronics', 'Hacking'])
  })

  it('reaches the same hybrid from the other end and seals the other pair', () => {
    const result = resolvePilotAdvancement({
      classRef: classId('Cyborg'),
      abilities: abilitiesIn('Gladiatorial Combat', 'Survivalist'),
    })
    expect(result.origin).toBe('Soldier')
    expect(result.sealed.slice().sort()).toEqual(['Survivalist', 'Tactical Warfare'])
  })

  it('still shows a sealed tree the pilot holds abilities in', () => {
    // Sealed is never "taken away" — the sheet must keep rendering these.
    const result = resolvePilotAdvancement({
      classRef: classId('Cyborg'),
      abilities: abilitiesIn('Augmentation', 'Hacking'),
    })
    expect(result.sealed).toContain('Hacking')
  })
})

describe('a stored origin overrides derivation', () => {
  it('wins even when the held trees would say otherwise', () => {
    const result = resolvePilotAdvancement({
      classRef: classId('Cyborg'),
      abilities: abilitiesIn('Hacking'), // evidence says Hacker
      originClassRef: classId('Soldier'), // the player said Soldier
    })
    expect(result.origin).toBe('Soldier')
    expect(result.originSource).toBe('stored')
    expect(result.sealed.slice().sort()).toEqual(['Survivalist', 'Tactical Warfare'])
  })

  it('is ignored when it names a class that cannot reach the hybrid', () => {
    const result = resolvePilotAdvancement({
      classRef: classId('Cyborg'),
      abilities: [],
      originClassRef: classId('Engineer'), // nowhere near Cyborg on the ring
    })
    expect(result.originSource).toBe('unresolved')
    expect(result.sealed).toEqual([])
  })
})

describe('a hybrid pilot whose origin cannot be derived', () => {
  it('seals nothing for a pilot with no abilities', () => {
    const result = resolvePilotAdvancement({ classRef: classId('Cyborg'), abilities: [] })
    expect(result.originState).toBe('ambiguous')
    expect(result.originSource).toBe('unresolved')
    expect(result.sealed).toEqual([])
    // The hybrid's own grants are still right without an origin.
    expect(result.open).toContain('Gladiatorial Combat')
    expect(result.candidates.slice().sort()).toEqual(['Hacker', 'Soldier'])
  })

  it('seals nothing when only granted trees are held', () => {
    const result = resolvePilotAdvancement({
      classRef: classId('Cyborg'),
      abilities: abilitiesIn('Augmentation', 'Gladiatorial Combat'),
    })
    expect(result.originState).toBe('ambiguous')
    expect(result.sealed).toEqual([])
  })

  it('seals nothing when the trees point two ways at once', () => {
    // Free-edit only: no legal pilot holds both sides.
    const result = resolvePilotAdvancement({
      classRef: classId('Cyborg'),
      abilities: abilitiesIn('Hacking', 'Tactical Warfare'),
    })
    expect(result.originState).toBe('contradictory')
    expect(result.originSource).toBe('unresolved')
    expect(result.sealed).toEqual([])
  })

  it('reports a stray tree without letting it override real evidence', () => {
    const result = resolvePilotAdvancement({
      classRef: classId('Cyborg'),
      abilities: abilitiesIn('Hacking', 'Forging'),
    })
    expect(result.origin).toBe('Hacker')
    expect(result.unexplainedTrees).toEqual(['Forging'])
  })
})

describe('an unresolvable class', () => {
  it('degrades to nothing rather than throwing', () => {
    const result = resolvePilotAdvancement({ classRef: 'not-a-class', abilities: [] })
    expect(result.className).toBeUndefined()
    expect(result.open).toEqual([])
    expect(result.sealed).toEqual([])
  })
})
