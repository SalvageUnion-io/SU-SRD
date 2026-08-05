/**
 * Tests for DialConfig — the ⚙ overlay. Verifies toggling visibility and
 * reordering emit the expected CockpitPrefs, and that Actions is locked.
 */

import { describe, expect, test } from 'bun:test'
import { fireEvent, render } from '@testing-library/react'
import type { CockpitPrefs, DialKind } from '../../../lib/schemas/cockpitPrefs'
import { DialConfig } from '../DialConfig'

const KINDS: DialKind[] = ['actions', 'mech', 'pilot', 'tables', 'srd']

function setup(prefs?: CockpitPrefs) {
  let last: CockpitPrefs | undefined
  const onChange = (next: CockpitPrefs) => {
    last = next
  }
  const utils = render(
    <DialConfig kinds={KINDS} prefs={prefs} onChange={onChange} onClose={() => {}} />
  )
  return { ...utils, get: () => last }
}

describe('DialConfig', () => {
  test('the Actions row checkbox is disabled (locked visible)', () => {
    const { getByLabelText } = setup()
    const actions = getByLabelText('Show Actions') as HTMLInputElement
    expect(actions.disabled).toBe(true)
    expect(actions.checked).toBe(true)
  })

  test('unchecking a row emits prefs with that kind hidden', () => {
    const { getByLabelText, get } = setup()
    fireEvent.click(getByLabelText('Show Pilot'))
    expect(get()?.hidden).toEqual(['pilot'])
  })

  test('re-checking a hidden row removes it from hidden', () => {
    const { getByLabelText, get } = setup({ hidden: ['pilot'], order: [] })
    fireEvent.click(getByLabelText('Show Pilot'))
    expect(get()?.hidden).toEqual([])
  })

  test('moving a kind up reorders and emits the full order', () => {
    const { getByLabelText, get } = setup()
    // Move "Mech" (index 1) up → swaps with Actions.
    fireEvent.click(getByLabelText('Move Mech up'))
    expect(get()?.order).toEqual(['mech', 'actions', 'pilot', 'tables', 'srd'])
  })

  test('moving a kind down reorders and emits the full order', () => {
    const { getByLabelText, get } = setup()
    fireEvent.click(getByLabelText('Move Pilot down'))
    expect(get()?.order).toEqual(['actions', 'mech', 'tables', 'pilot', 'srd'])
  })
})
