/**
 * RelatedUnits — each linked unit a contentful Mini of its kind, its name
 * opening its sheet and its vitals its body, never a relation chip; Edit puts
 * Unassign in its chip group. Read draws each empty place, with Assign and
 * + Create only for a viewer who may write the sheet.
 */

import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { LinkedUnitLink } from '../LinkedUnitLink'
import { RelatedUnits } from '../RelatedUnits'

describe('RelatedUnits', () => {
  test('a unit held in a Game wears its owner chip on its head', () => {
    render(
      <RelatedUnits
        editable={false}
        units={[
          { key: 'p1', kind: 'pilot', name: 'Bonesaw', href: '/p1', owner: 'Mine' },
          { key: 'p2', kind: 'pilot', name: 'Mara', href: '/p2' },
        ]}
      />
    )
    const [mine, other] = screen.getAllByRole('listitem')
    expect(mine?.querySelector('.su-entity-mini__pill')?.textContent).toContain('Mine')
    expect(other?.textContent).not.toContain('Mine')
  })

  test('Read: a grid of Minis, each linking to its sheet, its vitals under its name', () => {
    render(
      <RelatedUnits
        editable={false}
        units={[
          {
            key: 'm1',
            kind: 'mech',
            name: 'Scrapper',
            href: '/build/mechs/m1',
            readings: [{ label: 'SP', value: '9/9' }],
          },
          { key: 'p1', kind: 'pilot', name: 'Not shared' },
        ]}
      />
    )
    const list = screen.getByRole('list', { name: 'Related units' })
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
    expect(
      within(list)
        .getByRole('link', { name: /Scrapper/ })
        .getAttribute('href')
    ).toBe('/build/mechs/m1')
    expect(list.textContent).toContain('9/9')
    // No relation chip label ("MECH | Scrapper").
    expect(list.querySelector('.su-chip-link')).toBeNull()
  })

  test('Edit: an empty place is a placeholder Mini, what stands in for it its body', () => {
    render(
      <RelatedUnits
        editable
        units={[]}
        slots={[
          {
            key: 'crawler',
            kind: 'crawler',
            assign: <button type="button">Assign</button>,
            createHref: '/crawlers/new?game=g1',
            extra: <span>Mock Crawler Level</span>,
          },
        ]}
      />
    )
    const body = document.querySelector('.su-entity-mini__body')
    expect(body?.textContent).toContain('Mock Crawler Level')
    expect(screen.getByText('No crawler')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Create/ }).getAttribute('href')).toContain(
      '/crawlers/new?game=g1'
    )
  })

  test('Read draws each empty place: plain to a reader, Assign and + Create to a writer', () => {
    const slot = {
      key: 'mech',
      kind: 'mech' as const,
      assign: <button type="button">Assign</button>,
      createHref: '/mechs/new',
      extra: <span>Mock Crawler Level</span>,
    }
    const { unmount } = render(<RelatedUnits editable={false} units={[]} slots={[slot]} />)
    expect(screen.getByText('Related units')).toBeTruthy()
    expect(screen.getByText('No mech')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Assign' })).toBeNull()
    expect(screen.queryByRole('link', { name: /Create/ })).toBeNull()
    unmount()
    render(<RelatedUnits editable={false} writes units={[]} slots={[slot]} />)
    expect(screen.getByRole('button', { name: 'Assign' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /Create/ }).getAttribute('href')).toContain(
      '/mechs/new'
    )
    // What stands in for the place (a stepper) is Edit's alone.
    expect(screen.queryByText('Mock Crawler Level')).toBeNull()
  })

  test('a companion is a Mini linking to its own page, with no ⋯', () => {
    render(
      <RelatedUnits
        editable
        units={[
          {
            key: 'companion-x',
            kind: 'companion',
            name: 'Sestra Drone',
            href: '/mechs/m1/companions/x',
          },
        ]}
      />
    )
    expect(screen.getByRole('link', { name: /Sestra Drone/ }).getAttribute('href')).toBe(
      '/mechs/m1/companions/x'
    )
    expect(screen.queryByRole('button', { name: 'Sestra Drone actions' })).toBeNull()
  })

  test("Edit: R62 Change and Unassign ride the Mini's ⋯; Unassign takes the link off", async () => {
    const onUnassign = mock(() => undefined)
    const change = mock(({ open }: { open: boolean }) => (open ? <p>Change picker open</p> : null))
    render(
      <RelatedUnits
        editable
        units={[{ key: 'p1', kind: 'pilot', name: 'Bonesaw', onUnassign, change }]}
      />
    )
    // No button of its own on the head but the ⋯ (C2b: the head stays one line).
    expect(screen.queryByRole('button', { name: /^Unassign/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Change/ })).toBeNull()
    const menuFor = async () => {
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Bonesaw actions' }))
      })
      return screen.getByRole('menu')
    }
    await act(async () => {
      fireEvent.click(within(await menuFor()).getByRole('menuitem', { name: 'Change Pilot' }))
    })
    expect(screen.getByText('Change picker open')).toBeTruthy()
    await act(async () => {
      fireEvent.click(within(await menuFor()).getByRole('menuitem', { name: 'Unassign' }))
    })
    expect(onUnassign).toHaveBeenCalledTimes(1)
  })
})

describe('LinkedUnitLink', () => {
  test('a unit named outside Related units is a Mini linking to its sheet', () => {
    render(<LinkedUnitLink kind="crawler" name="Tenacity" href="/build/crawlers/c1" />)
    expect(screen.getByRole('link', { name: /Tenacity/ }).getAttribute('href')).toBe(
      '/build/crawlers/c1'
    )
  })
})
