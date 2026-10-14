/**
 * The entity model on its own terms. Parity with today's card helpers is
 * component-lib's `entityModelParity.test.ts`; this pins what the model
 * promises any reader (the SRD, ITUN, the Discord bot).
 */

import { describe, expect, test } from 'bun:test'
import { getModel } from '../../helpers'
import { EntitySchemaNames, SalvageUnionReference } from '../../index'
import type { SURefMetaEntity } from '../../schemas/index'
import { entityTone, headerFill } from '../parts/fill'
import { toEntityModel } from '../toEntityModel'

const need = <T>(value: T | undefined | null, label: string): T => {
  if (value == null) throw new Error(`fixture missing: ${label}`)
  return value
}

const ALL = [...EntitySchemaNames].flatMap(
  (schemaName) => (getModel(schemaName)?.all() ?? []) as SURefMetaEntity[]
)

describe('toEntityModel', () => {
  test('is serialisable for every entity: JSON round-trips it unchanged', () => {
    expect(ALL.length).toBeGreaterThan(1000)
    for (const entity of ALL) {
      const model = toEntityModel(entity)
      expect(JSON.parse(JSON.stringify(model))).toEqual(model)
    }
  })

  test('names every entity, with a linkable ref', () => {
    for (const entity of ALL) {
      const { ref, title } = toEntityModel(entity)
      expect(ref.id).toBe(entity.id)
      expect(ref.slug.length).toBeGreaterThan(0)
      expect(title.length).toBeGreaterThan(0)
      expect(ref.synthetic).toBeUndefined()
    }
  })

  test('a system: its stamp, tone, facts and traits (E17)', () => {
    const drill = need(SalvageUnionReference.Systems.getByName('Salvaging Drill'), 'drill')
    const model = toEntityModel(drill)
    expect(model.kind).toEqual({ stamp: 'System', type: 'System', domain: 'gear', nature: 'have' })
    expect(model.tone).toBe('tl-2')
    expect(model.facts.map((f) => [f.short, f.value])).toEqual([
      ['TL', '2'],
      ['Slots', '3'],
      ['SV', '2'],
    ])
    expect(model.traits.map((t) => [t.name, t.ref?.slug])).toEqual([
      ['Dependable', 'dependable'],
      ['Salvaging', 'salvaging'],
    ])
    expect(model.cite.page).toBe(drill.page)
  })

  test('an action: ink, a do-thing, its type as data and its facets as facts', () => {
    const action = need(
      SalvageUnionReference.Actions.all().find((a) => a.range && a.damage && a.actionType),
      'ranged action with damage'
    )
    const model = toEntityModel(action)
    expect(model.tone).toBe('ink')
    expect(model.kind.nature).toBe('do')
    expect(model.kind.domain).toBe('action')
    expect(model.actionType).toBe(action.actionType)
    expect(model.facts.map((f) => f.key)).toEqual(expect.arrayContaining(['range', 'damage']))
    expect(model.bookStats).toEqual([])
  })

  test('a split action type keeps both halves, Mech and Pilot', () => {
    const ability = need(
      SalvageUnionReference.Abilities.all().find((a) => typeof a.mechActionType === 'string'),
      'ability with a split action type'
    )
    const model = toEntityModel(ability)
    expect(model.mechActionType).toBe(ability.mechActionType)
    expect(model.actionType).toBeDefined()
  })

  test('a pattern names its chassis as parent and lists its loadout with multiplicity', () => {
    const leviathan = need(SalvageUnionReference.Chassis.getByName('Leviathan'), 'Leviathan')
    const destroyer = need(
      leviathan.patterns?.find((p) => p.name === 'Destroyer'),
      'Destroyer pattern'
    )
    const model = toEntityModel(leviathan, undefined, { pattern: destroyer })
    expect(model.title).toBe('Destroyer')
    expect(model.kind.stamp).toBe('Pattern')
    expect(model.parent).toEqual({
      label: 'Pattern of',
      ref: { schemaName: 'chassis', id: leviathan.id, slug: 'leviathan', name: 'Leviathan' },
    })
    expect(model.ref.pattern).toBe('Destroyer')
    const systems = need(
      model.children.find((g) => g.key === 'systems'),
      'systems group'
    )
    const installed = (destroyer.systems ?? []).reduce((sum, s) => sum + (s.count ?? 1), 0)
    expect(systems.items.length).toBe(installed)
  })

  test('a crawler commander is a synthetic child, never linked', () => {
    const crawler = need(
      SalvageUnionReference.Crawlers.all().find((c) => 'npc' in c && c.npc),
      'crawler with a commander'
    )
    const npcs = need(
      toEntityModel(crawler).children.find((g) => g.key === 'npcs'),
      'npcs group'
    )
    expect(npcs.items[0]?.synthetic).toBe(true)
    expect(npcs.items[0]?.id.startsWith(`${crawler.id}/`)).toBe(true)
  })

  test('every guide leads with prose, from its first step when it has no preamble', () => {
    for (const guide of SalvageUnionReference.Guides.all()) {
      expect(toEntityModel(guide).lead, `no lead for "${guide.name}"`).toBeTruthy()
    }
    const salvaging = need(SalvageUnionReference.Guides.getByName('Salvaging'), 'Salvaging')
    expect(salvaging.content ?? []).toEqual([])
    expect(toEntityModel(salvaging).lead).toStartWith('Area Salvaging represents scouring')
  })

  test("an instance changes identity only where a player's copy does", () => {
    const mule = need(SalvageUnionReference.Chassis.getByName('Mule'), 'Mule')
    const model = toEntityModel(mule, {
      title: 'Old Faithful',
      userMade: true,
      condition: 'damaged',
    })
    expect(model.title).toBe('Old Faithful')
    expect(model.userMade).toBe(true)
    expect(model.ref.name).toBe('Mule')
    expect(toEntityModel(mule).userMade).toBeUndefined()
  })
})

describe('entityTone', () => {
  const base = { id: 'test', name: 'Test', source: 'Salvage Union Workshop Manual', page: 1 }
  const as = (record: object) => record as unknown as SURefMetaEntity

  test('a glossary record without an authored tone is ink-2', () => {
    expect(entityTone('guides', as({ ...base, blackMarket: false }))).toBe('ink-2')
  })

  test('a guide wears its authored tone', () => {
    expect(entityTone('guides', as({ ...base, guideTone: 'salvage' }))).toBe('guide-salvage')
  })

  test('black-market goods with no tech level are ink-2', () => {
    expect(entityTone('systems', as({ ...base, blackMarket: true }))).toBe('ink-2')
  })

  test('gear rides the tech-level ramp, Bio and Nanite included', () => {
    expect(entityTone('equipment', as({ ...base, techLevel: 3 }))).toBe('tl-3')
    expect(entityTone('equipment', as({ ...base, techLevel: 'B' }))).toBe('tl-b')
    expect(entityTone('drones', as({ ...base, techLevel: 'N' }))).toBe('tl-n')
  })

  test('systems and modules wear their tech level, as the book heads them (pp. 162–164, 188–190)', () => {
    expect(entityTone('systems', as({ ...base, techLevel: 1 }))).toBe('tl-1')
    expect(entityTone('systems', as({ ...base, techLevel: 6 }))).toBe('tl-6')
    expect(entityTone('modules', as({ ...base, techLevel: 3 }))).toBe('tl-3')
    expect(entityTone('modules', as({ ...base, techLevel: 'N' }))).toBe('tl-n')
    expect(entityTone('systems', as({ ...base, techLevel: 'B' }))).toBe('tl-b')
  })

  test('a chassis is mech; an action is ink', () => {
    expect(entityTone('chassis', as(base))).toBe('mech')
    expect(entityTone('actions', as(base))).toBe('ink')
  })

  test('abilities take their tier tone: core, advanced or hybrid, legendary', () => {
    const tones = new Set(
      SalvageUnionReference.Abilities.all().map((a) => entityTone('abilities', a))
    )
    expect([...tones].sort()).toEqual(['crawler', 'pilot', 'tier-hybrid'])
    const toneOf = (tree: string) => {
      const ability = SalvageUnionReference.Abilities.all().find((a) => a.tree === tree)
      return entityTone('abilities', need(ability, tree))
    }
    expect(toneOf('Hacking')).toBe('pilot')
    expect(toneOf('Advanced Hacking')).toBe('tier-hybrid')
    expect(toneOf('Cyborg')).toBe('tier-hybrid')
    expect(toneOf('Legendary Hacker')).toBe('crawler')
  })
})

describe('headerFill (E12)', () => {
  test('a have-thing wears its tone in every form', () => {
    const mule = need(SalvageUnionReference.Chassis.getByName('Mule'), 'Mule')
    expect(headerFill(mule, 'row')).toBe('tone')
    expect(headerFill(mule, 'page')).toBe('tone')
  })

  test('an ability is ink on a card or page; its Row wears its tier tone', () => {
    const ability = need(SalvageUnionReference.Abilities.all()[0], 'an ability')
    expect(headerFill(ability, 'row')).toBe('tone')
    expect(headerFill(ability, 'card')).toBe('ink')
    expect(headerFill(ability, 'page')).toBe('ink')
  })

  test('an action is ink everywhere', () => {
    const action = need(SalvageUnionReference.Actions.all()[0], 'an action')
    expect(headerFill(action, 'row')).toBe('ink')
  })
})

describe('a vehicle’s systems', () => {
  const vehicle = (name: string) =>
    need(SalvageUnionReference.getByNameIn('vehicles', name), name) as SURefMetaEntity

  test('an action name that is a systems entry is a Systems child, the drone way', () => {
    const model = toEntityModel(vehicle('Fighting Box Wheel'))
    expect(model.children.map((g) => [g.label, g.items.map((i) => i.name)])).toEqual([
      ['Systems', ['Locomotion System', '.50 Cal Machine Gun']],
    ])
    expect(model.actions).toEqual([])
  })

  test('a name with no systems entry stays an action', () => {
    const model = toEntityModel(vehicle('Power Loader'))
    expect(model.children.map((g) => [g.label, g.items.map((i) => i.name)])).toEqual([
      ['Systems', ['Locomotion System']],
    ])
    // "Rigging Arm (Vehicle)", the vehicle's own action, printed "Rigging Arm".
    expect(model.actions.map((a) => a.name)).toContain('Rigging Arm')
  })
})
