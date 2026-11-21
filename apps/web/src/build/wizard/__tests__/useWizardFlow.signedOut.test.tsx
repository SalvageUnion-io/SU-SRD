/**
 * A guided wizard runs signed out and asks for the account at Save, keeping
 * the draft (SB-06, PT-23; ADR-034 as amended): nothing is created, the
 * session draft stays, and the sign-in ask opens.
 */

import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { toast } from '../../../components/index'
import { EMPTY_MECH_FORM_STATE } from '../../../lib/wizard/mechFormState'
import { readWizardDraft, wizardDraftKey } from '../../../lib/wizard/wizardDraft'
import { resetStores } from '../../../replica/__tests__/resetStores'
import type { SyncState } from '../../../replica/syncContext'
import { SyncContext } from '../../../replica/syncContext'
import { useUnits } from '../../../replica/units'
import { useWizardFlow } from '../useWizardFlow'

const SIGNED_OUT: SyncState = { status: 'signedOut', canWrite: false, outdated: false }
const DRAFT_KEY = 'test:wizard-draft'

beforeEach(() => {
  sessionStorage.clear()
  resetStores()
})
afterEach(() => {
  sessionStorage.clear()
  resetStores()
})

function wrapper({ children }: { children: ReactNode }) {
  return <SyncContext.Provider value={SIGNED_OUT}>{children}</SyncContext.Provider>
}

describe('useWizardFlow — signed out', () => {
  test('Save asks for the account and keeps the draft; nothing is created', async () => {
    const form = { name: 'Bullseye' }
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form))
    const completed: string[] = []
    const { result } = renderHook(
      () =>
        useWizardFlow({
          entityType: 'mech',
          noun: 'Mech',
          steps: ['review'] as const,
          stepLabels: { review: 'Name & Review' },
          gateFor: () => ({ ok: true }),
          initialStep: 'review',
          submitStep: 'review',
          form,
          draftKey: DRAFT_KEY,
          formDirty: true,
          schema: { safeParse: () => ({ success: true }) },
          toCreateInput: () => {
            throw new Error('a signed-out Save must not build a create input')
          },
          failureMessage: 'The mech could not be saved. Try again.',
          onComplete: (id) => completed.push(id),
          onCancel: () => {},
        }),
      { wrapper }
    )
    // Step 1 says up front that saving needs a sign-in (r2 D2).
    expect(result.current.shell.tryNote).toBe('Try it now. Saving needs a free sign-in.')
    // The submit step keeps the build as a file or on paper (r2 D3).
    expect(result.current.shell.keepAsFile).toBeDefined()
    expect(result.current.shell.signIn.open).toBe(false)
    await act(async () => {
      result.current.shell.onNext()
    })
    expect(result.current.shell.signIn.open).toBe(true)
    expect(completed).toEqual([])
    expect(useUnits.getState().mechs).toEqual([])
    expect(readWizardDraft<typeof form>(DRAFT_KEY)).toEqual(form)
    await act(async () => {
      result.current.shell.signIn.onClose()
    })
    expect(result.current.shell.signIn.open).toBe(false)
  })

  test('a step forward is a history entry: the browser’s Back is one step, not the way out', async () => {
    const steps = ['a', 'b', 'c'] as const
    const { result } = renderHook(
      () =>
        useWizardFlow({
          entityType: 'mech',
          noun: 'Mech',
          steps,
          stepLabels: { a: 'A', b: 'B', c: 'C' },
          gateFor: () => ({ ok: true }),
          initialStep: 'a',
          submitStep: 'c',
          form: { name: 'x' },
          draftKey: DRAFT_KEY,
          formDirty: false,
          schema: { safeParse: () => ({ success: true }) },
          toCreateInput: () => ({}) as never,
          failureMessage: 'no',
          onComplete: () => {},
          onCancel: () => {},
        }),
      { wrapper }
    )
    await act(async () => result.current.shell.onNext())
    await act(async () => result.current.shell.onNext())
    expect(result.current.step).toBe('c')
    expect(window.location.hash).toBe('#step-3')
    // The browser's Back: the entry before, and its step.
    await act(async () => {
      window.history.replaceState(null, '', '#step-2')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current.step).toBe('b')
    // Back to the entry the wizard opened on: its first step.
    await act(async () => {
      window.history.replaceState(null, '', window.location.pathname)
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(result.current.step).toBe('a')
  })

  /** A one-step mech wizard over the mech's real draft slot. */
  function leavable(formDirty: boolean) {
    const key = wizardDraftKey('mech')
    return renderHook(
      () =>
        useWizardFlow({
          entityType: 'mech',
          noun: 'Mech',
          steps: ['review'] as const,
          stepLabels: { review: 'Name & Review' },
          gateFor: () => ({ ok: true }),
          initialStep: 'review',
          submitStep: 'review',
          form: { name: 'Bullseye' },
          draftKey: key,
          formDirty,
          schema: { safeParse: () => ({ success: true }) },
          toCreateInput: () => {
            throw new Error('not saved here')
          },
          failureMessage: 'The mech could not be saved. Try again.',
          onComplete: () => {},
          onCancel: () => {},
        }),
      { wrapper }
    )
  }

  test('leaving with a build in progress says the draft is kept (r2 D1)', async () => {
    const said = spyOn(toast, 'info').mockImplementation(() => 'id')
    try {
      sessionStorage.setItem(
        wizardDraftKey('mech'),
        JSON.stringify({ ...EMPTY_MECH_FORM_STATE, chassisName: 'mule' })
      )
      const { unmount } = leavable(true)
      unmount()
      await Promise.resolve()
      expect(said).toHaveBeenCalledTimes(1)
      expect(said.mock.calls[0]?.[0]).toBe(
        'Your Mule mech draft is kept in this tab. Resume it from the Training Bay.'
      )
    } finally {
      said.mockRestore()
    }
  })

  test('Cancel, or a wizard nothing was done in, says nothing on the way out', async () => {
    const said = spyOn(toast, 'info').mockImplementation(() => 'id')
    try {
      sessionStorage.setItem(wizardDraftKey('mech'), JSON.stringify(EMPTY_MECH_FORM_STATE))
      const cancelled = leavable(true)
      await act(async () => {
        cancelled.result.current.shell.onCancel()
      })
      cancelled.unmount()
      const pristine = leavable(false)
      pristine.unmount()
      await Promise.resolve()
      expect(said).not.toHaveBeenCalled()
    } finally {
      said.mockRestore()
    }
  })
})
