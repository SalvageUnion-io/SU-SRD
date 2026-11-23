import { afterAll, afterEach, beforeEach, expect, spyOn, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { ToasterMount } from '../../components/index'
import { acts, closeRooms, openRooms, serve } from '../../replica/__tests__/fakeRooms'
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
afterEach(closeRooms)

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
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }))
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

test('Ended from Mediate, the Mediator stays there, and a toast opens the recap (r8 B8)', async () => {
  const calls: string[] = []
  render(<ToasterMount />)
  render(<SessionControl session={session(true, calls)} inBar stay />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'End group session' }))
  })
  const dialog = screen.getByRole('alertdialog', { name: 'End the group session?' })
  const confirm = [...dialog.querySelectorAll('button')].find(
    (b) => b.textContent === 'End group session'
  )
  await act(async () => {
    fireEvent.click(confirm as HTMLButtonElement)
  })
  expect(calls).toEqual(['end'])
  expect(assigned).toEqual([])
  const recap = await screen.findByRole('button', { name: 'Read the recap' })
  await act(async () => {
    fireEvent.click(recap)
  })
  expect(assigned).toEqual(['/games/g1'])
})

test('On the bar, Start keeps its hint as its description, under it (r5 B13)', () => {
  render(<SessionControl session={session(false, [])} inBar />)
  const start = screen.getByRole('button', { name: 'Start session' })
  expect(start.closest('.su-play-session')).not.toBeNull()
  expect(start.getAttribute('aria-describedby')).toBe(
    document.querySelector('.su-play-session__hint')?.id ?? null
  )
})

test('ending with a fight over tidies it in the same press, its boxes ticked (r6 C2)', async () => {
  openRooms('g1')
  serve('g1', {
    mediator: { id: 'mediator', running: { name: 'Ambush at the Pylon' } },
    opposition: [{ id: 'n1', maxHp: 6, currentHp: 0 }],
  })
  const calls: string[] = []
  render(<SessionControl session={session(true, calls)} />)
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'End group session' }))
  })
  const dialog = screen.getByRole('alertdialog', { name: 'End the group session?' })
  const end = within(dialog).getByRole('checkbox', { name: 'End Ambush at the Pylon' })
  expect((end as HTMLInputElement).checked).toBe(true)
  expect(
    (within(dialog).getByRole('checkbox', { name: 'Clear the downed' }) as HTMLInputElement).checked
  ).toBe(true)
  const confirm = [...dialog.querySelectorAll('button')].find(
    (b) => b.textContent === 'End group session'
  )
  await act(async () => {
    fireEvent.click(confirm as HTMLButtonElement)
  })
  expect(acts.map((a) => [a.name, a.args])).toContainEqual([
    'mediator.endEncounter',
    { clear: true },
  ])
  expect(calls).toEqual(['end'])
})
