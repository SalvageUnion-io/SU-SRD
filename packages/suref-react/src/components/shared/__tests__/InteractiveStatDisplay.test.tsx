import { describe, test, expect, mock, afterEach } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { InteractiveStatDisplay } from '../InteractiveStatDisplay'

describe('InteractiveStatDisplay', () => {
  afterEach(cleanup)
  test('renders label and value/max', () => {
    render(<InteractiveStatDisplay label="HP" value={8} max={10} onChange={() => {}} />)
    expect(screen.getByText('HP')).toBeTruthy()
    expect(screen.getByText('8')).toBeTruthy()
    expect(screen.getByText('10')).toBeTruthy()
  })

  test('decrement button calls onChange with value - 1', () => {
    const onChange = mock(() => {})
    render(<InteractiveStatDisplay label="HP" value={8} max={10} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Decrease HP'))
    expect(onChange).toHaveBeenCalledWith(7)
  })

  test('increment button calls onChange with value + 1', () => {
    const onChange = mock(() => {})
    render(<InteractiveStatDisplay label="HP" value={8} max={10} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Increase HP'))
    expect(onChange).toHaveBeenCalledWith(9)
  })

  test('decrement button disabled at min', () => {
    const onChange = mock(() => {})
    render(<InteractiveStatDisplay label="HP" value={0} max={10} onChange={onChange} />)
    const btn = screen.getByLabelText('Decrease HP')
    expect(btn.getAttribute('disabled')).toBe('')
    fireEvent.click(btn)
    expect(onChange).not.toHaveBeenCalled()
  })

  test('increment button disabled at max', () => {
    const onChange = mock(() => {})
    render(<InteractiveStatDisplay label="HP" value={10} max={10} onChange={onChange} />)
    const btn = screen.getByLabelText('Increase HP')
    expect(btn.getAttribute('disabled')).toBe('')
    fireEvent.click(btn)
    expect(onChange).not.toHaveBeenCalled()
  })

  test('respects custom min', () => {
    const onChange = mock(() => {})
    render(<InteractiveStatDisplay label="Heat" value={3} max={10} min={3} onChange={onChange} />)
    const btn = screen.getByLabelText('Decrease Heat')
    expect(btn.getAttribute('disabled')).toBe('')
  })

  test('read-only mode when no onChange provided', () => {
    render(<InteractiveStatDisplay label="SP" value={5} max={20} />)
    expect(screen.getByText('SP')).toBeTruthy()
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('20')).toBeTruthy()
    expect(screen.queryByLabelText('Decrease SP')).toBeNull()
    expect(screen.queryByLabelText('Increase SP')).toBeNull()
  })

  test('disabled mode hides buttons', () => {
    render(<InteractiveStatDisplay label="EP" value={3} max={6} onChange={() => {}} disabled />)
    expect(screen.queryByLabelText('Decrease EP')).toBeNull()
    expect(screen.queryByLabelText('Increase EP')).toBeNull()
  })

  test('disabled mode applies opacity', () => {
    const { container } = render(
      <InteractiveStatDisplay label="EP" value={3} max={6} onChange={() => {}} disabled />
    )
    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('opacity-40')
  })

  test('clamps decrement to min', () => {
    const onChange = mock(() => {})
    render(<InteractiveStatDisplay label="HP" value={1} max={10} min={0} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Decrease HP'))
    expect(onChange).toHaveBeenCalledWith(0)
  })

  test('clamps increment to max', () => {
    const onChange = mock(() => {})
    render(<InteractiveStatDisplay label="HP" value={9} max={10} onChange={onChange} />)
    fireEvent.click(screen.getByLabelText('Increase HP'))
    expect(onChange).toHaveBeenCalledWith(10)
  })
})
