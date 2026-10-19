import { describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { readPackageStylesheet } from '../../../styles/__tests__/packageStylesheet'
import { EntitySurfaceProvider } from '../../entity/EntitySurface'
import type { EntityLinkComponent } from '../../entity/entitySurfaceContext'
import { Button } from '../Button'
import { buttonVariants } from '../buttonVariants'
import { DISABLED } from '../interaction'
import { NextLabel } from '../NextLabel'

/**
 * The class the recipe emits for one variant, isolated from the rest of its
 * output. Asserting on this rather than on a colour's spelling keeps these
 * tests about "which variant did Button pick" — which is what they are for —
 * and survives a rename of every one of them.
 */
const variantClass = (variant: 'default' | 'primary' | 'ghost') =>
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

  test('on an ink ground the outlined button is the on-ink ghost, in CSS, never a prop', () => {
    render(<Button variant="ghost">Import</Button>)
    // The button carries no ground of its own (chrome K1)…
    expect(screen.getByRole('button').className).not.toContain('ink')
    // …the frame's `data-ground` recolours both outlined variants.
    const css = readPackageStylesheet().replace(/\s+/g, ' ')
    expect(css).toContain(
      "[data-ground='ink'] :is(.su-btn--default, .su-btn--ghost) { background-color: transparent;"
    )
  })

  test('there is no danger variant: no state colour fills a button (R9)', () => {
    // @ts-expect-error a destructive act is rust (`primary`) behind ConfirmDialog
    const cls = buttonVariants({ variant: 'danger' })
    expect(cls).not.toContain('su-btn--danger')
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
    // Asserted against the exported constant rather than its spelling: a test
    // pinned to the spelling breaks on a rename that changes nothing.
    expect(btn.className).toContain(DISABLED)
    fireEvent.click(btn)
    expect(onClick).not.toHaveBeenCalled()
  })

  describe('href: a link drawn as a button (ruleset §6.5)', () => {
    /** A stand-in router link: marks what it rendered. */
    function RouterLink({ children, ...rest }: ComponentProps<EntityLinkComponent>) {
      return (
        <a data-router="" {...rest}>
          {children}
        </a>
      )
    }

    test('is an anchor wearing the recipe, with no style of its own', () => {
      render(
        <Button href="/play/" variant="primary" size="mini">
          Play solo
        </Button>
      )
      const link = screen.getByRole('link', { name: 'Play solo' })
      expect(link.getAttribute('href')).toBe('/play/')
      expect(link.className).toContain(variantClass('primary'))
      expect(link.className).toContain(sizeClass('mini'))
      expect(link.getAttribute('style')).toBeNull()
      expect(link.hasAttribute('type')).toBe(false)
    })

    test("a root-relative href takes the surface's router link; a URL or a static page, an anchor", () => {
      render(
        <EntitySurfaceProvider value={{ linkAs: RouterLink }}>
          <Button href="/sheet/pilot/p1">Open</Button>
          <Button href="https://discord.com/x">Add</Button>
        </EntitySurfaceProvider>
      )
      expect(screen.getByRole('link', { name: 'Open' }).hasAttribute('data-router')).toBe(true)
      expect(screen.getByRole('link', { name: 'Add' }).hasAttribute('data-router')).toBe(false)
      cleanup()
      render(<Button href="/sheet/pilot/p1">Open</Button>)
      expect(screen.getByRole('link', { name: 'Open' }).hasAttribute('data-router')).toBe(false)
    })

    test('linkAs overrides the surface: a host outside it brings its own', () => {
      render(
        <EntitySurfaceProvider value={{ linkAs: RouterLink }}>
          <Button href="/build/sign-in" linkAs="a">
            Sign in
          </Button>
        </EntitySurfaceProvider>
      )
      expect(screen.getByRole('link', { name: 'Sign in' }).hasAttribute('data-router')).toBe(false)
    })

    test('back draws BackLabel at the Size: read "Back to <place>"', () => {
      render(
        <Button href="/" back size="compact">
          Hangar
        </Button>
      )
      const link = screen.getByRole('link', { name: 'Back to Hangar' })
      expect(link.textContent).toBe('Back to Hangar')
      expect(link.querySelector('svg')?.getAttribute('width')).toBe('14')
    })
  })

  test('NextLabel mirrors BackLabel: the place, then ChevronRight at the Size, read "Next: <place>"', () => {
    render(
      <Button size="full">
        <NextLabel to="Stats" size="full" />
      </Button>
    )
    const button = screen.getByRole('button', { name: 'Next: Stats' })
    // The visible name, then the glyph: no arrow character in the text (R23).
    expect(button.textContent).toBe('Next: Stats')
    expect(button.lastElementChild?.tagName.toLowerCase()).toBe('svg')
    expect(button.lastElementChild?.getAttribute('width')).toBe('18')
    expect(button.lastElementChild?.getAttribute('aria-hidden')).toBe('true')
  })
})
