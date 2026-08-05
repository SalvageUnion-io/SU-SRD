/**
 * Wizard draft persistence (audit item 3): drafts mirror to sessionStorage,
 * restore on mount, and clear on demand. The full wizard integration
 * (restore after unmount, confirm-on-cancel) is covered in
 * PilotWizard-draft.test.tsx-style flows; these pin the primitive.
 */
import { describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import {
  clearWizardDraft,
  readWizardDraft,
  useWizardDraftSync,
  wizardDraftKey,
} from '../wizardDraft'

type Form = { name: string; items: string[] }
const EMPTY: Form = { name: '', items: [] }

describe('wizardDraft', () => {
  test('keys separate create drafts from per-entity edit drafts', () => {
    expect(wizardDraftKey('pilot')).toBe('itun-wizard-draft:pilot:new')
    expect(wizardDraftKey('mech', 'abc')).toBe('itun-wizard-draft:mech:edit:abc')
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
    const key = wizardDraftKey('crawler', 'c1')
    sessionStorage.setItem(key, JSON.stringify({ name: 'X', items: [] }))
    clearWizardDraft(key)
    expect(readWizardDraft<Form>(key)).toBeNull()
  })

  test('corrupt drafts read as null and self-clear', () => {
    const key = wizardDraftKey('mech')
    sessionStorage.setItem(key, '{not json')
    expect(readWizardDraft<Form>(key)).toBeNull()
    expect(sessionStorage.getItem(key)).toBeNull()
  })
})
