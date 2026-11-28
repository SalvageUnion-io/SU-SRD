import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'

/**
 * The Game's invite URL, on the Game page: "Copy invite link" and "Reset
 * link".
 *
 * What these pin: the link is read as the panel opens (`invites.link`) and on
 * show as text (r8 C7); copying puts that whole URL on the clipboard; a phone
 * shares it; resetting asks `invites.reset` and shows the new link; and a
 * signed-out viewer, who has no link to copy, sees nothing.
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

const { InviteLink } = await import('../CopyInviteLink')
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

const URL = `${pageOrigin()}/games/invite/TOKEN0123456789A`

async function renderPanel(
  writer: (text: Promise<string>) => Promise<void> = async (text) => {
    copied.push(await text)
  },
  share?: (data: ShareData) => Promise<void>
): Promise<HTMLElement> {
  let container: HTMLElement | undefined
  await act(async () => {
    container = render(
      <SyncProvider>
        <InviteLink gameId={'g1' as never} clipboardWriter={writer} share={share} />
      </SyncProvider>
    ).container
  })
  if (container === undefined) throw new Error('nothing rendered')
  return container
}

describe('the invite link', () => {
  test('is on show as text, read once as the panel opens', async () => {
    await renderPanel()
    expect(screen.getByText(URL)).toBeTruthy()
    expect(mutations).toEqual([{ name: 'invites.link', args: { gameId: 'g1' } }])
  })

  test('Copy puts the whole URL on the clipboard, asking nothing more', async () => {
    await renderPanel()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy invite link' }))
    })
    expect(copied).toEqual([URL])
    expect(mutations).toHaveLength(1)
  })

  // r8 C7 (SB8-21): when the clipboard refuses, the link is already there to select.
  test('when the clipboard refuses, the link stays on show to select', async () => {
    await renderPanel(async () => {
      throw new Error('no clipboard')
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy invite link' }))
    })
    expect(screen.getByText(URL)).toBeTruthy()
  })

  test('a phone shares it; a desktop is offered no Share', async () => {
    const shared: ShareData[] = []
    await renderPanel(undefined, async (data) => {
      shared.push(data)
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Share invite link' }))
    })
    expect(shared).toEqual([{ url: URL }])
    cleanup()
    await renderPanel()
    expect(screen.queryByRole('button', { name: 'Share invite link' })).toBeNull()
  })

  test('is not offered to somebody who is not signed in', async () => {
    authed = false
    const container = await renderPanel()
    expect(container.textContent).toBe('')
  })
})

describe('Reset link', () => {
  async function openConfirm(): Promise<void> {
    await renderPanel()
    mutations.length = 0
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
