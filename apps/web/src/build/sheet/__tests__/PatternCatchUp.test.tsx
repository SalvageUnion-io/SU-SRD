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
  differs: 'Digger has 1 System this Mech lacks: Chainsaw Arm',
  lacksOnly: true as const,
  loadout: { systems: ['red-laser', 'chainsaw-arm'], modules: [] },
}

describe('PatternCatchUp', () => {
  test('says how the Mech differs, and Bring back writes the pattern’s loadout at once, with Undo', async () => {
    const patch = mock(() => {})
    const mech = mechFixture({ id: 'm-1', name: 'Digger 2', systems: ['red-laser'], modules: [] })
    render(<PatternCatchUp mech={mech} stamp={stamp} patch={patch} />)
    expect(screen.getByText('Digger has 1 System this Mech lacks: Chainsaw Arm')).toBeTruthy()
    // Not the viewer's pattern: nothing to update.
    expect(screen.queryByRole('button', { name: 'Update the pattern from this Mech' })).toBeNull()
    await act(async () => {
      // What the pattern has, brought in (r7 G3).
      fireEvent.click(screen.getByRole('button', { name: "Bring in the pattern's changes" }))
    })
    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(patch).toHaveBeenCalledWith({ systems: ['red-laser', 'chainsaw-arm'], modules: [] })
    const line = toast.getToasts().find((t) => 'action' in t && t.action) as
      | { action: { onClick: (e: never) => void } }
      | undefined
    expect(line).toBeDefined()
    expect((line as { title?: unknown } | undefined)?.title).toBe('Digger 2 now matches Digger.')
    line?.action.onClick(undefined as never)
    expect(patch).toHaveBeenLastCalledWith({ systems: ['red-laser'], modules: [] })
  })

  test('a Mech behind its own pattern is never offered to write itself over it (r8 E3)', () => {
    const mech = mechFixture({ id: 'm-1', name: 'Digger 2', sourcePattern: 'p1' })
    render(<PatternCatchUp mech={mech} stamp={{ ...stamp, own: true }} patch={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Update the pattern from this Mech' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Save as a new pattern' })).toBeNull()
    expect(screen.getByRole('button', { name: "Bring in the pattern's changes" })).toBeTruthy()
  })

  test('the viewer’s own pattern can be updated from a Mech ahead of it; a reader gets the words alone', () => {
    const mech = mechFixture({ id: 'm-1', name: 'Digger 2', sourcePattern: 'p1' })
    const { lacksOnly: _only, ...ahead } = stamp
    const { rerender } = render(
      <PatternCatchUp mech={mech} stamp={{ ...ahead, own: true }} patch={() => {}} />
    )
    expect(screen.getByRole('button', { name: 'Update the pattern from this Mech' })).toBeTruthy()
    // Keeping both builds is one press away (r8 E4).
    expect(screen.getByRole('button', { name: 'Save as a new pattern' })).toBeTruthy()
    rerender(<PatternCatchUp mech={mech} stamp={{ ...ahead, own: true }} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Digger has 1 System this Mech lacks: Chainsaw Arm')).toBeTruthy()
  })

  test('a Mech that differs both ways is brought back to the pattern', () => {
    const mech = mechFixture({ id: 'm-1', name: 'Digger 2' })
    const { lacksOnly: _only, ...both } = stamp
    render(
      <PatternCatchUp
        mech={mech}
        stamp={{ ...both, differs: 'Added Red Laser (vs Digger)' }}
        patch={() => {}}
      />
    )
    expect(screen.getByText('Added Red Laser (vs Digger)')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Bring back to the pattern' })).toBeTruthy()
  })
})
