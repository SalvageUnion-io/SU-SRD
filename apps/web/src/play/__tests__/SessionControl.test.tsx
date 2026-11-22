import { afterAll, beforeEach, expect, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { SessionControl } from '../SessionControl'
import type { GameSession } from '../useGameSession'

/** No router is mounted, so `useGo` falls back to `location.assign`, observed here. */
const assigned: string[] = []
const assignSpy = spyOn(window.location, 'assign').mockImplementation((to: string | URL) => {
  assigned.push(String(to))
})
beforeEach(() => {
  assigned.length = 0
})
afterAll(() => assignSpy.mockRestore())

function session(live: boolean, calls: string[]): GameSession {
  return {
    live,
    canWrite: true,
    pending: false,
    start: async () => {
      calls.push('start')
      return true
    },
    end: async () => {
      calls.push('end')
      return true
    },
    gameId: 'g1',
  }
}

test('Start group session is one press on the board', async () => {
  const calls: string[] = []
  render(<SessionControl session={session(false, calls)} />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Start group session' }))
  })
  expect(calls).toEqual(['start'])
})

test('End group session asks first, and ends only on the confirm', async () => {
  const calls: string[] = []
  render(<SessionControl session={session(true, calls)} />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'End group session' }))
  })
  expect(calls).toEqual([])
  const dialog = screen.getByRole('alertdialog', { name: 'End the group session?' })
  const confirm = [...dialog.querySelectorAll('button')].find(
    (b) => b.textContent === 'End group session'
  )
  await act(async () => {
    fireEvent.click(confirm as HTMLButtonElement)
  })
  expect(calls).toEqual(['end'])
  // Ended, whoever ended it lands on the Game's page and its recap (r6 C1).
  expect(assigned).toEqual(['/games/g1'])
})

test('On the bar, Start keeps its hint as its description, under it (r5 B13)', () => {
  render(<SessionControl session={session(false, [])} inBar />)
  const start = screen.getByRole('button', { name: 'Start group session' })
  expect(start.closest('.su-play-session')).not.toBeNull()
  expect(start.getAttribute('aria-describedby')).toBe(
    document.querySelector('.su-play-session__hint')?.id ?? null
  )
})
