import { describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

/**
 * Play's keys (r8 A7): Ctrl+K asks for the Rules' search, a letter with
 * nothing to press says why, and A never finishes an action nothing was done with.
 */

import { useRef } from 'react'
import { PLAY_RULES_ASKED, useFindKey } from '../useFindKey'

function Keys({ open = false, progressed = false }: { open?: boolean; progressed?: boolean }) {
  const within = useRef<HTMLDivElement>(null)
  const { said } = useFindKey(within)
  return (
    <div ref={within}>
      <span role="status">{said}</span>
      {open && (
        <ul>
          <li className="su-play-act" data-open="">
            <button
              type="button"
              className="su-play-act__use"
              data-progressed={progressed ? '' : undefined}
              onClick={() => document.body.setAttribute('data-finished', '')}
            >
              Cancel
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

describe('Play’s keys (r8 A7)', () => {
  test('Ctrl+K asks the screen for its Rules’ search', () => {
    render(<Keys />)
    let asked = 0
    const count = () => {
      asked += 1
    }
    window.addEventListener(PLAY_RULES_ASKED, count)
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true })
    window.removeEventListener(PLAY_RULES_ASKED, count)
    expect(asked).toBe(1)
  })

  test('R with no action open says why, instead of nothing', () => {
    render(<Keys />)
    act(() => {
      fireEvent.keyDown(document.body, { key: 'r' })
    })
    expect(screen.getByRole('status').textContent).toBe(
      'No action is open: press / to find one, then Use.'
    )
  })

  test('A never finishes an action nothing was done with; it says so', () => {
    document.body.removeAttribute('data-finished')
    render(<Keys open />)
    act(() => {
      fireEvent.keyDown(document.body, { key: 'a' })
    })
    expect(document.body.hasAttribute('data-finished')).toBe(false)
    expect(screen.getByRole('status').textContent).toContain('Nothing to apply yet')
    cleanup()
    render(<Keys open progressed />)
    fireEvent.keyDown(document.body, { key: 'a' })
    expect(document.body.hasAttribute('data-finished')).toBe(true)
  })
})
