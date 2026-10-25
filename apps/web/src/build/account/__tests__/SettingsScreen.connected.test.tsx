import { afterAll, afterEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { FunctionReference } from 'convex/server'
import { getFunctionName } from 'convex/server'
import { ConvexError } from 'convex/values'

/**
 * `SettingsScreen` for somebody who has an account.
 *
 * Holding a person's Discord identity creates obligations — show it, let them
 * correct it, let them take their data, let them erase it — and this is where
 * all four are honoured. The tests below are about those obligations, not about
 * layout: that deletion cannot happen on one click, that the export button is
 * not offered before there is anything to export, and that a blank display name
 * falls back to the Discord one rather than to nothing.
 *
 * Queries are answered **by name** (`getFunctionName`) — see `convexMock.ts`.
 * Name-keying needs no modulo wrap: a state change re-renders and replays the
 * same hooks, which would run off the end of a positional queue and collapse
 * the screen back to its loading state.
 */

import type { QueryAnswers } from '../../../components/__tests__/convexMock'
import { installConvexMocks, setQueryAnswers } from '../../../components/__tests__/convexMock'

let authed = true

/**
 * What each account mutation throws this test, keyed by function name
 * (`'account:deleteAccount'`); a name with no entry lands.
 */
let failures: Record<string, unknown> = {}

/** How many deletions reached the server this test. */
let deletions = 0

function useMutationMock(ref: unknown) {
  const name = getFunctionName(ref as FunctionReference<'mutation'>)
  return async () => {
    if (name === 'account:deleteAccount') deletions++
    if (name in failures) throw failures[name]
    return null
  }
}

// Module scope, before the imports below: `mock.module` only affects imports
// that resolve after it runs. See `convexMock.ts` for the capture/restore rules.
// `authReact` because the profile mounts `SignInControl`.
const convexMocks = await installConvexMocks({
  authReact: true,
  convexReact: {
    useConvexAuth: () => ({ isAuthenticated: authed, isLoading: false }),
    useMutation: useMutationMock,
  },
})

const { SettingsScreen } = await import('../SettingsScreen')
const { SyncProvider } = await import('../../../replica/SyncProvider')

function withQueries(answers: QueryAnswers): void {
  setQueryAnswers(answers)
}

/**
 * The two the profile asks for; `exported` is what most cases vary. Not
 * `games:listMine`: the Games list left this page for the masthead, and the
 * mock throws on an unregistered query — so a page that started asking for it
 * again would fail here rather than quietly re-growing the list.
 */
function profileQueries(me: unknown, exported: unknown = { pilots: [] }): QueryAnswers {
  return { 'account:me': me, 'account:exportMine': exported }
}

/** Force the browser's online flag, which is what picks Connected vs Disconnected. */
function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

afterEach(() => {
  authed = true
  failures = {}
  deletions = 0
  setOnline(true)
})

const wrap = () =>
  render(
    <SyncProvider>
      <SettingsScreen />
    </SyncProvider>
  )

const ME = { displayName: 'Beefcake', avatarUrl: null, discordId: 'd1' }

describe('what the settings page is when there is no account', () => {
  test('signed out says it is read-only and offers the way in', () => {
    authed = false
    withQueries({})
    wrap()

    // Signed out is read-only: building needs an account (ADR-034).
    expect(screen.getByText(/You are not signed in/i)).toBeTruthy()
    expect(screen.getByText(/building anything needs an account/i)).toBeTruthy()
    // It must not promise building or durability it cannot deliver.
    expect(screen.queryByText(/without an account/i)).toBeNull()
    expect(screen.queryByText(/saved on this device/i)).toBeNull()
  })

  test('disconnected explains it rather than showing a broken profile form', () => {
    setOnline(false)
    withQueries({})
    wrap()

    expect(screen.getByText(/unreachable right now/i)).toBeTruthy()
    // Offering an editable name that cannot be saved would be a lie.
    expect(screen.queryByRole('textbox', { name: 'Display name' })).toBeNull()
  })
})

describe('the profile', () => {
  test('while it loads it says so', () => {
    withQueries(profileQueries(undefined))
    wrap()
    expect(screen.getByText(/Loading your account/i)).toBeTruthy()
  })

  test('a signed-in session with no row says so plainly', () => {
    withQueries(profileQueries(null))
    wrap()
    expect(screen.getByText('No account is held for this sign-in.')).toBeTruthy()
  })

  test('the display name is pre-filled from Discord', () => {
    withQueries(profileQueries(ME))
    wrap()

    const input = screen.getByRole('textbox', { name: 'Display name' }) as HTMLInputElement
    expect(input.value).toBe('Beefcake')
  })

  test('a null display name renders as empty, not as the string null', () => {
    withQueries(profileQueries({ ...ME, displayName: null }))
    wrap()
    expect((screen.getByRole('textbox', { name: 'Display name' }) as HTMLInputElement).value).toBe(
      ''
    )
  })
})

describe('the settings page', () => {
  test('is headed Settings', () => {
    withQueries(profileQueries(ME))
    wrap()
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeTruthy()
  })

  test('does not list your games — the masthead Games menu does', () => {
    withQueries(profileQueries(ME))
    wrap()
    expect(screen.queryByRole('heading', { name: /your games/i })).toBeNull()
    expect(screen.queryByText(/not in any games yet/i)).toBeNull()
  })
})

describe('taking your data, and taking it away', () => {
  test('download is refused until the export has actually arrived', () => {
    // Clicking it early would hand somebody an empty file and call it their data.
    // Explicit rather than via profileQueries: a default parameter cannot
    // express "still loading", since `undefined` is what triggers the default.
    withQueries({ ...profileQueries(ME), 'account:exportMine': undefined })
    wrap()
    expect(screen.getByText('Download my data').closest('button')?.disabled).toBe(true)
  })

  test('once the export is ready the button is live', () => {
    withQueries(profileQueries(ME))
    wrap()
    expect(screen.getByText('Download my data').closest('button')?.disabled).toBe(false)
  })

  test('deletion takes two deliberate clicks, the second behind a ConfirmDialog', () => {
    withQueries(profileQueries(ME))
    wrap()

    // The first click only asks; nothing irreversible is one click away.
    expect(screen.queryByText('Permanently delete')).toBeNull()
    fireEvent.click(screen.getByText('Delete my account'))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete your account?' })
    expect(within(dialog).getByText(/cannot be undone/i)).toBeTruthy()
    expect(within(dialog).getByText('Permanently delete')).toBeTruthy()
    expect(within(dialog).getByText('Cancel')).toBeTruthy()
  })

  test('Cancel closes the dialog and deletes nothing', () => {
    withQueries(profileQueries(ME))
    wrap()

    fireEvent.click(screen.getByText('Delete my account'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(deletions).toBe(0)
  })

  test('it warns that the shared game outlives the account', () => {
    withQueries(profileQueries(ME))
    wrap()
    // A crawler is communal; deleting yourself must not delete the table's game.
    expect(screen.getByText(/Games you are in survive/i)).toBeTruthy()
  })
})

/** Press a button whose write settles inside act(), so its failure line has rendered. */
async function press(label: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByText(label))
  })
}

describe('a write the server does not take says so', () => {
  test("a refused deletion says the server's words, on the dialog", async () => {
    failures = { 'account:deleteAccount': new ConvexError('You still organise a Game.') }
    withQueries(profileQueries(ME))
    wrap()

    fireEvent.click(screen.getByText('Delete my account'))
    await press('Permanently delete')
    // The dialog stays open with the reason, so the reader sees nothing happened.
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText('You still organise a Game.')).toBeTruthy()
  })

  test('a deletion that lands closes the dialog', async () => {
    withQueries(profileQueries(ME))
    wrap()

    fireEvent.click(screen.getByText('Delete my account'))
    await press('Permanently delete')
    expect(deletions).toBe(1)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  test('a failed deletion says so in words, never its raw text', async () => {
    failures = {
      'account:deleteAccount': new Error('[CONVEX M(account:deleteAccount)] Server Error'),
    }
    withQueries(profileQueries(ME))
    wrap()

    fireEvent.click(screen.getByText('Delete my account'))
    await press('Permanently delete')
    expect(screen.getByText('Your account could not be deleted. Try again.')).toBeTruthy()
    expect(screen.queryByText(/Server Error/)).toBeNull()
  })

  test('Cancel clears the failure line', async () => {
    failures = { 'account:deleteAccount': new Error('boom') }
    withQueries(profileQueries(ME))
    wrap()

    fireEvent.click(screen.getByText('Delete my account'))
    await press('Permanently delete')
    expect(screen.getByText('Your account could not be deleted. Try again.')).toBeTruthy()
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('Your account could not be deleted. Try again.')).toBeNull()
  })

  test('a failed display-name save says so in words, never its raw text', async () => {
    failures = {
      'account:updateProfile': new Error('[CONVEX M(account:updateProfile)] Server Error'),
    }
    withQueries(profileQueries(ME))
    wrap()

    await press('Save')
    expect(screen.getByText('Your display name could not be saved. Try again.')).toBeTruthy()
    expect(screen.queryByText(/Server Error/)).toBeNull()
  })
})

afterAll(convexMocks.restore)
