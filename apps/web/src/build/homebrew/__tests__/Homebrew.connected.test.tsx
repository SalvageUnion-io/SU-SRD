/**
 * Homebrew's app surfaces (ADR-061): a shared pattern's page controls (Report
 * and the admin's Hide), the report dialog, and the admin's queue at
 * `/admin/homebrew`. Pins what each shows to whom and which server write each
 * control makes.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'

const writes: Array<[string, unknown]> = []

// Module scope, before the imports below — see `convexMock.ts`.
const convexMocks = await installConvexMocks({
  convexClient: { mutation: async () => ({ updatedAt: 1 }) },
  convexReact: {
    useMutation: (ref: unknown) => async (args: unknown) => {
      writes.push([getFunctionName(ref as FunctionReference<'mutation'>), args])
      return null
    },
  },
  authReact: true,
  router: true,
})
afterAll(() => convexMocks.restore())

const { HomebrewControls } = await import('../HomebrewControls')
const { HomebrewModerationScreen } = await import('../HomebrewModerationScreen')

const STATUS = { listed: true, hidden: false, reported: false, mine: false, admin: false }

const QUEUE = {
  reported: [
    {
      appId: 'pat-tow-rig',
      name: 'Tow Rig',
      madeBy: 'Rosa',
      reportCount: 2,
      reasons: ['Copied book text', 'Spam'],
      hiddenAt: null,
    },
  ],
  hidden: [
    { appId: 'pat-gone', name: 'Gone', madeBy: 'Ash', reportCount: 0, reasons: [], hiddenAt: 5 },
  ],
}

async function press(name: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

beforeEach(() => {
  writes.length = 0
})

describe('a shared pattern’s page controls', () => {
  test('a reader reports it with a reason', async () => {
    setQueryAnswers({ 'homebrew:status': STATUS })
    await act(async () => {
      render(<HomebrewControls appId="pat-tow-rig" name="Tow Rig" />)
    })
    await press('Report Tow Rig')
    await act(async () => {
      fireEvent.change(screen.getByLabelText('What is wrong with it'), {
        target: { value: 'Copied book text' },
      })
    })
    await press(/^Report$/)
    expect(writes).toEqual([
      ['homebrew:report', { appId: 'pat-tow-rig', reason: 'Copied book text' }],
    ])
  })

  test('an empty report is refused on the dialog, and nothing is sent', async () => {
    setQueryAnswers({ 'homebrew:status': STATUS })
    await act(async () => {
      render(<HomebrewControls appId="pat-tow-rig" name="Tow Rig" />)
    })
    await press('Report Tow Rig')
    await press(/^Report$/)
    expect(screen.getByText('Say what is wrong with it first.')).toBeTruthy()
    expect(writes).toEqual([])
  })

  test('already reported, it says so; its maker is offered nothing', async () => {
    setQueryAnswers({ 'homebrew:status': { ...STATUS, reported: true } })
    const { unmount } = render(<HomebrewControls appId="pat-tow-rig" name="Tow Rig" />)
    expect(screen.getByRole('button', { name: 'Report Tow Rig' }).textContent).toBe('Reported')
    unmount()

    setQueryAnswers({ 'homebrew:status': { ...STATUS, mine: true } })
    render(<HomebrewControls appId="pat-tow-rig" name="Tow Rig" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('an admin hides it, and puts a hidden one back', async () => {
    setQueryAnswers({ 'homebrew:status': { ...STATUS, admin: true } })
    const { unmount } = render(<HomebrewControls appId="pat-tow-rig" name="Tow Rig" />)
    await press('Hide from Homebrew')
    unmount()

    setQueryAnswers({
      'homebrew:status': { ...STATUS, listed: false, hidden: true, admin: true },
    })
    render(<HomebrewControls appId="pat-tow-rig" name="Tow Rig" />)
    await press('Put back in Homebrew')
    expect(writes).toEqual([
      ['homebrew:setHidden', { appId: 'pat-tow-rig', hidden: true }],
      ['homebrew:setHidden', { appId: 'pat-tow-rig', hidden: false }],
    ])
  })
})

describe('the admin queue', () => {
  test('an admin hides, dismisses and puts back', async () => {
    setQueryAnswers({ 'homebrew:moderation': QUEUE })
    await act(async () => {
      render(<HomebrewModerationScreen />)
    })
    expect(screen.getByText('Copied book text')).toBeTruthy()
    await press('Hide')
    await press('Dismiss 2 reports')
    await press('Put back')
    expect(writes).toEqual([
      ['homebrew:setHidden', { appId: 'pat-tow-rig', hidden: true }],
      ['homebrew:dismissReports', { appId: 'pat-tow-rig' }],
      ['homebrew:setHidden', { appId: 'pat-gone', hidden: false }],
    ])
  })

  test('one report reads in the singular; an empty queue says so', async () => {
    setQueryAnswers({
      'homebrew:moderation': {
        reported: [{ ...QUEUE.reported[0], reportCount: 1, reasons: ['Spam'] }],
        hidden: [],
      },
    })
    const { unmount } = render(<HomebrewModerationScreen />)
    expect(screen.getByRole('button', { name: 'Dismiss report' })).toBeTruthy()
    expect(screen.queryByText('Taken down')).toBeNull()
    unmount()

    setQueryAnswers({ 'homebrew:moderation': { reported: [], hidden: [] } })
    render(<HomebrewModerationScreen />)
    expect(screen.getByText('No open reports.')).toBeTruthy()
  })

  test('anyone else is told the page is not theirs', async () => {
    setQueryAnswers({ 'homebrew:moderation': null })
    render(<HomebrewModerationScreen />)
    expect(screen.getByText('Only a site admin can see this page.')).toBeTruthy()
  })
})
