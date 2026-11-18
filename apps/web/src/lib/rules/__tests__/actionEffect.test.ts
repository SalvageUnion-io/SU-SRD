/**
 * actionEffect — an actions row says what an action DOES (R65): its book
 * text with the setup, the upkeep, the examples and the flavour left out,
 * and never a word changed. Held to the book's own actions, by slug.
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

  test('flavour: a paragraph with no rule in it, where the action has rules text', () => {
    const juryRig = abilityAction('jury-rig', 'Jury Rig')
    const [flavour, ...rules] = paragraphs(juryRig)
    expect(effectText(juryRig)).toEqual(rules.map((text) => text.trim()))
    expect(effectText(juryRig)).not.toContain(flavour)
  })

  test('setup and upkeep: building the thing and how it scales with the Union Crawler', () => {
    const turret = abilityAction('auto-turret', 'Auto-Turret')
    const whole = paragraphs(turret).join(' ')
    const effect = effectText(turret).join(' ')
    for (const left of [
      /A\.I\. Personality/,
      /upgraded along with/,
      /uses the same rules as Mechs/,
    ]) {
      expect(whole).toMatch(left)
      expect(effect).not.toMatch(left)
    }
    // What it does at the table stays.
    expect(effect).toMatch(/Turn Action/)
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
  test('every kept paragraph is its own paragraph’s sentences, in order', () => {
    for (const action of everyAction()) {
      const originals = paragraphs(action)
      for (const kept of effectText(action)) {
        const source = originals.find((original) => {
          // Each kept sentence is found in the original after the last one.
          let from = 0
          return kept.split(/(?<=[.!?])\s+/).every((sentence) => {
            const at = original.indexOf(sentence.trim(), from)
            if (at < 0) return false
            from = at + sentence.trim().length
            return true
          })
        })
        expect(source, `${action.name}: “${kept.slice(0, 40)}…”`).toBeDefined()
      }
    }
  })

  test('no row opens a sentence with an example', () => {
    for (const action of everyAction()) {
      for (const kept of effectText(action)) {
        expect(kept, action.name).not.toMatch(/(^|[.!?]\s+)For example\b/)
      }
    }
  })

  test('flavour, hint, heading and choice blocks never reach a row', () => {
    for (const action of everyAction()) {
      for (const block of actionEffect(action)) {
        expect(['flavor', 'hint', 'heading', 'choice']).not.toContain(block.type ?? 'paragraph')
      }
    }
  })

  test('an action with text keeps some of it, unless its chips say what it does', () => {
    for (const action of everyAction()) {
      const said =
        (action.range?.length ?? 0) > 0 ||
        action.damage !== undefined ||
        (action.content ?? []).some((block) => block.type === 'datavalues' && !block.label)
      if (paragraphs(action).length === 0 || said) continue
      const typed = (action.content ?? []).filter(
        (block) => !['flavor', 'hint', 'heading', 'choice'].includes(block.type ?? 'paragraph')
      )
      if (typed.length === 0) continue
      expect(actionEffect(action).length, action.name).toBeGreaterThan(0)
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
