/**
 * The sticky bar's figures (r2 G7): what fills as it is used (the hold, the
 * slots) is an alarm only past its limit, never while empty.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { SheetBarStrip } from '../SheetBarStrip'

const stateOf = (key: string, value: number, max: number) => {
  const { container } = render(
    <SheetBarStrip title="Rig" kind="Mech" items={[{ key, label: key, value, max }]} />
  )
  return container.querySelector('.su-sheet-bar__vital')?.getAttribute('data-state') ?? null
}

describe('SheetBarStrip', () => {
  test('an empty hold is no alarm; one past its limit is', () => {
    expect(stateOf('cargo', 0, 20)).toBeNull()
    expect(stateOf('cargo', 20, 20)).toBeNull()
    expect(stateOf('cargo', 21, 20)).toBe('critical')
  })

  test('slots alarm only when over', () => {
    expect(stateOf('systemSlots', 0, 12)).toBeNull()
    expect(stateOf('moduleSlots', 5, 4)).toBe('critical')
  })

  test('a pool still alarms low, and Heat high', () => {
    expect(stateOf('sp', 1, 10)).toBe('critical')
    expect(stateOf('heat', 1, 10)).toBeNull()
    expect(stateOf('heat', 8, 10)).toBe('critical')
  })
})
