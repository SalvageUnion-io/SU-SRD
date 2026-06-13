import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Btn } from '../Btn'

afterEach(cleanup)

describe('Btn', () => {
  test('defaults to a paper/ink md button of type="button"', () => {
    render(<Btn>Cancel</Btn>)
    const btn = screen.getByRole('button', { name: 'Cancel' })
    expect(btn.getAttribute('type')).toBe('button')
    expect(btn.className).toContain('bg-paper')
  })

  test('primary variant is rust with white text', () => {
    render(<Btn variant="primary">Create Pilot</Btn>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-rust')
    expect(btn.className).toContain('text-su-white')
  })

  test('ghost variant is transparent', () => {
    render(<Btn variant="ghost">Back</Btn>)
    expect(screen.getByRole('button').className).toContain('bg-transparent')
  })

  test('danger variant uses the danger fill', () => {
    render(<Btn variant="danger">Delete</Btn>)
    expect(screen.getByRole('button').className).toContain('bg-danger')
  })

  test('sm and lg sizes adjust padding/type scale', () => {
    render(<Btn size="sm">Small</Btn>)
    expect(screen.getByRole('button').className).toContain('text-xs')
    cleanup()
    render(<Btn size="lg">Large</Btn>)
    expect(screen.getByRole('button').className).toContain('text-[15px]')
  })

  test('disabled blocks clicks and fades', () => {
    const onClick = mock(() => {})
    render(
      <Btn disabled onClick={onClick}>
        Nope
      </Btn>
    )
    const btn = screen.getByRole('button')
    expect(btn.hasAttribute('disabled')).toBe(true)
    expect(btn.className).toContain('disabled:opacity-40')
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })
})
