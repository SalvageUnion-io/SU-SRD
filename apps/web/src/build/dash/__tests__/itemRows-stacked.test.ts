/**
 * Read stacks a Mech's copies as its pattern's page does (r7 G7): one line
 * "Armour Plating ×2", its Slots and SV for both.
 */

import { describe, expect, test } from 'bun:test'
import { resolveSystem } from '../../../lib/rules/mechItems'
import { itemRows, stackedRows } from '../itemRows'

describe('stackedRows', () => {
  test('copies of a part read as one counted line, in their first place', () => {
    const systems = ['armour-plating', 'floodlights', 'armour-plating']
    const rows = stackedRows(itemRows({ systems, modules: [] }, 'system'), systems)
    const plating = resolveSystem('armour-plating')
    expect(rows.map((row) => row.name)).toEqual([
      `${plating?.name} ×2`,
      resolveSystem('floodlights')?.name,
    ])
    expect(rows[0]?.cells[1]).toBe((plating?.slotsRequired ?? 0) * 2)
    expect(rows[0]?.cells[2]).toBe((plating?.salvageValue ?? 0) * 2)
  })

  test('a loadout of one of each is untouched', () => {
    const systems = ['armour-plating', 'floodlights']
    const rows = itemRows({ systems, modules: [] }, 'system')
    expect(stackedRows(rows, systems)).toEqual(rows)
  })
})
