/**
 * The sheet's "⋯" writes (R62: a unit's acts ride its ⋯): Make a copy puts a
 * separate copy on the shelf at once, Delete removes the unit behind its
 * confirm; a mech also saves as a pattern there.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { installServerMocks } from '../../../components/__tests__/serverMock'

const serverMocks = await installServerMocks()

const { Sheet } = await import('../Sheet')
const { resetStores } = await import('../../../replica/__tests__/resetStores')
const { withSignedInBackend } = await import('../../../replica/__tests__/signedInBackend')
const { useUnits } = await import('../../../replica/units')

afterAll(() => {
  serverMocks.restore()
})

withSignedInBackend()

beforeEach(() => {
  resetStores()
})

const PILOT = {
  schemaVersion: 1 as const,
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'scavenger',
  abilities: [],
  equipment: [],
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  conditions: [],
}

/** Open the sheet's "⋯" and pick `item`. */
async function pick(item: string | RegExp) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }))
  })
  await act(async () => {
    fireEvent.click(await screen.findByRole('menuitem', { name: item }))
  })
}

/** Press the button `label` on the confirm titled `title`. */
async function confirmWith(title: string, label: string) {
  const dialog = await screen.findByRole('alertdialog', { name: title })
  await act(async () => {
    fireEvent.click(
      Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === label) as Element
    )
  })
}

describe('the sheet’s ⋯ writes', () => {
  test('Make a copy puts a second, separate pilot on the shelf', async () => {
    const pilot = await useUnits.getState().create('pilot', PILOT)
    render(<Sheet kind="pilot" id={pilot.id} />)

    await pick('Make a copy')
    // A copy only adds: it runs at once, behind no confirm.
    expect(screen.queryByRole('alertdialog')).toBeNull()

    await waitFor(() => expect(useUnits.getState().pilots).toHaveLength(2))
    const copy = useUnits.getState().pilots.find((p) => p.id !== pilot.id)
    expect(copy?.name).toBe('COPY OF Yara Voss')
    // Its callsign reads apart from the original's (r2 G6).
    expect(copy?.callsign).toBe('Ghost 2')
  })

  test('Delete removes the pilot once confirmed, and not before', async () => {
    const pilot = await useUnits.getState().create('pilot', PILOT)
    render(<Sheet kind="pilot" id={pilot.id} />)

    await pick(/^Delete/)
    expect(await screen.findByRole('alertdialog', { name: 'Delete Yara Voss?' })).toBeTruthy()
    expect(useUnits.getState().pilots).toHaveLength(1)
    await confirmWith('Delete Yara Voss?', 'Delete')

    await waitFor(() => expect(useUnits.getState().pilots).toHaveLength(0))
  })
})
