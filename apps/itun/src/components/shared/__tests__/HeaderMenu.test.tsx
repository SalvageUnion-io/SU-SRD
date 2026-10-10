import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { HeaderMenuItem } from '../HeaderMenu'
import { HeaderMenu } from '../HeaderMenu'

/**
 * HeaderMenu's contract is the menu-button pattern, so that is what is
 * asserted: a real button that says it opens a menu and whether it is open, a
 * `role="menu"` of `role="menuitem"` rows, activation that runs the row and
 * closes, Escape that closes and hands focus back to the trigger, and an
 * inert row that stays in the menu without doing anything.
 */

function setup(sections: HeaderMenuItem[][], props: { label?: string; chevron?: boolean } = {}) {
  render(<HeaderMenu trigger="Games" sections={sections} {...props} />)
  return screen.getByRole('button', { name: props.label ?? 'Games' })
}

async function open(trigger: HTMLElement): Promise<HTMLElement> {
  await act(async () => {
    fireEvent.click(trigger)
  })
  return screen.getByRole('menu')
}

describe('HeaderMenu', () => {
  test('the trigger is a collapsed menu button until pressed', async () => {
    const trigger = setup([[{ id: 'a', label: 'Shelves', onSelect: () => {} }]])
    expect(trigger.getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('menu')).toBeNull()

    await open(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
  })

  test('rows are menuitems, sections are divided by a separator', async () => {
    const menu = await open(
      setup([
        [{ id: 'a', label: 'Shelves', onSelect: () => {} }],
        [
          { id: 'b', label: 'Union Crawler #430', hint: 'Mediator', onSelect: () => {} },
          { id: 'c', label: 'The Long Haul', hint: 'Player', onSelect: () => {} },
        ],
        [],
      ])
    )
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(3)
    // Two non-empty sections → one rule; the empty third section draws none.
    expect(within(menu).getAllByRole('separator')).toHaveLength(1)
    // The hint is part of the row's name, as a separate word.
    expect(
      within(menu).getByRole('menuitem', { name: /Union Crawler #430.*Mediator/ })
    ).toBeTruthy()
  })

  test('activating a row runs it and closes the menu, focus back on the trigger', async () => {
    const onSelect = mock(() => {})
    const trigger = setup([[{ id: 'a', label: 'Settings', onSelect }]])
    const menu = await open(trigger)

    await act(async () => {
      fireEvent.click(within(menu).getByRole('menuitem', { name: 'Settings' }))
    })
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  test('Escape closes it and returns focus to the trigger', async () => {
    const trigger = setup([[{ id: 'a', label: 'Settings', onSelect: () => {} }]])
    const menu = await open(trigger)

    await act(async () => {
      fireEvent.keyDown(menu, { key: 'Escape' })
    })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })

  test('a row with no action is an inert, disabled menuitem', async () => {
    const menu = await open(setup([[{ id: 'none', label: 'No games yet' }]]))
    const row = within(menu).getByRole('menuitem', { name: 'No games yet' })
    expect(row.getAttribute('aria-disabled')).toBe('true')

    await act(async () => {
      fireEvent.click(row)
    })
    // Still open: an inert row is not a way out of the menu.
    expect(screen.queryByRole('menu')).toBeTruthy()
  })

  test('an avatar-only trigger takes its name from `label`, and can drop the chevron', () => {
    const trigger = setup([[{ id: 'a', label: 'Settings', onSelect: () => {} }]], {
      label: 'Account menu for Beefcake',
      chevron: false,
    })
    expect(trigger.querySelector('svg')).toBeNull()
  })
})
