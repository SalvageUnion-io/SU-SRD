import { afterEach, describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { useRef } from 'react'
import { chipLines, MAX_CHIP_LINES, useChipsFit } from '../parts/useChipsFit'

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

/** A heading whose chip group holds real chips, each `width` wide. */
function ChipHeading({ name, chips, room }: { name: number; chips: number[]; room: number }) {
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
      <span className="su-chips">
        {chips.map((width, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed test chips
          <span key={index} ref={sized(width)}>
            Chip
          </span>
        ))}
      </span>
    </div>
  )
}

describe('chipLines', () => {
  test('packs whole chips onto lines with the 4px gap', () => {
    expect(chipLines([40, 40, 40], 128)).toBe(1)
    expect(chipLines([40, 40, 40], 127)).toBe(2)
    expect(chipLines([40, 40, 40], 40)).toBe(3)
  })

  test('a chip wider than the room never fits', () => {
    expect(chipLines([40, 90], 80)).toBe(Number.POSITIVE_INFINITY)
  })
})

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
