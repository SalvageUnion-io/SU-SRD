/**
 * actionList — the rows an actions list is built from (R65): the owner's
 * picks ride each row (`mech.itemChoices`, R60), a picked variant's own
 * actions follow it, and each companion's actions are rows of their own.
 */

import { describe, expect, test } from 'bun:test'
import type { PartnerInstance } from 'game-domain/schemas/partner'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { mechFixture } from '../../../components/__tests__/fixtures'
import { buildCompanionActions, buildMechActions } from '../actionList'
import { actionRow } from '../actionRow'
import { resolveSystem } from '../mechItems'

const TURRET = 'automated-weapon-turret'

/** The turret's Turret Model choice and its first model. */
function turretModel() {
  const system = resolveSystem(TURRET)
  const action = system ? (SalvageUnionReference.resolveActions(system) ?? [])[0] : undefined
  const choice = action?.choices?.find((c) => c.source?.kind === 'systemVariant')
  const option = choice?.source?.kind === 'systemVariant' ? choice.source.options[0] : undefined
  if (!action || !choice || !option?.name) throw new Error('no Turret Model choice')
  return { action, choice, model: option.name, modelActions: option.actions ?? [] }
}

describe('the owner’s picks ride the row (mech.itemChoices)', () => {
  test('unpicked, the row carries its choices with nothing chosen, and no variant rows', () => {
    const { action, choice } = turretModel()
    const rows = buildMechActions(mechFixture({ id: 'm1', systems: [TURRET] }))
    const row = rows.find((r) => r.name === action.name)
    expect(row?.choices?.from.map((c) => c.id)).toContain(choice.id)
    expect(row?.choices?.selections).toEqual({})
    expect(rows.some((r) => r.variantOf !== undefined)).toBe(false)
    expect(row ? actionRow(row).picks : null).toEqual([])
  })

  test('a picked model: the row names the pick, and the model’s actions are rows after it', () => {
    const { action, choice, model, modelActions } = turretModel()
    const mech = mechFixture({
      id: 'm1',
      systems: [TURRET],
      itemChoices: { [TURRET]: { [choice.id]: [model] } },
    })
    const rows = buildMechActions(mech)
    const at = rows.findIndex((r) => r.name === action.name)
    const row = rows[at]
    expect(row?.choices?.selections).toEqual({ [choice.id]: [model] })
    expect(row ? actionRow(row).picks : []).toEqual([{ choice: choice.name, label: model }])
    const variants = rows.filter((r) => r.variantOf !== undefined)
    expect(variants.map((r) => r.name)).toEqual(modelActions)
    expect(variants.length).toBeGreaterThan(0)
    for (const variant of variants) {
      expect(rows.indexOf(variant)).toBeGreaterThan(at)
      expect(variant.slug).toBe(TURRET)
      expect(variant.key.startsWith(`${row?.key}:`)).toBe(true)
    }
  })

  test('an item installed twice lists its actions twice, each row under its own key', () => {
    const rows = buildMechActions(mechFixture({ id: 'm1', systems: [TURRET, TURRET] }))
    const keys = rows.map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(rows.filter((r) => r.slug === TURRET).length).toBeGreaterThan(1)
  })

  test('picks on another item do not reach this one', () => {
    const { choice, model } = turretModel()
    const rows = buildMechActions(
      mechFixture({
        id: 'm1',
        systems: [TURRET],
        itemChoices: { 'some-other-system': { [choice.id]: [model] } },
      })
    )
    expect(rows.some((r) => r.variantOf !== undefined)).toBe(false)
  })
})

describe('a companion’s actions are rows of their own', () => {
  const host = { kind: 'pilot', id: 'p1' } as const
  const partner = (over: Partial<PartnerInstance> = {}): PartnerInstance =>
    ({
      id: 'pt-rex',
      hostRef: 'mecha-companion',
      hostSchema: 'equipment',
      name: 'Rex',
      systems: [],
      modules: [],
      ...over,
    }) as PartnerInstance

  test('no companions, no rows', () => {
    expect(buildCompanionActions(host, undefined)).toEqual([])
    expect(buildCompanionActions(host, [])).toEqual([])
  })

  test('each System installed on it is a row, on the companion, keyed to it', () => {
    const system = SalvageUnionReference.Systems.all().find((s) =>
      (SalvageUnionReference.resolveActions(s) ?? []).some((a) => !a.hidden)
    )
    if (!system) throw new Error('no system with an action')
    const slug = getEntitySlug(system)
    const rows = buildCompanionActions(host, [partner({ systems: [slug] })])
    const installed = rows.filter((r) => r.kind === 'system' && r.slug === slug)
    expect(installed.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.companion).toMatchObject({ id: 'pt-rex', name: 'Rex', host })
      expect(row.key.startsWith('partner:pt-rex:')).toBe(true)
    }
    // The row that only says how the companion is built is no action.
    expect(rows.some((r) => r.name === 'Mecha Companion')).toBe(false)
  })

  test('two companions keep their rows apart', () => {
    const rows = buildCompanionActions(host, [partner(), partner({ id: 'pt-ada', name: 'Ada' })])
    const keys = rows.map((r) => r.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('an unnamed companion reads as its stat block', () => {
    const rows = buildCompanionActions(host, [partner({ name: '  ', systems: [TURRET] })])
    expect(rows[0]?.companion?.name).toBeTruthy()
    expect(rows[0]?.companion?.name.trim()).not.toBe('')
  })
})
