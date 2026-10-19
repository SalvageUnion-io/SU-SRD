/**
 * Toggle — one on/off (chrome K10, hard rule R29): a Button that stays
 * pressed, `aria-pressed` its state, pressed the ink plate.
 */
import { describe, expect, it } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { Toggle } from '../Toggle'

describe('Toggle', () => {
  it('is a Button at its Size whose pressed state is the ink plate, and reports the press', () => {
    const presses: string[] = []
    render(
      <>
        <Toggle size="mini" pressed onClick={() => presses.push('on')}>
          On
        </Toggle>
        <Toggle pressed={false} onClick={() => presses.push('off')}>
          Off
        </Toggle>
      </>
    )
    const on = screen.getByRole('button', { name: 'On' })
    const off = screen.getByRole('button', { name: 'Off' })
    expect(on.getAttribute('aria-pressed')).toBe('true')
    expect(off.getAttribute('aria-pressed')).toBe('false')
    expect(on.className).toContain('su-btn--ink')
    expect(on.className).toContain('su-btn--mini')
    expect(off.className).toContain('su-btn--default')
    expect(off.className).toContain('su-btn--compact')
    fireEvent.click(off)
    expect(presses).toEqual(['off'])
  })

  it('pencil, on an editable sheet line: one look in both states, the glyph leading', () => {
    const { rerender } = render(
      <Toggle variant="pencil" pressed={false} glyph={<i data-pip />} aria-label="Mark motto used">
        Used
      </Toggle>
    )
    const free = screen.getByRole('button', { name: 'Mark motto used' })
    expect(free.getAttribute('aria-pressed')).toBe('false')
    expect(free.className).toContain('su-btn--pencil')
    expect(free.textContent).toBe('Used')
    expect(free.querySelector('[aria-hidden="true"] [data-pip]')).not.toBeNull()

    rerender(
      <Toggle variant="pencil" size="mini" pressed aria-label="Reset motto used">
        Used
      </Toggle>
    )
    const used = screen.getByRole('button', { name: 'Reset motto used' })
    expect(used.getAttribute('aria-pressed')).toBe('true')
    // Pressed, the pencil plate inverts in CSS: it never becomes the ink variant.
    expect(used.className).toContain('su-btn--pencil')
    expect(used.className).not.toContain('su-btn--ink')
    expect(used.className).toContain('su-btn--mini')
  })
})
