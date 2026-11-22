/** A kept wizard draft in words, and the question a "Build with this" link asks of it (r2 D1). */

import { afterEach, describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { draftConflict, wizardDraftSummary, wizardDrafts } from '../draftSummary'
import { EMPTY_MECH_FORM_STATE } from '../mechFormState'
import { EMPTY_PILOT_FORM_STATE } from '../pilotFormState'
import { draftStorage, wizardDraftKey } from '../wizardDraft'

const classId = (name: string) => {
  const cls = SalvageUnionReference.Classes.getByName(name)
  if (!cls) throw new Error(`no class ${name}`)
  return cls.id
}
const keep = (kind: 'pilot' | 'mech' | 'crawler', form: unknown) =>
  draftStorage().setItem(wizardDraftKey(kind), JSON.stringify(form))

afterEach(() => draftStorage().clear())

describe('wizardDraftSummary', () => {
  test('no draft, no line', () => {
    expect(wizardDraftSummary('pilot')).toBeNull()
    expect(wizardDrafts()).toEqual([])
  })

  test('a draft is named by its pick, pilots first', () => {
    keep('mech', { ...EMPTY_MECH_FORM_STATE, chassisName: 'mule' })
    keep('pilot', { ...EMPTY_PILOT_FORM_STATE, classId: classId('Hacker'), name: 'Ada Test' })
    expect(wizardDrafts()).toEqual([
      { kind: 'pilot', label: 'Hacker pilot' },
      { kind: 'mech', label: 'Mule mech' },
    ])
  })

  test('a draft with no pick yet is its bare kind', () => {
    keep('pilot', { ...EMPTY_PILOT_FORM_STATE, name: 'Ada' })
    expect(wizardDraftSummary('pilot')).toEqual({ kind: 'pilot', label: 'pilot' })
  })
})

describe('draftConflict', () => {
  test('a link naming another class than the draft’s asks, naming both', () => {
    keep('pilot', { ...EMPTY_PILOT_FORM_STATE, classId: classId('Hacker') })
    expect(draftConflict('pilot', { class: 'engineer' })).toEqual({
      draft: 'Hacker pilot',
      fresh: 'Engineer pilot',
    })
    expect(draftConflict('pilot', { class: 'scout' })?.fresh).toBe('Scout pilot')
  })

  test('the same pick, no pick, or no draft asks nothing', () => {
    expect(draftConflict('pilot', { class: 'engineer' })).toBeNull()
    keep('pilot', { ...EMPTY_PILOT_FORM_STATE, classId: classId('Hacker') })
    expect(draftConflict('pilot', { class: 'hacker' })).toBeNull()
    expect(draftConflict('pilot', {})).toBeNull()
    // A pick the wizard never offers is dropped, as the wizard drops it.
    expect(draftConflict('pilot', { class: 'not-a-class' })).toBeNull()
    // A draft with no class yet takes the link's pick: nothing to choose between.
    keep('pilot', { ...EMPTY_PILOT_FORM_STATE, name: 'Ada' })
    expect(draftConflict('pilot', { class: 'engineer' })).toBeNull()
  })

  test('a mech draft on another chassis asks', () => {
    keep('mech', { ...EMPTY_MECH_FORM_STATE, chassisName: 'mule' })
    const magpie = SalvageUnionReference.Chassis.all().find(
      (c) => c.techLevel === 1 && c.name !== 'Mule'
    )
    expect(magpie).toBeDefined()
    if (!magpie) return
    const slug = magpie.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    expect(draftConflict('mech', { chassis: slug })).toEqual({
      draft: 'Mule mech',
      fresh: `${magpie.name} mech`,
    })
    expect(draftConflict('mech', { chassis: 'mule', pattern: 'anything' })).toBeNull()
  })
})
