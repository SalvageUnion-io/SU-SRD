/**
 * Wizard draft persistence: drafts mirror to the browser's storage (`draftStorage`),
 * restore on mount, and clear on demand. The full wizard integration
 * (restore after unmount, confirm-on-cancel) is covered in
 * PilotWizard-draft.test.tsx-style flows; these pin the primitive.
 */
import { describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import {
  clearWizardDraft,
  DRAFT_SCOPE,
  draftStorage,
  readWizardDraft,
  useWizardDraftSync,
  wizardDraftKey,
} from '../wizardDraft'

type Form = { name: string; items: string[] }
const EMPTY: Form = { name: '', items: [] }

describe('wizardDraft', () => {
  test('the r6 F6 ruling: a draft is kept in this browser, in every tab (localStorage)', () => {
    expect(DRAFT_SCOPE).toBe('browser')
    expect(draftStorage()).toBe(localStorage)
  })

  test('keys one draft slot per wizard kind', () => {
    expect(wizardDraftKey('pilot')).toBe('app-wizard-draft:pilot:new')
    expect(wizardDraftKey('mech')).toBe('app-wizard-draft:mech:new')
    expect(wizardDraftKey('crawler')).toBe('app-wizard-draft:crawler:new')
  })

  test('a dirty form persists and reads back; pristine forms never write', () => {
    const key = wizardDraftKey('pilot')
    const { result, rerender } = renderHook(
      ({ form }: { form: Form }) => useWizardDraftSync(key, form, EMPTY),
      { initialProps: { form: EMPTY } }
    )
    expect(result.current).toBe(false)
    expect(readWizardDraft<Form>(key)).toBeNull()

    act(() => {
      rerender({ form: { name: 'Ash', items: ['medkit'] } })
    })
    expect(result.current).toBe(true)
    expect(readWizardDraft<Form>(key)).toEqual({ name: 'Ash', items: ['medkit'] })
  })

  test('clearWizardDraft removes the stored draft', () => {
    const key = wizardDraftKey('crawler')
    draftStorage().setItem(key, JSON.stringify({ name: 'X', items: [] }))
    clearWizardDraft(key)
    expect(readWizardDraft<Form>(key)).toBeNull()
  })

  test('corrupt drafts read as null and self-clear', () => {
    const key = wizardDraftKey('mech')
    draftStorage().setItem(key, '{not json')
    expect(readWizardDraft<Form>(key)).toBeNull()
    expect(draftStorage().getItem(key)).toBeNull()
  })
})
