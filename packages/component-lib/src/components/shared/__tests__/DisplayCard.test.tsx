import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DisplayCard } from '../DisplayCard'
import type { ReferenceEntityControl } from '../../referenceEntity/ReferenceEntityDisplay/referenceEntityControlTypes'

function makeTestControl(overrides: Partial<ReferenceEntityControl> = {}): ReferenceEntityControl {
  return {
    key: 'test',
    label: 'Test',
    onClick: () => {},
    ariaLabel: 'Test',
    ...overrides,
  }
}

/**
 * The header band is a purely visual row (no landmark role, no label), so the
 * accessible route to it is through its visible content: query the rendered
 * header text, then step up to the row that wraps it. Replaces the deleted
 * test-only `headerTestId` prop.
 */
function headerRowAround(text: string): HTMLElement {
  const row = screen.getByText(text).parentElement
  if (!row) throw new Error(`no header row wrapping "${text}"`)
  return row
}

describe('DisplayCard', () => {
  afterEach(cleanup)
  test('renders header content', () => {
    render(
      <DisplayCard headerBg="bg-mech" headerContent={<span>My Header</span>}>
        <p>Body</p>
      </DisplayCard>
    )
    expect(screen.getByText('My Header')).toBeTruthy()
  })

  test('renders body content in full mode', () => {
    render(
      <DisplayCard headerBg="bg-mech" headerContent={<span>Header</span>}>
        <p>Body content</p>
      </DisplayCard>
    )
    expect(screen.getByText('Body content')).toBeTruthy()
  })

  test('renders footer content in full mode', () => {
    render(
      <DisplayCard
        headerBg="bg-mech"
        headerContent={<span>Header</span>}
        footerContent={<span>Footer info</span>}
      >
        <p>Body</p>
      </DisplayCard>
    )
    expect(screen.getByText('Footer info')).toBeTruthy()
  })

  test('renders label as pseudoheader', () => {
    render(
      <DisplayCard headerBg="bg-mech" headerContent={<span>Header</span>} label="CHASSIS">
        <p>Body</p>
      </DisplayCard>
    )
    expect(screen.getByText('CHASSIS')).toBeTruthy()
  })

  test('non-compact card WITH a callout top-aligns the header row and pads it', () => {
    render(
      <DisplayCard headerBg="bg-mech" headerContent={<span>Header</span>} label="CHASSIS">
        <p>Body</p>
      </DisplayCard>
    )
    const headerRow = headerRowAround('Header')
    expect(headerRow.className).toContain('items-start')
    // Non-compact callout clearance: the seam is the small (compact) stamp, so
    // pt-5 clears it with a thin, consistent gap under the callout.
    expect(headerRow.className).toContain('pt-5')
    expect(headerRow.className).toContain('pb-4')
  })

  test('compact card WITH a callout uses pt-3 and top-aligns the header row', () => {
    render(
      <DisplayCard
        headerBg="bg-mech"
        headerContent={<span>Header</span>}
        label="CHASSIS"
        size="medium"
      >
        <p>Body</p>
      </DisplayCard>
    )
    const headerRow = headerRowAround('Header')
    expect(headerRow.className).toContain('pt-3')
    expect(headerRow.className).toContain('items-start')
  })

  test('card WITHOUT any callout centres the header row and omits callout padding', () => {
    render(
      <DisplayCard headerBg="bg-mech" headerContent={<span>Header</span>}>
        <p>Body</p>
      </DisplayCard>
    )
    const headerRow = headerRowAround('Header')
    expect(headerRow.className).toContain('items-center')
    // Only the callout-specific paddings should be absent (base px-3 py-* remain).
    expect(headerRow.className).not.toContain('pt-4')
    expect(headerRow.className).not.toContain('pb-4')
    expect(headerRow.className).not.toContain('pt-3')
  })

  test('listing boolean hides body and footer', () => {
    render(
      <DisplayCard
        headerBg="bg-mech"
        headerContent={<span>Header</span>}
        footerContent={<span>Footer</span>}
        size="medium"
        extent="head"
      >
        <p>Body content</p>
      </DisplayCard>
    )
    expect(screen.getByText('Header')).toBeTruthy()
    expect(screen.queryByText('Body content')).toBeNull()
    expect(screen.queryByText('Footer')).toBeNull()
  })

  test('full + listing renders full-size header-only card', () => {
    const { container } = render(
      <DisplayCard
        headerBg="bg-mech"
        headerContent={<span>Full Listing</span>}
        footerContent={<span>Footer</span>}
        extent="head"
      >
        <p>Body content</p>
      </DisplayCard>
    )
    expect(screen.getByText('Full Listing')).toBeTruthy()
    // Body and footer hidden
    expect(screen.queryByText('Body content')).toBeNull()
    expect(screen.queryByText('Footer')).toBeNull()
    // Full-size header: 80px min-height, 3px border
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.style.border).toContain('3px')
  })

  test('default body padding is p-0', () => {
    const { container } = render(
      <DisplayCard headerBg="bg-mech" headerContent={<span>Header</span>}>
        <p>Body</p>
      </DisplayCard>
    )
    const body = container.querySelector('.p-0')
    expect(body).toBeTruthy()
  })

  test('does not render body when children is undefined', () => {
    const { container } = render(
      <DisplayCard headerBg="bg-mech" headerContent={<span>Header only</span>} />
    )
    expect(container.querySelector('.bg-paper')).toBeNull()
  })

  test('disabled state keeps original header background and applies opacity', () => {
    const { container } = render(
      <DisplayCard headerBg="bg-mech" headerContent={<span>Disabled</span>} disabled>
        <p>Body</p>
      </DisplayCard>
    )
    const header = headerRowAround('Disabled')
    expect(header.className).toContain('bg-mech')
    // Outer wrapper gets opacity-50
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('opacity-50')
  })

  test('bodyPadding overrides default padding', () => {
    const { container } = render(
      <DisplayCard headerBg="bg-mech" headerContent={<span>Header</span>} bodyPadding="p-4">
        <p>Body</p>
      </DisplayCard>
    )
    const body = container.querySelector('.p-4')
    expect(body).toBeTruthy()
    expect(container.querySelector('.p-0')).toBeNull()
  })

  test('cardClick control makes entire card clickable in listing mode', () => {
    let clicked = false
    const { container } = render(
      <DisplayCard
        headerBg="bg-mech"
        headerContent={<span>Row</span>}
        size="medium"
        extent="head"
        controls={[
          makeTestControl({
            cardClick: true,
            hidden: true,
            onClick: () => {
              clicked = true
            },
          }),
        ]}
      />
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.getAttribute('role')).toBe('button')
    fireEvent.click(wrapper)
    expect(clicked).toBe(true)
  })

  test('cardClick control makes entire card clickable in full mode', () => {
    let clicked = false
    const { container } = render(
      <DisplayCard
        headerBg="bg-mech"
        headerContent={<span>Full</span>}
        controls={[
          makeTestControl({
            cardClick: true,
            hidden: true,
            onClick: () => {
              clicked = true
            },
          }),
        ]}
      >
        <p>Body</p>
      </DisplayCard>
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.getAttribute('role')).toBe('button')
    expect(wrapper.className).toContain('cursor-pointer')
    fireEvent.click(wrapper)
    expect(clicked).toBe(true)
  })

  test('non-cardClick control does not make card clickable', () => {
    const { container } = render(
      <DisplayCard
        headerBg="bg-mech"
        headerContent={<span>Row</span>}
        size="medium"
        extent="head"
        controls={[makeTestControl({ cardClick: false })]}
      />
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.getAttribute('role')).toBeNull()
    // The control button itself still renders
    expect(screen.getByRole('button', { name: 'Test' })).toBeTruthy()
  })

  test('multiple cardClick controls: last one wins', () => {
    let clickedKey = ''
    const { container } = render(
      <DisplayCard
        headerBg="bg-mech"
        headerContent={<span>Row</span>}
        size="medium"
        extent="head"
        controls={[
          makeTestControl({
            key: 'first',
            cardClick: true,
            hidden: true,
            onClick: () => {
              clickedKey = 'first'
            },
          }),
          makeTestControl({
            key: 'second',
            cardClick: true,
            hidden: true,
            onClick: () => {
              clickedKey = 'second'
            },
          }),
        ]}
      />
    )
    fireEvent.click(container.firstElementChild as HTMLElement)
    expect(clickedKey).toBe('second')
  })

  test('onCardClick prop takes priority over cardClick controls', () => {
    let source = ''
    const { container } = render(
      <DisplayCard
        headerBg="bg-mech"
        headerContent={<span>Row</span>}
        size="medium"
        extent="head"
        onCardClick={() => {
          source = 'prop'
        }}
        controls={[
          makeTestControl({
            cardClick: true,
            hidden: true,
            onClick: () => {
              source = 'control'
            },
          }),
        ]}
      />
    )
    fireEvent.click(container.firstElementChild as HTMLElement)
    expect(source).toBe('prop')
  })

  test('cardClick adds hover scale classes to wrapper', () => {
    const { container } = render(
      <DisplayCard
        headerBg="bg-mech"
        headerContent={<span>Row</span>}
        size="medium"
        extent="head"
        controls={[makeTestControl({ cardClick: true, hidden: true })]}
      />
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('md:hover:scale-[1.02]')
  })

  test('button mode exposes a focus-visible ring with contrast offset', () => {
    const { container } = render(
      <DisplayCard headerBg="bg-mech" headerContent={<span>Row</span>} onCardClick={() => {}}>
        <p>Body</p>
      </DisplayCard>
    )
    const wrapper = container.firstElementChild as HTMLElement
    // Wrapper should be keyboard-focusable when clickable
    expect(wrapper.getAttribute('tabIndex')).toBe('0')
    expect(wrapper.getAttribute('role')).toBe('button')
    // Ring-based focus indicator with a contrasting offset color so the outline
    // remains visible on both light and dark tech-level backgrounds.
    expect(wrapper.className).toContain('focus-visible:ring-2')
    expect(wrapper.className).toContain('focus-visible:ring-ink')
    expect(wrapper.className).toContain('focus-visible:ring-offset-2')
    expect(wrapper.className).toContain('focus-visible:ring-offset-paper')
  })

  test('non-button (non-clickable) card does not render focus ring classes', () => {
    const { container } = render(
      <DisplayCard headerBg="bg-mech" headerContent={<span>Static</span>}>
        <p>Body</p>
      </DisplayCard>
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.getAttribute('role')).toBeNull()
    expect(wrapper.className).not.toContain('focus-visible:ring-2')
  })

  // --- Style override tests ---

  test('cardStyle overrides default shadow class', () => {
    const { container } = render(
      <DisplayCard
        headerBg="bg-mech"
        headerContent={<span>Header</span>}
        cardStyle={{ className: 'custom-card-class' }}
      >
        <p>Body</p>
      </DisplayCard>
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('custom-card-class')
    expect(wrapper.className).not.toContain('shadow-lg')
  })

  test('headerStyle applies className and inline style to header', () => {
    render(
      <DisplayCard
        headerBg="bg-mech"
        headerContent={<span>Header</span>}
        headerStyle={{ className: 'custom-header', style: { backgroundImage: 'url(test)' } }}
      >
        <p>Body</p>
      </DisplayCard>
    )
    const header = headerRowAround('Header')
    expect(header.className).toContain('custom-header')
    expect(header.style.backgroundImage).toContain('test')
  })
})
