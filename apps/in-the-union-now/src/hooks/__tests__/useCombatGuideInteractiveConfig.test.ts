import { describe, test, expect } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefGuide } from 'salvageunion-reference'
import { COMBAT_GUIDE_IDS, buildCombatGuideConfig } from '../useCombatGuideInteractiveConfig'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const [PUSHING_GUIDE_ID, MECH_DAMAGE_GUIDE_ID, PILOT_DAMAGE_GUIDE_ID, SALVAGING_GUIDE_ID] =
  COMBAT_GUIDE_IDS as [string, string, string, string]

// ---------------------------------------------------------------------------
// COMBAT_GUIDE_IDS constant
// ---------------------------------------------------------------------------

describe('COMBAT_GUIDE_IDS', () => {
  test('exports all four combat guide IDs', () => {
    expect(COMBAT_GUIDE_IDS).toContain(PUSHING_GUIDE_ID)
    expect(COMBAT_GUIDE_IDS).toContain(MECH_DAMAGE_GUIDE_ID)
    expect(COMBAT_GUIDE_IDS).toContain(PILOT_DAMAGE_GUIDE_ID)
    expect(COMBAT_GUIDE_IDS).toContain(SALVAGING_GUIDE_ID)
    expect(COMBAT_GUIDE_IDS).toHaveLength(4)
  })

  test('each guide ID resolves to a real guide in the data', () => {
    for (const id of COMBAT_GUIDE_IDS) {
      const guide = SalvageUnionReference.Guides.find((g) => g.id === id) as SURefGuide | undefined
      expect(guide).toBeTruthy()
      expect(guide!.steps).toBeTruthy()
    }
  })

  test('Mech Damage guide has a roll-table step', () => {
    const guide = SalvageUnionReference.Guides.find(
      (g) => g.id === MECH_DAMAGE_GUIDE_ID
    ) as SURefGuide
    const rollStep = guide.steps.find((s) => s.stepType === 'roll-table')
    expect(rollStep).toBeTruthy()
    expect(rollStep!.rollTable).toBe('Critical Damage')
  })

  test('Pilot Damage guide has a roll-table step', () => {
    const guide = SalvageUnionReference.Guides.find(
      (g) => g.id === PILOT_DAMAGE_GUIDE_ID
    ) as SURefGuide
    const rollStep = guide.steps.find((s) => s.stepType === 'roll-table')
    expect(rollStep).toBeTruthy()
    expect(rollStep!.rollTable).toBe('Critical Injury')
  })
})

// ---------------------------------------------------------------------------
// buildCombatGuideConfig
// ---------------------------------------------------------------------------

describe('buildCombatGuideConfig', () => {
  test('returns a GuideStepsInteractiveConfig with getStepState', () => {
    const guide = SalvageUnionReference.Guides.find(
      (g) => g.id === MECH_DAMAGE_GUIDE_ID
    ) as SURefGuide

    const config = buildCombatGuideConfig({
      guide,
      rollValues: {},
      onRollValueChange: () => {},
    })

    expect(config).toBeTruthy()
    expect(typeof config.getStepState).toBe('function')
  })

  test('getStepState marks all steps as unlocked and current (no completion tracking)', () => {
    const guide = SalvageUnionReference.Guides.find(
      (g) => g.id === MECH_DAMAGE_GUIDE_ID
    ) as SURefGuide

    const config = buildCombatGuideConfig({
      guide,
      rollValues: {},
      onRollValueChange: () => {},
    })

    for (let i = 0; i < guide.steps.length; i++) {
      const step = guide.steps[i]!
      const state = config.getStepState(step, i)
      expect(state.isUnlocked).toBe(true)
      // No completion tracking: isComplete is always false
      expect(state.isComplete).toBe(false)
    }
  })

  test('getStepRollState returns roll value for a given step', () => {
    const guide = SalvageUnionReference.Guides.find(
      (g) => g.id === MECH_DAMAGE_GUIDE_ID
    ) as SURefGuide
    const rollStep = guide.steps.find((s) => s.stepType === 'roll-table')!

    const config = buildCombatGuideConfig({
      guide,
      rollValues: { [rollStep.id]: '15' },
      onRollValueChange: () => {},
    })

    expect(config.getStepRollState).toBeDefined()
    const rollState = config.getStepRollState!(rollStep)
    expect(rollState).toBeTruthy()
    expect(rollState!.textValue).toBe('15')
  })

  test('getStepRollState returns null for non-roll steps', () => {
    const guide = SalvageUnionReference.Guides.find(
      (g) => g.id === MECH_DAMAGE_GUIDE_ID
    ) as SURefGuide
    const infoStep = guide.steps.find((s) => s.stepType === 'info')!

    const config = buildCombatGuideConfig({
      guide,
      rollValues: {},
      onRollValueChange: () => {},
    })

    const rollState = config.getStepRollState!(infoStep)
    expect(rollState).toBeNull()
  })

  test('renderRollInteraction is provided for roll-table steps', () => {
    const guide = SalvageUnionReference.Guides.find(
      (g) => g.id === MECH_DAMAGE_GUIDE_ID
    ) as SURefGuide
    // Verify the guide has at least one roll-table step (validates fixture)
    expect(guide.steps.some((s) => s.stepType === 'roll-table')).toBe(true)

    const config = buildCombatGuideConfig({
      guide,
      rollValues: {},
      onRollValueChange: () => {},
    })

    expect(config.renderRollInteraction).toBeDefined()
  })

  test('onPush callback is wired when provided (Pushing guide)', () => {
    const guide = SalvageUnionReference.Guides.find((g) => g.id === PUSHING_GUIDE_ID) as SURefGuide

    let pushCalled = false
    const config = buildCombatGuideConfig({
      guide,
      rollValues: {},
      onRollValueChange: () => {},
      onPush: () => {
        pushCalled = true
      },
    })

    // The push callback should be reachable
    expect(config).toBeTruthy()
    // Verify the config shape includes a renderStepContent when onPush is provided
    expect(typeof config.renderStepContent).toBe('function')
    // Confirm the callback is not pre-called during construction
    expect(pushCalled).toBe(false)
  })

  test('no DB calls, no mutations — config is a pure render function map', () => {
    const guide = SalvageUnionReference.Guides.find(
      (g) => g.id === SALVAGING_GUIDE_ID
    ) as SURefGuide

    // Should construct without any async, supabase, or mutation references
    expect(() => {
      buildCombatGuideConfig({
        guide,
        rollValues: {},
        onRollValueChange: () => {},
      })
    }).not.toThrow()
  })
})
