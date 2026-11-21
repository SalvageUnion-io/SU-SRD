/**
 * UnknownItemLine (hard rule R11): a stored slug the reference does not know
 * still shows on the sheet, named by its slug and stamped "Unknown", with its
 * condition where it has one and, in Edit only, the one remove control.
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { UnknownItemLine } from '../UnknownItemLine'

describe('an item the reference does not know', () => {
  test('Read: its slug as its name, stamped Unknown, linking nowhere and not removable', () => {
    const onRemove = mock(() => undefined)
    render(<UnknownItemLine slug="lost-laser" schemaName="systems" readOnly onRemove={onRemove} />)
    expect(screen.getByText('lost-laser')).toBeTruthy()
    expect(screen.getByText('Unknown')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull()
  })

  test('Read: a damaged one still names its condition', () => {
    render(<UnknownItemLine slug="lost-laser" schemaName="systems" readOnly condition="damaged" />)
    expect(screen.getByText('Damaged')).toBeTruthy()
  })

  test('Edit: the condition steps and the ✕ removes it', () => {
    const onRemove = mock(() => undefined)
    const onConditionCycle = mock(() => undefined)
    render(
      <UnknownItemLine
        slug="lost-laser"
        schemaName="systems"
        readOnly={false}
        condition="intact"
        onConditionCycle={onConditionCycle}
        onRemove={onRemove}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /lost-laser status: Intact/ }))
    expect(onConditionCycle).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Remove lost-laser' }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  test('Edit: with no way to remove it here, no ✕ is drawn', () => {
    render(<UnknownItemLine slug="lost-laser" schemaName="abilities" readOnly={false} />)
    expect(screen.getByText('lost-laser')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull()
  })
})
