import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { useDisclosure } from '../useDisclosure'

function Fold({ defaultOpen }: { defaultOpen?: boolean | (() => boolean) }) {
  const fold = useDisclosure(defaultOpen)
  return (
    <>
      <button type="button" {...fold.toggleProps}>
        TOGGLE
      </button>
      <div id={fold.panelId} hidden={!fold.open} data-testid="panel">
        Panel
      </div>
    </>
  )
}

describe('useDisclosure', () => {
  test('starts shut, and its toggle names the panel it controls', () => {
    render(<Fold />)
    const button = screen.getByRole('button', { name: 'TOGGLE' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.getAttribute('aria-controls')).toBe(screen.getByTestId('panel').id)
    expect(screen.getByTestId('panel').hidden).toBe(true)
  })

  test('the toggle opens and shuts it', () => {
    render(<Fold />)
    const button = screen.getByRole('button', { name: 'TOGGLE' })
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByTestId('panel').hidden).toBe(false)
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })

  test('takes a default, or a lazy one', () => {
    const { unmount } = render(<Fold defaultOpen />)
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true')
    unmount()
    render(<Fold defaultOpen={() => true} />)
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true')
  })
})
