/**
 * The pilot's identity panel in Edit: each field writes its trimmed text, a
 * required one (name, callsign) never writes empty, and Change Class writes the
 * new class in one patch once confirmed. Read offers no edit at all.
 */

import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { pilotFixture } from '../../../components/__tests__/fixtures'
import { resolveClassName } from '../../../lib/classRef'
import { PilotIdentityPanel } from '../PilotIdentity'

const PILOT = pilotFixture({
  id: 'p1',
  name: 'Yara Voss',
  callsign: 'Ghost',
  classRef: 'hauler',
})

/** Type `value` into the field labelled `label` and commit it. */
function edit(label: string, value: string) {
  const control = () => screen.getByLabelText(`Edit ${label}`)
  fireEvent.click(control())
  fireEvent.change(control(), { target: { value } })
  fireEvent.keyDown(control(), { key: 'Enter' })
}

describe('PilotIdentityPanel', () => {
  test('a freeform field writes its trimmed text', async () => {
    const patches: object[] = []
    render(<PilotIdentityPanel pilot={PILOT} patch={(p) => patches.push(p)} />)
    edit('pronouns', '  they/them ')
    await waitFor(() => expect(patches).toEqual([{ pronouns: 'they/them' }]))
  })

  test('a required field writes trimmed, and never writes empty', async () => {
    const patches: object[] = []
    render(<PilotIdentityPanel pilot={PILOT} patch={(p) => patches.push(p)} />)
    edit('callsign', '   ')
    edit('name', ' Yara Voss-Kade ')
    await waitFor(() => expect(patches).toEqual([{ name: 'Yara Voss-Kade' }]))
  })

  test('Change Class writes the picked class once confirmed, and Cancel writes nothing', async () => {
    const patches: Record<string, unknown>[] = []
    render(<PilotIdentityPanel pilot={PILOT} patch={(p) => patches.push(p as never)} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Change Class' }))
    })
    let dialog = await screen.findByRole('dialog')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(patches).toEqual([])

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Change Class' }))
    })
    dialog = await screen.findByRole('dialog')
    const confirm = () =>
      within(dialog).getAllByRole('button', { name: 'Change Class' }).at(-1) as HTMLButtonElement
    // The current class is no change: nothing to confirm yet.
    expect(confirm().disabled).toBe(true)
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('radio', { name: /Scout/ }))
    })
    expect(confirm().disabled).toBe(false)
    await act(async () => {
      fireEvent.click(confirm())
    })
    expect(patches).toHaveLength(1)
    expect(resolveClassName(String(patches[0]?.classRef))).toBe('Scout')
  })

  test('Read offers no class change and no field to edit', () => {
    render(<PilotIdentityPanel pilot={PILOT} />)
    expect(screen.queryByRole('button', { name: 'Change Class' })).toBeNull()
    expect(screen.queryByLabelText('Edit pronouns')).toBeNull()
  })
})
