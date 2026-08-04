/**
 * Roll-table data reaches the card two ways — INLINE (`table`) and BY
 * REFERENCE (`tableName` -> the `roll-tables` schema) — and it may sit on the
 * entity itself or on the action that folds into it. The card used to read
 * `entity.table` only, so "System and Software Hacker" (and 87 other entities)
 * rendered their prose with the d20 outcomes silently missing.
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { SalvageUnionReference, extractVisibleActions } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'
import { resolveCardTable } from '../resolveCardTable'

const ROLL_BUTTON = 'Roll on this table'

const find = <T extends { name?: string }>(items: readonly T[], name: string): T => {
  const match = items.find((item) => item.name === name)
  if (!match) throw new Error(`fixture missing: ${name}`)
  return match
}

describe('roll tables reach the card by reference, not just inline', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test("an ability whose self-action names a table renders that table's rows", () => {
    const ability = find(SalvageUnionReference.Abilities.all(), 'System and Software Hacker')
    render(<ReferenceEntityCard data={ability} />)

    expect(screen.getByLabelText(ROLL_BUTTON)).toBeTruthy()
    expect(screen.getByText('The System or Module is destroyed.')).toBeTruthy()
  })

  test('a system whose self-action names a table renders it', () => {
    const system = find(SalvageUnionReference.Systems.all(), 'Mechapult')
    render(<ReferenceEntityCard data={system} />)

    expect(screen.getByLabelText(ROLL_BUTTON)).toBeTruthy()
    expect(screen.getByText(/The Mechapult explodes and is destroyed\./)).toBeTruthy()
  })

  test('an action entity that names a table renders it on its own card', () => {
    const action = find(SalvageUnionReference.Actions.all(), 'Area Salvage')
    render(<ReferenceEntityCard data={action as unknown as SURefEntity} />)

    expect(screen.getByLabelText(ROLL_BUTTON)).toBeTruthy()
  })

  test('an inline `table` still renders (roll-tables entity itself)', () => {
    const rollTable = find(SalvageUnionReference.RollTables.all(), 'Trading Bay')
    render(<ReferenceEntityCard data={rollTable as unknown as SURefEntity} />)

    expect(screen.getByLabelText(ROLL_BUTTON)).toBeTruthy()
    expect(screen.getByText('An Intact Mech Chassis is available for trade.')).toBeTruthy()
  })

  test('a NON-self action keeps its table on its own nested card — printed once', () => {
    // "Trade Caravan" hosts "Improved Trading Bay", which names a table. The
    // action renders as its own nested card, so pulling the table up to the
    // host as well would print the same table twice.
    const crawler = find(SalvageUnionReference.Crawlers.all(), 'Trade Caravan')
    render(<ReferenceEntityCard data={crawler} />)

    expect(screen.getAllByLabelText(ROLL_BUTTON)).toHaveLength(1)
  })

  test('every ability with by-reference table data resolves a table', () => {
    const abilities = SalvageUnionReference.Abilities.all().filter((ability) => {
      const selfAction = (extractVisibleActions(ability) ?? []).find((a) => a.name === ability.name)
      return selfAction !== undefined && resolveCardTable(selfAction) !== undefined
    })
    // Guard the guard: this set is non-empty in the shipped dataset.
    expect(abilities.length).toBeGreaterThan(0)

    for (const ability of abilities) {
      render(<ReferenceEntityCard data={ability} />)
      expect(screen.getAllByLabelText(ROLL_BUTTON).length).toBeGreaterThan(0)
      cleanup()
    }
  })
})

describe('resolveCardTable', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('prefers an inline table, resolves a name, ignores anything else', () => {
    // An inline table wins over a name that would resolve to a different one.
    const inline = find(SalvageUnionReference.RollTables.all(), 'Trading Bay').table
    expect(resolveCardTable({ table: inline, tableName: 'Mechapult' })).toEqual(inline)
    expect(resolveCardTable({ tableName: 'Trading Bay' })).toBeDefined()
    expect(resolveCardTable({ tableName: 'no such table' })).toBeUndefined()
    expect(resolveCardTable({ tableName: '' })).toBeUndefined()
    expect(resolveCardTable(undefined)).toBeUndefined()
    expect(resolveCardTable(null)).toBeUndefined()
    expect(resolveCardTable('Trading Bay')).toBeUndefined()
  })
})
