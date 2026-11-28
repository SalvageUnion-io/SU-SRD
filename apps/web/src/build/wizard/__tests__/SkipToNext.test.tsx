/** A picking step's skip past its detail card lands on Next (r5 C6). */

import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SkipToNext, WIZ_NEXT_ID } from '../SkipToNext'

describe('SkipToNext', () => {
  test('follows to Next, past what sits between', () => {
    render(
      <>
        <SkipToNext />
        <a href="/classes/hacker/">Hacker</a>
        <button type="button" id={WIZ_NEXT_ID}>
          Next
        </button>
      </>
    )
    fireEvent.click(screen.getByRole('link', { name: 'Skip to Next' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }))
  })
})
