/**
 * assignedUnitsFor — one Assigned units list for every kind: owner chips
 * wherever a Game names the holder, Unassign only on a link this sheet holds,
 * a docked mech read with its own pilot's piloting context.
 */

import { describe, expect, mock, test } from 'bun:test'
import type { SoftLink } from 'game-domain/schemas/softLink'
import {
  crawlerFixture,
  mechFixture,
  pilotFixture,
  softLinkFixture,
} from '../../../components/__tests__/fixtures'
import type { AssignedSubject } from '../assignedUnits.model'
import { assignedUnitsFor } from '../assignedUnits.model'
import type { SheetComposition } from '../composition.model'
import { mechRailItems, rowStats } from '../railStats.model'

const pilot = pilotFixture({ id: 'p1', name: 'Bonesaw' })
const mech = mechFixture({ id: 'm1', name: 'Scrapper', chassisRef: 'mule' })
const crawler = crawlerFixture({ id: 'c1', name: 'Tenacity' })

const empty: SheetComposition = {
  mode: 'wired',
  pilot: null,
  mech: null,
  crawler: null,
  crawlerPilots: [],
  crawlerMechs: [],
  crawlerMechPilots: {},
  crew: [],
}

function build(
  subject: AssignedSubject,
  composition: Partial<SheetComposition>,
  options: {
    softLinks?: SoftLink[]
    held?: string[]
    editable?: boolean
    withheld?: { key: string; kind: 'pilot' | 'mech' | 'crawler'; name?: string }[]
  } = {}
) {
  const unassign = mock((_linkId: string) => undefined)
  const result = assignedUnitsFor({
    subject,
    composition: { ...empty, ...composition },
    withheld: options.withheld ?? [],
    softLinks: options.softLinks ?? [],
    holds: (_kind, id) => (options.held ?? []).includes(id),
    hrefFor: (kind, id) => `/${kind}/${id}`,
    ownerOf: (kind, id) =>
      kind === 'crawler' ? undefined : { label: `owner-${id}`, unassigned: false, mine: false },
    editable: options.editable ?? true,
    unassign,
    picker: (pick, opts) => `${pick}:${opts.filled ? 'change' : 'assign'}`,
  })
  return { ...result, unassign }
}

describe('assignedUnitsFor', () => {
  test('a pilot and a mech sheet wear owner chips, as a crawler sheet does', () => {
    const onPilot = build({ kind: 'pilot', entity: pilot }, { mech })
    expect(onPilot.units.map((u) => u.owner)).toEqual(['owner-m1'])
    const onMech = build({ kind: 'mech', entity: mech }, { pilot, crawler })
    expect(onMech.units.map((u) => u.owner)).toEqual(['owner-p1', undefined])
  })

  test('every unit wears its owner chip: MINE, a crewmate by name, or Unassigned', () => {
    const chips = {
      p1: { label: 'Mine', unassigned: false, mine: true },
      p2: { label: 'Mara', unassigned: false, mine: false },
      p3: { label: 'Unassigned', unassigned: true, mine: false },
    } as const
    const crew = ['p1', 'p2', 'p3'].map((id) => pilotFixture({ id, name: id }))
    const { units } = assignedUnitsFor({
      subject: { kind: 'crawler', entity: crawler },
      composition: { ...empty, crawlerPilots: crew },
      withheld: [],
      softLinks: [],
      holds: () => false,
      hrefFor: () => undefined,
      ownerOf: (_kind, id) => chips[id as keyof typeof chips],
      editable: false,
      unassign: () => undefined,
      picker: () => null,
    })
    expect(units.map((u) => u.owner)).toEqual(['Mine', 'Mara', 'Unassigned'])
  })

  test('Unassign is offered only on a link whose from end this sheet holds', () => {
    const link = softLinkFixture('mech-to-pilot', 'm1', 'p1')
    const theirs = build(
      { kind: 'pilot', entity: pilot },
      { mech },
      { softLinks: [link], held: ['p1'] }
    )
    expect(theirs.units[0]?.onUnassign).toBeUndefined()
    const mine = build(
      { kind: 'pilot', entity: pilot },
      { mech },
      { softLinks: [link], held: ['p1', 'm1'] }
    )
    mine.units[0]?.onUnassign?.()
    expect(mine.unassign).toHaveBeenCalledWith(link.id)
    const read = build(
      { kind: 'pilot', entity: pilot },
      { mech },
      { softLinks: [link], held: ['p1', 'm1'], editable: false }
    )
    expect(read.units[0]?.onUnassign).toBeUndefined()
  })

  test('a place of one: its unit with Change, else Not shared, else its Assign', () => {
    const filled = build({ kind: 'mech', entity: mech }, { pilot })
    expect(filled.units[0]?.change).toBe('pilot:change')
    expect(filled.slots.map((s) => s.kind)).toEqual(['crawler'])
    const withheld = build(
      { kind: 'mech', entity: mech },
      {},
      { withheld: [{ key: 'w', kind: 'pilot' }] }
    )
    expect(withheld.units).toEqual([{ key: 'pilot', kind: 'pilot', name: 'Not shared' }])
    expect(withheld.slots.map((s) => s.kind)).toEqual(['crawler'])
  })

  test('a crawler lists its bay then its crew, and keeps both Assigns', () => {
    const { units, slots } = build(
      { kind: 'crawler', entity: crawler },
      { crawlerMechs: [mech], crawlerPilots: [pilot] },
      { withheld: [{ key: 'w1', kind: 'mech' }] }
    )
    expect(units.map((u) => [u.kind, u.name])).toEqual([
      ['mech', 'Scrapper'],
      ['mech', 'Not shared'],
      ['pilot', 'Bonesaw'],
    ])
    expect(units[0]?.change).toBeUndefined()
    expect(slots.map((s) => s.placeholder)).toEqual(['Dock a Mech', 'Add a Pilot to the crew'])
  })

  test('in Read a crawler reads its crew as pairs: the pilot, with the mech they fly', () => {
    const spare = mechFixture({ id: 'm2', name: 'Spare' })
    const { units } = build(
      { kind: 'crawler', entity: crawler },
      { crawlerMechs: [mech, spare], crawlerPilots: [pilot], crawlerMechPilots: { m1: pilot } },
      { editable: false }
    )
    // The pilot leads, wearing the mech they fly; the flown mech is no unit of
    // its own; the spare nobody flies follows.
    expect(units.map((u) => [u.name, u.flies])).toEqual([
      ['Bonesaw', 'Scrapper'],
      ['Spare', undefined],
    ])
    // A mech flown by someone not on this crew keeps its own Mini.
    const visitor = pilotFixture({ id: 'p9' })
    const away = build(
      { kind: 'crawler', entity: crawler },
      { crawlerMechs: [mech], crawlerPilots: [pilot], crawlerMechPilots: { m1: visitor } },
      { editable: false }
    )
    expect(away.units.map((u) => [u.name, u.flies])).toEqual([
      ['Bonesaw', undefined],
      ['Scrapper', undefined],
    ])
  })

  test("a docked mech reads its own pilot's piloting context (Beefcake)", () => {
    const beefy = pilotFixture({ id: 'p2', abilities: ['beefcake'] })
    const { units } = build(
      { kind: 'crawler', entity: crawler },
      { crawlerMechs: [mech], crawlerMechPilots: { m1: beefy } }
    )
    const bare = rowStats(mechRailItems(mech, undefined))
    const sp = units[0]?.readings?.find((r) => r.label === 'SP')
    expect(sp?.value).not.toBe(bare[0]?.value)
  })

  test('an assigned mech or crawler leads with its Tech Level', () => {
    const fromPilot = build({ kind: 'pilot', entity: pilot }, { mech, crawler })
    const tl = (kind: string) => fromPilot.units.find((u) => u.kind === kind)?.readings?.[0]
    expect(tl('mech')).toMatchObject({ label: 'TL', chip: 'rank' })
    expect(tl('crawler')).toMatchObject({ label: 'TL', value: String(crawler.techLevel) })
  })
})
