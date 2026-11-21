import { describe, expect, test } from 'bun:test'
import { nameToSlug } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { mechPatternStamp } from '../bandStamps.model'

const none = () => undefined

describe('mechPatternStamp', () => {
  test('a saved pattern: its name, linked to its page', () => {
    expect(
      mechPatternStamp({ chassisRef: 'mule', sourcePattern: 'p1' }, (id) =>
        id === 'p1' ? 'Nimble Hauler' : undefined
      )
    ).toEqual({ name: 'Nimble Hauler', href: '/p/pattern/p1' })
  })

  test('a saved pattern this browser does not hold still links', () => {
    expect(mechPatternStamp({ chassisRef: 'mule', sourcePattern: 'p1' }, none)?.href).toBe(
      '/p/pattern/p1'
    )
  })

  test('a book pattern: its name, linked under its chassis', () => {
    const chassis = resolveChassisRef('mule')
    const pattern = chassis?.patterns?.[0]
    if (!chassis || !pattern) throw new Error('the Mule has a pattern')
    const stamp = mechPatternStamp(
      { chassisRef: 'mule', startingPatternRef: nameToSlug(pattern.name) },
      none
    )
    expect(stamp?.name).toBe(pattern.name)
    // A Reference page, never an app route: the router would put it under /build.
    expect(stamp?.href).toBeUndefined()
    expect(stamp?.page).toBe(`/chassis/mule/pattern/${nameToSlug(pattern.name)}/`)
  })

  // PT-13: the chip went stale. It named the pattern, and linked its page,
  // after the loadout had changed and after the chassis had.
  describe('once the mech has moved on from its pattern', () => {
    const chassis = resolveChassisRef('mule')
    const pattern = chassis?.patterns?.[0]
    if (!chassis || !pattern) throw new Error('the Mule has a pattern')
    const ref = nameToSlug(pattern.name)
    const slugs = (items: readonly { name: string; count?: number }[]) =>
      items.flatMap((i) => new Array<string>(i.count ?? 1).fill(nameToSlug(i.name)))
    const asBuilt = { systems: slugs(pattern.systems), modules: slugs(pattern.modules) }

    test('a book pattern’s own loadout, in any order, is still the pattern', () => {
      const stamp = mechPatternStamp(
        {
          chassisRef: 'mule',
          startingPatternRef: ref,
          systems: [...asBuilt.systems].reverse(),
          modules: asBuilt.modules,
        },
        none
      )
      expect(stamp?.changed).toBeUndefined()
    })

    test('a changed loadout reads "Based on"', () => {
      const stamp = mechPatternStamp(
        {
          chassisRef: 'mule',
          startingPatternRef: ref,
          systems: [...asBuilt.systems, 'red-laser'],
          modules: asBuilt.modules,
        },
        none
      )
      expect(stamp).toMatchObject({ name: pattern.name, changed: true })
    })

    test('another chassis has no such pattern, so it says nothing', () => {
      const other = mechPatternStamp(
        { chassisRef: 'scrapper', startingPatternRef: ref, systems: [], modules: [] },
        none
      )
      expect(other).toBeUndefined()
    })

    test('a saved pattern held here: changed loadout is "Based on", another chassis nothing', () => {
      const saved = { name: 'Nimble Hauler', chassisRef: 'mule', systems: ['a'], modules: ['b'] }
      const held = (id: string) => (id === 'p1' ? saved : undefined)
      const mech = { chassisRef: 'mule', sourcePattern: 'p1', systems: ['a'], modules: ['b'] }
      expect(mechPatternStamp(mech, held)?.changed).toBeUndefined()
      expect(mechPatternStamp({ ...mech, modules: [] }, held)?.changed).toBe(true)
      expect(mechPatternStamp({ ...mech, chassisRef: 'scrapper' }, held)).toBeUndefined()
    })
  })

  test('a blank build says nothing', () => {
    expect(mechPatternStamp({ chassisRef: 'mule' }, none)).toBeUndefined()
  })
})
