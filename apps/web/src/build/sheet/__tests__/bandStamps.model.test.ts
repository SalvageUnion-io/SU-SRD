import { describe, expect, test } from 'bun:test'
import { nameToSlug } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { isBookCrewMech, mechPatternStamp, withoutDrift } from '../bandStamps.model'

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

  test('a saved pattern that is gone says so, and is not a link (r3 G3)', () => {
    expect(mechPatternStamp({ chassisRef: 'mule', sourcePattern: 'p1' }, none, true)).toEqual({
      name: 'Deleted pattern',
    })
    // One this browser holds is never gone, whatever was asked.
    expect(
      mechPatternStamp({ chassisRef: 'mule', sourcePattern: 'p1' }, () => 'Nimble Hauler', true)
        ?.href
    ).toBe('/p/pattern/p1')
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

    test('a changed loadout is changed (its band then says "differs", r6 E1)', () => {
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

    test('a saved pattern held here: a changed loadout is changed, another chassis nothing', () => {
      const saved = { name: 'Nimble Hauler', chassisRef: 'mule', systems: ['a'], modules: ['b'] }
      const held = (id: string) => (id === 'p1' ? saved : undefined)
      const mech = { chassisRef: 'mule', sourcePattern: 'p1', systems: ['a'], modules: ['b'] }
      expect(mechPatternStamp(mech, held)?.changed).toBeUndefined()
      expect(mechPatternStamp({ ...mech, modules: [] }, held)?.changed).toBe(true)
      expect(mechPatternStamp({ ...mech, chassisRef: 'scrapper' }, held)).toBeUndefined()
    })

    test('a changed one says what differs and carries the pattern’s loadout (r5 D2)', () => {
      const saved = {
        name: 'Digger',
        chassisRef: 'mule',
        systems: ['chainsaw-arm', 'red-laser'],
        modules: [],
      }
      const stamp = mechPatternStamp(
        {
          chassisRef: 'mule',
          sourcePattern: 'p1',
          systems: ['red-laser', 'red-laser'],
          modules: [],
        },
        () => saved
      )
      expect(stamp?.loadout).toEqual({ systems: ['chainsaw-arm', 'red-laser'], modules: [] })
      // What the pattern has that the Mech lacks reads from the pattern's side (r7 G3).
      expect(stamp?.differs).toBe(
        'Digger has 1 System this Mech lacks: Chainsaw Arm · added Red Laser'
      )
      expect(stamp?.lacksOnly).toBeUndefined()
    })

    test('a pattern that gained parts says what the Mech lacks, never "removed" (r7 G3)', () => {
      const saved = {
        name: 'Longhaul',
        chassisRef: 'mule',
        systems: ['red-laser', 'hydraulic-crusher', 'green-laser', 'floodlights'],
        modules: ['comms-module'],
      }
      const stamp = mechPatternStamp(
        { chassisRef: 'mule', sourcePattern: 'p1', systems: ['floodlights'], modules: [] },
        () => saved
      )
      expect(stamp?.differs).toBe(
        'Longhaul has 3 Systems and 1 Module this Mech lacks: Red Laser, Hydraulic Crusher, Green Laser, Comms Module'
      )
      expect(stamp?.lacksOnly).toBe(true)
    })

    test('a Mech that added parts says what it added (r6 E2)', () => {
      const saved = { name: 'Digger', chassisRef: 'mule', systems: [], modules: [] }
      const stamp = mechPatternStamp(
        { chassisRef: 'mule', sourcePattern: 'p1', systems: ['red-laser'], modules: [] },
        () => saved
      )
      expect(stamp?.differs).toBe('Added Red Laser (vs Digger)')
      expect(stamp?.lacksOnly).toBeUndefined()
    })
  })

  test('a blank build says nothing', () => {
    expect(mechPatternStamp({ chassisRef: 'mule' }, none)).toBeUndefined()
  })
})

describe('a book crew’s Mech (r8 E9)', () => {
  test('is the Starter Set’s or the Quickstart’s, or a copy of one', () => {
    expect(isBookCrewMech({ id: 'starter-mech-mule' })).toBe(true)
    expect(isBookCrewMech({ id: 'quickstart-mech-magpie' })).toBe(true)
    expect(isBookCrewMech({ id: 'u-1', seedRef: 'starter-mech-mule' })).toBe(true)
    expect(isBookCrewMech({ id: 'u-1' })).toBe(false)
  })

  test('names its pattern without saying how it differs', () => {
    expect(
      withoutDrift({
        name: 'Survivor',
        page: '/x/',
        changed: true,
        differs: 'Survivor has 1 System this Mech lacks: High Pressure Hose',
        lacksOnly: true,
        loadout: { systems: [], modules: [] },
      })
    ).toEqual({ name: 'Survivor', page: '/x/' })
  })
})
