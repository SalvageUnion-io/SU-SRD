/** The drift line (r6 E2): how the Mech differs, from its side, and the two ways to act on it. */
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { mechFixture } from '../../../components/__tests__/fixtures'
import { toast } from '../../../components/index'
import { PatternCatchUp } from '../PatternCatchUp'

afterEach(() => {
  cleanup()
  toast.dismiss()
})

const stamp = {
  name: 'Digger',
  changed: true as const,
  differs: 'Removed Chainsaw Arm',
  loadout: { systems: ['red-laser', 'chainsaw-arm'], modules: [] },
}

describe('PatternCatchUp', () => {
  test('says how the Mech differs, and Bring back writes the pattern’s loadout at once, with Undo', async () => {
    const patch = mock(() => {})
    const mech = mechFixture({ id: 'm-1', name: 'Digger 2', systems: ['red-laser'], modules: [] })
    render(<PatternCatchUp mech={mech} stamp={stamp} patch={patch} />)
    expect(screen.getByText('Removed Chainsaw Arm (vs Digger)')).toBeTruthy()
    // Not the viewer's pattern: nothing to update.
    expect(screen.queryByRole('button', { name: 'Update the pattern from this Mech' })).toBeNull()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Bring back to the pattern' }))
    })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(patch).toHaveBeenCalledWith({ systems: ['red-laser', 'chainsaw-arm'], modules: [] })
    const line = toast.getToasts().find((t) => 'action' in t && t.action) as
      | { action: { onClick: (e: never) => void } }
      | undefined
    expect(line).toBeDefined()
    line?.action.onClick(undefined as never)
    expect(patch).toHaveBeenLastCalledWith({ systems: ['red-laser'], modules: [] })
  })

  test('the viewer’s own pattern can be updated from the Mech; a reader gets the words alone', () => {
    const mech = mechFixture({ id: 'm-1', name: 'Digger 2', sourcePattern: 'p1' })
    const { rerender } = render(
      <PatternCatchUp mech={mech} stamp={{ ...stamp, own: true }} patch={() => {}} />
    )
    expect(screen.getByRole('button', { name: 'Update the pattern from this Mech' })).toBeTruthy()
    rerender(<PatternCatchUp mech={mech} stamp={{ ...stamp, own: true }} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Removed Chainsaw Arm (vs Digger)')).toBeTruthy()
  })
})
