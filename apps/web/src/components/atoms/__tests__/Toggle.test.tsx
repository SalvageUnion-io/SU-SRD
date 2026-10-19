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
})
