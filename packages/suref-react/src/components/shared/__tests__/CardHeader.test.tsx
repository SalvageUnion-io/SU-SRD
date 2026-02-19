import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CardHeader } from '../CardHeader'
import type { ReferenceEntityControl } from '../../referenceEntity/ReferenceEntityDisplay/referenceEntityControlTypes'

function MockIcon({ className }: { className?: string }) {
  return <svg data-testid="mock-icon" className={className} />
}

function makeControl(overrides: Partial<ReferenceEntityControl> = {}): ReferenceEntityControl {
  return {
    key: 'test',
    icon: MockIcon,
    onClick: () => {},
    ariaLabel: 'Test action',
    ...overrides,
  }
}

describe('CardHeader', () => {
  afterEach(cleanup)

  test('string title renders as pseudoheader Text', () => {
    render(<CardHeader title="My Title" />)
    const title = screen.getByText('My Title')
    expect(title).toBeTruthy()
    expect(title.className).toContain('bg-su-black')
    expect(title.className).toContain('uppercase')
  })

  test('ReactNode title renders as-is', () => {
    render(<CardHeader title={<span data-testid="custom-title">Custom</span>} />)
    expect(screen.getByTestId('custom-title')).toBeTruthy()
  })

  test('compact mode uses text-base title size', () => {
    render(<CardHeader title="Compact Title" compact />)
    const title = screen.getByText('Compact Title')
    expect(title.className).toContain('text-base')
  })

  test('full mode uses text-[1.75rem] title size', () => {
    render(<CardHeader title="Full Title" />)
    const title = screen.getByText('Full Title')
    expect(title.className).toContain('text-[1.75rem]')
  })

  test('subtitle renders below title', () => {
    render(<CardHeader title="Title" subtitle={<span>Subtitle text</span>} />)
    expect(screen.getByText('Title')).toBeTruthy()
    expect(screen.getByText('Subtitle text')).toBeTruthy()
  })

  test('controls rendered via ControlButtons', () => {
    const handleClick = mock(() => {})
    render(<CardHeader title="Title" controls={[makeControl({ onClick: handleClick })]} />)
    const button = screen.getByRole('button')
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  test('controlSize prop passes through to ControlButtons', () => {
    render(<CardHeader title="Title" controls={[makeControl()]} controlSize="sm" />)
    const icon = screen.getByTestId('mock-icon')
    expect(icon.getAttribute('class')).toContain('h-3.5')
  })

  test('leftContent renders before title', () => {
    render(<CardHeader title="Title" leftContent={<span data-testid="left">L</span>} />)
    const left = screen.getByTestId('left')
    const title = screen.getByText('Title')
    // Both should be in the same parent flex container
    expect(left.parentElement).toBe(title.parentElement!.parentElement)
  })

  test('rightContent renders before controls', () => {
    render(
      <CardHeader
        title="Title"
        rightContent={<span>Stats</span>}
        controls={[makeControl({ ariaLabel: 'Action' })]}
      />
    )
    expect(screen.getByText('Stats')).toBeTruthy()
    expect(screen.getByLabelText('Action')).toBeTruthy()
  })

  test('right side div not rendered when no rightContent and no controls', () => {
    const { container } = render(<CardHeader title="Title only" />)
    // Should only have the left flex group as a direct child (inside fragment)
    const topLevelDivs = container.querySelectorAll(':scope > div')
    // Fragment children are rendered directly in the container
    expect(topLevelDivs.length).toBe(1)
  })

  test('disabled adds opacity-50 to string title', () => {
    render(<CardHeader title="Disabled Title" disabled />)
    const title = screen.getByText('Disabled Title')
    expect(title.className).toContain('opacity-50')
  })
})
