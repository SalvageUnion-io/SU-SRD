/**
 * The plan at the table (r6 B7, MD6-09): Mediate shows the session being
 * played and the Game notes from Prep, and saves them as Prep does. Reads are
 * answered by name (`serverMock.ts`); `plan.set` is recorded.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { GamePlan } from 'game-domain/schemas/gamePlan'
import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'
import { withSignedInBackend } from '../../../replica/__tests__/signedInBackend'

const saves: GamePlan[] = []

const serverMocks = await installServerMocks({
  call: (name, args) => {
    if (name !== 'plan.set') return undefined
    saves.push((args as { plan: GamePlan }).plan)
    return undefined
  },
})
afterAll(() => serverMocks.restore())

const { SyncContext } = await import('../../../replica/syncContext')
const { MediatorPlan } = await import('../MediatorPlan')
const { currentSession } = await import('../mediatorPlan.model')

withSignedInBackend()

const PLAN: GamePlan = {
  schemaVersion: 1,
  notes: 'The bridge is out.',
  sessions: [
    { id: 's-past', date: '2026-01-05', title: 'The Crossing', note: 'Done.' },
    { id: 's-next', date: '2999-12-05', title: 'The Pylon and after', note: 'Kessler turns.' },
  ],
}

beforeEach(() => {
  saves.length = 0
  setQueryAnswers({ 'plan.get': PLAN })
})

async function renderPlan() {
  await act(async () => {
    render(
      <SyncContext.Provider value={{ status: 'live', canWrite: true, outdated: false }}>
        <MediatorPlan gameId="g1" canWrite />
      </SyncContext.Provider>
    )
  })
}

describe('the plan on Mediate', () => {
  test('the session being played is today’s or the next, else the last played', () => {
    expect(currentSession(PLAN, '2026-06-01')?.id).toBe('s-next')
    expect(currentSession({ sessions: [PLAN.sessions[0] as never] }, '2026-06-01')?.id).toBe(
      's-past'
    )
    expect(currentSession({ sessions: [{ id: 'u', note: '' }] }, '2026-06-01')?.id).toBe('u')
    expect(currentSession({ sessions: [] }, '2026-06-01')).toBeNull()
  })

  test('once today’s plan is played, the one being played is the next (r8 B8)', () => {
    const today = { id: 's-today', date: '2026-06-01', note: '', played: '2026-06-01' }
    expect(currentSession({ sessions: [today, PLAN.sessions[1] as never] }, '2026-06-01')?.id).toBe(
      's-next'
    )
    // With every plan played, it is the last one played.
    expect(currentSession({ sessions: [today] }, '2026-06-01')?.id).toBe('s-today')
  })

  test('it shows the next session’s plan and the Game notes, and saves them as typed', async () => {
    await renderPlan()
    const session = screen.getByLabelText(
      'Session plan · The Pylon and after'
    ) as HTMLTextAreaElement
    expect(session.value).toBe('Kessler turns.')
    const notes = screen.getByLabelText('Game notes') as HTMLTextAreaElement
    expect(notes.value).toBe('The bridge is out.')
    await act(async () => {
      fireEvent.change(session, { target: { value: 'Kessler turns at half HP.' } })
      fireEvent.blur(session)
    })
    expect(saves.at(-1)?.sessions.find((s) => s.id === 's-next')?.note).toBe(
      'Kessler turns at half HP.'
    )
    expect(screen.getByRole('link', { name: 'Open Prep' }).getAttribute('href')).toBe(
      '/games/g1/prep'
    )
  })
})
