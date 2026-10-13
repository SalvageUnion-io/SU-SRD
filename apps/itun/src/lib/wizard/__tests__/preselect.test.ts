import { describe, expect, test } from 'bun:test'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { EMPTY_MECH_FORM_STATE } from '../mechFormState'
import {
  parseSlugParam,
  preselectedChassis,
  preselectedClassId,
  preselectedCrawlerType,
  preselectedPattern,
  withMechPreselection,
  withPreselection,
} from '../preselect'

describe('parseSlugParam', () => {
  test('keeps a slug and drops anything else', () => {
    expect(parseSlugParam('mule')).toBe('mule')
    expect(parseSlugParam('battle-crawler')).toBe('battle-crawler')
    expect(parseSlugParam('Mule')).toBeUndefined()
    expect(parseSlugParam('../mule')).toBeUndefined()
    expect(parseSlugParam('')).toBeUndefined()
    expect(parseSlugParam(7)).toBeUndefined()
    expect(parseSlugParam(undefined)).toBeUndefined()
  })
})

describe('preselectedChassis', () => {
  test('a Tech 1 chassis slug passes through', () => {
    expect(preselectedChassis('mule')).toBe('mule')
  })

  test('a chassis the wizard never offers, or no chassis at all, is dropped', () => {
    const tech2 = SalvageUnionReference.Chassis.all().find((c) => c.techLevel === 2)
    expect(tech2).toBeDefined()
    if (tech2) expect(preselectedChassis(getEntitySlug(tech2))).toBeUndefined()
    expect(preselectedChassis('not-a-chassis')).toBeUndefined()
    expect(preselectedChassis(undefined)).toBeUndefined()
  })
})

describe('preselectedClassId', () => {
  test('a core class slug resolves to its id', () => {
    const engineer = SalvageUnionReference.Classes.getByName('Engineer')
    expect(preselectedClassId('engineer')).toBe(engineer?.id)
  })

  test('a class without core trees (advanced / hybrid) is dropped', () => {
    const advanced = SalvageUnionReference.Classes.all().find((c) => !('coreTrees' in c))
    expect(advanced).toBeDefined()
    if (advanced) expect(preselectedClassId(getEntitySlug(advanced))).toBeUndefined()
    expect(preselectedClassId('not-a-class')).toBeUndefined()
  })
})

describe('preselectedCrawlerType', () => {
  test('every crawler type is a legal start; anything else is dropped', () => {
    for (const type of SalvageUnionReference.Crawlers.all()) {
      expect(preselectedCrawlerType(getEntitySlug(type))).toBe(getEntitySlug(type))
    }
    expect(preselectedCrawlerType('not-a-crawler')).toBeUndefined()
  })
})

describe('withPreselection', () => {
  test('fills an empty pick', () => {
    expect(withPreselection(EMPTY_MECH_FORM_STATE, 'chassisName', 'mule').chassisName).toBe('mule')
  })

  test('leaves a chosen pick — a draft in progress — alone', () => {
    const draft = { ...EMPTY_MECH_FORM_STATE, chassisName: 'jackhammer' }
    expect(withPreselection(draft, 'chassisName', 'mule')).toBe(draft)
  })

  test('no preselection is no change', () => {
    expect(withPreselection(EMPTY_MECH_FORM_STATE, 'chassisName', undefined)).toBe(
      EMPTY_MECH_FORM_STATE
    )
  })
})

describe('preselectedPattern', () => {
  test("a Tech 1 chassis's legal starting pattern resolves", () => {
    expect(preselectedPattern('mule', 'hauler')?.name).toBe('Hauler')
  })

  test('a pattern the wizard never offers, or a chassis it never offers, is dropped', () => {
    expect(preselectedPattern('mule', 'crusher')).toBeUndefined()
    expect(preselectedPattern('mule', 'not-a-pattern')).toBeUndefined()
    expect(preselectedPattern('not-a-chassis', 'hauler')).toBeUndefined()
    expect(preselectedPattern(undefined, 'hauler')).toBeUndefined()
    expect(preselectedPattern('mule', undefined)).toBeUndefined()
    // A pattern slug only means anything on its own chassis.
    expect(preselectedPattern('mazona', 'hauler')).toBeUndefined()
  })
})

describe('withMechPreselection', () => {
  const hauler = () => {
    const pattern = preselectedPattern('mule', 'hauler')
    if (!pattern) throw new Error('Hauler fixture missing')
    return pattern
  }

  test('a fresh form takes the chassis and the pattern loadout', () => {
    const form = withMechPreselection(EMPTY_MECH_FORM_STATE, 'mule', hauler())
    expect(form.chassisName).toBe('mule')
    expect(form.patternName).toBe('Hauler')
    expect(form.name).toBe('Hauler')
    expect(form.systems.length).toBeGreaterThan(0)
    expect(form.modules.length).toBeGreaterThan(0)
  })

  test('a draft on another chassis, or with a loadout begun, is left alone', () => {
    const elsewhere = { ...EMPTY_MECH_FORM_STATE, chassisName: 'jackhammer' }
    expect(withMechPreselection(elsewhere, 'mule', hauler())).toBe(elsewhere)
    const begun = { ...EMPTY_MECH_FORM_STATE, chassisName: 'mule', systems: ['zoom-optics'] }
    expect(withMechPreselection(begun, 'mule', hauler())).toBe(begun)
  })
})
