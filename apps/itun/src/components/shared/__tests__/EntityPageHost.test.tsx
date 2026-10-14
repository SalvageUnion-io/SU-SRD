/**
 * ITUN's Page opener (E4, E5): a Mention anywhere in the app is a button that
 * opens its entity — the detail dialog — and it
 * Peeks through the app's one PeekHost. A pattern's Page links its chassis
 * (`PATTERN OF | Mule`), and that chip opens the chassis's Page in the dialog.
 */
import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { Mention, useDetailModal } from 'component-lib'
import type { SURefEntity, SURefObjectAnyPattern } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { EntityPageHost } from '../EntityPageHost'

const vulnerable = () => {
  const trait = SalvageUnionReference.Traits.getByName('vulnerable')
  if (!trait) throw new Error('vulnerable fixture missing')
  return toEntityModel(trait).ref
}

/** A pattern's Page, opened as the Mediator's tray opens one. */
function PatternOpener({
  chassis,
  pattern,
}: {
  chassis: SURefEntity
  pattern: SURefObjectAnyPattern
}) {
  const { control, modal } = useDetailModal(chassis, { pattern })
  return (
    <>
      <button type="button" onClick={control.onClick}>
        open pattern
      </button>
      {modal}
    </>
  )
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

  test("a pattern's PATTERN OF chip opens its chassis's Page in the dialog", async () => {
    const chassis = SalvageUnionReference.Chassis.getByName('Mule') as SURefEntity | undefined
    const pattern =
      chassis && 'patterns' in chassis && Array.isArray(chassis.patterns)
        ? (chassis.patterns[0] as SURefObjectAnyPattern | undefined)
        : undefined
    if (!chassis || !pattern) throw new Error('mule pattern fixture missing')
    render(
      <EntityPageHost>
        <PatternOpener chassis={chassis} pattern={pattern} />
      </EntityPageHost>
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'open pattern' }))
    })
    const patternPage = await screen.findByRole('dialog')
    await act(async () => {
      fireEvent.click(within(patternPage).getByRole('button', { name: 'Pattern of: Mule' }))
    })
    const chassisPage = screen
      .getAllByRole('dialog')
      .find((d) => within(d).queryByRole('heading', { name: /^Mule\b/ }))
    expect(chassisPage).toBeTruthy()
  })
})
