/** Bring up to date (r5 D2): a preview naming what differs, then the pattern's loadout, with Undo. */
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { mechFixture } from '../../../components/__tests__/fixtures'
import { toast } from '../../../components/index'
import { PatternCatchUp } from '../PatternCatchUp'

afterEach(() => {
  cleanup()
  toast.dismiss()
})

describe('PatternCatchUp', () => {
  test('previews, then writes the pattern’s loadout; its Undo puts the old one back', async () => {
    const patch = mock(() => {})
    const mech = mechFixture({ id: 'm-1', name: 'Digger 2', systems: ['red-laser'], modules: [] })
    render(
      <PatternCatchUp
        mech={mech}
        stamp={{
          name: 'Digger',
          changed: true,
          differs: 'pattern adds Chainsaw Arm',
          loadout: { systems: ['red-laser', 'chainsaw-arm'], modules: [] },
        }}
        patch={patch}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Bring up to date' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.textContent).toContain('Bring Digger 2 up to date with Digger?')
    expect(dialog.textContent).toContain('pattern adds Chainsaw Arm.')
    expect(patch).not.toHaveBeenCalled()
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Bring up to date' }))
    })
    expect(patch).toHaveBeenCalledWith({ systems: ['red-laser', 'chainsaw-arm'], modules: [] })
    const line = toast.getToasts().find((t) => 'action' in t && t.action) as
      | { action: { onClick: (e: never) => void } }
      | undefined
    expect(line).toBeDefined()
    line?.action.onClick(undefined as never)
    expect(patch).toHaveBeenLastCalledWith({ systems: ['red-laser'], modules: [] })
  })
})
