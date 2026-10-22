/**
 * Unit tests for `offeredAbilityTrees` — the trees a class's ability picker
 * offers. Real data, preloaded by `tools/testPreload.ts`.
 */
import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from '../../index'
import type { RefClass } from '../../schemas/index'
import { offeredAbilityTrees, toAdvancementClass } from '../advancementDataset'

function cls(name: string) {
  const found = SalvageUnionReference.Classes.getByName(name)
  if (found === undefined) throw new Error(`no class ${name}`)
  return toAdvancementClass(found as RefClass)
}

describe('offeredAbilityTrees', () => {
  it('a Core class offers its core, Advanced and Legendary trees', () => {
    expect(offeredAbilityTrees(cls('Scout'), { allLevels: true })).toEqual([
      'Recon',
      'Sleuth',
      'Sniper',
      'Advanced Scout',
      'Legendary Scout',
    ])
  })

  it("a hybrid with no recorded origin offers both origins' core trees (Survey Drone is Recon)", () => {
    const trees = offeredAbilityTrees(cls('Ranger'), { allLevels: true })
    // The hybrid's own four trees come first.
    expect(trees.slice(0, 4)).toEqual(['Survivalist', 'Sniper', 'Ranger', 'Legendary Ranger'])
    // Scout's and Soldier's core trees, the two classes that reach Ranger.
    for (const tree of ['Recon', 'Sleuth', 'Gladiatorial Combat', 'Tactical Warfare']) {
      expect(trees).toContain(tree)
    }
    // Not a tree of any class that can reach Ranger.
    expect(trees).not.toContain('Hacking')
  })

  it("a hybrid with a recorded origin offers only that origin's core trees", () => {
    const trees = offeredAbilityTrees(cls('Ranger'), { allLevels: true, originName: 'Scout' })
    expect(trees).toEqual([
      'Survivalist',
      'Sniper',
      'Ranger',
      'Legendary Ranger',
      'Recon',
      'Sleuth',
    ])
  })

  it('an origin that cannot reach the hybrid is ignored rather than trusted', () => {
    expect(offeredAbilityTrees(cls('Ranger'), { allLevels: true, originName: 'Hacker' })).toEqual(
      offeredAbilityTrees(cls('Ranger'), { allLevels: true })
    )
  })

  it('the creation pool (allLevels: false) still offers a hybrid nothing', () => {
    expect(offeredAbilityTrees(cls('Ranger'), { allLevels: false })).toEqual([])
  })

  it('already-selected trees stay offered', () => {
    expect(
      offeredAbilityTrees(cls('Fabricator'), {
        allLevels: true,
        originName: 'Engineer',
        selectedTrees: ['Recon'],
      })
    ).toContain('Recon')
  })
})
