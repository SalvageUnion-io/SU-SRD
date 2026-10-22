import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { DowntimeStepNav } from '../DowntimeStepNav'

/**
 * The Downtime bar, drawn once for the player's step box and the Mediator's
 * (hard rule R23): Back is `BackLabel`, Next is `NextLabel` ("Next: Step 3"),
 * and the last step's way on is End Downtime.
 */

const names = () =>
  screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)

describe('DowntimeStepNav', () => {
  test("the player's: Next to the step after, no Back and no early End", () => {
    const onAdvance = mock(() => {})
    render(
      <DowntimeStepNav step={1} count={10} off={false} onEnd={() => {}} onAdvance={onAdvance} />
    )
    expect(names()).toEqual(['Next: Step 3'])
    fireEvent.click(screen.getByRole('button', { name: 'Next: Step 3' }))
    expect(onAdvance).toHaveBeenCalledTimes(1)
  })

  test("the player's last step: End Downtime in Next's place", () => {
    const onEnd = mock(() => {})
    render(<DowntimeStepNav step={9} count={10} off={false} onEnd={onEnd} onAdvance={() => {}} />)
    expect(names()).toEqual(['End Downtime'])
    fireEvent.click(screen.getByRole('button', { name: 'End Downtime' }))
    expect(onEnd).toHaveBeenCalledTimes(1)
  })

  test("the Mediator's: Back, End Downtime early, then Next", () => {
    const onBack = mock(() => {})
    render(
      <DowntimeStepNav
        step={2}
        count={10}
        off={false}
        onBack={onBack}
        onEnd={() => {}}
        onAdvance={() => {}}
        endEarly
      />
    )
    expect(names()).toEqual(['Back to Step 2', 'End Downtime', 'Next: Step 4'])
    fireEvent.click(screen.getByRole('button', { name: 'Back to Step 2' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  test('Back is off on the first step, and every control when the session may not write', () => {
    const { unmount } = render(
      <DowntimeStepNav
        step={0}
        count={10}
        off={false}
        onBack={() => {}}
        onEnd={() => {}}
        onAdvance={() => {}}
        endEarly
      />
    )
    expect(screen.getByRole('button', { name: 'Back to Step 1' })).toHaveProperty('disabled', true)
    unmount()
    render(
      <DowntimeStepNav
        step={3}
        count={10}
        off
        onBack={() => {}}
        onEnd={() => {}}
        onAdvance={() => {}}
        endEarly
      />
    )
    for (const button of screen.getAllByRole('button'))
      expect(button).toHaveProperty('disabled', true)
  })
})
