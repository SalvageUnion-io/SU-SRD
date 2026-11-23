/**
 * The Pilot wizard's names (r7 F7, SB7-07): the Callsign is required, the Name
 * optional, each with a Roll; Roll the rest fills every empty field that has a
 * table and leaves what was typed.
 */
import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { CallsignStep } from '../CallsignStep'
import { RollTheRest } from '../RollTheRest'
import type { PilotIdentityField, RollTableDeps } from '../rollTableHelpers.model'

/** Every table lands on one row, named for its table. */
const DEPS: RollTableDeps = {
  findTable: (name) =>
    ({
      id: name,
      name,
      schemaName: 'roll-tables',
      table: { '1-20': { value: `${name} result` } },
    }) as never,
  d20For: async () => () => 7,
}

describe('CallsignStep', () => {
  test('the Callsign is required and comes first; the Name is optional; each has a Roll', () => {
    render(<CallsignStep name="" callsign="" onChange={() => {}} _rollDeps={DEPS} />)
    const boxes = screen.getAllByRole('textbox')
    expect(boxes[0]?.id).toBe('pilot-callsign')
    expect((boxes[0] as HTMLInputElement).required).toBe(true)
    expect((boxes[1] as HTMLInputElement).required).toBe(false)
    expect(screen.getByText('Name (optional)')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Roll callsign' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Roll name' })).toBeTruthy()
  })

  test('a blank Name shows the Callsign it will be stored as', () => {
    render(<CallsignStep name="" callsign="Sparks" onChange={() => {}} />)
    expect(screen.getByRole('textbox', { name: /Name/ }).getAttribute('placeholder')).toBe('Sparks')
  })
})

describe('RollTheRest', () => {
  const values = (over: Partial<Record<PilotIdentityField, string>>) => ({
    name: '',
    callsign: '',
    motto: '',
    keepsake: '',
    background: '',
    appearance: '',
    ...over,
  })

  test('fills every empty field and leaves what was typed', async () => {
    let rolled: Partial<Record<PilotIdentityField, string>> = {}
    render(
      <RollTheRest
        values={values({ callsign: 'Sparks' })}
        onRolled={(patch) => {
          rolled = patch
        }}
        _rollDeps={DEPS}
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Roll the rest/ }))
    })
    expect(rolled.callsign).toBeUndefined()
    expect(Object.keys(rolled).sort()).toEqual(
      ['appearance', 'background', 'keepsake', 'motto', 'name'].sort()
    )
  })

  test('off once every field holds something', () => {
    const full = values({
      name: 'a',
      callsign: 'b',
      motto: 'c',
      keepsake: 'd',
      background: 'e',
      appearance: 'f',
    })
    render(<RollTheRest values={full} onRolled={() => {}} />)
    expect(screen.getByRole('button', { name: /Roll the rest/ }).hasAttribute('disabled')).toBe(
      true
    )
  })
})
