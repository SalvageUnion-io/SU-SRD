import { afterEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { useRef } from 'react'
import { MAX_CHIP_LINES, useChipsFit } from '../parts/useChipsFit'

const realMatchMedia = window.matchMedia

function phone(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia
}

function Heading({
  name,
  chips,
  room,
  overflow = 0,
}: {
  name: number
  chips: number
  room: number
  /** How far the head's content runs past it (its `scrollWidth` less `clientWidth`). */
  overflow?: number
}) {
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
        if (el) {
          Object.defineProperty(el, 'clientWidth', { value: room })
          Object.defineProperty(el, 'scrollWidth', { value: room + overflow })
        }
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

  test('wider than a phone a head whose chips stay inside it is left as it is', () => {
    phone(false)
    const { getByTestId } = render(<Heading name={160} chips={150} room={300} />)
    expect(getByTestId('heading').dataset.chips).toBeUndefined()
  })

  test('wider than a phone chips that run past the head drop under the name (R3)', () => {
    phone(false)
    const { getByTestId } = render(<Heading name={160} chips={150} room={300} overflow={10} />)
    expect(getByTestId('heading').dataset.chips).toBe('under')
  })
})

/**
 * A heading whose chip group holds real chips, each `width` wide, laid out
 * `perLine` to a line (18px tall), and the state a last measure left
 * (`chips`).
 */
function ChipHeading({
  name,
  chips,
  room,
  perLine = chips.length,
  state,
}: {
  name: number
  chips: number[]
  room: number
  perLine?: number
  state?: 'beside' | 'under'
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  useChipsFit(ref, true)
  const sized =
    (width: number, top = 0) =>
    (el: HTMLElement | null) => {
      if (el) el.getBoundingClientRect = () => ({ width, top, height: 18 }) as DOMRect
    }
  return (
    <div
      data-testid="heading"
      data-chips={state}
      ref={(el) => {
        ref.current = el
        if (el) {
          Object.defineProperty(el, 'clientWidth', { value: room })
          Object.defineProperty(el, 'scrollWidth', { value: room })
        }
      }}
    >
      <span ref={sized(name)}>Name</span>
      <span className="su-chips">
        {chips.map((width, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed test chips
          <span key={index} ref={sized(width, Math.floor(index / perLine) * 22)}>
            Chip
          </span>
        ))}
      </span>
    </div>
  )
}

describe('useChipsFit, chips that wrap', () => {
  test('on a phone, chips that wrap onto a few lines beside the name stay beside it', () => {
    phone(true)
    // 200px of room beside the name: six 40px chips take two lines.
    const { getByTestId } = render(
      <ChipHeading name={100} chips={[40, 40, 40, 40, 40, 40]} room={300} />
    )
    expect(getByTestId('heading').dataset.chips).toBe('beside')
  })

  test(`on a phone, chips that would take more than ${MAX_CHIP_LINES} lines drop under`, () => {
    phone(true)
    // 50px of room: one chip a line, six lines.
    const { getByTestId } = render(
      <ChipHeading name={250} chips={[40, 40, 40, 40, 40, 40]} room={300} />
    )
    expect(getByTestId('heading').dataset.chips).toBe('under')
  })
})

describe('useChipsFit wider than a phone', () => {
  test('chips beside the name on two lines stay there', () => {
    phone(false)
    const { getByTestId } = render(
      <ChipHeading name={100} chips={[40, 40, 40, 40]} room={300} perLine={2} />
    )
    expect(getByTestId('heading').dataset.chips).toBeUndefined()
  })

  test(`chips beside the name on more than ${MAX_CHIP_LINES} lines drop under it (C5)`, () => {
    phone(false)
    const { getByTestId } = render(
      <ChipHeading name={100} chips={[40, 40, 40, 40, 40, 40]} room={300} perLine={2} />
    )
    expect(getByTestId('heading').dataset.chips).toBe('under')
  })

  test('under, they come back beside only when they fit beside the one-line name', () => {
    phone(false)
    const back = render(
      <ChipHeading name={100} chips={[40, 40, 40, 40, 40, 40]} room={300} state="under" />
    )
    expect(back.getByTestId('heading').dataset.chips).toBe('beside')
    back.unmount()
    const stay = render(
      <ChipHeading name={250} chips={[40, 40, 40, 40, 40, 40]} room={300} state="under" />
    )
    expect(stay.getByTestId('heading').dataset.chips).toBe('under')
  })
})
