import { describe, it, expect } from 'bun:test'
import { SalvageUnionReference } from './index.js'
import { resolveChoiceView, type ChoiceSelections } from './resolveChoiceView.js'

const sniper = SalvageUnionReference.Equipment.find((e) => e.name === 'Custom Sniper Rifle')!

// Resolve choice ids from the real entity so the tests track the data, not
// hard-coded UUIDs.
const weaponTypeChoice = sniper.choices!.find((c) => c.name === 'Weapon Type')!
const modificationChoice = sniper.choices!.find((c) => c.name === 'Modification')!

const WEAPON_TYPE = weaponTypeChoice.id
const MODIFICATION = modificationChoice.id

function damage(view: ReturnType<typeof resolveChoiceView>) {
  return view.datavalues.find((dv) => dv.label === 'Damage')?.value
}

function range(view: ReturnType<typeof resolveChoiceView>) {
  return view.datavalues.find((dv) => dv.label === 'Range')?.value
}

function traitTypes(view: ReturnType<typeof resolveChoiceView>) {
  return view.traits.map((t) => t.type)
}

describe('resolveChoiceView — Custom Sniper Rifle fixture', () => {
  it('sanity: fixture has base datavalues and the two expected choices', () => {
    expect(sniper).toBeDefined()
    expect(damage(resolveChoiceView(sniper, {}))).toBe(2)
    expect(range(resolveChoiceView(sniper, {}))).toBe('Long')
    expect(weaponTypeChoice.schemaEntities).toEqual(['Ballistic', 'Energy'])
    expect(modificationChoice.multiSelect).toBe(true)
  })

  it('base row only (no selections): base stats, no traits, weapon-type prompt present', () => {
    const view = resolveChoiceView(sniper, {})

    expect(damage(view)).toBe(2)
    expect(range(view)).toBe('Long')
    expect(view.traits).toEqual([])

    // Weapon Type is required (exclusive trait-schema choice) → prompt.
    expect(view.prompts).toHaveLength(1)
    expect(view.prompts[0]).toEqual({
      choiceId: WEAPON_TYPE,
      label: 'Weapon Type',
      text: 'Choose: Ballistic or Energy',
    })
  })

  it('Ballistic selected: Ballistic trait added and weapon-type prompt gone', () => {
    const selections: ChoiceSelections = { [WEAPON_TYPE]: ['Ballistic'] }
    const view = resolveChoiceView(sniper, selections)

    expect(traitTypes(view)).toEqual(['Ballistic'])
    expect(view.prompts).toHaveLength(0)
    // Base stats untouched by a pure trait add.
    expect(damage(view)).toBe(2)
    expect(range(view)).toBe('Long')
  })

  it('Energy selected: Energy trait added (exclusive alternative)', () => {
    const view = resolveChoiceView(sniper, { [WEAPON_TYPE]: ['Energy'] })
    expect(traitTypes(view)).toEqual(['Energy'])
    expect(view.prompts).toHaveLength(0)
  })

  it('Rangefinder modification: Range raised to Far via setRange', () => {
    const view = resolveChoiceView(sniper, { [MODIFICATION]: ['Rangefinder'] })
    expect(range(view)).toBe('Far')
    expect(damage(view)).toBe(2)
  })

  it('High Calibre Rounds modification: Damage raised to 3 via addDamage', () => {
    const view = resolveChoiceView(sniper, { [MODIFICATION]: ['High Calibre Rounds'] })
    expect(damage(view)).toBe(3)
    expect(range(view)).toBe('Long')
  })

  it('Dum Dum Rounds modification: Anti-Organic trait added via addTrait', () => {
    const view = resolveChoiceView(sniper, { [MODIFICATION]: ['Dum Dum Rounds'] })
    expect(traitTypes(view)).toEqual(['Anti-Organic'])
  })

  it('option without effects (Compact Design) toggles chosen but does not alter the row', () => {
    const view = resolveChoiceView(sniper, { [MODIFICATION]: ['Compact Design'] })
    expect(damage(view)).toBe(2)
    expect(range(view)).toBe('Long')
    expect(view.traits).toEqual([])
  })

  it('Pinpoint Targeter modification: Targeter trait added via addTrait', () => {
    const view = resolveChoiceView(sniper, { [MODIFICATION]: ['Pinpoint Targeter'] })
    expect(traitTypes(view)).toEqual(['Targeter'])
  })

  it('multiple modifications combined: Rangefinder + High Calibre + Dum Dum stack', () => {
    const view = resolveChoiceView(sniper, {
      [MODIFICATION]: ['Rangefinder', 'High Calibre Rounds', 'Dum Dum Rounds'],
    })
    expect(range(view)).toBe('Far')
    expect(damage(view)).toBe(3)
    expect(traitTypes(view)).toContain('Anti-Organic')
  })

  it('weapon type + modifications combined: trait + range + damage all applied, no prompt', () => {
    const view = resolveChoiceView(sniper, {
      [WEAPON_TYPE]: ['Ballistic'],
      [MODIFICATION]: ['Rangefinder', 'High Calibre Rounds'],
    })
    expect(traitTypes(view)).toContain('Ballistic')
    expect(range(view)).toBe('Far')
    expect(damage(view)).toBe(3)
    expect(view.prompts).toHaveLength(0)
  })

  it('multiple trait-adding modifications stack additively (Anti-Matter + Flashy + Silencer)', () => {
    const view = resolveChoiceView(sniper, {
      [MODIFICATION]: ['Anti-Matter', 'Flashy', 'Silencer'],
    })
    const types = traitTypes(view)
    expect(types).toContain('Deadly')
    expect(types).toContain('Flashy')
    expect(types).toContain('Silent')
    expect(types).toHaveLength(3)
  })

  it('unresolved Weapon Type still prompts even when modifications are selected', () => {
    const view = resolveChoiceView(sniper, { [MODIFICATION]: ['Rangefinder'] })
    expect(view.prompts).toHaveLength(1)
    expect(view.prompts[0]?.choiceId).toBe(WEAPON_TYPE)
    expect(view.prompts[0]?.text).toBe('Choose: Ballistic or Energy')
  })

  it('is pure: does not mutate the source entity datavalues or traits', () => {
    const before = JSON.stringify(sniper.content)
    resolveChoiceView(sniper, {
      [WEAPON_TYPE]: ['Ballistic'],
      [MODIFICATION]: ['Rangefinder', 'High Calibre Rounds'],
    })
    expect(JSON.stringify(sniper.content)).toBe(before)
  })

  it('repeated resolution is deterministic', () => {
    const selections: ChoiceSelections = {
      [WEAPON_TYPE]: ['Energy'],
      [MODIFICATION]: ['Rangefinder', 'Dum Dum Rounds'],
    }
    const a = resolveChoiceView(sniper, selections)
    const b = resolveChoiceView(sniper, selections)
    expect(a).toEqual(b)
  })
})

describe('resolveChoiceView — edge cases', () => {
  it('entity with no choices returns base row and no prompts', () => {
    const view = resolveChoiceView({ content: sniper.content }, {})
    expect(damage(view)).toBe(2)
    expect(view.prompts).toEqual([])
    expect(view.traits).toEqual([])
  })

  it('entity with no datavalues block returns an empty datavalues array', () => {
    const view = resolveChoiceView({ choices: sniper.choices }, {})
    expect(view.datavalues).toEqual([])
    // Weapon Type prompt still surfaces.
    expect(view.prompts).toHaveLength(1)
  })

  it('multi-select choice with zero selections emits no prompt (optional)', () => {
    const view = resolveChoiceView(sniper, { [WEAPON_TYPE]: ['Ballistic'] })
    // Only Weapon Type was resolved; Modification (multiSelect) must not prompt.
    expect(view.prompts).toHaveLength(0)
  })

  it('unknown option value in selections is ignored', () => {
    const view = resolveChoiceView(sniper, { [MODIFICATION]: ['Nonexistent Mod'] })
    expect(damage(view)).toBe(2)
    expect(range(view)).toBe('Long')
    expect(view.traits).toEqual([])
  })

  it('base traits on the entity are preserved and copied (not referencing source)', () => {
    const entity = {
      content: sniper.content,
      traits: [{ type: 'Heavy' }],
      choices: sniper.choices,
    }
    const view = resolveChoiceView(entity, { [MODIFICATION]: ['Dum Dum Rounds'] })
    expect(traitTypes(view)).toEqual(['Heavy', 'Anti-Organic'])
    // Source traits untouched.
    expect(entity.traits).toEqual([{ type: 'Heavy' }])
  })
})
