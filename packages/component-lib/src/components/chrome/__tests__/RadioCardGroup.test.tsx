import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { RadioCardGroup } from '../RadioCardGroup'
import { Sel } from '../Sel'

/**
 * The radio pattern for card pickers: one tab stop (the chosen card), the
 * arrow keys moving between cards and choosing the one they land on, and a
 * press still calling the card's own callback — so a picker that clears its
 * pick on a second press keeps doing so.
 */

const CLASSES = ['Hacker', 'Hauler', 'Salvager'] as const

function Picker({ clearOnRepress = false }: { clearOnRepress?: boolean }) {
  const [chosen, setChosen] = useState<string>('Hauler')
  return (
    <RadioCardGroup label="Class">
      {CLASSES.map((name) => (
        <Sel
          key={name}
          radio
          ariaLabel={name}
          selected={chosen === name}
          onToggle={() => setChosen((cur) => (clearOnRepress && cur === name ? '' : name))}
        >
          {name}
        </Sel>
      ))}
    </RadioCardGroup>
  )
}

const radio = (name: string) => screen.getByRole('radio', { name })

describe('RadioCardGroup', () => {
  test('a named radiogroup whose cards announce the pick', () => {
    render(<Picker />)
    expect(screen.getByRole('radiogroup', { name: 'Class' })).toBeTruthy()
    expect(radio('Hauler').getAttribute('aria-checked')).toBe('true')
    expect(radio('Hacker').getAttribute('aria-checked')).toBe('false')
  })

  test('the chosen card is the one tab stop', () => {
    render(<Picker />)
    expect(radio('Hauler').getAttribute('tabindex')).toBe('0')
    expect(radio('Hacker').getAttribute('tabindex')).toBe('-1')
    expect(radio('Salvager').getAttribute('tabindex')).toBe('-1')
  })

  test('a press chooses the card', async () => {
    render(<Picker />)
    await act(async () => {
      fireEvent.click(radio('Salvager'))
    })
    expect(radio('Salvager').getAttribute('aria-checked')).toBe('true')
    expect(radio('Hauler').getAttribute('aria-checked')).toBe('false')
  })

  test('the arrow keys move to the next card and choose it', async () => {
    render(<Picker />)
    await act(async () => {
      radio('Hauler').focus()
    })
    await act(async () => {
      fireEvent.keyDown(radio('Hauler'), { key: 'ArrowDown' })
    })
    expect(document.activeElement).toBe(radio('Salvager'))
    expect(radio('Salvager').getAttribute('aria-checked')).toBe('true')
    expect(radio('Salvager').getAttribute('tabindex')).toBe('0')
  })

  test("a second press still reaches the card's own callback", async () => {
    render(<Picker clearOnRepress />)
    await act(async () => {
      fireEvent.click(radio('Hauler'))
    })
    expect(radio('Hauler').getAttribute('aria-checked')).toBe('false')
  })
})
