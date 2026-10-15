import { afterEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { useRef } from 'react'
import { useChipsFit } from '../parts/useChipsFit'

const realMatchMedia = window.matchMedia

function phone(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia
}

function Heading({ name, chips, room }: { name: number; chips: number; room: number }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useChipsFit(ref, true)
  const sized = (width: number) => (el: HTMLElement | null) => {
    if (el) el.getBoundingClientRect = () => ({ width }) as DOMRect
  }
  return (
    <div
      data-testid="heading"
      ref={(el) => {
        ref.current = el
        if (el) Object.defineProperty(el, 'clientWidth', { value: room })
      }}
    >
      <span ref={sized(name)}>Name</span>
      <span ref={sized(chips)}>Chips</span>
    </div>
  )
}

afterEach(() => {
  window.matchMedia = realMatchMedia
})

describe('useChipsFit', () => {
  test('on a phone, chips that fit beside the name stay beside it', () => {
    phone(true)
    const { getByTestId } = render(<Heading name={100} chips={150} room={300} />)
    expect(getByTestId('heading').dataset.chips).toBe('beside')
  })

  test('on a phone, chips that do not fit drop under the name', () => {
    phone(true)
    const { getByTestId } = render(<Heading name={160} chips={150} room={300} />)
    expect(getByTestId('heading').dataset.chips).toBe('under')
  })

  test('wider than a phone nothing is measured: the chips are always beside', () => {
    phone(false)
    const { getByTestId } = render(<Heading name={160} chips={150} room={300} />)
    expect(getByTestId('heading').dataset.chips).toBeUndefined()
  })
})
