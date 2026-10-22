/**
 * SELECT mode, `toggle`: the Compact's control is a real checkbox in its head.
 * The surface around it is a pointer convenience only, so nothing interactive
 * nests inside a `role="button"` and the Compact's content stays readable.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Entity } from '../Entity'

const drill = () => {
  const found = SalvageUnionReference.Systems.getByName('Salvaging Drill')
  if (!found) throw new Error('fixture missing: Salvaging Drill')
  return found
}

function renderToggle(selected: boolean) {
  const picks: number[] = []
  const view = render(
    <Entity
      size="compact"
      entity={drill()}
      mode={{
        kind: 'select',
        role: 'toggle',
        selected,
        onSelect: () => picks.push(1),
        label: 'Pick Salvaging Drill',
      }}
    />
  )
  return { ...view, picks }
}

describe('select mode, toggle', () => {
  test('the control is a checkbox named for the choice, carrying the state', () => {
    renderToggle(true)
    const box = screen.getByRole('checkbox', { name: 'Pick Salvaging Drill' })
    expect((box as HTMLInputElement).checked).toBe(true)
    expect(screen.queryByRole('button')).toBeNull()
  })

  test('the surface has no role, tab stop or name', () => {
    const { container } = renderToggle(false)
    const surface = container.firstElementChild
    expect(surface?.getAttribute('role')).toBeNull()
    expect(surface?.getAttribute('tabindex')).toBeNull()
    expect(surface?.getAttribute('aria-label')).toBeNull()
  })

  test('a pointer click on the surface selects; the checkbox selects exactly once', () => {
    const { container, picks } = renderToggle(false)
    const surface = container.firstElementChild
    if (!(surface instanceof HTMLElement)) throw new Error('no surface')
    fireEvent.click(surface)
    expect(picks).toHaveLength(1)
    fireEvent.click(screen.getByRole('checkbox', { name: 'Pick Salvaging Drill' }))
    expect(picks).toHaveLength(2)
  })
})
