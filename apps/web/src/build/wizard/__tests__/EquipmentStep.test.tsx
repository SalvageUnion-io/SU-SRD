/**
 * The equipment step's list cites the step's book on its foot; an item printed
 * in another book says its own book and page on its line (SB-03).
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { EquipmentStep } from '../EquipmentStep'

const CITE = { source: 'Salvage Union Workshop Manual', page: 19 } as const

describe('EquipmentStep', () => {
  test('an item from another book cites it; the step’s own book is not repeated', () => {
    render(
      <EquipmentStep
        selectedEquipment={[]}
        onCountChange={() => {}}
        budget={2}
        choices={undefined}
        onChoices={() => {}}
        cite={CITE}
      />
    )
    const row = (name: string) => {
      const found = screen.getAllByText(name).find((node) => node.closest('tr'))
      if (!found) throw new Error(`no row: ${name}`)
      return found.closest('tr') as HTMLElement
    }
    expect(row('Epoxy Gun').textContent).toContain('Rainmaker · p.77')
    expect(row('First Aid Kit').textContent).not.toContain('p.80')
    expect(row('First Aid Kit').textContent).not.toContain('Workshop Manual')
  })
})
