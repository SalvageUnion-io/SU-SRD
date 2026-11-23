/**
 * The equipment step's list cites the step's book on its foot; an item printed
 * in another book says its own book and page on its line (SB-03).
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
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

  test('pressing a row picks a first copy; a picked row or a full budget only shows its card (r6 F4)', () => {
    const counts: [string, number][] = []
    const view = (selected: string[]) => (
      <EquipmentStep
        selectedEquipment={selected}
        onCountChange={(slug, next) => counts.push([slug, next])}
        budget={2}
        choices={undefined}
        onChoices={() => {}}
        cite={CITE}
      />
    )
    const { rerender } = render(view([]))
    const press = (name: string) => {
      const label = screen.getAllByText(name).find((node) => node.closest('label'))
      fireEvent.click(label?.closest('label') as HTMLElement)
    }
    press('First Aid Kit')
    expect(counts).toEqual([['first-aid-kit', 1]])
    rerender(view(['first-aid-kit']))
    press('Epoxy Gun')
    expect(counts.at(-1)).toEqual(['epoxy-gun', 1])
    rerender(view(['first-aid-kit', 'epoxy-gun']))
    press('First Aid Kit')
    expect(counts).toHaveLength(2)
    // The picks are counted once, on the action bar: not over the list.
    expect(screen.queryByText('Picks')).toBeNull()
  })
})
