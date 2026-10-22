/**
 * The Foundry VTT export (`foundryActor.ts`): a pilot and a mech as Actors of
 * the unofficial `salvage-union` system 1.3.0. Every system field written is
 * one its `template.json` declares (copied below, the fields only), so the
 * import never carries a key the system would not write itself.
 */

import { describe, expect, test } from 'bun:test'
import type { RefEntity } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { mechMaxCargo, mechMaxEP, mechMaxHeat, mechMaxSP } from 'salvageunion-reference/rules'
import { mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import type { FoundryActor } from '../foundryActor'
import { contentHtml, foundryFileName, mechToFoundry, pilotToFoundry } from '../foundryActor'

/** `template.json` of salvage-union 1.3.0: each type's fields, its templates folded in. */
const DECLARED = {
  pilot: [
    'hp',
    'class',
    'callsign',
    'background',
    'backgroundUsed',
    'keepsake',
    'keepsakeUsed',
    'motto',
    'mottoUsed',
    'ability-points',
    'inventorySlots',
    'skillPoints',
    'appearance',
    'healthType',
  ],
  mech: [
    'sp',
    'description',
    'quirk',
    'appearance',
    'energy-points',
    'heat',
    'system-slots',
    'module-slots',
  ],
  ability: [
    'ap',
    'inventorySlots',
    'description',
    'table_id',
    'traits',
    'visible',
    'uses',
    'level',
    'range',
    'action',
  ],
  equipment: [
    'ap',
    'inventorySlots',
    'description',
    'table_id',
    'traits',
    'visible',
    'uses',
    'range',
    'action',
    'damage',
    'techLevel',
  ],
  chassis: [
    'description',
    'table_id',
    'techLevel',
    'ep',
    'heat',
    'slots',
    'cargo',
    'salvageValue',
    'status',
    'visible',
    'size',
    'displayName',
    'sp',
    'systemSlots',
    'moduleSlots',
  ],
  system: [
    'techLevel',
    'ep',
    'heat',
    'slots',
    'cargo',
    'salvageValue',
    'status',
    'description',
    'table_id',
    'traits',
    'visible',
    'uses',
    'range',
    'action',
    'damage',
  ],
  module: [
    'techLevel',
    'ep',
    'heat',
    'slots',
    'cargo',
    'salvageValue',
    'status',
    'description',
    'table_id',
    'traits',
    'visible',
    'uses',
    'range',
    'action',
    'damage',
  ],
  salvage: ['description', 'salvageValue', 'techLevel'],
} as const satisfies Record<string, readonly string[]>

function slugOf(entity: RefEntity | undefined): string {
  if (!entity) throw new Error('fixture entity missing from the dataset')
  return getEntitySlug(entity)
}

const engineer = slugOf(SalvageUnionReference.Classes.getByName('Engineer'))
const expertise = slugOf(SalvageUnionReference.Abilities.getByName('Engineering Expertise'))
const firstAid = slugOf(SalvageUnionReference.Equipment.getByName('First Aid Kit'))
const mule = slugOf(SalvageUnionReference.Chassis.getByName('Mule'))
const cal50 = slugOf(SalvageUnionReference.Systems.getByName('.50 Cal Machine Gun'))
const comms = slugOf(SalvageUnionReference.Modules.getByName('Comms Module'))

function expectDeclared(actor: FoundryActor) {
  const extra = (fields: Record<string, unknown>, type: keyof typeof DECLARED) =>
    Object.keys(fields).filter((key) => !(DECLARED[type] as readonly string[]).includes(key))
  expect(extra(actor.system, actor.type)).toEqual([])
  for (const item of actor.items)
    expect([item.name, extra(item.system, item.type)]).toEqual([item.name, []])
}

describe('a pilot as a Foundry Pilot', () => {
  const pilot = pilotFixture({
    id: 'p1',
    name: 'Vesh Tanaka',
    callsign: 'Bonesaw',
    classRef: engineer,
    abilities: [expertise],
    equipment: [firstAid],
    motto: 'Fix it twice',
    usedToggles: { motto: true },
    currentHP: 7,
    equipmentUses: { [firstAid]: 1 },
    genericInventory: [{ id: 'g1', name: 'Scrap', slotCost: 3, qty: 2 }],
  })
  const actor = pilotToFoundry(pilot, null)

  test('names, class and the pilot lines carry over', () => {
    expect(actor).toMatchObject({ name: 'Vesh Tanaka', type: 'pilot' })
    expect(actor.system).toMatchObject({
      callsign: 'Bonesaw',
      class: 'Engineer',
      motto: 'Fix it twice',
      mottoUsed: true,
      keepsakeUsed: false,
      healthType: 'hp',
    })
  })

  test('HP and AP are the derived pools, current over max', () => {
    expect(actor.system.hp).toEqual({ value: 7, max: 10 })
    expect(actor.system['ability-points']).toEqual({ value: 5, max: 5 })
    expect(actor.system.inventorySlots).toBe(6)
  })

  test('an ability is a copy with its cost, action, tier and text', () => {
    const ability = actor.items.find((item) => item.type === 'ability')
    expect(ability?.name).toBe('Engineering Expertise')
    expect(ability?.system).toMatchObject({ ap: '1', action: 't', level: 'core' })
    expect(String(ability?.system.description)).toContain('<p>You are able to answer questions')
    expect(ability?.flags['salvageunion-io']?.ref).toBe(`abilities/${expertise}`)
  })

  test('equipment keeps its uses, range and traits', () => {
    const kit = actor.items.find((item) => item.name === 'First Aid Kit')
    expect(kit?.system).toMatchObject({
      techLevel: 'T1',
      range: 'close',
      action: 't',
      uses: { value: 1, max: 3 },
      traits: [],
      inventorySlots: 1,
    })
  })

  test('free-form inventory keeps its slots', () => {
    const scrap = actor.items.find((item) => item.name === 'Scrap ×2')
    expect(scrap?.system.inventorySlots).toBe(3)
  })

  test('writes only fields the system declares', () => expectDeclared(actor))
})

describe('a mech as a Foundry Mech', () => {
  const mech = mechFixture({
    id: 'm1',
    name: 'Iron Mongrel',
    chassisRef: mule,
    patternName: 'Hauler',
    systems: [cal50, cal50],
    modules: [comms],
    systemConditions: { [cal50]: 'damaged' },
    currentSP: 5,
    currentHeat: 2,
    cargoLots: [
      { id: 'l1', kind: 'bulk', name: 'Scrap', cat: 'SCRAP', tl: 2, qty: 3, units: 3, code: 'SCR' },
    ],
  })
  const actor = mechToFoundry(mech, undefined)

  test('the chassis Item carries the derived maxima, which the system reads', () => {
    const chassis = actor.items.find((item) => item.type === 'chassis')
    expect(chassis?.name).toBe('Mule')
    expect(chassis?.system).toMatchObject({
      sp: mechMaxSP(mech),
      ep: mechMaxEP(mech),
      heat: mechMaxHeat(mech),
      cargo: mechMaxCargo(mech),
      systemSlots: 16,
      moduleSlots: 2,
      techLevel: 'T1',
    })
    expect(String(chassis?.system.description)).toContain('Integrated Cargo Bay')
  })

  test('pools are current over max', () => {
    expect(actor.system.sp).toEqual({ value: 5, max: mechMaxSP(mech) })
    expect(actor.system.heat).toEqual({ value: 2, max: mechMaxHeat(mech) })
    expect(String(actor.system.description)).toContain('&quot;Hauler&quot;')
  })

  test('each installed copy is its own Item, with its condition and no cargo', () => {
    const guns = actor.items.filter((item) => item.name === '.50 Cal Machine Gun')
    expect(guns).toHaveLength(2)
    expect(guns[0]?.system).toMatchObject({
      status: 1,
      slots: 2,
      range: 'close',
      action: 't',
      damage: '2 SP',
      traits: ['Ballistic', 'Jamming', 'Pinning'],
      cargo: 0,
    })
    const module = actor.items.find((item) => item.type === 'module')
    expect(module?.system).toMatchObject({ status: 0, range: 'long', action: 'f' })
  })

  test('a cargo lot is Salvage sized by its slots', () => {
    const scrap = actor.items.find((item) => item.type === 'salvage')
    expect(scrap?.system).toMatchObject({ techLevel: 'T2', salvageValue: 3 })
  })

  test('writes only fields the system declares', () => expectDeclared(actor))
})

describe('rules text as HTML', () => {
  test('lists group, flavour is italic, text is escaped, trait marks read plain', () => {
    expect(
      contentHtml([
        { type: 'paragraph', value: 'A <b> & [[Communicator]] link.' },
        { type: 'list-item', value: 'one' },
        { type: 'list-item', value: 'two' },
        { type: 'flavor', value: 'Union says hi.' },
      ])
    ).toBe(
      '<p>A &lt;b&gt; &amp; Communicator link.</p>\n<ul><li>one</li><li>two</li></ul>\n<p><em>Union says hi.</em></p>'
    )
  })
})

test('the file is named for Foundry and the actor', () => {
  expect(foundryFileName('pilot', 'Vesh Tanaka')).toBe('fvtt-salvage-union-pilot-vesh-tanaka.json')
})
