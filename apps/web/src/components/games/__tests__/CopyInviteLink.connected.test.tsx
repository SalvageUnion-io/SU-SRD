import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

/**
 * The Game's invite URL: "Copy invite link" (the Game page and the
 * Dashboard's Crew tab) and "Reset link" (the Game page).
 *
 * What these pin: copying asks the server for the Game's link (`invites.link`)
 * and puts the whole URL on the clipboard; resetting asks `invites.reset`; and
 * a signed-out viewer, who has no link to copy, sees nothing.
 */

import { getFunctionName } from 'convex/server'
import { APP_BASE, pageOrigin } from '../../../lib/site'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

let authed = true
const mutations: { name: string; args: unknown }[] = []

const convexMocks = await installConvexMocks({
  convexReact: {
    useConvexAuth: () => ({ isAuthenticated: authed, isLoading: false }),
    useMutation: (ref: unknown) => async (args: unknown) => {
      mutations.push({ name: getFunctionName(ref as never), args })
      return 'TOKEN0123456789A'
    },
  },
})

const { CopyInviteLink, ResetInviteLink } = await import('../CopyInviteLink')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')

const copied: string[] = []

beforeEach(() => {
  authed = true
  mutations.length = 0
  copied.length = 0
  setQueryAnswers({})
})

afterAll(() => {
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
  convexMocks.restore()
})

async function renderButton(): Promise<HTMLElement> {
  let container: HTMLElement | undefined
  await act(async () => {
    container = render(
      <ConnectionProvider>
        <CopyInviteLink
          gameId={'g1' as never}
          clipboardWriter={async (text) => {
            copied.push(await text)
          }}
        />
      </ConnectionProvider>
    ).container
  })
  if (container === undefined) throw new Error('nothing rendered')
  return container
}

describe('Copy invite link', () => {
  test('asks for the Game’s link and copies the whole URL', async () => {
    await renderButton()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy invite link' }))
    })

    expect(mutations).toEqual([{ name: 'invites:link', args: { gameId: 'g1' } }])
    expect(copied).toEqual([`${pageOrigin()}${APP_BASE}/invite/TOKEN0123456789A`])
  })

  test('is not offered to somebody who is not signed in', async () => {
    authed = false
    const container = await renderButton()
    expect(container.textContent).toBe('')
  })
})

describe('Reset link', () => {
  async function openConfirm(): Promise<void> {
    await act(async () => {
      render(
        <ConnectionProvider>
          <ResetInviteLink gameId={'g1' as never} />
        </ConnectionProvider>
      )
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reset link' }))
    })
  }

  test('asks before resetting, and Cancel resets nothing', async () => {
    await openConfirm()
    expect(screen.getByRole('alertdialog', { name: 'Reset the invite link?' })).toBeTruthy()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })

    expect(mutations).toEqual([])
  })

  test('confirming asks the server for a new link for this Game', async () => {
    await openConfirm()
    const dialog = screen.getByRole('alertdialog', { name: 'Reset the invite link?' })
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Reset link' }))
    })

    expect(mutations).toEqual([{ name: 'invites:reset', args: { gameId: 'g1' } }])
  })
})
