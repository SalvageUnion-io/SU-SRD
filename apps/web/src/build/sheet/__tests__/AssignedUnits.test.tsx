/**
 * AssignedUnits — each linked unit a contentful Mini of its kind, its name
 * opening its sheet and its vitals its body, never a relation chip; Edit puts
 * Unassign in its chip group.
 */

import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { AssignedUnits } from '../AssignedUnits'
import { LinkedUnitLink } from '../LinkedUnitLink'

describe('AssignedUnits', () => {
  test('a unit held in a Game wears its owner chip on its head (round 7)', () => {
    render(
      <AssignedUnits
        editable={false}
        units={[
          { key: 'p1', kind: 'pilot', name: 'Bonesaw', href: '/p1', owner: 'You' },
          { key: 'p2', kind: 'pilot', name: 'Mara', href: '/p2' },
        ]}
      />
    )
    const [mine, other] = screen.getAllByRole('listitem')
    expect(mine?.querySelector('.su-entity-mini__pill')?.textContent).toContain('You')
    expect(other?.textContent).not.toContain('You')
  })

  test('Read: a grid of Minis, each linking to its sheet, its vitals under its name', () => {
    render(
      <AssignedUnits
        editable={false}
        units={[
          {
            key: 'm1',
            kind: 'mech',
            name: 'Scrapper',
            href: '/build/sheet/mech/m1',
            readings: [{ label: 'SP', value: '9/9' }],
          },
          { key: 'p1', kind: 'pilot', name: 'Not shared' },
        ]}
      />
    )
    const list = screen.getByRole('list', { name: 'Assigned units' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(
      within(list)
        .getByRole('link', { name: /Scrapper/ })
        .getAttribute('href')
    ).toBe('/build/sheet/mech/m1')
    expect(list.textContent).toContain('9/9')
    // No relation chip label ("MECH | Scrapper").
    expect(list.querySelector('.su-chip-link')).toBeNull()
  })

  test('Edit: an empty place is a placeholder Mini, what stands in for it its body (round 5)', () => {
    render(
      <AssignedUnits
        editable
        units={[]}
        slots={[
          {
            key: 'crawler',
            kind: 'crawler',
            assign: <button type="button">Assign</button>,
            extra: <span>Mock Crawler Level</span>,
          },
        ]}
      />
    )
    const body = document.querySelector('.su-entity-mini__body')
    expect(body?.textContent).toContain('Mock Crawler Level')
    expect(screen.getByText('No Crawler assigned')).toBeTruthy()
  })

  test('Read leaves the section out with nothing linked', () => {
    const { container } = render(<AssignedUnits editable={false} units={[]} />)
    expect(container.textContent).toBe('')
  })

  test('Edit: Unassign rides the Mini and takes the link off', () => {
    const onUnassign = mock(() => undefined)
    render(
      <AssignedUnits editable units={[{ key: 'p1', kind: 'pilot', name: 'Bonesaw', onUnassign }]} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Unassign Bonesaw' }))
    expect(onUnassign).toHaveBeenCalledTimes(1)
  })
})

describe('LinkedUnitLink', () => {
  test('a unit named outside Assigned units is a Mini linking to its sheet', () => {
    render(<LinkedUnitLink kind="crawler" name="Tenacity" href="/build/sheet/crawler/c1" />)
    expect(screen.getByRole('link', { name: /Tenacity/ }).getAttribute('href')).toBe(
      '/build/sheet/crawler/c1'
    )
  })
})
