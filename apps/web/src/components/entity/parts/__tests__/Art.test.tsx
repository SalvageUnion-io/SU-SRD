import { describe, expect, test } from 'bun:test'
import { fireEvent, render } from '@testing-library/react'
import { Art } from '../Art'

describe('Art', () => {
  test('an image that will not load leaves no near-blank window behind (RR6-07)', () => {
    const { container } = render(<Art art={{ kind: 'image', url: '/missing.webp' }} />)
    // The DOM may already have reported the miss; else report it.
    const img = container.querySelector('img')
    if (img) fireEvent.error(img)
    expect(container.querySelector('.su-entity-compact__art')).toBeNull()
  })

  test('an image that loads keeps its window', () => {
    const { container } = render(
      <Art art={{ kind: 'image', url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }} />
    )
    expect(container.querySelector('.su-entity-compact__art img')).toBeTruthy()
  })
})
