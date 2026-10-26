/**
 * Homebrew's app surfaces (ADR-061): a shared pattern's page controls (Report
 * and the admin's Hide), the report dialog, and the admin's queue at
 * `/admin/homebrew`. Pins what each shows to whom and which server write each
 * control makes.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { installConvexMocks } from '../../../components/__tests__/convexMock'
import {
  answerRoutes,
  routeWrites,
  withWorkerRoutes,
} from '../../../lib/sharing/__tests__/workerRoutes'
import { sharedPaths } from '../../../lib/sharing/paths'

// Module scope, before the imports below — see `convexMock.ts`: the router
// and sign-in only; Homebrew is the Worker's.
const convexMocks = await installConvexMocks({ authReact: true, router: true })
afterAll(() => convexMocks.restore())

const { HomebrewControls } = await import('../HomebrewControls')
const { HomebrewModerationScreen } = await import('../HomebrewModerationScreen')

withWorkerRoutes()

const TOW_RIG = sharedPaths.homebrew('pat-tow-rig')
const MODERATION = sharedPaths.moderation()

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

describe('a shared pattern’s page controls', () => {
  test('a reader reports it with a reason', async () => {
    answerRoutes({ [TOW_RIG]: STATUS })
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
    expect(routeWrites).toEqual([
      { path: sharedPaths.report('pat-tow-rig'), body: { reason: 'Copied book text' } },
    ])
  })

  test('an empty report is refused on the dialog, and nothing is sent', async () => {
    answerRoutes({ [TOW_RIG]: STATUS })
    await act(async () => {
      render(<HomebrewControls appId="pat-tow-rig" name="Tow Rig" />)
    })
    await press('Report Tow Rig')
    await press(/^Report$/)
    expect(screen.getByText('Say what is wrong with it first.')).toBeTruthy()
    expect(routeWrites).toEqual([])
  })

  test('already reported, it says so; its maker is offered nothing', async () => {
    answerRoutes({ [TOW_RIG]: { ...STATUS, reported: true } })
    const { unmount } = render(<HomebrewControls appId="pat-tow-rig" name="Tow Rig" />)
    expect(screen.getByRole('button', { name: 'Report Tow Rig' }).textContent).toBe('Reported')
    unmount()

    answerRoutes({ [TOW_RIG]: { ...STATUS, mine: true } })
    render(<HomebrewControls appId="pat-tow-rig" name="Tow Rig" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('an admin hides it, and puts a hidden one back', async () => {
    answerRoutes({ [TOW_RIG]: { ...STATUS, admin: true } })
    const { unmount } = render(<HomebrewControls appId="pat-tow-rig" name="Tow Rig" />)
    await press('Hide from Homebrew')
    unmount()

    answerRoutes({ [TOW_RIG]: { ...STATUS, listed: false, hidden: true, admin: true } })
    render(<HomebrewControls appId="pat-tow-rig" name="Tow Rig" />)
    await press('Put back in Homebrew')
    expect(routeWrites).toEqual([
      { path: sharedPaths.hidden('pat-tow-rig'), body: { hidden: true } },
      { path: sharedPaths.hidden('pat-tow-rig'), body: { hidden: false } },
    ])
  })
})

describe('the admin queue', () => {
  test('an admin hides, dismisses and puts back', async () => {
    answerRoutes({ [MODERATION]: QUEUE })
    await act(async () => {
      render(<HomebrewModerationScreen />)
    })
    expect(screen.getByText('Copied book text')).toBeTruthy()
    await press('Hide')
    await press('Dismiss 2 reports')
    await press('Put back')
    expect(routeWrites).toEqual([
      { path: sharedPaths.hidden('pat-tow-rig'), body: { hidden: true } },
      { path: sharedPaths.dismiss('pat-tow-rig'), body: {} },
      { path: sharedPaths.hidden('pat-gone'), body: { hidden: false } },
    ])
  })

  test('one report reads in the singular; an empty queue says so', async () => {
    answerRoutes({
      [MODERATION]: {
        reported: [{ ...QUEUE.reported[0], reportCount: 1, reasons: ['Spam'] }],
        hidden: [],
      },
    })
    const { unmount } = render(<HomebrewModerationScreen />)
    expect(screen.getByRole('button', { name: 'Dismiss report' })).toBeTruthy()
    expect(screen.queryByText('Taken down')).toBeNull()
    unmount()

    answerRoutes({ [MODERATION]: { reported: [], hidden: [] } })
    render(<HomebrewModerationScreen />)
    expect(screen.getByText('No open reports.')).toBeTruthy()
  })

  test('anyone else is told the page is not theirs', async () => {
    answerRoutes({ [MODERATION]: null })
    render(<HomebrewModerationScreen />)
    expect(screen.getByText('Only a site admin can see this page.')).toBeTruthy()
  })
})
