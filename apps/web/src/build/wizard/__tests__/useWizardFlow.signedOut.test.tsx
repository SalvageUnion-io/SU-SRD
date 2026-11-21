/**
 * A guided wizard runs signed out and asks for the account at Save, keeping
 * the draft (SB-06, PT-23; ADR-034 as amended): nothing is created, the
 * session draft stays, and the sign-in ask opens.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { readWizardDraft } from '../../../lib/wizard/wizardDraft'
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
})
