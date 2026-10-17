/** AdderBox: the dashed intake row; AdderField: a caps label naming its field. */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { AdderBox, AdderField } from '../AdderBox'

describe('AdderBox', () => {
  test('frames its fields in one dashed wrapping row, and a label names its field', () => {
    render(
      <AdderBox style={{ marginTop: '12px' }}>
        <AdderField label="Slots" htmlFor="slots">
          <input id="slots" type="number" />
        </AdderField>
        <button type="button">Add</button>
      </AdderBox>
    )
    const field = screen.getByLabelText('Slots')
    const box = screen.getByRole('button', { name: 'Add' }).parentElement
    expect(box?.style.borderStyle).toBe('dashed')
    expect(box?.style.flexWrap).toBe('wrap')
    expect(box?.style.marginTop).toBe('12px')
    expect(box?.contains(field)).toBe(true)
  })
})
