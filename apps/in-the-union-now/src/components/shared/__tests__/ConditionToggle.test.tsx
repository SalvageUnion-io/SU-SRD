/**
 * Unit tests for ConditionToggle.
 *
 * Tests that:
 * - All three states render with correct labels
 * - Clicking cycles intact → damaged → destroyed → intact
 * - onChange fires with the correct next value
 * - Keyboard activation (Enter, Space) cycles the state
 */

import { describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen } from '@testing-library/react'

import type { ItemCondition } from '../ConditionToggle'
import { ConditionToggle } from '../ConditionToggle'

describe('ConditionToggle', () => {
  test('renders "Intact" label when value is intact', () => {
    const onChange = mock(() => {})
    render(<ConditionToggle value="intact" onChange={onChange} />)
    expect(screen.getByText('Intact')).toBeTruthy()
  })

  test('renders "Damaged" label when value is damaged', () => {
    const onChange = mock(() => {})
    render(<ConditionToggle value="damaged" onChange={onChange} />)
    expect(screen.getByText('Damaged')).toBeTruthy()
  })

  test('renders "Destroyed" label when value is destroyed', () => {
    const onChange = mock(() => {})
    render(<ConditionToggle value="destroyed" onChange={onChange} />)
    expect(screen.getByText('Destroyed')).toBeTruthy()
  })

  test('click on intact calls onChange with "damaged"', async () => {
    const onChange = mock(() => {})
    render(<ConditionToggle value="intact" onChange={onChange} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect((onChange.mock.calls[0] as ItemCondition[])[0]).toBe('damaged')
  })

  test('click on damaged calls onChange with "destroyed"', async () => {
    const onChange = mock(() => {})
    render(<ConditionToggle value="damaged" onChange={onChange} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect((onChange.mock.calls[0] as ItemCondition[])[0]).toBe('destroyed')
  })

  test('click on destroyed calls onChange with "intact"', async () => {
    const onChange = mock(() => {})
    render(<ConditionToggle value="destroyed" onChange={onChange} />)

    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect((onChange.mock.calls[0] as ItemCondition[])[0]).toBe('intact')
  })

  test('Enter key cycles from intact to damaged', async () => {
    const onChange = mock(() => {})
    render(<ConditionToggle value="intact" onChange={onChange} />)
    const button = screen.getByRole('button')

    await act(async () => {
      fireEvent.keyDown(button, { key: 'Enter' })
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect((onChange.mock.calls[0] as ItemCondition[])[0]).toBe('damaged')
  })

  test('Space key cycles from damaged to destroyed', async () => {
    const onChange = mock(() => {})
    render(<ConditionToggle value="damaged" onChange={onChange} />)
    const button = screen.getByRole('button')

    await act(async () => {
      fireEvent.keyDown(button, { key: ' ' })
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect((onChange.mock.calls[0] as ItemCondition[])[0]).toBe('destroyed')
  })

  test('other keys do not trigger onChange', async () => {
    const onChange = mock(() => {})
    render(<ConditionToggle value="intact" onChange={onChange} />)
    const button = screen.getByRole('button')

    await act(async () => {
      fireEvent.keyDown(button, { key: 'Tab' })
      fireEvent.keyDown(button, { key: 'Escape' })
    })

    expect(onChange).not.toHaveBeenCalled()
  })

  test('aria-label includes condition state', () => {
    const onChange = mock(() => {})
    render(<ConditionToggle value="intact" onChange={onChange} />)
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-label')).toContain('Intact')
  })

  test('aria-label includes prefix when ariaLabelPrefix is provided', () => {
    const onChange = mock(() => {})
    render(<ConditionToggle value="damaged" onChange={onChange} ariaLabelPrefix="Heavy Blaster" />)
    const button = screen.getByRole('button')
    expect(button.getAttribute('aria-label')).toContain('Heavy Blaster')
    expect(button.getAttribute('aria-label')).toContain('Damaged')
  })
})
