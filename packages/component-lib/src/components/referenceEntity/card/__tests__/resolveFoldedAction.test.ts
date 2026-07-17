/**
 * The self-action fold rule (choice-plan Stage 6). Encodes the exact behavior
 * change: the same-named action folds regardless of action count; a lone
 * differently-named action still folds; multiple differently-named actions with
 * no self-action fold nothing. Uses real entity/action names from the dataset.
 */
import { describe, expect, test } from 'bun:test'
import { resolveFoldedAction } from '../resolveFoldedAction'

const a = (name: string) => ({ name })

describe('resolveFoldedAction', () => {
  test('single same-named action folds (Grenade)', () => {
    expect(resolveFoldedAction([a('Grenade')], 'Grenade')?.name).toBe('Grenade')
  })

  test('MULTI-action entity folds its same-named self-action (Holo Companion)', () => {
    // The bug: the old `length === 1` gate refused to fold here, dropping the
    // self-action's choices/content and disagreeing with getChoices.
    const actions = [a('Holo Companion'), a('Project'), a('Un-Project')]
    expect(resolveFoldedAction(actions, 'Holo Companion')?.name).toBe('Holo Companion')
  })

  test('MULTI-action entity folds self-action (Bionic Arms)', () => {
    const actions = [a('Bionic Arms'), a('Bionic Arms Attack')]
    expect(resolveFoldedAction(actions, 'Bionic Arms')?.name).toBe('Bionic Arms')
  })

  test('single differently-named action still folds its facets (Meld Drone → Bite)', () => {
    expect(resolveFoldedAction([a('Bite')], 'Meld Drone')?.name).toBe('Bite')
  })

  test('multiple differently-named actions, no self-action → nothing folds', () => {
    // e.g. a repair system whose actions are Patch / System Repair, none named
    // like the entity — each renders as its own card.
    expect(resolveFoldedAction([a('Patch'), a('System Repair')], 'Nanite Sifter')).toBeUndefined()
  })

  test('no actions → nothing folds', () => {
    expect(resolveFoldedAction([], 'Whatever')).toBeUndefined()
  })
})
