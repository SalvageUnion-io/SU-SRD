/**
 * ChipListEditor — the one chip-well editor (ruleset §6.6, hard rule R16):
 * conditions and crew facts draw the same well, the same empty state and the
 * same draft field, and differ only in what a commit means.
 */

import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { tokens } from '../../../components/index'
import { ChipListEditor } from '../ChipListEditor'
import { CHIP_WELL, CONDITION_DRAFT, FACT_DRAFT } from '../chipWell.model'

const { space } = tokens

/** The well a rendered editor drew. */
function well(container: HTMLElement): HTMLElement {
  const el = container.querySelector('[data-chip-well]')
  if (!(el instanceof HTMLElement)) throw new Error('no chip well')
  return el
}

describe('ChipListEditor — the one well', () => {
  test('conditions and facts draw one well: one min-height, padding on the scale', () => {
    const conditions = render(
      <ChipListEditor
        items={['Shaken']}
        onChange={() => {}}
        noun="condition"
        draftWidth={CONDITION_DRAFT}
        unique
      />
    )
    const facts = render(
      <ChipListEditor
        items={[]}
        onChange={() => {}}
        noun="fact"
        owner="Command Bay crew"
        draftWidth={FACT_DRAFT}
        tone="quiet"
      />
    )
    const a = well(conditions.container)
    const b = well(facts.container)
    expect(a.getAttribute('style')).toBe(b.getAttribute('style'))
    // §4.4's scale inside a block: 8px of padding, 6px between chips, never 10px.
    expect(CHIP_WELL.padding).toBe(space[8])
    expect(CHIP_WELL.gap).toBe(space[6])
    expect(Object.values(CHIP_WELL)).not.toContain('10px')
    expect(a.style.padding).toBe('8px')
    expect(a.style.minHeight).toBe(b.style.minHeight)
  })

  test('the one empty state: EmptyState inline, "No <things> yet."', () => {
    render(
      <ChipListEditor
        items={[]}
        onChange={() => {}}
        noun="condition"
        draftWidth={CONDITION_DRAFT}
        unique
      />
    )
    expect(screen.getByText('No conditions yet.')).toBeTruthy()
  })

  test('a set drops a repeat, case aside; a list keeps it', async () => {
    const setChange = mock(async (_next: string[]) => {})
    render(
      <ChipListEditor
        items={['Shaken']}
        onChange={setChange}
        noun="condition"
        draftWidth={CONDITION_DRAFT}
        unique
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add condition' }))
    const field = screen.getByRole('textbox', { name: 'New condition' })
    fireEvent.change(field, { target: { value: 'shaken' } })
    await act(async () => {
      fireEvent.keyDown(field, { key: 'Enter' })
    })
    expect(setChange).not.toHaveBeenCalled()

    const listChange = mock(async (_next: string[]) => {})
    render(
      <ChipListEditor
        items={['Hates rain']}
        onChange={listChange}
        noun="fact"
        owner="Command Bay crew"
        draftWidth={FACT_DRAFT}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add Command Bay crew fact' }))
    const factField = screen.getByRole('textbox', { name: 'New Command Bay crew fact' })
    fireEvent.change(factField, { target: { value: 'Hates rain' } })
    await act(async () => {
      fireEvent.keyDown(factField, { key: 'Enter' })
    })
    expect(listChange).toHaveBeenCalledWith(['Hates rain', 'Hates rain'])
  })

  test('read-only: plain chips, no × and no "+ Add"', () => {
    render(
      <ChipListEditor
        items={['Hates rain']}
        onChange={() => {}}
        noun="fact"
        owner="Command Bay crew"
        draftWidth={FACT_DRAFT}
        readOnly
      />
    )
    expect(screen.getByText('Hates rain')).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
