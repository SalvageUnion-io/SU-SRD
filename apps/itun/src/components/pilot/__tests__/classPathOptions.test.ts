/**
 * Tests for classPathOptions.ts — how the Change Class picker is shaped and
 * what it promises before you confirm.
 */
import { describe, expect, it } from 'bun:test'
import type { SURefClass } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { classChangePatch, classPathConsequence, classPathGroups } from '../classPathOptions'

const all = () => SalvageUnionReference.Classes.all() as SURefClass[]
const idOf = (name: string): string => {
  const cls = all().find((c) => c.name === name)
  if (cls === undefined) throw new Error(`no such class: ${name}`)
  return cls.id
}
const namesIn = (kind: string, groups: ReturnType<typeof classPathGroups>): string[] =>
  groups.find((g) => g.kind === kind)?.options.map((o) => o.cls.name) ?? []

describe('classPathGroups', () => {
  it('leads with the two hybrids this pilot can actually reach', () => {
    const groups = classPathGroups(all(), idOf('Hacker'))
    expect(groups[0]?.kind).toBe('reachable')
    expect(groups[0]?.label).toBe('From Hacker')
    expect(namesIn('reachable', groups).sort()).toEqual(['Cyborg', 'Fabricator'])
  })

  it('names the gate tree on each reachable destination', () => {
    const groups = classPathGroups(all(), idOf('Hacker'))
    const cyborg = groups[0]?.options.find((o) => o.cls.name === 'Cyborg')
    expect(cyborg?.note).toBe('via Augmentation')
  })

  it('still offers the other three hybrids, demoted rather than withheld', () => {
    const groups = classPathGroups(all(), idOf('Hacker'))
    expect(namesIn('off-ring', groups).sort()).toEqual(['Ranger', 'Smuggler', 'Union Rep'])
    expect(groups.find((g) => g.kind === 'off-ring')?.options[0]?.note).toBe('asks origin')
  })

  it('offers every Core class as a re-home, marking the current one', () => {
    const groups = classPathGroups(all(), idOf('Hacker'))
    expect(namesIn('core', groups)).toHaveLength(6)
    const current = groups.find((g) => g.kind === 'core')?.options.filter((o) => o.current)
    expect(current?.map((o) => o.cls.name)).toEqual(['Hacker'])
  })

  it('offers a Salvager no reachable group at all', () => {
    const groups = classPathGroups(all(), idOf('Salvager'))
    expect(groups.some((g) => g.kind === 'reachable')).toBe(false)
    expect(namesIn('core', groups)).toHaveLength(6)
  })

  it('offers a pilot who has already advanced no reachable group', () => {
    // The choice has been made; every hybrid is off-ring from here.
    const groups = classPathGroups(all(), idOf('Cyborg'))
    expect(groups.some((g) => g.kind === 'reachable')).toBe(false)
    expect(namesIn('off-ring', groups)).toHaveLength(5)
  })
})

describe('classPathConsequence', () => {
  it('titles the transition, not the destination', () => {
    const c = classPathConsequence(all(), idOf('Hacker'), idOf('Cyborg'))
    expect(c?.title).toBe('Hacker → Cyborg')
  })

  it('names what opens, including the tree borrowed from the neighbour', () => {
    const c = classPathConsequence(all(), idOf('Hacker'), idOf('Cyborg'))
    expect(c?.gain).toContain('Cyborg')
    expect(c?.gain).toContain('Gladiatorial Combat')
  })

  it('names the paths foreclosed and the trees sealed', () => {
    const c = classPathConsequence(all(), idOf('Hacker'), idOf('Cyborg'))
    expect(c?.lose).toContain('Advanced Hacking — forever')
    expect(c?.lose).toContain('Fabricator — forever')
    expect(c?.lose.some((l) => l.includes('Hacking and Electronics seal'))).toBe(true)
  })

  it('always leads KEEP with the retained abilities', () => {
    const c = classPathConsequence(all(), idOf('Hacker'), idOf('Cyborg'))
    expect(c?.keep[0]).toBe('Every ability already learned, permanently')
    expect(c?.keep).toContain('Augmentation stays open')
  })

  it('implies the origin from the current class, asking nothing', () => {
    const c = classPathConsequence(all(), idOf('Hacker'), idOf('Cyborg'))
    expect(c?.impliedOrigin).toBe('Hacker')
    expect(c?.needsOrigin).toBe(false)
  })

  it('asks for an origin when the hybrid is off this pilot’s ring', () => {
    const c = classPathConsequence(all(), idOf('Hacker'), idOf('Union Rep'))
    expect(c?.needsOrigin).toBe(true)
    expect(c?.impliedOrigin).toBeUndefined()
    expect(c?.originChoices.slice().sort()).toEqual(['Engineer', 'Hauler'])
    // With no origin, nothing is promised as sealed.
    expect(c?.lose.some((l) => l.includes('seal'))).toBe(false)
  })

  it('seals the other pair when reached from the other end', () => {
    const c = classPathConsequence(all(), idOf('Soldier'), idOf('Cyborg'))
    expect(c?.title).toBe('Soldier → Cyborg')
    expect(c?.lose.some((l) => l.includes('Survivalist and Tactical Warfare seal'))).toBe(true)
  })

  it('promises no losses for a plain Core class', () => {
    const c = classPathConsequence(all(), idOf('Cyborg'), idOf('Hacker'))
    expect(c?.lose).toEqual([])
    expect(c?.needsOrigin).toBe(false)
  })
})

describe('classChangePatch', () => {
  it('writes class and origin together in one patch', () => {
    const patch = classChangePatch(all(), idOf('Cyborg'), idOf('Hacker'))
    expect(patch.classRef).toBe(idOf('Cyborg'))
    expect(patch.originClassRef).toBe(idOf('Hacker'))
  })

  it('leaves the origin unset when it can be derived', () => {
    // No answer given: derivation covers it, so nothing is stored.
    const patch = classChangePatch(all(), idOf('Cyborg'), undefined)
    expect(patch.originClassRef).toBeUndefined()
  })

  it('clears the origin when moving to a Core class', () => {
    const patch = classChangePatch(all(), idOf('Hacker'), idOf('Soldier'))
    expect(patch.originClassRef).toBeUndefined()
  })
})
