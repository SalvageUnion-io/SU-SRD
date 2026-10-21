/**
 * SheetItemLine — an item's controls in its Mini's chip group (C8, hard
 * rules R6 and R11): the condition is the tri-state `StatusBadge`, Uses the
 * horizontal `Stat` in edit mode, then the actions and the one ✕, each in
 * the Mini's `[data-chip-group]`, whose name is then the link.
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import type { EntityFormModel } from '../../../components/index'
import { Entity } from '../../../components/index'
import { SheetItemLine } from '../SheetItemLine'

const MODEL: EntityFormModel = {
  ref: { schemaName: 'systems', id: 'x', slug: 'token', name: 'Mini', synthetic: true },
  title: 'Mini',
  kind: { stamp: 'System', type: 'System', domain: 'gear', nature: 'have' },
  tone: 'ink',
  facts: [],
  traits: [],
  art: { kind: 'none' },
}

const TOKEN = <Entity size="mini" context="loadout" model={MODEL} mode={{ kind: 'read' }} />

/** The chip group a control sits in. */
const groupOf = (el: Element) => el.closest('[data-chip-group]')

describe('SheetItemLine — Read', () => {
  test('a live condition still steps in Read (a crawler bay, round 6)', () => {
    const onConditionCycle = mock(() => undefined)
    render(
      <SheetItemLine
        token={TOKEN}
        name="Mech Bay"
        condition="intact"
        readOnly
        liveCondition
        onConditionCycle={onConditionCycle}
        nextCondition="damaged"
      />
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Mech Bay status: Intact. Activate to mark Damaged' })
    )
    expect(onConditionCycle).toHaveBeenCalledTimes(1)
  })

  test('without it, Read draws an intact item as its Mini alone', () => {
    render(
      <SheetItemLine
        token={TOKEN}
        name="Mech Bay"
        condition="intact"
        readOnly
        onConditionCycle={() => undefined}
      />
    )
    expect(screen.queryByRole('button', { name: /status:/ })).toBeNull()
  })
})

describe('SheetItemLine — Edit', () => {
  test('the condition is the StatusBadge, which steps it on', () => {
    const onConditionCycle = mock(() => undefined)
    render(
      <SheetItemLine
        token={TOKEN}
        name="Data Scanner"
        condition="intact"
        readOnly={false}
        onConditionCycle={onConditionCycle}
      />
    )
    const badge = screen.getByRole('button', {
      name: 'Data Scanner status: Intact. Activate to mark Damaged',
    })
    expect(badge.closest('.su-sheet-item__condition')).toBeTruthy()
    expect(groupOf(badge)).toBeTruthy()
    fireEvent.click(badge)
    expect(onConditionCycle).toHaveBeenCalledTimes(1)
  })

  test('Uses is a label-first Stat with its steps, clamped to 0 and the max', () => {
    const onChange = mock((_next: number) => undefined)
    const { container } = render(
      <SheetItemLine
        token={TOKEN}
        name="First Aid Kit"
        readOnly={false}
        uses={{ remaining: 3, max: 3, onChange }}
      />
    )
    const cell = container.querySelector('.su-sheet-item__uses')
    expect(cell?.classList.contains('su-stat-cell')).toBe(true)
    expect(cell?.textContent).toBe('Uses3/3')
    const add = screen.getByRole<HTMLButtonElement>('button', {
      name: 'Increase First Aid Kit uses',
    })
    expect(add.disabled).toBe(true)
    expect(groupOf(add)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Decrease First Aid Kit uses' }))
    expect(onChange).toHaveBeenCalledWith(2)
    expect(screen.getByRole('status').textContent).toBe('First Aid Kit uses: 3')
  })

  test('an item with no uses draws no Uses', () => {
    const { container } = render(
      <SheetItemLine
        token={TOKEN}
        name="Data Scanner"
        readOnly={false}
        uses={{ remaining: 0, max: 0, onChange: () => undefined }}
      />
    )
    expect(container.querySelector('.su-sheet-item__uses')).toBeNull()
  })
})

describe('SheetItemLine — Read', () => {
  test('intact, the Mini alone', () => {
    const { container } = render(
      <SheetItemLine token={TOKEN} name="Data Scanner" condition="intact" readOnly />
    )
    expect(container.textContent?.startsWith('Mini')).toBe(true)
    expect(container.textContent).not.toContain('Intact')
  })

  test('damaged, the StatusBadge reads it, with nothing to press', () => {
    render(<SheetItemLine token={TOKEN} name="Data Scanner" condition="damaged" readOnly />)
    expect(screen.getByText('Damaged')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
