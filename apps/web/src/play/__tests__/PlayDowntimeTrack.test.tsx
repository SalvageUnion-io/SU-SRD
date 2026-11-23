/** The Downtime track reads a step the table jumped over as skipped, never done (r8 B9, SB8-16). */

import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { currentDowntimeStep } from 'game-domain/rules/downtime'
import { PlayDowntimeTrack } from '../PlayDowntimeTrack'

const { steps } = currentDowntimeStep(0)
const label = (i: number) =>
  screen.getByRole('img', { name: new RegExp(`^Step ${i}: `) }).getAttribute('aria-label')

describe('the Downtime track', () => {
  test('a step jumped over reads skipped until the table stands on it', () => {
    const view = render(<PlayDowntimeTrack steps={steps} current={1} canWrite />)
    expect(label(1)).toMatch(/, done$/)
    view.rerender(<PlayDowntimeTrack steps={steps} current={4} canWrite />)
    expect(label(2)).toMatch(/, done$/)
    expect(label(3)).toMatch(/, skipped$/)
    expect(label(4)).toMatch(/, skipped$/)
    // Back on step 4, then on: it was stood on, so it is done.
    view.rerender(<PlayDowntimeTrack steps={steps} current={3} canWrite />)
    view.rerender(<PlayDowntimeTrack steps={steps} current={4} canWrite />)
    expect(label(3)).toMatch(/, skipped$/)
    expect(label(4)).toMatch(/, done$/)
  })
})
