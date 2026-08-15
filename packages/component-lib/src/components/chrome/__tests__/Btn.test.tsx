import { describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Button } from '../Button'
import { buttonVariants } from '../buttonVariants'
import { DISABLED } from '../interaction'

/**
 * The class the recipe emits for one variant, isolated from the rest of its
 * output. Asserting on this rather than on a colour's spelling keeps these
 * tests about "which variant did Button pick" — which is what they are for —
 * and survives the rename that #799 just performed on every one of them.
 */
const variantClass = (variant: 'default' | 'primary' | 'ghost' | 'danger') =>
  buttonVariants({ variant })
    .split(' ')
    .find((c) => c.startsWith('su-btn--')) as string

type Size = 'full' | 'compact' | 'mini' | 'iconOnly'

/**
 * The same trick for the size axis, diffed against a DIFFERENT explicit size.
 *
 * It cannot use `size: undefined` as the baseline the way `variantClass` gets
 * away with a single call: omitting `size` falls back to the default rung
 * (`compact`), so the baseline would already contain the very class being
 * looked for and the diff would come back empty. Comparing two explicit sizes
 * leaves exactly the size rung, since the variant class is common to both.
 */
const sizeClass = (size: Size) => {
  const other: Size = size === 'iconOnly' ? 'full' : 'iconOnly'
  const baseline = new Set(buttonVariants({ size: other }).split(' '))
  return buttonVariants({ size })
    .split(' ')
    .find((c) => c.startsWith('su-btn--') && !baseline.has(c)) as string
}

describe('Button', () => {
  test('defaults to a paper/ink md button of type="button"', () => {
    render(<Button>Cancel</Button>)
    const btn = screen.getByRole('button', { name: 'Cancel' })
    expect(btn.getAttribute('type')).toBe('button')
    expect(btn.className).toContain(variantClass('default'))
  })

  test('primary variant is rust with white text', () => {
    render(<Button variant="primary">Create Pilot</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain(variantClass('primary'))
  })

  test('ghost variant is transparent', () => {
    render(<Button variant="ghost">Back</Button>)
    expect(screen.getByRole('button').className).toContain(variantClass('ghost'))
  })

  test('danger variant uses the status-bad fill', () => {
    render(<Button variant="danger">Delete</Button>)
    // status-bad, not a bespoke `danger` red: --color-danger was the third red
    // in a set that should have had one, and is retired. status-bad is the
    // sanctioned state token (ruleset §3.3).
    expect(screen.getByRole('button').className).toContain(variantClass('danger'))
  })

  test('compact and full rungs adjust padding/type scale', () => {
    render(<Button size="compact">Small</Button>)
    expect(screen.getByRole('button').className).toContain(sizeClass('compact'))
    cleanup()
    render(<Button size="full">Large</Button>)
    expect(screen.getByRole('button').className).toContain(sizeClass('full'))
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
