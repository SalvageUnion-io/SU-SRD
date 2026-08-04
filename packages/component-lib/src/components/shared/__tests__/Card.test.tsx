import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Card } from '../Card'
import type { ReferenceEntityControl } from '../../referenceEntity/referenceEntityControlTypes'

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
function rootEl(container: Element): HTMLElement {
  const el = container.firstElementChild
  if (!(el instanceof HTMLElement)) throw new Error('expected an HTMLElement card root')
  return el
}

function headerRowAround(text: string): HTMLElement {
  const row = screen.getByText(text).parentElement
  if (!row) throw new Error(`no header row wrapping "${text}"`)
  return row
}

describe('Card', () => {
  afterEach(cleanup)
  test('renders header content', () => {
    render(
      <Card headerBg="bg-mech" headerContent={<span>My Header</span>}>
        <p>Body</p>
      </Card>
    )
    expect(screen.getByText('My Header')).toBeTruthy()
  })

  test('renders body content in full mode', () => {
    render(
      <Card headerBg="bg-mech" headerContent={<span>Header</span>}>
        <p>Body content</p>
      </Card>
    )
    expect(screen.getByText('Body content')).toBeTruthy()
  })

  test('renders footer content in full mode', () => {
    render(
      <Card
        headerBg="bg-mech"
        headerContent={<span>Header</span>}
        footerContent={<span>Footer info</span>}
      >
        <p>Body</p>
      </Card>
    )
    expect(screen.getByText('Footer info')).toBeTruthy()
  })

  test('renders label as pseudoheader', () => {
    render(
      <Card headerBg="bg-mech" headerContent={<span>Header</span>} label="CHASSIS">
        <p>Body</p>
      </Card>
    )
    expect(screen.getByText('CHASSIS')).toBeTruthy()
  })

  test('non-compact card WITH a callout top-aligns the header row and pads it', () => {
    render(
      <Card headerBg="bg-mech" headerContent={<span>Header</span>} label="CHASSIS">
        <p>Body</p>
      </Card>
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
      <Card headerBg="bg-mech" headerContent={<span>Header</span>} label="CHASSIS" size="medium">
        <p>Body</p>
      </Card>
    )
    const headerRow = headerRowAround('Header')
    expect(headerRow.className).toContain('pt-3')
    expect(headerRow.className).toContain('items-start')
  })

  test('card WITHOUT any callout centres the header row and omits callout padding', () => {
    render(
      <Card headerBg="bg-mech" headerContent={<span>Header</span>}>
        <p>Body</p>
      </Card>
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
      <Card
        headerBg="bg-mech"
        headerContent={<span>Header</span>}
        footerContent={<span>Footer</span>}
        size="medium"
        extent="head"
      >
        <p>Body content</p>
      </Card>
    )
    expect(screen.getByText('Header')).toBeTruthy()
    expect(screen.queryByText('Body content')).toBeNull()
    expect(screen.queryByText('Footer')).toBeNull()
  })

  test('full + listing renders full-size header-only card', () => {
    const { container } = render(
      <Card
        headerBg="bg-mech"
        headerContent={<span>Full Listing</span>}
        footerContent={<span>Footer</span>}
        extent="head"
      >
        <p>Body content</p>
      </Card>
    )
    expect(screen.getByText('Full Listing')).toBeTruthy()
    // Body and footer hidden
    expect(screen.queryByText('Body content')).toBeNull()
    expect(screen.queryByText('Footer')).toBeNull()
    // Full-size header: 80px min-height, entity-weight (3px) border. The weight
    // is named by its border-glossary token rather than the literal, so the
    // assertion tracks the token the component actually emits.
    const wrapper = rootEl(container)
    expect(wrapper.style.borderWidth).toBe('var(--bw-entity)')
  })

  test('frame="chrome" draws the nested sub-panel border weight', () => {
    const { container } = render(
      <Card frame="chrome" headerBg="bg-ink" headerContent={<span>Crew</span>}>
        <p>Body</p>
      </Card>
    )
    const wrapper = rootEl(container)
    expect(wrapper.style.borderWidth).toBe('var(--bw-chrome)')
  })

  test('frame weight is subtracted from the inner clip radius', () => {
    // Asserted through SSR rather than the rendered DOM: the radius is
    // `calc(var(--radius-card) - var(--bw-*))`, and happy-dom's CSS parser
    // drops any `calc()` containing `var()` outright (the style attribute comes
    // back null), so this is simply not observable via the DOM in this
    // environment. The markup React emits is, and it is what browsers parse.
    const chrome = renderToStaticMarkup(
      <Card frame="chrome" headerBg="bg-ink" headerContent={<span>Crew</span>}>
        <p>Body</p>
      </Card>
    )
    expect(chrome).toContain('calc(var(--radius-card) - var(--bw-chrome))')

    const entity = renderToStaticMarkup(
      <Card headerBg="bg-mech" headerContent={<span>Chassis</span>}>
        <p>Body</p>
      </Card>
    )
    expect(entity).toContain('calc(var(--radius-card) - var(--bw-entity))')
  })

  test('default body padding is p-0', () => {
    const { container } = render(
      <Card headerBg="bg-mech" headerContent={<span>Header</span>}>
        <p>Body</p>
      </Card>
    )
    const body = container.querySelector('.p-0')
    expect(body).toBeTruthy()
  })

  test('does not render body when children is undefined', () => {
    const { container } = render(
      <Card headerBg="bg-mech" headerContent={<span>Header only</span>} />
    )
    expect(container.querySelector('.bg-paper')).toBeNull()
  })

  test('disabled state keeps original header background and applies opacity', () => {
    const { container } = render(
      <Card headerBg="bg-mech" headerContent={<span>Disabled</span>} disabled>
        <p>Body</p>
      </Card>
    )
    // The band's tone is asserted in `referenceEntityHelpers.test.ts` against
    // `bandSurface` directly, not here: the band now paints an inline
    // `color-mix(...)` DEEP fill instead of the raw `bg-mech` class, and
    // happy-dom rejects `color-mix` as an invalid backgroundColor — it drops
    // the declaration, so both `style.backgroundColor` and the `style`
    // attribute read empty in this environment regardless of what React set.
    // Asserting it here could only ever produce a false failure or a fake pass.
    expect(headerRowAround('Disabled')).toBeTruthy()
    // Outer wrapper gets opacity-50
    const wrapper = rootEl(container)
    expect(wrapper.className).toContain('opacity-50')
  })

  test('bodyPadding overrides default padding', () => {
    const { container } = render(
      <Card headerBg="bg-mech" headerContent={<span>Header</span>} bodyPadding="p-4">
        <p>Body</p>
      </Card>
    )
    const body = container.querySelector('.p-4')
    expect(body).toBeTruthy()
    expect(container.querySelector('.p-0')).toBeNull()
  })

  test('cardClick control makes entire card clickable in listing mode', () => {
    let clicked = false
    const { container } = render(
      <Card
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
    const wrapper = rootEl(container)
    expect(wrapper.getAttribute('role')).toBe('button')
    fireEvent.click(wrapper)
    expect(clicked).toBe(true)
  })

  test('cardClick control makes entire card clickable in full mode', () => {
    let clicked = false
    const { container } = render(
      <Card
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
      </Card>
    )
    const wrapper = rootEl(container)
    expect(wrapper.getAttribute('role')).toBe('button')
    expect(wrapper.className).toContain('cursor-pointer')
    fireEvent.click(wrapper)
    expect(clicked).toBe(true)
  })

  test('non-cardClick control does not make card clickable', () => {
    const { container } = render(
      <Card
        headerBg="bg-mech"
        headerContent={<span>Row</span>}
        size="medium"
        extent="head"
        controls={[makeTestControl({ cardClick: false })]}
      />
    )
    const wrapper = rootEl(container)
    expect(wrapper.getAttribute('role')).toBeNull()
    // The control button itself still renders
    expect(screen.getByRole('button', { name: 'Test' })).toBeTruthy()
  })

  test('multiple cardClick controls: last one wins', () => {
    let clickedKey = ''
    const { container } = render(
      <Card
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
    fireEvent.click(rootEl(container))
    expect(clickedKey).toBe('second')
  })

  test('onCardClick prop takes priority over cardClick controls', () => {
    let source = ''
    const { container } = render(
      <Card
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
    fireEvent.click(rootEl(container))
    expect(source).toBe('prop')
  })

  test('cardClick adds hover scale classes to wrapper', () => {
    const { container } = render(
      <Card
        headerBg="bg-mech"
        headerContent={<span>Row</span>}
        size="medium"
        extent="head"
        controls={[makeTestControl({ cardClick: true, hidden: true })]}
      />
    )
    const wrapper = rootEl(container)
    expect(wrapper.className).toContain('md:hover:scale-[1.02]')
  })

  test('button mode exposes a focus-visible ring with contrast offset', () => {
    const { container } = render(
      <Card headerBg="bg-mech" headerContent={<span>Row</span>} onCardClick={() => {}}>
        <p>Body</p>
      </Card>
    )
    const wrapper = rootEl(container)
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
      <Card headerBg="bg-mech" headerContent={<span>Static</span>}>
        <p>Body</p>
      </Card>
    )
    const wrapper = rootEl(container)
    expect(wrapper.getAttribute('role')).toBeNull()
    expect(wrapper.className).not.toContain('focus-visible:ring-2')
  })

  // --- Style override tests ---

  test('cardStyle overrides default shadow class', () => {
    const { container } = render(
      <Card
        headerBg="bg-mech"
        headerContent={<span>Header</span>}
        cardStyle={{ className: 'custom-card-class' }}
      >
        <p>Body</p>
      </Card>
    )
    const wrapper = rootEl(container)
    expect(wrapper.className).toContain('custom-card-class')
    expect(wrapper.className).not.toContain('shadow-lg')
  })

  test('headerStyle applies className and inline style to header', () => {
    render(
      <Card
        headerBg="bg-mech"
        headerContent={<span>Header</span>}
        headerStyle={{ className: 'custom-header', style: { backgroundImage: 'url(test)' } }}
      >
        <p>Body</p>
      </Card>
    )
    const header = headerRowAround('Header')
    expect(header.className).toContain('custom-header')
    expect(header.style.backgroundImage).toContain('test')
  })
})
