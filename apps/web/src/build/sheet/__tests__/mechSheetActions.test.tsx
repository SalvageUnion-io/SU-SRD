/**
 * Every write the mech's sheet makes goes through `useMechSheetActions`: each
 * handler reads the freshest record and writes only what it changes.
 */

import { describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import type { Mech } from 'game-domain/schemas/mech'
import { mechFixture } from '../../../components/__tests__/fixtures'
import { makeEntityStoreMock } from '../../../components/__tests__/mockEntityStore'
import { LIVE_SHEET_MANUAL, LIVE_SHEET_OVERRIDE } from '../../../replica/provenance'
import type { UnitsState } from '../../../replica/units'
import { useMechSheetActions } from '../mechSheetActions.model'

type Write = { fields: Partial<Mech>; meta: unknown }

/** The hook on `mech`, its store answering with the latest write folded over it. */
function actionsFor(start: Mech) {
  let current = start
  const writes: Write[] = []
  const storeState = {
    ...makeEntityStoreMock({ mechs: [start] }).getState(),
    get: (type: string, id: string) => (type === 'mech' && id === start.id ? current : null),
    update: async (_type: string, _id: string, fields: Partial<Mech>, meta: unknown) => {
      writes.push({ fields, meta })
      current = { ...current, ...fields }
    },
  } as unknown as UnitsState
  const store = Object.assign(() => storeState, { getState: () => storeState })
  const { result } = renderHook(() =>
    useMechSheetActions({ mech: start, store: store as never, storeState, crawler: null })
  )
  return { result, writes }
}

const MULE = mechFixture({
  id: 'mech-1',
  systems: ['salvaging-drill'],
  modules: ['survey-scanner', 'survey-scanner'],
})

describe('useMechSheetActions', () => {
  test('a pinned maximum is written as an override, and an unchanged one not at all', async () => {
    const { result, writes } = actionsFor(mechFixture({ id: 'mech-1', maxSpOverride: 10 }))
    await act(async () => {
      result.current.overrideMechMax({ maxSpOverride: 10 })
    })
    expect(writes).toEqual([])
    await act(async () => {
      result.current.overrideMechMax({ maxSpOverride: 12 })
    })
    expect(writes).toEqual([{ fields: { maxSpOverride: 12 }, meta: LIVE_SHEET_OVERRIDE }])
  })

  test('adding stacks on the freshest loadout, a system or a module', async () => {
    const { result, writes } = actionsFor(MULE)
    await act(async () => {
      result.current.addItem('system', 'salvaging-drill')
      result.current.addItem('module', 'ai-co-pilot')
    })
    expect(writes.map((w) => w.fields)).toEqual([
      { systems: ['salvaging-drill', 'salvaging-drill'] },
      { modules: ['survey-scanner', 'survey-scanner', 'ai-co-pilot'] },
    ])
    expect(writes.every((w) => w.meta === LIVE_SHEET_MANUAL)).toBe(true)
  })

  test("removing a module's last copy takes its picks with it; a copy left keeps them", async () => {
    const mech = { ...MULE, itemChoices: { 'survey-scanner': { mode: ['wide'] } } }
    const { result, writes } = actionsFor(mech)
    await act(async () => {
      result.current.removeItem('module', 0)
    })
    expect(writes[0]?.fields).toEqual({ modules: ['survey-scanner'] })
    await act(async () => {
      result.current.removeItem('module', 0)
    })
    expect(writes[1]?.fields).toEqual({ modules: [], itemChoices: {} })
  })

  test('a condition cycles from intact, and uses never go below zero', async () => {
    const { result, writes } = actionsFor(MULE)
    await act(async () => {
      await result.current.cycleItemCondition('system', 'salvaging-drill')
    })
    expect(writes[0]?.fields).toEqual({ systemConditions: { 'salvaging-drill': 'damaged' } })
    await act(async () => {
      await result.current.cycleItemCondition('module', 'survey-scanner')
    })
    expect(writes[1]?.fields).toEqual({ moduleConditions: { 'survey-scanner': 'damaged' } })
    await act(async () => {
      await result.current.setItemUses('salvaging-drill', -2)
    })
    expect(writes[2]?.fields).toEqual({ itemUses: { 'salvaging-drill': 0 } })
  })

  test('a repair with no crawler to pay from sets the item intact and spends nothing', async () => {
    const mech = { ...MULE, moduleConditions: { 'survey-scanner': 'damaged' as const } }
    const { result, writes } = actionsFor(mech)
    await act(async () => {
      await result.current.repairItem('module', 'survey-scanner', 1, 2)
    })
    expect(writes.map((w) => w.fields)).toEqual([
      { moduleConditions: { 'survey-scanner': 'intact' } },
    ])
  })

  test('quirk, appearance and description save trimmed, and blank clears them', async () => {
    const { result, writes } = actionsFor(MULE)
    await act(async () => {
      result.current.saveQuirk('  Leaks oil ')
      result.current.saveAppearance('   ')
      result.current.saveDescription('Rust red')
    })
    expect(writes.map((w) => w.fields)).toEqual([
      { quirk: 'Leaks oil' },
      { appearance: undefined },
      { description: 'Rust red' },
    ])
  })
})
