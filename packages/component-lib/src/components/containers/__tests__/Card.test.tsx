import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FOCUS_RING_ON_TONE } from '../../atoms/interaction'
import type { ReferenceEntityControl } from '../../referenceEntity/referenceEntityControlTypes'
import { Card } from '../Card'

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
    // Non-compact callout clearance (`.su-card-head[data-callout]`): top-aligned,
    // 20px over / 16px under, so the seam stamp clears with a thin, consistent gap.
    expect(headerRow.hasAttribute('data-callout')).toBe(true)
    expect(headerRow.hasAttribute('data-compact')).toBe(false)
  })

  test('compact card WITH a callout uses pt-3 and top-aligns the header row', () => {
    render(
      <Card headerBg="bg-mech" headerContent={<span>Header</span>} label="CHASSIS" size="medium">
        <p>Body</p>
      </Card>
    )
    const headerRow = headerRowAround('Header')
    expect(headerRow.hasAttribute('data-callout')).toBe(true)
    expect(headerRow.hasAttribute('data-compact')).toBe(true)
  })

  test('card WITHOUT any callout centres the header row and omits callout padding', () => {
    render(
      <Card headerBg="bg-mech" headerContent={<span>Header</span>}>
        <p>Body</p>
      </Card>
    )
    const headerRow = headerRowAround('Header')
    // The base `.su-card-head` (centred, px-3 py-2); no callout modifier.
    expect(headerRow.className).toContain('su-card-head')
    expect(headerRow.hasAttribute('data-callout')).toBe(false)
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
    expect(wrapper.style.borderTopWidth).toBe('var(--bw-entity)')
  })

  test('frame="chrome" draws the nested sub-panel border weight', () => {
    const { container } = render(
      <Card frame="chrome" headerBg="bg-ink" headerContent={<span>Crew</span>}>
        <p>Body</p>
      </Card>
    )
    const wrapper = rootEl(container)
    expect(wrapper.style.borderTopWidth).toBe('var(--bw-chrome)')
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

  test('the body band carries only its own class by default', () => {
    const { container } = render(
      <Card headerBg="bg-mech" headerContent={<span>Header</span>}>
        <p>Body</p>
      </Card>
    )
    const body = container.querySelector('.su-card-body')
    expect(body?.className).toBe('su-card-body')
  })

  test('does not render body when children is undefined', () => {
    const { container } = render(
      <Card headerBg="bg-mech" headerContent={<span>Header only</span>} />
    )
    expect(container.querySelector('.su-card-body')).toBeNull()
  })

  test('disabled state keeps original header background and applies opacity', () => {
    const { container } = render(
      <Card headerBg="bg-mech" headerContent={<span>Disabled</span>} disabled>
        <p>Body</p>
      </Card>
    )
    const header = headerRowAround('Disabled')
    expect(header.className).toContain('bg-mech')
    // Outer wrapper dims to half opacity
    const wrapper = rootEl(container)
    expect(wrapper.style.opacity).toBe('0.5')
  })

  test('bodyPadding overrides default padding', () => {
    const { container } = render(
      <Card headerBg="bg-mech" headerContent={<span>Header</span>} bodyPadding="p-4">
        <p>Body</p>
      </Card>
    )
    const body = container.querySelector('.su-card-body')
    expect(body?.className).toContain('p-4')
  })

  test('bodyStyle lands on the body band', () => {
    render(
      <Card headerBg="bg-mech" headerContent={<span>Header</span>} bodyStyle={{ minHeight: 0 }}>
        <p>Body</p>
      </Card>
    )
    expect(screen.getByText('Body').parentElement?.style.minHeight).toMatch(/^0(px)?$/)
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
    expect(wrapper.style.cursor).toBe('pointer')
    fireEvent.click(wrapper)
    expect(clicked).toBe(true)
  })

  test('a VISIBLE cardClick control is the one control; the card is a pointer convenience', () => {
    let clicks = 0
    const { container } = render(
      <Card
        headerBg="bg-mech"
        headerContent={<span>Row</span>}
        size="medium"
        extent="head"
        controls={[
          makeTestControl({
            cardClick: true,
            onClick: () => {
              clicks += 1
            },
          }),
        ]}
      />
    )
    const wrapper = rootEl(container)
    // No role, tab stop or key handler on the card: one button, one tab stop.
    expect(wrapper.getAttribute('role')).toBeNull()
    expect(wrapper.getAttribute('tabindex')).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    // A pointer click anywhere still lands, and the button's own click fires once.
    fireEvent.click(wrapper)
    expect(clicks).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'Test' }))
    expect(clicks).toBe(2)
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

  test('cardClick makes the wrapper a pointer target, without a hover lift', () => {
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
    expect(wrapper.style.cursor).toBe('pointer')
    expect(wrapper.getAttribute('style')).not.toContain('scale')
    expect(wrapper.getAttribute('style')).not.toContain('translate')
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
    // Ring-based focus indicator with a contrasting offset colour so the ring
    // stays visible on both the light and the dark end of the tech-level ramp.
    //
    // One assertion, on the exported constant, not on the pieces of a
    // spelling: the ring's composition is the STYLESHEET's business. What this
    // test is about is that a clickable Card reaches for the on-tone rung rather
    // than the soft one; a spelled ring would pin the test to an implementation
    // detail a rename can move.
    expect(wrapper.className).toContain(FOCUS_RING_ON_TONE)
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

  test('cardStyle adds its class, and the card stays flat (no shadow)', () => {
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
