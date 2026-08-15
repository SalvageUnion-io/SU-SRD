import { describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Button } from '../Button'
import { DISABLED } from '../interaction'

describe('Button', () => {
  test('defaults to a paper/ink md button of type="button"', () => {
    render(<Button>Cancel</Button>)
    const btn = screen.getByRole('button', { name: 'Cancel' })
    expect(btn.getAttribute('type')).toBe('button')
    expect(btn.className).toContain('bg-paper')
  })

  test('primary variant is rust with white text', () => {
    render(<Button variant="primary">Create Pilot</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('bg-rust')
    expect(btn.className).toContain('text-paper')
  })

  test('ghost variant is transparent', () => {
    render(<Button variant="ghost">Back</Button>)
    expect(screen.getByRole('button').className).toContain('bg-transparent')
  })

  test('danger variant uses the status-bad fill', () => {
    render(<Button variant="danger">Delete</Button>)
    // status-bad, not a bespoke `danger` red: --color-danger was the third red
    // in a set that should have had one, and is retired. status-bad is the
    // sanctioned state token (ruleset §3.3).
    expect(screen.getByRole('button').className).toContain('bg-status-bad')
  })

  test('compact and full rungs adjust padding/type scale', () => {
    render(<Button size="compact">Small</Button>)
    expect(screen.getByRole('button').className).toContain('text-xs')
    cleanup()
    render(<Button size="full">Large</Button>)
    expect(screen.getByRole('button').className).toContain('text-lede')
  })

  test('disabled blocks clicks and fades', () => {
    const onClick = mock(() => {})
    render(
      <Button disabled onClick={onClick}>
        Nope
      </Button>
    )
    const btn = screen.getByRole('button')
    expect(btn.hasAttribute('disabled')).toBe(true)
    // Asserted against the exported constant rather than its spelling: the
    // vocabulary moved from Tailwind classes to `.su-*` names in #799, and a
    // test pinned to the spelling breaks on a rename that changes nothing.
    expect(btn.className).toContain(DISABLED)
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })
})
