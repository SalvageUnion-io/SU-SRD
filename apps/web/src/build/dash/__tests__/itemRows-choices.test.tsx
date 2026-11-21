/**
 * A made choice reads as made on a sheet's System row, in Read too (R60): the
 * row's state carries it as a chip, `CHOICE | <pick>`.
 */

import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveSystem } from '../../../lib/rules/mechItems'
import { itemRows } from '../itemRows'

const TURRET = 'automated-weapon-turret'

/** The turret's Turret Model choice and its first model. */
function turretModel() {
  const system = resolveSystem(TURRET)
  const action = system ? (SalvageUnionReference.resolveActions(system) ?? [])[0] : undefined
  const choice = action?.choices?.find((c) => c.source?.kind === 'systemVariant')
  const option = choice?.source?.kind === 'systemVariant' ? choice.source.options[0] : undefined
  if (!choice || !option?.name) throw new Error('no Turret Model choice')
  return { choice, model: option.name }
}

const fitted = { systems: [TURRET], modules: [] }

describe('itemRows — a made choice', () => {
  test('a picked option is a chip on its row', () => {
    const { choice, model } = turretModel()
    const [row] = itemRows(
      { ...fitted, itemChoices: { [TURRET]: { [choice.id]: [model] } } },
      'system'
    )
    const { container } = render(row?.state)
    expect(container.textContent).toContain(model)
  })

  test('with no pick, the row says nothing of it', () => {
    const [row] = itemRows(fitted, 'system')
    expect(row?.state).toBeUndefined()
  })
})
