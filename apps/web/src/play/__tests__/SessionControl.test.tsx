import { expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { SessionControl } from '../SessionControl'
import type { GameSession } from '../useGameSession'

function session(live: boolean, calls: string[]): GameSession {
  return {
    live,
    canWrite: true,
    pending: false,
    start: async () => {
      calls.push('start')
      return true
    },
    end: () => calls.push('end'),
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
})
