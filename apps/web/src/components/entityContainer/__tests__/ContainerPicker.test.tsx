/**
 * ContainerPicker draws one set of containers as a select, a menu or a list:
 * the shelf leads, the Games follow, actions act and pick nothing.
 */
import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ContainerChoice } from '../ContainerPicker'
import { ContainerPicker } from '../ContainerPicker'

const CHOICES: ContainerChoice[] = [
  { container: { kind: 'shelf' }, label: 'Hangar' },
  { container: { kind: 'game', gameId: 'g1' }, label: 'Union Crawler #430', hint: 'Mediator' },
]

describe('ContainerPicker', () => {
  test('select: the shelf, then the Games under "Games", then the actions', () => {
    const picks: ContainerChoice[] = []
    let made = 0
    render(
      <ContainerPicker
        variant="select"
        id="where"
        label="Where"
        value={{ kind: 'shelf' }}
        choices={CHOICES}
        onPick={(c) => picks.push(c)}
        actions={[{ id: 'new-game', label: '+ New Game', onSelect: () => made++ }]}
      />
    )
    const select = screen.getByLabelText('Where') as HTMLSelectElement
    expect([...select.options].map((o) => o.textContent)).toEqual([
      'Hangar',
      'Union Crawler #430 · Mediator',
      '+ New Game',
    ])
    expect(select.querySelector('optgroup')?.getAttribute('label')).toBe('Games')
    fireEvent.change(select, { target: { value: 'game:g1' } })
    expect(picks.map((c) => c.container)).toEqual([{ kind: 'game', gameId: 'g1' }])
    fireEvent.change(select, { target: { value: 'new-game' } })
    expect(made).toBe(1)
    expect(picks).toHaveLength(1)
  })

  test('menu: a row per choice with its hint, inert while loading', async () => {
    const picks: ContainerChoice[] = []
    const { rerender } = render(
      <ContainerPicker
        variant="menu"
        trigger="Games"
        choices={undefined}
        onPick={(c) => picks.push(c)}
        loading="Loading your Games…"
        empty="No Games yet"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Games' }))
    })
    expect(
      within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Loading your Games…' })
    ).toBeTruthy()
    rerender(
      <ContainerPicker
        variant="menu"
        trigger="Games"
        choices={CHOICES}
        onPick={(c) => picks.push(c)}
        loading="Loading your Games…"
        empty="No Games yet"
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: /Union Crawler/ }))
    })
    expect(picks.map((c) => c.label)).toEqual(['Union Crawler #430'])
  })

  test('list: a button per choice; loading pends, and with none it says why', () => {
    const picks: ContainerChoice[] = []
    const props = {
      variant: 'list',
      label: 'Where to',
      onPick: (c: ContainerChoice) => picks.push(c),
      loading: 'your Games',
      empty: 'You are in no Game.',
    } as const
    const { rerender } = render(<ContainerPicker {...props} choices={undefined} />)
    expect(screen.getByRole('status').textContent).toContain('your Games')
    rerender(<ContainerPicker {...props} choices={[]} />)
    expect(screen.getByText('You are in no Game.')).toBeTruthy()
    rerender(<ContainerPicker {...props} choices={CHOICES} />)
    const list = screen.getByRole('list', { name: 'Where to' })
    fireEvent.click(within(list).getByRole('button', { name: 'Union Crawler #430 · Mediator' }))
    expect(picks.map((c) => c.container)).toEqual([{ kind: 'game', gameId: 'g1' }])
  })
})
