/**
 * Step 1 of the Pilot wizard (r7 F5, F6): the book's page is printed once, in
 * the rule box, never on the lists; each first-ability row carries what it
 * does under its name, for a phone, where the column is dropped.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ClassAbilityStep } from '../ClassAbilityStep'

const hauler = SalvageUnionReference.Classes.getByName('Hauler') as { id: string } | undefined

describe('ClassAbilityStep', () => {
  test('no citation on the lists; each ability says what it does under its name', () => {
    const { container } = render(
      <ClassAbilityStep
        classId={hauler?.id ?? ''}
        selectedAbilities={[]}
        onSelectClass={() => {}}
        onSelectAbility={() => {}}
      />
    )
    const lists = [...container.querySelectorAll('.su-ledger')]
    expect(lists).toHaveLength(2)
    for (const list of lists) expect(list.textContent).not.toContain('p.18')
    const row = screen.getByRole('radio', { name: /^Folk Song/ }).closest('tr') as HTMLElement
    const under = row.querySelector('th .su-wiz-phone-under')
    expect(under?.textContent).toMatch(/song/i)
  })
})
