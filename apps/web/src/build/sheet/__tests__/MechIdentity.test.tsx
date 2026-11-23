/**
 * The mech's identity panel: its name is its pattern's name, and a rename
 * writes `name` alone, so the pattern it started from (`startingPatternRef`,
 * provenance) survives it.
 */

import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mechFixture } from '../../../components/__tests__/fixtures'
import { MechIdentityPanel } from '../MechIdentity'

describe('renaming a mech', () => {
  test('writes the name alone, keeping the book pattern it started from', async () => {
    const patches: object[] = []
    const mech = mechFixture({ id: 'm1', name: 'Scrapper', startingPatternRef: 'swiss-cheese' })
    render(<MechIdentityPanel mech={mech} patch={(p) => patches.push(p)} />)
    const control = () => screen.getByLabelText('Edit mech name')
    fireEvent.click(control())
    fireEvent.change(control(), { target: { value: '  Old Rusty  ' } })
    fireEvent.keyDown(control(), { key: 'Enter' })
    await waitFor(() => expect(patches).toEqual([{ name: 'Old Rusty' }]))
  })

  test('an empty name is never written', async () => {
    const patches: object[] = []
    render(<MechIdentityPanel mech={mechFixture({ id: 'm1' })} patch={(p) => patches.push(p)} />)
    const control = () => screen.getByLabelText('Edit mech name')
    fireEvent.click(control())
    fireEvent.change(control(), { target: { value: '   ' } })
    fireEvent.keyDown(control(), { key: 'Enter' })
    await waitFor(() => expect(control().tagName).not.toBe('INPUT'))
    expect(patches).toEqual([])
  })
})

describe('a Mech just built or copied (r7 G4, G5)', () => {
  test('opens with its name selected for typing, once', async () => {
    const { typeNameOnArrival, nameAwaitsTyping } = await import('../nameOnArrival.model')
    const { useSheetModeStore } = await import('../sheetMode.model')
    useSheetModeStore.getState().setEditing(false)
    typeNameOnArrival('m-new')
    // Its sheet opens in Edit, where the name is written.
    expect(useSheetModeStore.getState().editing).toBe(true)
    const mech = mechFixture({ id: 'm-new', name: 'Longhaul 1' })
    const first = render(<MechIdentityPanel mech={mech} patch={() => {}} />)
    const field = screen.getByLabelText('Edit mech name') as HTMLInputElement
    expect(field.tagName).toBe('INPUT')
    expect(document.activeElement).toBe(field)
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 'Longhaul 1'.length])
    expect(nameAwaitsTyping('m-new')).toBe(false)
    first.unmount()
    // A later visit opens as usual.
    render(<MechIdentityPanel mech={mech} patch={() => {}} />)
    expect(screen.getByLabelText('Edit mech name').tagName).not.toBe('INPUT')
    useSheetModeStore.getState().setEditing(false)
  })
})
