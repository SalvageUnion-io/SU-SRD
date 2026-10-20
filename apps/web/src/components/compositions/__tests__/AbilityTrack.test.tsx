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
  test("a sequential tree draws the caller's Ability on each tier, its numeral left to the Compact", () => {
    const { container } = render(
      <AbilityTrack
        abilities={tree('Mechanical Knowledge')}
        track="core"
        renderAbility={(ability) => <span className="probe">{ability.name}</span>}
      />
    )
    expect(container.querySelector('.su-ability-track')?.getAttribute('data-track')).toBe('core')
    expect(container.querySelectorAll('.su-ability-track__tier .probe')).toHaveLength(3)
    expect(container.querySelector('.su-ability-track__or')).toBeNull()
  })

  test('a pick-one tree has an "or" row between each pick', () => {
    const picks = tree('Legendary Engineer')
    const { container } = render(
      <AbilityTrack abilities={picks} track="legendary" renderAbility={(a) => a.name} />
    )
    expect(container.querySelectorAll('.su-ability-track__tier')).toHaveLength(picks.length)
    expect(container.querySelectorAll('.su-ability-track__or')).toHaveLength(picks.length - 1)
    expect(container.querySelector('.su-ability-track > li:first-child')?.className).toBe(
      'su-ability-track__tier'
    )
  })
})
