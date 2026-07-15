import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ControlButtons } from '../ControlButtons'
import type { ReferenceEntityControl } from '../../referenceEntity/ReferenceEntityDisplay/referenceEntityControlTypes'

function makeControl(overrides: Partial<ReferenceEntityControl> = {}): ReferenceEntityControl {
  return {
    key: 'test',
    label: 'Test',
    onClick: () => {},
    ariaLabel: 'Test action',
    ...overrides,
  }
}

describe('ControlButtons', () => {
  afterEach(cleanup)

  test('renders a button for each control', () => {
    const controls = [
      makeControl({ key: 'a', ariaLabel: 'Action A', label: 'A' }),
      makeControl({ key: 'b', ariaLabel: 'Action B', label: 'B' }),
    ]
    render(<ControlButtons controls={controls} />)
    expect(screen.getByLabelText('Action A')).toBeTruthy()
    expect(screen.getByLabelText('Action B')).toBeTruthy()
  })

  test('defaults to primary variant (black bg)', () => {
    render(<ControlButtons controls={[makeControl()]} />)
    const button = screen.getByRole('button')
    expect(button.innerHTML).toContain('bg-su-black')
  })

  test('applies danger variant classes', () => {
    render(<ControlButtons controls={[makeControl({ variant: 'danger' })]} />)
    const button = screen.getByRole('button')
    expect(button.innerHTML).toContain('bg-su-rust')
  })

  test('applies ghost variant classes', () => {
    render(<ControlButtons controls={[makeControl({ variant: 'ghost' })]} />)
    const button = screen.getByRole('button')
    expect(button.innerHTML).toContain('bg-paper')
  })

  test('fires onClick with stopPropagation', () => {
    let parentClicked = false
    const handleClick = mock(() => {})

    render(
      // biome-ignore lint/a11y/noStaticElementInteractions: bare div is the propagation probe this test needs
      // biome-ignore lint/a11y/useKeyWithClickEvents: click-only probe — keyboard interaction is not under test
      <div onClick={() => (parentClicked = true)}>
        <ControlButtons controls={[makeControl({ onClick: handleClick })]} />
      </div>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
    expect(parentClicked).toBe(false)
  })

  test('renders label text', () => {
    render(<ControlButtons controls={[makeControl({ label: 'Use' })]} />)
    expect(screen.getByText('Use')).toBeTruthy()
  })

  test('falls back to ariaLabel when no label is set', () => {
    render(<ControlButtons controls={[makeControl({ label: undefined })]} />)
    expect(screen.getByText('Test action')).toBeTruthy()
  })

  test('applies custom className from control', () => {
    render(<ControlButtons controls={[makeControl({ className: 'my-custom' })]} />)
    const button = screen.getByRole('button')
    expect(button.className).toContain('my-custom')
  })

  test('compact renders smaller text', () => {
    render(<ControlButtons controls={[makeControl()]} compact />)
    const button = screen.getByRole('button')
    expect(button.innerHTML).toContain('text-label')
  })

  test('default size renders text-xs', () => {
    render(<ControlButtons controls={[makeControl()]} />)
    const button = screen.getByRole('button')
    expect(button.innerHTML).toContain('text-xs')
  })

  test('empty controls array renders nothing', () => {
    const { container } = render(<ControlButtons controls={[]} />)
    expect(container.innerHTML).toBe('')
  })

  test('hidden controls are not rendered', () => {
    const controls = [
      makeControl({ key: 'visible', ariaLabel: 'Visible', label: 'Visible' }),
      makeControl({ key: 'hidden', ariaLabel: 'Hidden', label: 'Hidden', hidden: true }),
    ]
    render(<ControlButtons controls={controls} />)
    expect(screen.getByLabelText('Visible')).toBeTruthy()
    expect(screen.queryByLabelText('Hidden')).toBeNull()
  })

  test('all-hidden controls renders nothing', () => {
    const { container } = render(<ControlButtons controls={[makeControl({ hidden: true })]} />)
    expect(container.innerHTML).toBe('')
  })

  test('disabled control renders with grey styling', () => {
    render(<ControlButtons controls={[makeControl({ disabled: true })]} />)
    const button = screen.getByRole('button')
    expect(button.className).toContain('cursor-not-allowed')
    expect(button.innerHTML).toContain('bg-su-grey-light')
  })

  test('disabled control does not fire onClick', () => {
    const handleClick = mock(() => {})
    render(<ControlButtons controls={[makeControl({ onClick: handleClick, disabled: true })]} />)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(0)
  })

  test('segmentText renders a secondary segment', () => {
    render(<ControlButtons controls={[makeControl({ segmentText: 'Mech' })]} />)
    expect(screen.getByText('Mech')).toBeTruthy()
    expect(screen.getByText('Test')).toBeTruthy()
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

  // Icon-only controls (design `.ctl`): an `icon` with no `label`/`segmentText`
  // renders a square icon button (the live-sheet per-card remove/swap cluster).
  const RemoveGlyph = ({ className }: { className?: string }) => (
    <svg className={className} data-testid="remove-glyph" aria-hidden="true" />
  )

  test('icon + no label renders an icon-only square button', () => {
    render(
      <ControlButtons
        controls={[
          makeControl({ label: undefined, ariaLabel: 'Remove Charge', icon: RemoveGlyph }),
        ]}
      />
    )
    const button = screen.getByLabelText('Remove Charge')
    // The accessible name comes from ariaLabel, not visible text.
    expect(button.textContent).toBe('')
    // Square chrome (not the segmented label pill).
    expect(button.className).toContain('h-8')
    expect(button.className).toContain('w-8')
    // The provided icon renders inside.
    expect(screen.getByTestId('remove-glyph')).toBeTruthy()
  })

  test('icon-only control keeps the 44px coarse-pointer tap floor', () => {
    render(
      <ControlButtons
        controls={[makeControl({ label: undefined, ariaLabel: 'Remove', icon: RemoveGlyph })]}
      />
    )
    const button = screen.getByLabelText('Remove')
    expect(button.className).toContain('min-h-11')
    expect(button.className).toContain('sm:min-h-0')
  })

  test('icon-only control fires onClick', () => {
    const handleClick = mock(() => {})
    render(
      <ControlButtons
        controls={[
          makeControl({
            label: undefined,
            ariaLabel: 'Remove',
            icon: RemoveGlyph,
            onClick: handleClick,
          }),
        ]}
      />
    )
    fireEvent.click(screen.getByLabelText('Remove'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  test('icon WITH a label keeps the segmented text button', () => {
    render(
      <ControlButtons
        controls={[makeControl({ label: 'Buy', ariaLabel: 'Buy', icon: RemoveGlyph })]}
      />
    )
    // Label present → not the icon-only path; the text still renders.
    expect(screen.getByText('Buy')).toBeTruthy()
    const button = screen.getByRole('button')
    expect(button.className).not.toContain('h-8')
  })
})
