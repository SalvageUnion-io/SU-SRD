/** The options chosen on a build's items, as the wizard keeps and saves them. */
import { describe, expect, it } from 'bun:test'
import { madeChoices, withItemChoice } from '../itemChoices'
import { EMPTY_MECH_FORM_STATE, mechFormToCreateInput } from '../mechFormState'
import { EMPTY_PILOT_FORM_STATE, pilotFormToCreateInput } from '../pilotFormState'

describe('withItemChoice', () => {
  it('replaces one item’s options and keeps every other item’s', () => {
    const before = { turret: { weapon: ['Laser'] }, kit: { fitting: ['Winch'] } }
    expect(withItemChoice(before, 'turret', { weapon: ['Cannon'] })).toEqual({
      turret: { weapon: ['Cannon'] },
      kit: { fitting: ['Winch'] },
    })
    expect(withItemChoice(undefined, 'turret', { weapon: ['Laser'] })).toEqual({
      turret: { weapon: ['Laser'] },
    })
  })
})

describe('madeChoices', () => {
  it('keeps the options of the items still held, and drops an emptied choice', () => {
    const choices = {
      turret: { weapon: ['Laser'], mount: [] },
      gone: { fitting: ['Winch'] },
      bare: { fitting: [] },
    }
    expect(madeChoices(choices, ['turret', 'turret', 'bare'])).toEqual({
      turret: { weapon: ['Laser'] },
    })
  })

  it('is undefined when nothing is chosen, as the unit’s field is', () => {
    expect(madeChoices(undefined, ['turret'])).toBeUndefined()
    expect(madeChoices({ gone: { fitting: ['Winch'] } }, ['turret'])).toBeUndefined()
  })
})

describe('a choice made at creation is saved on the unit', () => {
  it('a mech keeps its Systems’ and Modules’ options as itemChoices', () => {
    const input = mechFormToCreateInput({
      ...EMPTY_MECH_FORM_STATE,
      name: 'Iron Fist',
      chassisName: 'mule',
      systems: ['automated-weapon-turret'],
      modules: ['comms-module'],
      itemChoices: {
        'automated-weapon-turret': { weapon: ['Laser'] },
        'comms-module': { band: ['Short'] },
        'cargo-pod': { removed: ['Yes'] },
      },
    })
    expect(input.itemChoices).toEqual({
      'automated-weapon-turret': { weapon: ['Laser'] },
      'comms-module': { band: ['Short'] },
    })
  })

  it('a mech with no option chosen has no itemChoices', () => {
    const input = mechFormToCreateInput({
      ...EMPTY_MECH_FORM_STATE,
      name: 'Iron Fist',
      chassisName: 'mule',
      systems: ['cargo-pod'],
    })
    expect('itemChoices' in input).toBe(false)
  })

  it('a pilot keeps its equipment’s options as equipmentChoices', () => {
    const input = pilotFormToCreateInput({
      ...EMPTY_PILOT_FORM_STATE,
      name: 'Mira Voss',
      callsign: 'Sparks',
      equipment: ['custom-sniper-rifle', 'rope'],
      equipmentChoices: {
        'custom-sniper-rifle': { type: ['Ballistic'] },
        'holo-companion': { form: ['Cat'] },
      },
    })
    expect(input.equipmentChoices).toEqual({ 'custom-sniper-rifle': { type: ['Ballistic'] } })
  })
})
