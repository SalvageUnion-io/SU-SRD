import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { AbilityTrack } from '../AbilityTrack'
import { trackForTree } from '../treeTrack'

const tree = (name: string) =>
  SalvageUnionReference.Abilities.all().filter((ability) => ability.tree === name)

describe('trackForTree', () => {
  test('reads each tree kind off its first Ability', () => {
    expect(trackForTree(tree('Mechanical Knowledge'))).toBe('core')
    expect(trackForTree(tree('Advanced Engineer'))).toBe('advanced')
    expect(trackForTree(tree('Fabricator'))).toBe('hybrid')
    expect(trackForTree(tree('Legendary Engineer'))).toBe('legendary')
    expect(trackForTree(tree('Generic'))).toBeUndefined()
    expect(trackForTree([])).toBeUndefined()
  })
})

describe('AbilityTrack', () => {
  test("a sequential tree numbers each tier and draws the caller's Ability", () => {
    const { container } = render(
      <AbilityTrack
        abilities={tree('Mechanical Knowledge')}
        track="core"
        renderAbility={(ability) => <span className="probe">{ability.name}</span>}
      />
    )
    expect(container.querySelector('.su-ability-track')?.getAttribute('data-track')).toBe('core')
    expect(
      [...container.querySelectorAll('.su-ability-track__numeral')].map((n) => n.textContent)
    ).toEqual(['1', '2', '3'])
    expect(container.querySelectorAll('.probe')).toHaveLength(3)
    expect(container.querySelector('.su-ability-track__or')).toBeNull()
  })

  test('a pick-one tree has no numerals, an "or" between each pick', () => {
    const picks = tree('Legendary Engineer')
    const { container } = render(
      <AbilityTrack abilities={picks} track="legendary" renderAbility={(a) => a.name} />
    )
    expect(container.querySelector('.su-ability-track__numeral')).toBeNull()
    expect(container.querySelectorAll('.su-ability-track__or')).toHaveLength(picks.length - 1)
  })
})
