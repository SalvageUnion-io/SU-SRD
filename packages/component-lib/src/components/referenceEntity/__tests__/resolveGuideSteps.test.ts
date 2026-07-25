import { describe, expect, it } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { enrichForFiltering, matchesFilter, resolveGuideSteps } from '../card/resolveGuideSteps'

const guideByName = (name: string) => {
  const guide = SalvageUnionReference.Guides.find((g) => g.name === name)
  if (!guide) throw new Error(`Guide "${name}" not in the reference set`)
  return guide
}

describe('resolveGuideSteps', () => {
  it('resolves every step of every shipped guide', () => {
    const guides = SalvageUnionReference.Guides.all()
    expect(guides.length).toBeGreaterThan(0)
    for (const guide of guides) {
      expect(resolveGuideSteps(guide)).toHaveLength(guide.steps.length)
    }
  })

  it('returns [] for an entity that has no steps', () => {
    const chassis = SalvageUnionReference.Chassis.all()[0]
    expect(chassis).toBeDefined()
    if (chassis) expect(resolveGuideSteps(chassis)).toEqual([])
  })

  /** The regression this module exists for: guides keep most of their prose in
   *  `steps`, so a renderer reading only top-level `content` shows almost none
   *  of the guide. "Salvaging" has NO top-level content at all. */
  it('surfaces the step prose that top-level content omits', () => {
    const salvaging = guideByName('Salvaging')
    expect(salvaging.content ?? []).toHaveLength(0)

    const resolved = resolveGuideSteps(salvaging)
    const prose = resolved
      .flatMap(({ step }) => step.content ?? [])
      .filter((block) => typeof block.value === 'string')
      .map((block) => String(block.value))
      .join(' ')
    expect(prose.length).toBeGreaterThan(2000)
  })

  it('numbers steps within a section, restarting at each section boundary', () => {
    const downtime = guideByName('Crawler Downtime')
    const resolved = resolveGuideSteps(downtime)

    // Every step that opens a section restarts the count at 1.
    for (const entry of resolved) {
      if (entry.section) expect(entry.number).toBe(1)
    }
    // And numbering is strictly consecutive between boundaries.
    resolved.forEach((entry, index) => {
      const previous = resolved[index - 1]
      if (!previous || entry.section) return
      expect(entry.number).toBe(previous.number + 1)
    })
  })

  it('resolves a roll-table step to its table entity', () => {
    const resolved = resolveGuideSteps(guideByName('Create a Pilot'))
    const callsign = resolved.find(({ step }) => step.rollTable === 'Callsign Table')
    expect(callsign?.table?.name).toBe('Callsign Table')
    expect(callsign?.table?.table).toBeDefined()
  })

  it('keeps a schemaEntities step in the data order the book lists', () => {
    const resolved = resolveGuideSteps(guideByName('Create a Pilot'))
    const classes = resolved.find(({ step }) => step.name === 'Choose your Pilot Class')
    const names = step0Names(classes?.entities)
    expect(names).toEqual(classes?.step.schemaEntities ?? [])
  })

  /** `treeType` is COMPUTED, not stored — without enrichment this step would
   *  resolve to all 100+ abilities instead of the level-1 core ones. */
  it('applies computed-field filters when a step names no explicit entities', () => {
    const resolved = resolveGuideSteps(guideByName('Create a Pilot'))
    const ability = resolved.find(({ step }) => step.name === 'Choose your first Ability')
    expect(ability?.step.schemaEntities ?? []).toHaveLength(0)

    const all = SalvageUnionReference.Abilities.all().length
    expect(ability?.entities.length).toBeGreaterThan(0)
    expect(ability?.entities.length).toBeLessThan(all)
    for (const entity of ability?.entities ?? []) {
      expect((entity as { level?: number }).level).toBe(1)
    }
  })
})

function step0Names(entities: { name?: string }[] | undefined): string[] {
  return (entities ?? []).map((e) => e.name ?? '')
}

describe('matchesFilter', () => {
  it('skips a filter whose field the entity does not carry', () => {
    expect(matchesFilter({}, { field: 'techLevel', value: 1 })).toBe(true)
  })

  it('compares with eq by default and honours ne', () => {
    expect(matchesFilter({ techLevel: 1 }, { field: 'techLevel', value: 1 })).toBe(true)
    expect(matchesFilter({ techLevel: 2 }, { field: 'techLevel', value: 1 })).toBe(false)
    expect(matchesFilter({ techLevel: 2 }, { field: 'techLevel', operator: 'ne', value: 1 })).toBe(
      true
    )
  })

  it('applies min/max bounds to numeric fields', () => {
    expect(matchesFilter({ techLevel: 3 }, { field: 'techLevel', min: 2, max: 4 })).toBe(true)
    expect(matchesFilter({ techLevel: 5 }, { field: 'techLevel', min: 2, max: 4 })).toBe(false)
    expect(matchesFilter({ techLevel: 'B' }, { field: 'techLevel', min: 2 })).toBe(false)
  })
})

describe('enrichForFiltering', () => {
  it('classifies an ability tree as core when a class lists it', () => {
    const coreTree = SalvageUnionReference.Classes.all()
      .flatMap((c) => (c as { coreTrees?: string[] }).coreTrees ?? [])
      .find(Boolean)
    expect(coreTree).toBeDefined()
    const enriched = enrichForFiltering({ tree: coreTree }, 'abilities')
    expect(enriched.treeType).toBe('core')
  })

  it('classifies Generic and Legendary trees', () => {
    expect(enrichForFiltering({ tree: 'Generic' }, 'abilities').treeType).toBe('generic')
    expect(enrichForFiltering({ tree: 'Legendary Ace' }, 'abilities').treeType).toBe('legendary')
  })

  it('leaves entities of other schemas untouched', () => {
    const input = { tree: 'Generic' }
    expect(enrichForFiltering(input, 'equipment')).toBe(input)
  })
})
