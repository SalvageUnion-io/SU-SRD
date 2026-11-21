/**
 * A "Build with this" link never reopens an old draft silently (r2 D1): with
 * a draft on another pick it asks once, and Resume and Start new both work
 * from the question. The Training Bay names a kept draft and resumes it.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EMPTY_PILOT_FORM_STATE } from '../../../lib/wizard/pilotFormState'
import { readWizardDraft, wizardDraftKey } from '../../../lib/wizard/wizardDraft'
import { DraftGate } from '../DraftGate'
import { WizardDrafts } from '../WizardDrafts'

const KEY = wizardDraftKey('pilot')
const hacker = () => {
  const cls = SalvageUnionReference.Classes.getByName('Hacker')
  if (!cls) throw new Error('no Hacker')
  sessionStorage.setItem(KEY, JSON.stringify({ ...EMPTY_PILOT_FORM_STATE, classId: cls.id }))
}

afterEach(() => sessionStorage.clear())

async function press(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

describe('DraftGate', () => {
  test('a link to another class asks; Resume opens the draft and drops the link’s pick', async () => {
    hacker()
    let resumed = 0
    const gate = (picks: { class?: string }) => (
      <DraftGate kind="pilot" picks={picks} onResume={() => resumed++}>
        <p>the wizard</p>
      </DraftGate>
    )
    const { rerender } = render(gate({ class: 'scout' }))
    expect(
      screen.getByRole('heading', {
        name: 'Resume your Hacker pilot draft, or start a new Scout pilot?',
      })
    ).toBeTruthy()
    expect(screen.queryByText('the wizard')).toBeNull()

    await press('Resume Hacker pilot draft')
    expect(resumed).toBe(1)
    // The wizard waits for the pick to leave the address: mounted with it, it
    // would lay Scout over the draft it restores.
    expect(screen.queryByText('the wizard')).toBeNull()
    rerender(gate({}))
    expect(screen.getByText('the wizard')).toBeTruthy()
    expect(readWizardDraft(KEY)).not.toBeNull()
  })

  test('Start new discards the draft and opens the wizard on the link’s pick', async () => {
    hacker()
    let resumed = 0
    render(
      <DraftGate kind="pilot" picks={{ class: 'scout' }} onResume={() => resumed++}>
        <p>the wizard</p>
      </DraftGate>
    )
    await press('Start new Scout pilot')
    expect(resumed).toBe(0)
    expect(readWizardDraft(KEY)).toBeNull()
    expect(screen.getByText('the wizard')).toBeTruthy()
  })

  test('the draft’s own class, or no draft, opens the wizard unasked', () => {
    hacker()
    render(
      <DraftGate kind="pilot" picks={{ class: 'hacker' }} onResume={() => {}}>
        <p>the wizard</p>
      </DraftGate>
    )
    expect(screen.getByText('the wizard')).toBeTruthy()
  })
})

describe('WizardDrafts', () => {
  test('nothing with no draft; a kept draft is a line with its Resume', () => {
    const { container, unmount } = render(<WizardDrafts />)
    expect(container.textContent).toBe('')
    unmount()
    hacker()
    render(<WizardDrafts />)
    expect(screen.getByText('Draft: Hacker pilot')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Resume: Hacker pilot' })).toBeTruthy()
  })
})
