import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DisplayCard } from '../DisplayCard'

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

  test('listing mode hides body and footer', () => {
    render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Header</span>}
        footerContent={<span>Footer</span>}
        mode="listing"
      >
        <p>Body content</p>
      </DisplayCard>
    )
    expect(screen.getByText('Header')).toBeTruthy()
    expect(screen.queryByText('Body content')).toBeNull()
    expect(screen.queryByText('Footer')).toBeNull()
  })

  test('compact mode renders body with tighter padding', () => {
    const { container } = render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header</span>} mode="compact">
        <p>Body</p>
      </DisplayCard>
    )
    const body = container.querySelector('.p-2')
    expect(body).toBeTruthy()
  })

  test('full mode renders body with standard padding', () => {
    const { container } = render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Header</span>} mode="full">
        <p>Body</p>
      </DisplayCard>
    )
    const body = container.querySelector('.p-3')
    expect(body).toBeTruthy()
  })

  test('onClick makes header clickable with button role', () => {
    let clicked = false
    render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Clickable</span>}
        onClick={() => {
          clicked = true
        }}
      >
        <p>Body</p>
      </DisplayCard>
    )
    const button = screen.getByRole('button')
    fireEvent.click(button)
    expect(clicked).toBe(true)
  })

  test('header supports keyboard activation', () => {
    let clicked = false
    render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Keyboard</span>}
        onClick={() => {
          clicked = true
        }}
      >
        <p>Body</p>
      </DisplayCard>
    )
    const button = screen.getByRole('button')
    fireEvent.keyDown(button, { key: 'Enter' })
    expect(clicked).toBe(true)
  })

  test('no onClick means no button role', () => {
    render(
      <DisplayCard headerBg="bg-su-green" headerContent={<span>Static</span>}>
        <p>Body</p>
      </DisplayCard>
    )
    expect(screen.queryByRole('button')).toBeNull()
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

  test('absoluteElements renders inside the wrapper', () => {
    render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Header</span>}
        absoluteElements={<div data-testid="absolute-el">Overlay</div>}
      >
        <p>Body</p>
      </DisplayCard>
    )
    expect(screen.getByTestId('absolute-el')).toBeTruthy()
    expect(screen.getByText('Overlay')).toBeTruthy()
  })

  test('source applies expansion CSS class to header', () => {
    render(
      <DisplayCard
        headerBg="bg-su-green"
        headerContent={<span>Fangs</span>}
        source="We Were Here First!"
        headerTestId="test-header"
      >
        <p>Body</p>
      </DisplayCard>
    )
    const header = screen.getByTestId('test-header')
    expect(header.className).toContain('expansion-fangs-down')
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
    const footer = container.querySelector('.expansion-fangs-up')
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
    expect(header.className).toContain('expansion-fangs-down')
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper.className).toContain('opacity-50')
  })
})
