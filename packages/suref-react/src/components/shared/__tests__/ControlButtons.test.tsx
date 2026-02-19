import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ControlButtons } from '../ControlButtons'
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

describe('ControlButtons', () => {
  afterEach(cleanup)

  test('renders a button for each control', () => {
    const controls = [
      makeControl({ key: 'a', ariaLabel: 'Action A' }),
      makeControl({ key: 'b', ariaLabel: 'Action B' }),
    ]
    render(<ControlButtons controls={controls} />)
    expect(screen.getByLabelText('Action A')).toBeTruthy()
    expect(screen.getByLabelText('Action B')).toBeTruthy()
  })

  test('applies primary variant classes', () => {
    render(<ControlButtons controls={[makeControl({ variant: 'primary' })]} />)
    const button = screen.getByRole('button')
    expect(button.className).toContain('bg-su-black')
  })

  test('applies danger variant classes', () => {
    render(<ControlButtons controls={[makeControl({ variant: 'danger' })]} />)
    const button = screen.getByRole('button')
    expect(button.className).toContain('hover:bg-su-rust/80')
  })

  test('defaults to ghost variant', () => {
    render(<ControlButtons controls={[makeControl()]} />)
    const button = screen.getByRole('button')
    expect(button.className).toContain('hover:bg-white/20')
  })

  test('fires onClick with stopPropagation', () => {
    let parentClicked = false
    const handleClick = mock(() => {})

    render(
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
      <div onClick={() => (parentClicked = true)}>
        <ControlButtons controls={[makeControl({ onClick: handleClick })]} />
      </div>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
    expect(parentClicked).toBe(false)
  })

  test('renders label text when provided', () => {
    render(<ControlButtons controls={[makeControl({ label: 'Use' })]} />)
    expect(screen.getByText('Use')).toBeTruthy()
  })

  test('applies custom className from control', () => {
    render(<ControlButtons controls={[makeControl({ className: 'opacity-100' })]} />)
    const button = screen.getByRole('button')
    expect(button.className).toContain('opacity-100')
  })

  test('size="sm" renders h-3.5 icons', () => {
    render(<ControlButtons controls={[makeControl()]} size="sm" />)
    const icon = screen.getByTestId('mock-icon')
    expect(icon.getAttribute('class')).toContain('h-3.5')
  })

  test('default size renders h-4.5 icons', () => {
    render(<ControlButtons controls={[makeControl()]} />)
    const icon = screen.getByTestId('mock-icon')
    expect(icon.getAttribute('class')).toContain('h-4.5')
  })

  test('empty controls array renders nothing', () => {
    const { container } = render(<ControlButtons controls={[]} />)
    expect(container.innerHTML).toBe('')
  })

  test('hidden controls are not rendered', () => {
    const controls = [
      makeControl({ key: 'visible', ariaLabel: 'Visible' }),
      makeControl({ key: 'hidden', ariaLabel: 'Hidden', hidden: true }),
    ]
    render(<ControlButtons controls={controls} />)
    expect(screen.getByLabelText('Visible')).toBeTruthy()
    expect(screen.queryByLabelText('Hidden')).toBeNull()
  })

  test('all-hidden controls renders nothing', () => {
    const { container } = render(<ControlButtons controls={[makeControl({ hidden: true })]} />)
    expect(container.innerHTML).toBe('')
  })

  test('control with hoverContent still renders button', () => {
    render(
      <ControlButtons
        controls={[
          makeControl({
            hoverContent: <div data-testid="hover-content">Weapon details</div>,
          }),
        ]}
      />
    )
    // Button should be rendered (hover content is portaled, not visible without hover)
    expect(screen.getByRole('button')).toBeTruthy()
    expect(screen.getByLabelText('Test action')).toBeTruthy()
  })

  test('control without hoverContent renders plain button', () => {
    render(<ControlButtons controls={[makeControl()]} />)
    const button = screen.getByRole('button')
    expect(button).toBeTruthy()
    expect(button.tagName).toBe('BUTTON')
  })
})
