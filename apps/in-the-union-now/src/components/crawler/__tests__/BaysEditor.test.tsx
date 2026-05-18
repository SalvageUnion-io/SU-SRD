import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, mock, test } from 'bun:test'

import { BaysEditor } from '../BaysEditor'

describe('BaysEditor', () => {
  test('shows empty state when no bays', () => {
    render(<BaysEditor bays={[]} onChange={() => undefined} />)
    expect(screen.getByText('No bays assigned yet.')).toBeDefined()
  })

  test('renders existing bays', () => {
    render(<BaysEditor bays={['pilot-001', 'mech-alpha']} onChange={() => undefined} />)
    expect(screen.getByText('pilot-001')).toBeDefined()
    expect(screen.getByText('mech-alpha')).toBeDefined()
  })

  test('adds a bay when Add Bay is clicked', () => {
    const onChange = mock(() => undefined)
    render(<BaysEditor bays={[]} onChange={onChange} />)

    const input = screen.getByLabelText('Bay entity slug')
    fireEvent.change(input, { target: { value: 'pilot-new' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Bay' }))

    expect(onChange).toHaveBeenCalledWith(['pilot-new'])
  })

  test('adds a bay when Enter is pressed in the input', () => {
    const onChange = mock(() => undefined)
    render(<BaysEditor bays={[]} onChange={onChange} />)

    const input = screen.getByLabelText('Bay entity slug')
    fireEvent.change(input, { target: { value: 'pilot-enter' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith(['pilot-enter'])
  })

  test('removes a bay by index when Remove is clicked', () => {
    const onChange = mock(() => undefined)
    render(<BaysEditor bays={['pilot-001', 'mech-alpha', 'pilot-002']} onChange={onChange} />)

    const removeButton = screen.getByRole('button', { name: 'Remove bay mech-alpha' })
    fireEvent.click(removeButton)

    expect(onChange).toHaveBeenCalledWith(['pilot-001', 'pilot-002'])
  })

  test('clears input after adding a bay', () => {
    render(<BaysEditor bays={[]} onChange={() => undefined} />)

    const input = screen.getByLabelText('Bay entity slug') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'pilot-new' } })
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Add Bay' }))
    })

    expect(input.value).toBe('')
  })

  test('does not call onChange when input is empty and Add Bay is clicked', () => {
    const onChange = mock(() => undefined)
    render(<BaysEditor bays={[]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add Bay' }))

    expect(onChange).not.toHaveBeenCalled()
  })

  test('bay list round-trips: add then remove returns to original', () => {
    let bays: string[] = ['existing-bay']
    const onChange = mock((newBays: string[]) => {
      bays = newBays
    })

    const { rerender } = render(<BaysEditor bays={bays} onChange={onChange} />)

    // Add a bay
    const input = screen.getByLabelText('Bay entity slug')
    fireEvent.change(input, { target: { value: 'new-bay' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Bay' }))
    expect(bays).toEqual(['existing-bay', 'new-bay'])

    // Rerender with new bays
    rerender(<BaysEditor bays={bays} onChange={onChange} />)

    // Remove the newly added bay
    const removeButton = screen.getByRole('button', { name: 'Remove bay new-bay' })
    fireEvent.click(removeButton)
    expect(bays).toEqual(['existing-bay'])
  })
})
