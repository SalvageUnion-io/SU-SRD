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

  test('compact renders body with tighter padding', () => {
    const { container } = render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header</span>} compact>
        <p>Body</p>
      </DisplayCard>
    )
    const body = container.querySelector('.p-2')
    expect(body).toBeTruthy()
  })

  test('full renders body with standard padding', () => {
    const { container } = render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header</span>}>
        <p>Body</p>
      </DisplayCard>
    )
    const body = container.querySelector('.p-3')
    expect(body).toBeTruthy()
  })

  test('does not render body when children is undefined', () => {
    const { container } = render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header only</span>} />
    )
    expect(container.querySelector('.bg-su-white')).toBeNull()
  })

  test('headerOpacity applies opacity style to header', () => {
    render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Dimmed</span>}
        headerOpacity={0.5}
        headerTestId="test-header"
      >
        <p>Body</p>
      </DisplayCard>
    )
    const header = screen.getByTestId('test-header')
    expect(header.style.opacity).toBe('0.5')
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
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header</span>} bodyPadding="p-0">
        <p>Body</p>
      </DisplayCard>
    )
    const body = container.querySelector('.p-0')
    expect(body).toBeTruthy()
    expect(container.querySelector('.p-3')).toBeNull()
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

  test('source applies expansion CSS class to header', () => {
    render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Beast</span>}
        source="We Were Here First!"
        headerTestId="test-header"
      >
        <p>Body</p>
      </DisplayCard>
    )
    const header = screen.getByTestId('test-header')
    expect(header.className).toContain('expansion-beast-texture')
  })

  test('footer gets source styling applied', () => {
    const { container } = render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Header</span>}
        footerContent={<span>Footer</span>}
        source="We Were Here First!"
      >
        <p>Body</p>
      </DisplayCard>
    )
    const footer = container.querySelector('.expansion-beast-texture')
    expect(footer).toBeTruthy()
  })

  test('disabled state preserves source styling with opacity', () => {
    const { container } = render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Header</span>}
        source="We Were Here First!"
        disabled
        headerTestId="test-header"
      >
        <p>Body</p>
      </DisplayCard>
    )
    const header = screen.getByTestId('test-header')
    expect(header.className).toContain('expansion-beast-texture')
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('opacity-50')
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

  test('image hidden on non-default tab', () => {
    const tabs: DisplayCardTab[] = [{ key: 'a', label: 'Alpha', content: <p>Alpha content</p> }]
    const { container } = render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Header</span>}
        tabs={tabs}
        image={{ url: 'https://example.com/img.png', alt: 'Test image' }}
      >
        <p>Default body</p>
      </DisplayCard>
    )
    // Image visible on default tab
    expect(container.querySelector('img')).toBeTruthy()

    // Switch to Alpha tab
    fireEvent.click(screen.getByRole('tab', { name: 'Alpha' }))
    expect(container.querySelector('img')).toBeNull()
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
})
