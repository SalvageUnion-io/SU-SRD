/**
 * UnitRow — a player unit as the library Row: the name on the cut-out, its
 * readings label-first chips, its note and the host's labels right of the
 * title, and View / Unassign as the head's controls, never inside a link.
 * EmptyUnitSlot — the dashed placeholder an unfilled slot keeps.
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { EmptyUnitSlot } from '../EmptyUnitSlot'
import { UnitRow } from '../UnitRow'

const rowOf = (name: string) => {
  const row = screen.getByText(name).closest('.su-entity-row')
  if (!(row instanceof HTMLElement)) throw new Error(`no row for ${name}`)
  return row
}

describe('UnitRow', () => {
  test('the library Row: the name on the paper cut-out, the frame the Row’s', () => {
    render(<UnitRow kind="mech" name="Iron Fist" />)
    const row = rowOf('Iron Fist')
    expect(row.querySelector('.su-entity-row__notch')?.textContent).toContain('Iron Fist')
    expect(row.querySelector('.su-entity-row__frame')).not.toBeNull()
  })

  test('readings are label-first chips', () => {
    render(
      <UnitRow
        kind="crawler"
        name="Tenacity"
        readings={[
          { label: 'TL', value: 3 },
          { label: 'Bays', value: '4/5' },
        ]}
      />
    )
    const row = rowOf('Tenacity')
    const cells = [...row.querySelectorAll('.su-stat-cell')].map((c) => c.textContent)
    expect(cells).toContain('TL3')
    expect(cells).toContain('Bays4/5')
  })

  test('the note and the host labels sit right of the title, in the head', () => {
    render(
      <UnitRow
        kind="pilot"
        name="Ace"
        note="Home Crawler"
        labels={<span data-testid="owner">YOU</span>}
      />
    )
    const head = rowOf('Ace').querySelector('.su-entity-row__head')
    if (!(head instanceof HTMLElement)) throw new Error('no head')
    expect(within(head).getByText('Home Crawler')).toBeTruthy()
    expect(within(head).getByTestId('owner')).toBeTruthy()
  })

  test('an NPC is user-made: dashed, with the User-made label', () => {
    render(<UnitRow kind="npc" name="Mags" userMade />)
    const row = rowOf('“Mags”')
    expect(row.querySelector('.su-entity-row__frame')?.hasAttribute('data-user-made')).toBe(true)
    expect(within(row).getByText('User-made')).toBeTruthy()
  })

  test('View opens the sheet, named for the unit', () => {
    render(<UnitRow kind="pilot" name="Yara Voss" href="/sheet/pilot/yara" />)
    const view = screen.getByRole('link', { name: 'View Yara Voss' })
    expect(view.getAttribute('href')).toContain('/sheet/pilot/yara')
    expect(view.closest('.su-entity-row__controls')).not.toBeNull()
  })

  test('no href, no View', () => {
    render(<UnitRow kind="pilot" name="Yara Voss" />)
    expect(screen.queryByRole('link')).toBeNull()
  })

  test('Unassign fires its handler, named for the unit', () => {
    const onUnassign = mock(() => undefined)
    render(<UnitRow kind="mech" name="Iron Fist" onUnassign={onUnassign} />)
    fireEvent.click(screen.getByRole('button', { name: 'Unassign Iron Fist' }))
    expect(onUnassign).toHaveBeenCalledTimes(1)
  })

  test('host controls come before View and Unassign', () => {
    render(
      <UnitRow
        kind="mech"
        name="Iron Fist"
        href="/sheet/mech/iron"
        onUnassign={() => undefined}
        controls={<button type="button">Change Mech</button>}
      />
    )
    const slot = screen.getByRole('button', { name: 'Change Mech' }).parentElement
    const names = [...(slot?.children ?? [])].map(
      (el) => el.getAttribute('aria-label') ?? el.textContent
    )
    expect(names).toEqual(['Change Mech', 'View Iron Fist', 'Unassign Iron Fist'])
  })
})

describe('EmptyUnitSlot', () => {
  test('its role stamp, message and CTAs', () => {
    render(
      <EmptyUnitSlot
        kind="mech"
        roleLabel="Assigned Mech"
        message="No mech assigned."
        actions={<button type="button">+ Create</button>}
      />
    )
    expect(screen.getByText('Assigned Mech')).toBeTruthy()
    expect(screen.getByText('No mech assigned.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '+ Create' })).toBeTruthy()
  })

  test('no actions, no foot', () => {
    const { container } = render(
      <EmptyUnitSlot kind="crawler" roleLabel="Home Crawler" message="None." />
    )
    expect(container.querySelector('.empty-unit-slot__actions')).toBeNull()
  })
})
