import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { ClearFieldDialog, EndEncounterDialog } from '../ClearFieldDialogs'

async function click(el: HTMLElement) {
  await act(async () => {
    fireEvent.click(el)
  })
}

describe('Clear the field (MD-19)', () => {
  test('names how many leave, and clears only when confirmed', async () => {
    let cleared = 0
    let closed = 0
    render(
      <ClearFieldDialog
        open
        onClose={() => {
          closed += 1
        }}
        onTray={4}
        onClear={async () => {
          cleared += 1
        }}
      />
    )
    const dialog = within(screen.getByRole('alertdialog', { name: 'Clear the field?' }))
    expect(dialog.getByText(/removes 4 units from the Opposition/)).toBeTruthy()
    await click(dialog.getByRole('button', { name: 'Clear the field' }))
    await waitFor(() => expect(closed).toBe(1))
    expect(cleared).toBe(1)
  })
})

describe('End offers to clear the field (MD-19)', () => {
  function open(onEnd: (clear: boolean) => Promise<void>) {
    render(<EndEncounterDialog name="Ambush" onClose={() => undefined} onTray={1} onEnd={onEnd} />)
    return within(screen.getByRole('alertdialog', { name: 'End Ambush?' }))
  }

  test('leaving the Opposition on the field is the default', async () => {
    const ended: boolean[] = []
    const dialog = open(async (clear) => {
      ended.push(clear)
    })
    expect(
      (dialog.getByRole('radio', { name: 'Leave it on the field' }) as HTMLInputElement).checked
    ).toBe(true)
    await click(dialog.getByRole('button', { name: 'End' }))
    await waitFor(() => expect(ended).toEqual([false]))
  })

  test('choosing Clear the field ends and clears, naming what goes', async () => {
    const ended: boolean[] = []
    const dialog = open(async (clear) => {
      ended.push(clear)
    })
    await click(dialog.getByRole('radio', { name: 'Clear the field (removes 1 unit)' }))
    await click(dialog.getByRole('button', { name: 'End' }))
    await waitFor(() => expect(ended).toEqual([true]))
  })
})
