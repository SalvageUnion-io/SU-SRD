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
    const control = () => screen.getByLabelText('Edit pattern name')
    fireEvent.click(control())
    fireEvent.change(control(), { target: { value: '  Old Rusty  ' } })
    fireEvent.keyDown(control(), { key: 'Enter' })
    await waitFor(() => expect(patches).toEqual([{ name: 'Old Rusty' }]))
  })

  test('an empty name is never written', async () => {
    const patches: object[] = []
    render(<MechIdentityPanel mech={mechFixture({ id: 'm1' })} patch={(p) => patches.push(p)} />)
    const control = () => screen.getByLabelText('Edit pattern name')
    fireEvent.click(control())
    fireEvent.change(control(), { target: { value: '   ' } })
    fireEvent.keyDown(control(), { key: 'Enter' })
    await waitFor(() => expect(control().tagName).not.toBe('INPUT'))
    expect(patches).toEqual([])
  })
})
