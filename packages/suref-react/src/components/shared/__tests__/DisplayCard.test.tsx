import { describe, test, expect, afterEach, spyOn } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DisplayCard } from '../DisplayCard'
import type { DisplayCardTab } from '../DisplayCard'
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

describe('DisplayCard', () => {
  afterEach(cleanup)
  test('renders header content', () => {
    render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>My Header</span>}>
        <p>Body</p>
      </DisplayCard>
    )
    expect(screen.getByText('My Header')).toBeTruthy()
  })

  test('renders body content in full mode', () => {
    render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header</span>}>
        <p>Body content</p>
      </DisplayCard>
    )
    expect(screen.getByText('Body content')).toBeTruthy()
  })

  test('renders footer content in full mode', () => {
    render(
      <DisplayCard
        headerBg="bg-su-green"
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
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header</span>} label="CHASSIS">
        <p>Body</p>
      </DisplayCard>
    )
    expect(screen.getByText('CHASSIS')).toBeTruthy()
  })

  test('renders labelLead, label, and labelBadge together in one callout row', () => {
    render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Header</span>}
        labelLead={<span>RECOMMENDED</span>}
        label="TECH LEVEL"
        labelBadge="3"
      >
        <p>Body</p>
      </DisplayCard>
    )
    expect(screen.getByText('RECOMMENDED')).toBeTruthy()
    expect(screen.getByText('TECH LEVEL')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    // All three live inside a single callout row (shared parent element), in order.
    const lead = screen.getByText('RECOMMENDED')
    const row = lead.parentElement
    expect(row).not.toBeNull()
    const rowText = row?.textContent ?? ''
    expect(rowText.indexOf('RECOMMENDED')).toBeLessThan(rowText.indexOf('TECH LEVEL'))
    expect(rowText.indexOf('TECH LEVEL')).toBeLessThan(rowText.indexOf('3'))
  })

  test('non-compact card WITH a callout top-aligns the header row and pads it', () => {
    render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Header</span>}
        label="CHASSIS"
        headerTestId="frame-header-container"
      >
        <p>Body</p>
      </DisplayCard>
    )
    const headerRow = screen.getByTestId('frame-header-container')
    expect(headerRow.className).toContain('items-start')
    expect(headerRow.className).toContain('pt-4')
    expect(headerRow.className).toContain('pb-4')
  })

  test('compact card WITH a callout uses pt-3 and top-aligns the header row', () => {
    render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Header</span>}
        label="CHASSIS"
        compact
        headerTestId="frame-header-container"
      >
        <p>Body</p>
      </DisplayCard>
    )
    const headerRow = screen.getByTestId('frame-header-container')
    expect(headerRow.className).toContain('pt-3')
    expect(headerRow.className).toContain('items-start')
  })

  test('card WITHOUT any callout centres the header row and omits callout padding', () => {
    render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Header</span>}
        headerTestId="frame-header-container"
      >
        <p>Body</p>
      </DisplayCard>
    )
    const headerRow = screen.getByTestId('frame-header-container')
    expect(headerRow.className).toContain('items-center')
    // Only the callout-specific paddings should be absent (base px-3 py-* remain).
    expect(headerRow.className).not.toContain('pt-4')
    expect(headerRow.className).not.toContain('pb-4')
    expect(headerRow.className).not.toContain('pt-3')
  })

  test('listing boolean hides body and footer', () => {
    render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Header</span>}
        footerContent={<span>Footer</span>}
        compact
        listing
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
        headerBg="bg-su-green"
        headerContent={<span>Full Listing</span>}
        footerContent={<span>Footer</span>}
        listing
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
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header</span>}>
        <p>Body</p>
      </DisplayCard>
    )
    const body = container.querySelector('.p-0')
    expect(body).toBeTruthy()
  })

  test('does not render body when children is undefined', () => {
    const { container } = render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header only</span>} />
    )
    expect(container.querySelector('.bg-su-white')).toBeNull()
  })

  test('disabled state keeps original header background and applies opacity', () => {
    const { container } = render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Disabled</span>}
        disabled
        headerTestId="test-header"
      >
        <p>Body</p>
      </DisplayCard>
    )
    const header = screen.getByTestId('test-header')
    expect(header.className).toContain('bg-su-green')
    // Outer wrapper gets opacity-50
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('opacity-50')
  })

  test('bodyPadding overrides default padding', () => {
    const { container } = render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header</span>} bodyPadding="p-4">
        <p>Body</p>
      </DisplayCard>
    )
    const body = container.querySelector('.p-4')
    expect(body).toBeTruthy()
    expect(container.querySelector('.p-0')).toBeNull()
  })

  test('headerTestId passes data-testid to header div', () => {
    render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Header</span>}
        headerTestId="my-header"
      >
        <p>Body</p>
      </DisplayCard>
    )
    expect(screen.getByTestId('my-header')).toBeTruthy()
  })

  test('cardClick control makes entire card clickable in listing mode', () => {
    let clicked = false
    const { container } = render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Row</span>}
        compact
        listing
        headerTestId="header"
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
        headerBg="bg-su-green"
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
        headerBg="bg-su-green"
        headerContent={<span>Row</span>}
        compact
        listing
        controls={[makeTestControl({ cardClick: false })]}
      />
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.getAttribute('role')).toBeNull()
    // The control button itself still renders
    expect(screen.getByRole('button', { name: 'Test' })).toBeTruthy()
  })

  test('multiple cardClick controls: last one wins and warns', () => {
    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    let clickedKey = ''
    const { container } = render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Row</span>}
        compact
        listing
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
    expect(warnSpy).toHaveBeenCalled()
    fireEvent.click(container.firstElementChild as HTMLElement)
    expect(clickedKey).toBe('second')
    warnSpy.mockRestore()
  })

  test('onCardClick prop takes priority over cardClick controls', () => {
    let source = ''
    const { container } = render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Row</span>}
        compact
        listing
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

  test('cardClickable enables hover classes without click handler', () => {
    const { container } = render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Hoverable</span>} cardClickable>
        <p>Body</p>
      </DisplayCard>
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('cursor-pointer')
    // No role=button since there's no click handler
    expect(wrapper.getAttribute('role')).toBeNull()
  })

  test('cardClick adds hover scale classes to wrapper', () => {
    const { container } = render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Row</span>}
        compact
        listing
        controls={[makeTestControl({ cardClick: true, hidden: true })]}
      />
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('md:hover:scale-[1.02]')
  })

  test('button mode exposes a focus-visible ring with contrast offset', () => {
    const { container } = render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Row</span>} onCardClick={() => {}}>
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
    expect(wrapper.className).toContain('focus-visible:ring-su-black')
    expect(wrapper.className).toContain('focus-visible:ring-offset-2')
    expect(wrapper.className).toContain('focus-visible:ring-offset-su-white')
  })

  test('non-button (non-clickable) card does not render focus ring classes', () => {
    const { container } = render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Static</span>}>
        <p>Body</p>
      </DisplayCard>
    )
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.getAttribute('role')).toBeNull()
    expect(wrapper.className).not.toContain('focus-visible:ring-2')
  })

  test('tab content container has aria-live polite for screen reader announcements', () => {
    const tabs: DisplayCardTab[] = [{ key: 'a', label: 'Alpha', content: <p>Alpha content</p> }]
    const { container } = render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header</span>} tabs={tabs}>
        <p>Default body</p>
      </DisplayCard>
    )
    const liveRegion = container.querySelector('[aria-live="polite"]')
    expect(liveRegion).toBeTruthy()
    expect(liveRegion!.textContent).toContain('Default body')
  })

  // --- Tab tests ---

  test('no tabs renders no tab bar', () => {
    render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header</span>}>
        <p>Body</p>
      </DisplayCard>
    )
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.getByText('Body')).toBeTruthy()
  })

  test('tabs render tab bar with correct labels', () => {
    const tabs: DisplayCardTab[] = [
      { key: 'a', label: 'Alpha', content: <p>Alpha content</p> },
      { key: 'b', label: 'Beta', content: <p>Beta content</p> },
    ]
    render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header</span>} tabs={tabs}>
        <p>Default content</p>
      </DisplayCard>
    )
    const tablist = screen.getByRole('tablist')
    expect(tablist).toBeTruthy()
    const tabButtons = screen.getAllByRole('tab')
    expect(tabButtons.length).toBe(3) // Info + Alpha + Beta
    expect(tabButtons[0]!.textContent).toBe('Info')
    expect(tabButtons[1]!.textContent).toBe('Alpha')
    expect(tabButtons[2]!.textContent).toBe('Beta')
  })

  test('default tab shows children content', () => {
    const tabs: DisplayCardTab[] = [{ key: 'a', label: 'Alpha', content: <p>Alpha content</p> }]
    render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header</span>} tabs={tabs}>
        <p>Default body</p>
      </DisplayCard>
    )
    expect(screen.getByText('Default body')).toBeTruthy()
    expect(screen.queryByText('Alpha content')).toBeNull()
  })

  test('tab switching hides children and shows tab content', () => {
    const tabs: DisplayCardTab[] = [{ key: 'a', label: 'Alpha', content: <p>Alpha content</p> }]
    render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header</span>} tabs={tabs}>
        <p>Default body</p>
      </DisplayCard>
    )
    // Click Alpha tab
    fireEvent.click(screen.getByRole('tab', { name: 'Alpha' }))
    expect(screen.queryByText('Default body')).toBeNull()
    expect(screen.getByText('Alpha content')).toBeTruthy()

    // Click back to default
    fireEvent.click(screen.getByRole('tab', { name: 'Info' }))
    expect(screen.getByText('Default body')).toBeTruthy()
    expect(screen.queryByText('Alpha content')).toBeNull()
  })

  test('defaultTabLabel customization', () => {
    const tabs: DisplayCardTab[] = [{ key: 'a', label: 'Alpha', content: <p>Alpha content</p> }]
    render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Header</span>}
        tabs={tabs}
        defaultTabLabel="Details"
      >
        <p>Body</p>
      </DisplayCard>
    )
    expect(screen.getByRole('tab', { name: 'Details' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Info' })).toBeNull()
  })

  test('listing mode ignores tabs', () => {
    const tabs: DisplayCardTab[] = [{ key: 'a', label: 'Alpha', content: <p>Alpha content</p> }]
    render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Header</span>}
        compact
        listing
        tabs={tabs}
      >
        <p>Body</p>
      </DisplayCard>
    )
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByText('Body')).toBeNull()
    expect(screen.queryByText('Alpha content')).toBeNull()
  })

  test('tab with glowColor gets box-shadow applied', () => {
    const tabs: DisplayCardTab[] = [
      {
        key: 'glow',
        label: 'Glowing',
        content: <p>Glow content</p>,
        glowColor: 'rgba(206, 88, 152, 0.5)',
      },
    ]
    render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header</span>} tabs={tabs}>
        <p>Body</p>
      </DisplayCard>
    )
    const glowTab = screen.getByRole('tab', { name: 'Glowing' })
    expect(glowTab.style.boxShadow).toBe('0 0 8px 2px rgba(206, 88, 152, 0.5)')
  })

  // --- Style override tests ---

  test('cardStyle overrides default shadow class', () => {
    const { container } = render(
      <DisplayCard
        headerBg="bg-su-green"
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
        headerBg="bg-su-green"
        headerContent={<span>Header</span>}
        headerStyle={{ className: 'custom-header', style: { backgroundImage: 'url(test)' } }}
        headerTestId="test-header"
      >
        <p>Body</p>
      </DisplayCard>
    )
    const header = screen.getByTestId('test-header')
    expect(header.className).toContain('custom-header')
    expect(header.style.backgroundImage).toContain('test')
  })

  test('footerStyle overrides default footer bg class', () => {
    const { container } = render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Header</span>}
        footerContent={<span>Footer</span>}
        footerStyle={{ className: 'bg-su-orange' }}
      >
        <p>Body</p>
      </DisplayCard>
    )
    // Footer should have the override class, not the default headerBg
    const footerEl = container.querySelector('.bg-su-orange')
    expect(footerEl).toBeTruthy()
    expect(footerEl!.textContent).toBe('Footer')
  })
})
