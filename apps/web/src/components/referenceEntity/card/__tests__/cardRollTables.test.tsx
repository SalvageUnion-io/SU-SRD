/**
 * Roll-table data reaches the card two ways — INLINE (`table`) and BY
 * REFERENCE (`tableName` -> the `roll-tables` schema) — and it may sit on the
 * entity itself or on the action that folds into it. A card that reads
 * `entity.table` only renders "System and Software Hacker" (and 87 other
 * entities) with the d20 outcomes silently missing.
 */
import { describe, expect, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { RefEntity } from 'salvageunion-reference'
import { extractVisibleActions, resolveTable, SalvageUnionReference } from 'salvageunion-reference'
import { malformed } from 'salvageunion-reference/testing'
import { PeekTable } from '../../../entity/PeekTable'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

/** The stamp is the roll: "Roll the die on <table>". */
const ROLL_BUTTON = /^Roll the die on /

/** On a Page every table starts hidden: open it to read its rows (a card's Peeks them). */
const openTable = () => fireEvent.click(screen.getByRole('button', { name: /^Show the .* table$/ }))

const find = <T extends { name?: string }>(items: readonly T[], name: string): T => {
  const match = items.find((item) => item.name === name)
  if (!match) throw new Error(`fixture missing: ${name}`)
  return match
}

describe('roll tables reach the card by reference, not just inline', () => {
  test("an ability whose self-action names a table renders that table's rows", () => {
    const ability = find(SalvageUnionReference.Abilities.all(), 'System and Software Hacker')
    render(<ReferenceEntityCard data={ability} presentation="page" />)

    expect(screen.getByLabelText(ROLL_BUTTON)).toBeTruthy()
    openTable()
    expect(screen.getByText('The System or Module is destroyed.')).toBeTruthy()
  })

  test('a system whose self-action names a table renders it', () => {
    const system = find(SalvageUnionReference.Systems.all(), 'Mechapult')
    render(<ReferenceEntityCard data={system} presentation="page" />)

    expect(screen.getByLabelText(ROLL_BUTTON)).toBeTruthy()
    openTable()
    expect(screen.getByText(/The Mechapult explodes and is destroyed\./)).toBeTruthy()
  })

  test("in a card the table is a roll Token whose name Peeks the table's rows", () => {
    const system = find(SalvageUnionReference.Systems.all(), 'Mechapult')
    const { container } = render(<ReferenceEntityCard data={system} />)

    // No Table toggle: the Roll is the Token's one control, its rows its Peek's.
    expect(screen.getByLabelText(ROLL_BUTTON)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Show the .* table$/ })).toBeNull()
    const trigger = container.querySelector('.su-roll-token [data-peek]')
    expect(trigger?.getAttribute('data-peek')).toMatch(/\/table$/)
    cleanup()

    // The Peek draws the table it resolves, read-only.
    const selfAction = (extractVisibleActions(system) ?? []).find((a) => a.name === system.name)
    const table = resolveTable(system) ?? resolveTable(selfAction)
    if (!table) throw new Error('Mechapult table missing')
    render(<PeekTable name="Mechapult" table={table} />)
    expect(screen.getByText(/The Mechapult explodes and is destroyed\./)).toBeTruthy()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
  })

  test('an action entity that names a table renders it on its own card', () => {
    const action = find(SalvageUnionReference.Actions.all(), 'Area Salvage')
    // Actions are meta entities, outside RefEntity; the card renders them anyway.
    render(<ReferenceEntityCard data={malformed<RefEntity>(action)} />)

    expect(screen.getByLabelText(ROLL_BUTTON)).toBeTruthy()
  })

  test('an inline `table` still renders (roll-tables entity itself)', () => {
    const rollTable = find(SalvageUnionReference.RollTables.all(), 'Trading Bay')
    render(<ReferenceEntityCard data={rollTable} presentation="page" />)

    expect(screen.getByLabelText(ROLL_BUTTON)).toBeTruthy()
    openTable()
    expect(screen.getByText('An Intact Mech Chassis is available for trade.')).toBeTruthy()
  })

  test('a NON-self action keeps its table under its own Token — printed once', () => {
    // "Trade Caravan" hosts "Improved Trading Bay", which names a table. In a
    // card the action is a contentful Token (N3) with its folded table on the
    // line under it, so pulling the table up to the host as well would print
    // the same table twice.
    const crawler = find(SalvageUnionReference.Crawlers.all(), 'Trade Caravan')
    const { container } = render(<ReferenceEntityCard data={crawler} />)

    expect(screen.getAllByLabelText(ROLL_BUTTON)).toHaveLength(1)
    // Beside the Token, never inside it: a Token nests nothing (E6).
    expect(container.querySelector('.su-entity-token[data-contentful] .su-roll-token')).toBeNull()
    expect(
      container.querySelector('.su-entity-token[data-contentful] + .su-roll-token')
    ).not.toBeNull()
  })

  test('every ability with by-reference table data resolves a table', () => {
    const abilities = SalvageUnionReference.Abilities.all().filter((ability) => {
      const selfAction = (extractVisibleActions(ability) ?? []).find((a) => a.name === ability.name)
      return selfAction !== undefined && resolveTable(selfAction) !== undefined
    })
    // Guard the guard: this set is non-empty in the shipped dataset.
    expect(abilities.length).toBeGreaterThan(0)

    // On its Page: a granting ability's table rides the granted entity, a
    // level-1 card there and a Token inside any other card (N1).
    for (const ability of abilities) {
      render(<ReferenceEntityCard data={ability} presentation="page" />)
      expect(screen.getAllByLabelText(ROLL_BUTTON).length).toBeGreaterThan(0)
      cleanup()
    }
  })
})
