import { describe, it, expect } from 'bun:test'
import { resolveChoiceView, type ChoiceSelections } from './resolveChoiceView.js'
import type {
  SURefObjectChoice,
  SURefObjectContentBlock,
  SURefObjectDataValue,
  SURefObjectTrait,
} from './schemas/index.js'

/**
 * These tests drive the resolver from the schema, not from any specific real
 * entity. Every fixture is a minimal, synthetic `{ content, traits, choices }`
 * shaped exactly as the Zod schemas allow, so each effect op, choice shape, and
 * branch is covered by construction — no dependency on whichever items happen to
 * carry choices in the dataset.
 */

type ResolvableEntity = {
  content?: SURefObjectContentBlock[]
  traits?: SURefObjectTrait[]
  choices?: SURefObjectChoice[]
}

type OptionsSource = Extract<NonNullable<SURefObjectChoice['source']>, { kind: 'options' }>
type ChoiceOption = OptionsSource['options'][number]
type ChoiceEffect = NonNullable<ChoiceOption['effects']>[number]
type Cardinality = NonNullable<SURefObjectChoice['cardinality']>

/** An optional multi-pick choice ("take as many modifications as you like"). */
const OPTIONAL_MULTI: Cardinality = { min: 0, max: 99 }

// --- fixture builders -------------------------------------------------------

function entity(parts: {
  datavalues?: SURefObjectDataValue[]
  traits?: SURefObjectTrait[]
  choices?: SURefObjectChoice[]
}): ResolvableEntity {
  return {
    content: parts.datavalues
      ? [{ type: 'datavalues', value: parts.datavalues } satisfies SURefObjectContentBlock]
      : undefined,
    traits: parts.traits,
    choices: parts.choices,
  }
}

const addTrait = (value: string, amount?: number): ChoiceEffect =>
  amount === undefined ? { op: 'addTrait', value } : { op: 'addTrait', value, amount }
const removeTrait = (value: string): ChoiceEffect => ({ op: 'removeTrait', value })
const setRange = (value: string | number): ChoiceEffect => ({ op: 'setRange', value })
const addDamage = (value: number, unit?: string): ChoiceEffect =>
  unit === undefined ? { op: 'addDamage', value } : { op: 'addDamage', value, unit }

const option = (value: string, effects?: ChoiceEffect[]): ChoiceOption => ({
  value,
  label: value,
  ...(effects ? { effects } : {}),
})

/** An inline structured option list — `source.kind: 'options'`. */
function optionChoice(
  id: string,
  options: ChoiceOption[],
  opts: { name?: string; cardinality?: Cardinality } = {}
): SURefObjectChoice {
  return {
    id,
    name: opts.name ?? id,
    source: { kind: 'options', options },
    ...(opts.cardinality ? { cardinality: opts.cardinality } : {}),
  }
}

/** A shortlist catalog choice — `source.kind: 'catalog'` with named `entities`
 * (e.g. Weapon Type → Ballistic / Energy): the resolver infers
 * `addTrait <selectedName>`, and an unresolved one with no declared cardinality
 * is required. */
function traitSchemaChoice(
  id: string,
  entities: string[],
  opts: { name?: string; cardinality?: Cardinality } = {}
): SURefObjectChoice {
  return {
    id,
    name: opts.name ?? id,
    source: { kind: 'catalog', entities },
    ...(opts.cardinality ? { cardinality: opts.cardinality } : {}),
  }
}

// --- accessors --------------------------------------------------------------

type View = ReturnType<typeof resolveChoiceView>
const datavalue = (view: View, label: string) => view.datavalues.find((d) => d.label === label)
const damage = (view: View) => datavalue(view, 'Damage')?.value
const range = (view: View) => datavalue(view, 'Range')?.value
const traitTypes = (view: View) => view.traits.map((t) => t.type)
const traitAmount = (view: View, type: string) => view.traits.find((t) => t.type === type)?.amount

const DV: SURefObjectDataValue[] = [
  { label: 'Damage', type: 'keyword', value: 2 },
  { label: 'Range', type: 'keyword', value: 'Long' },
]

// ---------------------------------------------------------------------------

describe('resolveChoiceView — base datavalues', () => {
  it('passes the base row through unchanged when there are no selections', () => {
    const view = resolveChoiceView(entity({ datavalues: DV }), {})
    expect(damage(view)).toBe(2)
    expect(range(view)).toBe('Long')
    expect(view.traits).toEqual([])
    expect(view.prompts).toEqual([])
  })

  it('returns an empty datavalues array when the entity has no datavalues block', () => {
    expect(resolveChoiceView({ choices: [] }, {}).datavalues).toEqual([])
  })

  it('does not mutate the source content block', () => {
    const e = entity({
      datavalues: DV,
      choices: [
        optionChoice('mod', [option('boost', [addDamage(1)])], { cardinality: OPTIONAL_MULTI }),
      ],
    })
    const before = JSON.stringify(e.content)
    resolveChoiceView(e, { mod: ['boost'] })
    expect(JSON.stringify(e.content)).toBe(before)
  })
})

describe('resolveChoiceView — setRange effect', () => {
  it('replaces the existing Range value', () => {
    const e = entity({
      datavalues: DV,
      choices: [
        optionChoice('mod', [option('rf', [setRange('Far')])], { cardinality: OPTIONAL_MULTI }),
      ],
    })
    const view = resolveChoiceView(e, { mod: ['rf'] })
    expect(range(view)).toBe('Far')
    expect(damage(view)).toBe(2)
  })

  it('creates a Range datavalue when none exists', () => {
    const e = entity({
      datavalues: [{ label: 'Damage', type: 'keyword', value: 2 }],
      choices: [
        optionChoice('mod', [option('rf', [setRange('Close')])], { cardinality: OPTIONAL_MULTI }),
      ],
    })
    const view = resolveChoiceView(e, { mod: ['rf'] })
    expect(range(view)).toBe('Close')
  })
})

describe('resolveChoiceView — addDamage effect', () => {
  it('sums a numeric Damage value', () => {
    const e = entity({
      datavalues: DV,
      choices: [
        optionChoice('mod', [option('hc', [addDamage(1)])], { cardinality: OPTIONAL_MULTI }),
      ],
    })
    expect(damage(resolveChoiceView(e, { mod: ['hc'] }))).toBe(3)
  })

  it('sums when the base Damage is a numeric string', () => {
    const e = entity({
      datavalues: [{ label: 'Damage', type: 'keyword', value: '2' }],
      choices: [
        optionChoice('mod', [option('hc', [addDamage(2)])], { cardinality: OPTIONAL_MULTI }),
      ],
    })
    expect(damage(resolveChoiceView(e, { mod: ['hc'] }))).toBe(4)
  })

  it('creates a Damage datavalue with its unit when none exists', () => {
    const e = entity({
      datavalues: [{ label: 'Range', type: 'keyword', value: 'Long' }],
      choices: [
        optionChoice('mod', [option('hc', [addDamage(1, 'SP')])], { cardinality: OPTIONAL_MULTI }),
      ],
    })
    const view = resolveChoiceView(e, { mod: ['hc'] })
    expect(damage(view)).toBe(1)
    expect(datavalue(view, 'Damage')?.unit).toBe('SP')
  })

  it('concatenates with the unit when the base Damage is non-numeric', () => {
    const e = entity({
      datavalues: [{ label: 'Damage', type: 'keyword', value: '2d6' }],
      choices: [
        optionChoice('mod', [option('hc', [addDamage(1, 'SP')])], { cardinality: OPTIONAL_MULTI }),
      ],
    })
    expect(damage(resolveChoiceView(e, { mod: ['hc'] }))).toBe('2d6 / +1 SP')
  })
})

describe('resolveChoiceView — addTrait effect', () => {
  it('adds a new trait', () => {
    const e = entity({
      choices: [
        optionChoice('mod', [option('dd', [addTrait('Anti-Organic')])], {
          cardinality: OPTIONAL_MULTI,
        }),
      ],
    })
    expect(traitTypes(resolveChoiceView(e, { mod: ['dd'] }))).toEqual(['Anti-Organic'])
  })

  it('adds a trait carrying an amount', () => {
    const e = entity({
      choices: [
        optionChoice('mod', [option('napalm', [addTrait('Burn', 1)])], {
          cardinality: OPTIONAL_MULTI,
        }),
      ],
    })
    expect(traitAmount(resolveChoiceView(e, { mod: ['napalm'] }), 'Burn')).toBe(1)
  })

  it('upgrades the amount of an existing trait in place (no duplicate)', () => {
    const e = entity({
      traits: [{ type: 'Explosive', amount: 1 }],
      choices: [
        optionChoice('mod', [option('boom', [addTrait('Explosive', 2)])], {
          cardinality: OPTIONAL_MULTI,
        }),
      ],
    })
    const view = resolveChoiceView(e, { mod: ['boom'] })
    expect(traitAmount(view, 'Explosive')).toBe(2)
    expect(view.traits.filter((t) => t.type === 'Explosive')).toHaveLength(1)
  })

  it('does not duplicate an existing trait when no new amount is given', () => {
    const e = entity({
      traits: [{ type: 'Ballistic' }],
      choices: [
        optionChoice('mod', [option('again', [addTrait('Ballistic')])], {
          cardinality: OPTIONAL_MULTI,
        }),
      ],
    })
    expect(traitTypes(resolveChoiceView(e, { mod: ['again'] }))).toEqual(['Ballistic'])
  })
})

describe('resolveChoiceView — removeTrait effect', () => {
  it('strips an existing trait', () => {
    const e = entity({
      traits: [{ type: 'Heavy' }, { type: 'Missile' }],
      choices: [
        optionChoice('mod', [option('portable', [removeTrait('Heavy')])], {
          cardinality: OPTIONAL_MULTI,
        }),
      ],
    })
    expect(traitTypes(resolveChoiceView(e, { mod: ['portable'] }))).toEqual(['Missile'])
  })

  it('is a no-op when the trait is absent', () => {
    const e = entity({
      traits: [{ type: 'Missile' }],
      choices: [
        optionChoice('mod', [option('portable', [removeTrait('Heavy')])], {
          cardinality: OPTIONAL_MULTI,
        }),
      ],
    })
    expect(traitTypes(resolveChoiceView(e, { mod: ['portable'] }))).toEqual(['Missile'])
  })
})

describe('resolveChoiceView — inferred trait choices (schemaEntities)', () => {
  it('adds a trait named after the selected entity', () => {
    const e = entity({ choices: [traitSchemaChoice('wt', ['Ballistic', 'Energy'])] })
    const view = resolveChoiceView(e, { wt: ['Ballistic'] })
    expect(traitTypes(view)).toEqual(['Ballistic'])
    expect(view.prompts).toHaveLength(0)
  })

  it('adds one trait per selection for a multi-select trait-schema choice', () => {
    const e = entity({
      choices: [traitSchemaChoice('opt', ['A', 'B'], { cardinality: OPTIONAL_MULTI })],
    })
    expect(traitTypes(resolveChoiceView(e, { opt: ['A', 'B'] }))).toEqual(['A', 'B'])
  })
})

describe('resolveChoiceView — prompts for unresolved choices', () => {
  it('emits a prompt for an unresolved exclusive trait-schema choice', () => {
    const e = entity({
      choices: [traitSchemaChoice('wt', ['Ballistic', 'Energy'], { name: 'Weapon Type' })],
    })
    const view = resolveChoiceView(e, {})
    expect(view.prompts).toEqual([
      { choiceId: 'wt', label: 'Weapon Type', text: 'Choose: Ballistic or Energy' },
    ])
  })

  it('formats a single-option prompt as "Choose: X"', () => {
    const e = entity({ choices: [traitSchemaChoice('w', ['OnlyOne'])] })
    expect(resolveChoiceView(e, {}).prompts[0]?.text).toBe('Choose: OnlyOne')
  })

  it('formats three or more options as "Choose: A, B or C"', () => {
    const e = entity({ choices: [traitSchemaChoice('w', ['A', 'B', 'C'])] })
    expect(resolveChoiceView(e, {}).prompts[0]?.text).toBe('Choose: A, B or C')
  })

  it('drops the prompt once the choice is resolved', () => {
    const e = entity({ choices: [traitSchemaChoice('wt', ['Ballistic', 'Energy'])] })
    expect(resolveChoiceView(e, { wt: ['Energy'] }).prompts).toHaveLength(0)
  })

  it('does not prompt for a multi-select choice with zero selections', () => {
    const e = entity({
      choices: [traitSchemaChoice('opt', ['A', 'B'], { cardinality: OPTIONAL_MULTI })],
    })
    expect(resolveChoiceView(e, {}).prompts).toEqual([])
  })

  it('does not prompt for an exclusive choiceOptions choice (only trait-schema choices are required)', () => {
    const e = entity({ choices: [optionChoice('mod', [option('a'), option('b')])] })
    expect(resolveChoiceView(e, {}).prompts).toEqual([])
  })

  it('treats cardinality.min > 0 as required and prompts', () => {
    const e = entity({
      choices: [
        optionChoice('mod', [option('a'), option('b')], { cardinality: { min: 1, max: 1 } }),
      ],
    })
    expect(resolveChoiceView(e, {}).prompts[0]?.text).toBe('Choose: a or b')
  })

  it('treats cardinality.min === 0 as optional', () => {
    const e = entity({
      choices: [
        traitSchemaChoice('wt', ['A', 'B']),
        optionChoice('opt', [option('x')], { cardinality: { min: 0, max: 1 } }),
      ],
    })
    const prompts = resolveChoiceView(e, {}).prompts
    expect(prompts).toHaveLength(1)
    expect(prompts[0]?.choiceId).toBe('wt')
  })
})

describe('resolveChoiceView — combined effects', () => {
  it('stacks effects across multiple selected options', () => {
    const e = entity({
      datavalues: DV,
      choices: [
        optionChoice(
          'mod',
          [
            option('rf', [setRange('Far')]),
            option('hc', [addDamage(1)]),
            option('dd', [addTrait('Anti-Organic')]),
          ],
          { cardinality: OPTIONAL_MULTI }
        ),
      ],
    })
    const view = resolveChoiceView(e, { mod: ['rf', 'hc', 'dd'] })
    expect(range(view)).toBe('Far')
    expect(damage(view)).toBe(3)
    expect(traitTypes(view)).toContain('Anti-Organic')
  })

  it('applies a trait choice and an effect choice together, with no leftover prompt', () => {
    const e = entity({
      datavalues: DV,
      choices: [
        traitSchemaChoice('wt', ['Ballistic', 'Energy']),
        optionChoice('mod', [option('rf', [setRange('Far')])], { cardinality: OPTIONAL_MULTI }),
      ],
    })
    const view = resolveChoiceView(e, { wt: ['Ballistic'], mod: ['rf'] })
    expect(traitTypes(view)).toContain('Ballistic')
    expect(range(view)).toBe('Far')
    expect(view.prompts).toHaveLength(0)
  })

  it('leaves the trait-schema prompt up while other choices resolve', () => {
    const e = entity({
      choices: [
        traitSchemaChoice('wt', ['Ballistic', 'Energy']),
        optionChoice('mod', [option('rf', [setRange('Far')])], { cardinality: OPTIONAL_MULTI }),
      ],
    })
    expect(resolveChoiceView(e, { mod: ['rf'] }).prompts[0]?.choiceId).toBe('wt')
  })
})

describe('resolveChoiceView — purity and determinism', () => {
  it('preserves and copies base traits without referencing the source array', () => {
    const e = entity({
      traits: [{ type: 'Heavy' }],
      choices: [
        optionChoice('mod', [option('dd', [addTrait('Anti-Organic')])], {
          cardinality: OPTIONAL_MULTI,
        }),
      ],
    })
    const view = resolveChoiceView(e, { mod: ['dd'] })
    expect(traitTypes(view)).toEqual(['Heavy', 'Anti-Organic'])
    expect(e.traits).toEqual([{ type: 'Heavy' }])
  })

  it('removeTrait does not mutate the source traits', () => {
    const e = entity({
      traits: [{ type: 'Heavy' }, { type: 'Explosive', amount: 1 }],
      choices: [
        optionChoice('mod', [option('p', [removeTrait('Heavy'), addTrait('Explosive', 2)])], {
          cardinality: OPTIONAL_MULTI,
        }),
      ],
    })
    resolveChoiceView(e, { mod: ['p'] })
    expect(e.traits).toEqual([{ type: 'Heavy' }, { type: 'Explosive', amount: 1 }])
  })

  it('is deterministic across repeated resolution', () => {
    const e = entity({
      datavalues: DV,
      choices: [
        traitSchemaChoice('wt', ['Ballistic', 'Energy']),
        optionChoice(
          'mod',
          [option('rf', [setRange('Far')]), option('dd', [addTrait('Anti-Organic')])],
          { cardinality: OPTIONAL_MULTI }
        ),
      ],
    })
    const selections: ChoiceSelections = { wt: ['Energy'], mod: ['rf', 'dd'] }
    expect(resolveChoiceView(e, selections)).toEqual(resolveChoiceView(e, selections))
  })
})

describe('resolveChoiceView — edge cases', () => {
  it('returns the base row and no prompts when there are no choices', () => {
    const view = resolveChoiceView(entity({ datavalues: DV }), {})
    expect(damage(view)).toBe(2)
    expect(view.prompts).toEqual([])
    expect(view.traits).toEqual([])
  })

  it('ignores an unknown option value in the selections', () => {
    const e = entity({
      datavalues: DV,
      choices: [
        optionChoice('mod', [option('real', [addTrait('T')])], { cardinality: OPTIONAL_MULTI }),
      ],
    })
    const view = resolveChoiceView(e, { mod: ['nope'] })
    expect(view.traits).toEqual([])
    expect(damage(view)).toBe(2)
  })

  it('ignores selections keyed by an unknown choice id', () => {
    const e = entity({
      datavalues: DV,
      choices: [
        optionChoice('mod', [option('real', [addTrait('T')])], { cardinality: OPTIONAL_MULTI }),
      ],
    })
    const view = resolveChoiceView(e, { bogus: ['x'] })
    expect(view.traits).toEqual([])
    expect(damage(view)).toBe(2)
    expect(view.prompts).toEqual([])
  })

  it('treats a selected option without effects as a no-op on the row', () => {
    const e = entity({
      datavalues: DV,
      choices: [optionChoice('mod', [option('plain')], { cardinality: OPTIONAL_MULTI })],
    })
    const view = resolveChoiceView(e, { mod: ['plain'] })
    expect(damage(view)).toBe(2)
    expect(range(view)).toBe('Long')
    expect(view.traits).toEqual([])
  })
})
