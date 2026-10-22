import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { StartHere } from '../StartHere'

describe('StartHere', () => {
  test("each step's frame wears its band's colour (R51)", () => {
    const { container } = render(<StartHere id="start" />)
    const frames = [...container.querySelectorAll<HTMLElement>('.su-entity-index__frame')]
    expect(frames).toHaveLength(3)
    for (const frame of frames) {
      const band = frame.querySelector<HTMLElement>('.su-entity-index__band')
      expect(frame.style.borderColor).toBe(band?.style.backgroundColor ?? '')
      expect(frame.style.borderColor).not.toBe('')
    }
  })
})
