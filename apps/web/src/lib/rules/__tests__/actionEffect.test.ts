/**
 * actionEffect — an actions row says what an action DOES (R65): its book
 * text with the setup, the upkeep, the examples and the flavour that the data
 * tags (`notInPlay`) left out, and never a word changed. Held to the book's
 * own actions, by slug.
 */

import { describe, expect, test } from 'bun:test'
import type { RefMetaAction, RefObjectChoice } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { actionEffect, actionPicks } from '../actionEffect'

const KINDS = ['Abilities', 'Equipment', 'Systems', 'Modules'] as const

/** Every action the book's abilities, equipment, systems and modules grant. */
function everyAction(): RefMetaAction[] {
  return KINDS.flatMap((kind) =>
    SalvageUnionReference[kind]
      .all()
      .flatMap((entity) => SalvageUnionReference.resolveActions(entity) ?? [])
  )
}

/** An ability's action, by the ability's slug and the action's name. */
function abilityAction(slug: string, name: string): RefMetaAction {
  const ability = SalvageUnionReference.Abilities.all().find((a) => getEntitySlug(a) === slug)
  const action = ability
    ? (SalvageUnionReference.resolveActions(ability) ?? []).find((a) => a.name === name)
    : undefined
  if (!action) throw new Error(`no action ${name} on ${slug}`)
  return action
}

const paragraphs = (action: RefMetaAction) =>
  (action.content ?? []).flatMap((block) => (typeof block.value === 'string' ? [block.value] : []))
const effectText = (action: RefMetaAction) =>
  actionEffect(action).flatMap((block) => (typeof block.value === 'string' ? [block.value] : []))
const words = (text: string) => text.split(/\s+/).filter(Boolean)

describe('what the effect leaves out', () => {
  test('an example: the rule stays, "For example, …" goes', () => {
    const mender = abilityAction('union-engineer', 'Mender')
    expect(paragraphs(mender).join(' ')).toMatch(/For example/)
    const [effect, ...rest] = effectText(mender)
    expect(rest).toEqual([])
    expect(effect).not.toMatch(/for example/i)
    // What is left is the paragraph's own opening, word for word.
    expect(paragraphs(mender)[0]?.startsWith(effect ?? '-')).toBe(true)
  })

  test('flavour: a paragraph with no rule in it', () => {
    const juryRig = abilityAction('jury-rig', 'Jury Rig')
    const [flavour, ...rules] = paragraphs(juryRig)
    expect(effectText(juryRig)).toEqual(rules)
    expect(effectText(juryRig)).not.toContain(flavour)
  })

  test('setup and upkeep: building the thing and how it scales with the Union Crawler', () => {
    const turret = abilityAction('auto-turret', 'Auto-Turret')
    const whole = paragraphs(turret).join(' ')
    const effect = effectText(turret).join(' ')
    for (const left of [
      /You construct an immobile Auto-Turret/,
      /A\.I\. Personality/,
      /upgraded along with/,
    ]) {
      expect(whole).toMatch(left)
      expect(effect).not.toMatch(left)
    }
    // What it does at the table stays, and so does the rule it plays by.
    expect(effect).toMatch(/Turn Action/)
    expect(effect).toMatch(/uses the same rules as Mechs/)
  })

  test('a rule that names no number still stays: Downtime, an Ability, a Tech Level', () => {
    const acquisition = abilityAction('mech-acquisition', 'Mech Acquisition')
    expect(effectText(acquisition).some((text) => /^During Downtime/.test(text))).toBe(true)
  })

  test('an action its chips say in full has no effect text', () => {
    const bare = everyAction().filter(
      (action) => action.damage !== undefined && effectText(action).length === 0
    )
    expect(bare.length).toBeGreaterThan(0)
  })
})

describe('the book’s words are never changed, only left out', () => {
  test('an untagged block reaches the row as it is; a tagged one loses its tagged words only', () => {
    for (const action of everyAction()) {
      const expected: (string | undefined)[][] = []
      for (const block of action.content ?? []) {
        const type = block.type ?? 'paragraph'
        if (['flavor', 'hint', 'heading', 'choice'].includes(type)) continue
        if (type === 'datavalues' && !block.label) continue
        if (typeof block.value !== 'string') {
          expected.push([undefined])
          continue
        }
        const tags = block.notInPlay ?? []
        if (tags.some((t) => t.text === undefined)) continue
        let text = block.value
        for (const t of tags) text = text.replace(t.text ?? '', '')
        if (tags.length === 0) expected.push([block.value])
        else if (words(text).length > 0) expected.push(words(text))
      }
      const kept = actionEffect(action).map((block): (string | undefined)[] => {
        if (typeof block.value !== 'string') return [undefined]
        const tagged = (action.content ?? []).find((b) => b === block) === undefined
        return tagged ? words(block.value) : [block.value]
      })
      expect(kept, action.name).toEqual(expected)
    }
  })

  test('no row opens a sentence with an example', () => {
    for (const action of everyAction()) {
      for (const kept of effectText(action)) {
        expect(kept, action.name).not.toMatch(/(^|[.!?]\s+)For example\b/)
      }
    }
  })

  test('flavour, hint, heading and choice blocks, and the tags, never reach a row', () => {
    for (const action of everyAction()) {
      for (const block of actionEffect(action)) {
        expect(['flavor', 'hint', 'heading', 'choice']).not.toContain(block.type ?? 'paragraph')
        expect(block.notInPlay, action.name).toBeUndefined()
      }
    }
  })
})

describe('actionPicks: the options chosen on an action, as its row says them', () => {
  const choice = {
    id: 'modification',
    name: 'Modification',
    source: {
      kind: 'options',
      options: [
        { value: 'scope', label: 'Scope', description: 'It also gains the [[Long]] Trait.' },
        {
          value: 'rounds',
          label: 'High Calibre Rounds',
          description:
            'You may spend 2 AP to automatically hit. It deals an additional 2 SP damage.',
        },
      ],
    },
  } as unknown as RefObjectChoice

  test('a pick the chips already carry is its label alone', () => {
    expect(actionPicks([choice], { modification: ['scope'] })).toEqual([
      { choice: 'Modification', label: 'Scope' },
    ])
  })

  test('a pick that gives something to do at the table keeps that sentence only', () => {
    expect(actionPicks([choice], { modification: ['rounds'] })).toEqual([
      {
        choice: 'Modification',
        label: 'High Calibre Rounds',
        text: 'You may spend 2 AP to automatically hit.',
      },
    ])
  })

  test('nothing picked, nothing said; an unknown value reads as itself', () => {
    expect(actionPicks([choice], {})).toEqual([])
    expect(actionPicks([choice], { modification: ['custom'] })).toEqual([
      { choice: 'Modification', label: 'custom' },
    ])
  })
})
