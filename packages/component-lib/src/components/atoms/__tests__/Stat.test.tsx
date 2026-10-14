import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { color } from '../../../design/tokens'
import { Stat } from '../Stat'

describe('Stat', () => {
  test('default colors are ink on paper (16:1 contrast, WCAG AAA)', () => {
    render(<Stat label="HP" value={10} />)
    const group = screen.getByRole('group')
    expect(group).toBeTruthy()
    // The value box uses a paper fill and ink text by default,
    // which gives 16:1 contrast ratio — well above WCAG AAA (7:1).
    // [top stamp, box, bottom stamp]
    const box = group.children[1] as HTMLElement | undefined
    expect(box?.style.backgroundColor).toBe(color.paper)
    const readout = box?.querySelector<HTMLElement>('span')
    expect(readout?.style.color).toBe(color.ink)
  })
})
