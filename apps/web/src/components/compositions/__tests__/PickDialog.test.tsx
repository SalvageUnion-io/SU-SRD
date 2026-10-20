/**
 * PickDialog — the one pick dialog (ruleset §6.6, hard rule R24): one radio
 * group of Compacts, a titled group under its Slab, one empty state, and the act
 * off until something is picked.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { unitRowModel } from '../../../lib/units/unitModel'
import type { PickGroup } from '../PickDialog'
import { PickDialog } from '../PickDialog'

const choice = (id: string, name: string, kind: 'pilot' | 'mech') => ({
  id,
  label: name,
  model: unitRowModel({ kind, name }),
})

const GROUPS: PickGroup[] = [
  { key: 'pilot', title: 'Pilots', choices: [choice('p1', 'Bonesaw', 'pilot')] },
  { key: 'mech', title: 'Mechs', choices: [choice('m1', 'Mazona', 'mech')] },
  { key: 'crawler', title: 'Crawlers', choices: [] },
]

function pick(props: Partial<Parameters<typeof PickDialog>[0]> = {}) {
  const picks: string[] = []
  let confirmed = 0
  render(
    <PickDialog
      open
      onOpenChange={() => {}}
      title="Move in from your Training Bay"
      groups={GROUPS}
      empty="Nothing in your Training Bay can move in."
      selected={null}
      onSelect={(id) => picks.push(id)}
      confirmLabel="Move in"
      {...props}
      confirm={props.confirm ?? (props.selected ? () => confirmed++ : undefined)}
    />
  )
  return { picks, confirmed: () => confirmed }
}

describe('PickDialog', () => {
  test('one radio group; each titled group under its Slab; an empty group left out', () => {
    const { picks } = pick()
    const group = screen.getByRole('radiogroup', { name: 'Move in from your Training Bay' })
    expect(within(group).getByRole('region', { name: 'Pilots' })).toBeTruthy()
    expect(within(group).getByRole('heading', { name: 'Mechs' })).toBeTruthy()
    expect(within(group).queryByRole('region', { name: 'Crawlers' })).toBeNull()
    fireEvent.click(within(group).getByRole('radio', { name: 'Mazona' }))
    expect(picks).toEqual(['m1'])
  })

  test('the act is off until something is picked', () => {
    pick()
    const act = screen.getByRole('button', { name: 'Move in' }) as HTMLButtonElement
    expect(act.disabled).toBe(true)
  })

  test('a pick checks its Compact and turns the act on', () => {
    const { confirmed } = pick({ selected: 'p1' })
    expect(screen.getByRole('radio', { name: 'Bonesaw' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Move in' }))
    expect(confirmed()).toBe(1)
  })

  test('nothing on offer is the one empty state, never a hint line', () => {
    pick({ groups: [{ key: 'pilot', title: 'Pilots', choices: [] }] })
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.getByText('Nothing in your Training Bay can move in.')).toBeTruthy()
  })

  test('loading pends', () => {
    pick({ groups: undefined, loading: 'your Training Bay' })
    expect(screen.getByRole('status').textContent).toContain('your Training Bay')
  })
})
