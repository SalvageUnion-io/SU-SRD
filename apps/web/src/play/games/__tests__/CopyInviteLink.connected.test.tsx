import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'

/**
 * The Game's invite URL, on the Game page: "Copy invite link" and "Reset
 * link".
 *
 * What these pin: copying asks the server for the Game's link (`invites.link`)
 * and puts the whole URL on the clipboard; resetting asks `invites.reset`; and
 * a signed-out viewer, who has no link to copy, sees nothing.
 */

import { installServerMocks, setQueryAnswers } from '../../../components/__tests__/serverMock'
import { pageOrigin } from '../../../lib/site'

let authed = true
const mutations: { name: string; args: unknown }[] = []

const serverMocks = await installServerMocks({
  authReact: { useSession: () => ({ isAuthenticated: authed, isLoading: false }) },
  call: (name, args) => {
    mutations.push({ name, args })
    return 'TOKEN0123456789A'
  },
})

const { CopyInviteLink, ResetInviteLink } = await import('../CopyInviteLink')
const { SyncProvider } = await import('../../../replica/SyncProvider')
const { resetSync } = await import('../../../replica/sync')

const copied: string[] = []

beforeEach(() => {
  authed = true
  mutations.length = 0
  copied.length = 0
  setQueryAnswers({})
})

afterAll(() => {
  resetSync()
  serverMocks.restore()
})

async function renderButton(): Promise<HTMLElement> {
  let container: HTMLElement | undefined
  await act(async () => {
    container = render(
      <SyncProvider>
        <CopyInviteLink
          gameId={'g1' as never}
          clipboardWriter={async (text) => {
            copied.push(await text)
          }}
        />
      </SyncProvider>
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

    expect(mutations).toEqual([{ name: 'invites.link', args: { gameId: 'g1' } }])
    expect(copied).toEqual([`${pageOrigin()}/play/invite/TOKEN0123456789A`])
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
        <SyncProvider>
          <ResetInviteLink gameId={'g1' as never} />
        </SyncProvider>
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

    expect(mutations).toEqual([{ name: 'invites.reset', args: { gameId: 'g1' } }])
  })
})
