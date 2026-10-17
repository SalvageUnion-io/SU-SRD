import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Card } from '../Card'

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
      <Card headerBgColor="var(--color-mech)" headerContent={<span>My Header</span>}>
        <p>Body</p>
      </Card>
    )
    expect(screen.getByText('My Header')).toBeTruthy()
  })

  test('renders body content in full mode', () => {
    render(
      <Card headerBgColor="var(--color-mech)" headerContent={<span>Header</span>}>
        <p>Body content</p>
      </Card>
    )
    expect(screen.getByText('Body content')).toBeTruthy()
  })

  test('renders footer content in full mode', () => {
    render(
      <Card
        headerBgColor="var(--color-mech)"
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
      <Card headerBgColor="var(--color-mech)" headerContent={<span>Header</span>} label="CHASSIS">
        <p>Body</p>
      </Card>
    )
    expect(screen.getByText('CHASSIS')).toBeTruthy()
  })

  test('non-compact card WITH a callout top-aligns the header row and pads it', () => {
    render(
      <Card headerBgColor="var(--color-mech)" headerContent={<span>Header</span>} label="CHASSIS">
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
      <Card
        headerBgColor="var(--color-mech)"
        headerContent={<span>Header</span>}
        label="CHASSIS"
        size="compact"
      >
        <p>Body</p>
      </Card>
    )
    const headerRow = headerRowAround('Header')
    expect(headerRow.hasAttribute('data-callout')).toBe(true)
    expect(headerRow.hasAttribute('data-compact')).toBe(true)
  })

  test('card WITHOUT any callout centres the header row and omits callout padding', () => {
    render(
      <Card headerBgColor="var(--color-mech)" headerContent={<span>Header</span>}>
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
        headerBgColor="var(--color-mech)"
        headerContent={<span>Header</span>}
        footerContent={<span>Footer</span>}
        size="compact"
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
        headerBgColor="var(--color-mech)"
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
      <Card frame="chrome" headerBgColor="var(--color-ink)" headerContent={<span>Crew</span>}>
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
      <Card frame="chrome" headerBgColor="var(--color-ink)" headerContent={<span>Crew</span>}>
        <p>Body</p>
      </Card>
    )
    expect(chrome).toContain('calc(var(--radius-card) - var(--bw-chrome))')

    const entity = renderToStaticMarkup(
      <Card headerBgColor="var(--color-mech)" headerContent={<span>Chassis</span>}>
        <p>Body</p>
      </Card>
    )
    expect(entity).toContain('calc(var(--radius-card) - var(--bw-entity))')
  })

  test('the body band carries only its own class by default', () => {
    const { container } = render(
      <Card headerBgColor="var(--color-mech)" headerContent={<span>Header</span>}>
        <p>Body</p>
      </Card>
    )
    const body = container.querySelector('.su-card-body')
    expect(body?.className).toBe('su-card-body')
  })

  test('does not render body when children is undefined', () => {
    const { container } = render(
      <Card headerBgColor="var(--color-mech)" headerContent={<span>Header only</span>} />
    )
    expect(container.querySelector('.su-card-body')).toBeNull()
  })

  test('bodyStyle lands on the body band', () => {
    render(
      <Card
        headerBgColor="var(--color-mech)"
        headerContent={<span>Header</span>}
        bodyStyle={{ minHeight: 0 }}
      >
        <p>Body</p>
      </Card>
    )
    expect(screen.getByText('Body').parentElement?.style.minHeight).toMatch(/^0(px)?$/)
  })

  // --- Style override tests ---

  test('cardStyle adds its class, and the card stays flat (no shadow)', () => {
    const { container } = render(
      <Card
        headerBgColor="var(--color-mech)"
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
        headerBgColor="var(--color-mech)"
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
