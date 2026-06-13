import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PickCard } from '../PickCard'
import { Sel } from '../Sel'
import { OptRow } from '../OptRow'
import { Stepper } from '../Stepper'

afterEach(cleanup)

describe('PickCard', () => {
  test('renders name, body and foot', () => {
    render(
      <PickCard name="Engineer" foot={<span>6 abilities</span>}>
        Fixers and tinkerers.
      </PickCard>
    )
    expect(screen.getByText('Engineer')).toBeTruthy()
    expect(screen.getByText('Fixers and tinkerers.')).toBeTruthy()
    expect(screen.getByText('6 abilities')).toBeTruthy()
  })

  test('selected shows the rust ring and Selected chip', () => {
    const { container } = render(<PickCard name="Engineer" selected onSelect={() => {}} />)
    expect(screen.getByText('Selected')).toBeTruthy()
    expect(container.firstElementChild!.className).toContain('shadow-[0_0_0_3px_var(--color-rust)]')
  })

  test('onSelect makes the card an accessible pressed button', () => {
    const onSelect = mock(() => {})
    render(<PickCard name="Engineer" onSelect={onSelect} />)
    const card = screen.getByRole('button')
    expect(card.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(card)
    expect(onSelect).toHaveBeenCalled()
    fireEvent.keyDown(card, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalledTimes(2)
  })
})

describe('Sel', () => {
  test('selection ring toggles without layout shift (box-shadow only)', () => {
    const { container, rerender } = render(
      <Sel selected={false}>
        <div>card</div>
      </Sel>
    )
    expect(container.firstElementChild!.className).not.toContain('shadow-[0_0_0_3px')
    rerender(
      <Sel selected>
        <div>card</div>
      </Sel>
    )
    expect(container.firstElementChild!.className).toContain('shadow-[0_0_0_3px')
  })

  test('onToggle makes the wrapper keyboard-operable', () => {
    const onToggle = mock(() => {})
    render(
      <Sel selected={false} onToggle={onToggle} ariaLabel="Engineering Expertise">
        <div>card</div>
      </Sel>
    )
    const wrapper = screen.getByRole('button', {
      name: 'Engineering Expertise',
    })
    fireEvent.keyDown(wrapper, { key: ' ' })
    expect(onToggle).toHaveBeenCalled()
  })
})

describe('OptRow', () => {
  test('renders name + clamped desc, active shows rust caret and inset bar', () => {
    render(<OptRow name="Iron Mongrel" desc="A reliable workhorse chassis." active />)
    expect(screen.getByText('Iron Mongrel')).toBeTruthy()
    expect(screen.getByText('▸')).toBeTruthy()
    expect(screen.getByRole('button').className).toContain(
      'shadow-[inset_3px_0_0_var(--color-rust)]'
    )
    expect(screen.getByRole('button').getAttribute('aria-current')).toBe('true')
  })

  test('inactive row has no caret', () => {
    render(<OptRow name="Iron Mongrel" />)
    expect(screen.queryByText('▸')).toBeNull()
  })
})

describe('Stepper', () => {
  const steps = ['Class', 'Abilities', 'Equipment', 'Review']

  test('marks the active step with aria-current and zero-pads numbers', () => {
    render(<Stepper steps={steps} active={1} />)
    const active = screen.getByText('Abilities').closest('button')!
    expect(active.getAttribute('aria-current')).toBe('step')
    expect(screen.getByText('01')).toBeTruthy()
    expect(screen.getByText('02')).toBeTruthy()
  })

  test('done steps are clickable when onStepClick provided; future steps are not', () => {
    const onStepClick = mock((i: number) => i)
    render(<Stepper steps={steps} active={2} onStepClick={onStepClick} />)
    fireEvent.click(screen.getByText('Class').closest('button')!)
    expect(onStepClick).toHaveBeenLastCalledWith(0)
    const future = screen.getByText('Review').closest('button')!
    expect(future.hasAttribute('disabled')).toBe(true)
  })
})
