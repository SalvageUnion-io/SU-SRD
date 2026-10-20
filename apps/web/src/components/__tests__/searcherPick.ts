import { act, fireEvent, screen, within } from '@testing-library/react'

/**
 * Driving `EntitySearcher` from a caller's test: its pool is a list of Minis
 * with nothing to tick, so choosing means opening the Mini and pressing the
 * Page's action (ADD TO …, ADD ANOTHER, CHOOSE). Removing is the rail's ✕.
 * Each step settles in its own `act`, so the Page is there before it is read:
 * await them, never inside another `act`.
 */

/** The searcher's Mini list (not the rail, which repeats chosen names). */
function searcherList(scope: HTMLElement = document.body): HTMLElement {
  const list = scope.querySelector<HTMLElement>('.su-searcher__list')
  if (!list) throw new Error('No searcher list on screen')
  return list
}

/** The list's Mini for `name`, or null when the pool does not offer it. */
export function searcherMini(name: string, scope?: HTMLElement): HTMLElement | null {
  return within(searcherList(scope)).queryByRole('button', { name })
}

/** Open `name`'s Page and return its action bar. */
export async function openInSearcher(name: string, scope?: HTMLElement): Promise<HTMLElement> {
  const token = searcherMini(name, scope)
  if (!token) throw new Error(`No Mini named ${name} in the searcher`)
  await act(async () => {
    fireEvent.click(token)
  })
  return screen.getByRole('group', { name: `${name} actions` })
}

/** Open `name`'s Page and press its primary action (the bar's last button). */
export async function pickInSearcher(name: string, scope?: HTMLElement): Promise<void> {
  const buttons = within(await openInSearcher(name, scope)).queryAllByRole('button')
  const primary = buttons[buttons.length - 1]
  if (!primary) throw new Error(`${name} offers no action: it is already chosen`)
  await act(async () => {
    fireEvent.click(primary)
  })
}
