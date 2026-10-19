/**
 * UnitRow — a player unit as the library Row: the name on the cut-out, its
 * readings label-first chips, its note and the host's labels right of the
 * title, and View / Unassign as the head's controls, never inside a link.
 * EmptyUnitSlot — the dashed placeholder an unfilled slot keeps.
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { unitRowModel } from '../../../lib/units/unitModel'
import { EmptyUnitSlot } from '../EmptyUnitSlot'
import { UnitRow } from '../UnitRow'

const rowOf = (name: string) => {
  const row = screen.getByText(name).closest('.su-entity-row')
  if (!(row instanceof HTMLElement)) throw new Error(`no row for ${name}`)
  return row
}

/** A unit Row's chips as [class, text] pairs, in the order drawn (`Chips`' lanes). */
const lanesOf = (name: string) =>
  [...rowOf(name).querySelectorAll('[data-chip-class]')].flatMap((lane) =>
    [...lane.querySelectorAll('.su-stat-cell')].map((cell) => [
      lane.getAttribute('data-chip-class'),
      cell.textContent,
    ])
  )

describe('unitRowModel budget (C3): a unit Row keeps its rank and its lead vital', () => {
  test('a mech keeps SP of SP, EP and Heat', () => {
    render(
      <UnitRow
        kind="mech"
        name="Iron Fist"
        readings={[
          { label: 'TL', value: 2, chip: 'rank' },
          { label: 'SP', value: '9/13' },
          { label: 'EP', value: '6/11' },
          { label: 'Heat', value: '4/12' },
        ]}
      />
    )
    expect(lanesOf('Iron Fist')).toEqual([
      ['rank', 'TL2'],
      ['measure', 'SP9/13'],
    ])
  })

  test('a pilot keeps HP of HP and AP; a crawler SP of SP and Bays', () => {
    render(
      <>
        <UnitRow
          kind="pilot"
          name="Ace"
          readings={[
            { label: 'HP', value: '7/10' },
            { label: 'AP', value: '4/6' },
          ]}
        />
        <UnitRow
          kind="crawler"
          name="Tenacity"
          readings={[
            { label: 'TL', value: 3 },
            { label: 'SP', value: '20/25' },
            { label: 'Bays', value: '4/5 Intact' },
          ]}
        />
      </>
    )
    expect(lanesOf('Ace')).toEqual([['measure', 'HP7/10']])
    expect(lanesOf('Tenacity')).toEqual([
      ['rank', 'TL3'],
      ['measure', 'SP20/25'],
    ])
  })

  test('the model carries only the rank and the measures, grouped for the budget', () => {
    const model = unitRowModel({
      kind: 'mech',
      name: 'Iron Fist',
      readings: [
        { label: 'Chassis', value: 'Mule', chip: 'relation' },
        { label: 'TL', value: 1 },
        { label: 'SP', value: '9/13' },
        { label: 'Role', value: 'Lead', chip: 'mark' },
      ],
    })
    expect(model.facts.map((f) => [f.key, f.group])).toEqual([
      ['tech-level', 'provenance'],
      ['SP', 'vitals'],
    ])
  })
})

describe('UnitRow', () => {
  test('the library Row: the name on the paper cut-out, the frame the Row’s', () => {
    render(<UnitRow kind="mech" name="Iron Fist" />)
    const row = rowOf('Iron Fist')
    expect(row.querySelector('.su-entity-row__notch')?.textContent).toContain('Iron Fist')
    expect(row.querySelector('.su-entity-row__frame')).not.toBeNull()
  })

  test('readings are label-first chips, each in its class lane', () => {
    render(
      <UnitRow
        kind="mech"
        name="Iron Fist"
        readings={[
          { label: 'Chassis', value: 'Mule', chip: 'relation' },
          { label: 'TL', value: 1, chip: 'rank' },
          { label: 'SP', value: '9/13' },
          { label: 'Condition', value: 'Intact', chip: 'state' },
        ]}
      />
    )
    expect(lanesOf('Iron Fist')).toEqual([
      ['rank', 'TL1'],
      ['measure', 'SP9/13'],
      ['relation', 'ChassisMule'],
      ['state', 'ConditionIntact'],
    ])
  })

  test('a reading with no class: TL ranks, a number measures, a name relates', () => {
    render(
      <UnitRow
        kind="pilot"
        name="Ace"
        readings={[
          { label: 'Class', value: 'Hacker' },
          { label: 'TL', value: 2 },
          { label: 'HP', value: '7/10' },
        ]}
      />
    )
    expect(lanesOf('Ace')).toEqual([
      ['rank', 'TL2'],
      ['measure', 'HP7/10'],
      ['relation', 'ClassHacker'],
    ])
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
    expect(container.querySelector('.su-empty-unit-slot__actions')).toBeNull()
  })
})
