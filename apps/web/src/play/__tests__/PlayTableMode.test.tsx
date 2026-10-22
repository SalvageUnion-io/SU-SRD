/**
 * Table mode (play.md §11): the phone's one focused screen. A big roll of the
 * Core Mechanic recorded like every Play roll, the pinned vitals at the Full
 * Size with their − / + (one tap each), the bar's TABLE toggle remembered on
 * the device, and the screen held awake while it shows.
 *
 * Uses toBeTruthy() not toBeInTheDocument() (jest-dom's matchers are not on
 * bun:test's expect).
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { PlayTableMode, TableModeToggle } from '../PlayTableMode'
import type { PinnedUnit } from '../playPhone.model'
import { clearPlayRolls, usePlayRollLog } from '../playRolls.model'
import { tableUnits } from '../tableMode.model'
import { resetTableMode, useTableMode } from '../useTableMode'
import { useWakeLock } from '../useWakeLock'

const PINNED: PinnedUnit[] = [
  {
    kind: 'pilot',
    name: 'Bonesaw',
    vitals: [
      { label: 'HP', value: 7, max: 10 },
      { label: 'AP', value: 3, max: 5 },
    ],
  },
  {
    kind: 'mech',
    name: 'Buzzard',
    vitals: [
      { label: 'SP', value: 4, max: 10 },
      { label: 'EP', value: 4, max: 6 },
      { label: 'Heat', value: 3, max: 9 },
    ],
  },
]

afterEach(() => {
  cleanup()
  clearPlayRolls()
  localStorage.clear()
  resetTableMode()
})

describe('the model', () => {
  test('each pinned vital names the field the Units column writes', () => {
    expect(tableUnits(PINNED).map((u) => u.vitals.map((v) => v.field))).toEqual([
      ['currentHP', 'currentAP'],
      ['currentSP', 'currentEP', 'currentHeat'],
    ])
  })
})

describe('the vitals', () => {
  test('one tap is one step: − on HP writes HP − 1, + on Heat writes Heat + 1', () => {
    const onWrite = mock((_kind: string, _field: string, _next: number) => {})
    render(
      <PlayTableMode
        units={tableUnits(PINNED)}
        live={{ pilot: true, mech: true }}
        onWrite={onWrite}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Decrease HP' }))
    expect(onWrite).toHaveBeenLastCalledWith('pilot', 'currentHP', 6)
    fireEvent.click(screen.getByRole('button', { name: 'Increase Heat' }))
    expect(onWrite).toHaveBeenLastCalledWith('mech', 'currentHeat', 4)
    expect(onWrite).toHaveBeenCalledTimes(2)
  })

  test('a unit that may not be written is a read-out', () => {
    render(
      <PlayTableMode
        units={tableUnits(PINNED)}
        live={{ pilot: false, mech: true }}
        onWrite={() => {}}
      />
    )
    expect(screen.queryByRole('button', { name: 'Decrease HP' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Decrease SP' })).toBeTruthy()
  })

  test('Downtime pins nothing, and says the tabs hold the step', () => {
    render(<PlayTableMode units={[]} live={{ pilot: true, mech: true }} onWrite={() => {}} />)
    expect(screen.getByText(/the tabs hold the step/)).toBeTruthy()
  })
})

describe('the roll', () => {
  test('one tap rolls the Core Mechanic, records it, and reads the result', async () => {
    const log = renderHook(() => usePlayRollLog())
    render(
      <PlayTableMode
        units={[]}
        live={{ pilot: true, mech: true }}
        onWrite={() => {}}
        rollDie={async () => 14}
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Roll the die' }))
    })
    const roll = log.result.current.at(-1)
    expect(roll?.tableName).toBe('Core Mechanic')
    expect(roll?.rolls).toEqual([14])
    expect(screen.getByRole('status').textContent).toContain('14')
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe(
      `Rolled 14, ${roll?.outcome}`
    )
  })
})

describe('the TABLE toggle', () => {
  test('presses table mode on and off, and the device remembers it', () => {
    render(<TableModeToggle />)
    const toggle = screen.getByRole('button', { name: 'Table mode' })
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    expect(localStorage.getItem('su:play-table-mode')).toBe('on')

    // A later visit reads it back.
    resetTableMode()
    const { result } = renderHook(() => useTableMode())
    expect(result.current[0]).toBe(true)
  })
})

describe('useWakeLock', () => {
  test('holds the screen while active and lets go after', async () => {
    const release = mock(async () => {})
    const request = mock(async (_type: 'screen') => ({ release }))
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
    try {
      const hook = renderHook(({ on }) => useWakeLock(on), { initialProps: { on: true } })
      await act(async () => {})
      expect(request).toHaveBeenCalledWith('screen')
      hook.rerender({ on: false })
      expect(release).toHaveBeenCalled()
    } finally {
      Reflect.deleteProperty(navigator, 'wakeLock')
    }
  })

  test('a browser without the API is left alone', () => {
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow()
  })
})
