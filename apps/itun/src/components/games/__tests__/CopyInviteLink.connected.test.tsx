import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'

/**
 * "Copy invite link" (issue 1255) — the one way a Game is shared, on the Game page
 * and the Dashboard's Crew tab.
 *
 * What these pin: it asks the server for the Game's link (`invites.link`, which
 * decides what kind of link this viewer gets) and puts the whole URL on the
 * clipboard; and a signed-out viewer, who has no link to copy, sees nothing.
 */

import { getFunctionName } from 'convex/server'
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

const { CopyInviteLink } = await import('../CopyInviteLink')
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
            copied.push(text)
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
    expect(copied).toEqual([`${window.location.origin}/invite/TOKEN0123456789A`])
  })

  test('is not offered to somebody who is not signed in', async () => {
    authed = false
    const container = await renderButton()
    expect(container.textContent).toBe('')
  })
})
