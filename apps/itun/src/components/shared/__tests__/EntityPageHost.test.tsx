/**
 * ITUN's Page opener (E4, E5): a Mention anywhere in the app is a button that
 * opens its entity — the detail dialog — and it
 * Peeks through the app's one PeekHost.
 */
import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Mention } from 'component-lib'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { EntityPageHost } from '../EntityPageHost'

const vulnerable = () => {
  const trait = SalvageUnionReference.Traits.getByName('vulnerable')
  if (!trait) throw new Error('vulnerable fixture missing')
  return toEntityModel(trait).ref
}

describe('EntityPageHost', () => {
  test('a Mention opens its entity in the detail dialog', async () => {
    render(
      <EntityPageHost>
        <p>
          It gains the <Mention entityRef={vulnerable()}>Vulnerable</Mention> Trait.
        </p>
      </EntityPageHost>
    )
    const mention = screen.getByRole('button', { name: 'Vulnerable' })
    expect(mention.getAttribute('data-peek')).toStartWith('traits:')
    await act(async () => {
      fireEvent.click(mention)
    })
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent?.toLowerCase()).toContain('vulnerable')
  })
})
