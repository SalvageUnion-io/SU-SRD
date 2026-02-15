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
})
