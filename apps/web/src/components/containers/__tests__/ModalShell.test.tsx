import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { ModalShell } from '../ModalShell'

describe('ModalShell', () => {
  test('renders title text when open', () => {
    render(
      <ModalShell open={true} onOpenChange={() => {}} title="My Modal">
        <p>Content</p>
      </ModalShell>
    )
    // Title appears in header (visible) and as sr-only Dialog.Title + Dialog.Description
    const allInstances = screen.getAllByText('My Modal')
    expect(allInstances.length).toBeGreaterThan(0)
  })

  test('renders children when open', () => {
    render(
      <ModalShell open={true} onOpenChange={() => {}} title="My Modal">
        <p>Modal content here</p>
      </ModalShell>
    )
    expect(screen.getByText('Modal content here')).toBeTruthy()
  })

  test('renders subtitle when provided', () => {
    render(
      <ModalShell open={true} onOpenChange={() => {}} title="My Modal" subtitle="Sub info">
        <p>Content</p>
      </ModalShell>
    )
    expect(screen.getByText('Sub info')).toBeTruthy()
  })

  test('does not render subtitle when not provided', () => {
    render(
      <ModalShell open={true} onOpenChange={() => {}} title="My Modal">
        <p>Content</p>
      </ModalShell>
    )
    expect(screen.queryByText('Sub info')).toBeNull()
  })

  test('calls onOpenChange when close button is clicked', () => {
    const onOpenChange = mock(() => {})
    render(
      <ModalShell open={true} onOpenChange={onOpenChange} title="Close Test">
        <p>Content</p>
      </ModalShell>
    )
    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)
    expect(onOpenChange).toHaveBeenCalled()
  })

  test('renders nothing visible when closed', () => {
    render(
      <ModalShell open={false} onOpenChange={() => {}} title="Hidden Modal">
        <p>Content</p>
      </ModalShell>
    )
    expect(screen.queryByText('Hidden Modal')).toBeNull()
    expect(screen.queryByText('Content')).toBeNull()
  })

  test('the title is said once: the visible heading names the dialog (r6 F8)', () => {
    render(
      <ModalShell open={true} onOpenChange={() => {}} title="Accessible Title">
        <p>Content</p>
      </ModalShell>
    )
    expect(screen.getAllByText('Accessible Title')).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Accessible Title' })).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'Accessible Title' })).toBeTruthy()
    expect(screen.getByRole('dialog').getAttribute('aria-describedby')).toBeNull()
  })

  test('a bare dialog, which draws its own frame, is named by a hidden title', () => {
    render(
      <ModalShell open={true} onOpenChange={() => {}} title="Bare Title" bare>
        <p>Content</p>
      </ModalShell>
    )
    const srOnly = Array.from(document.body.querySelectorAll<HTMLElement>('.su-sr-only'))
    expect(srOnly.filter((el) => el.textContent === 'Bare Title')).toHaveLength(1)
  })

  test('role="alertdialog" renders an alert dialog instead of a dialog', () => {
    render(
      <ModalShell open={true} onOpenChange={() => {}} title="Delete Mira Cole?" role="alertdialog">
        <p>This cannot be undone.</p>
      </ModalShell>
    )
    expect(screen.getByRole('alertdialog')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('description={null} leaves the description to the children', () => {
    render(
      <ModalShell open={true} onOpenChange={() => {}} title="Delete Mira Cole?" description={null}>
        <p>This cannot be undone.</p>
      </ModalShell>
    )
    // Only the visible heading carries the title; no hidden Description restates it.
    expect(screen.getAllByText('Delete Mira Cole?')).toHaveLength(1)
  })

  // Chrome K7: three widths, and no other.
  for (const [width, cap] of [
    ['narrow', '28rem'],
    ['default', '48rem'],
    ['page', '72rem'],
  ] as const) {
    test(`width="${width}" caps the popup at ${cap}`, () => {
      render(
        <ModalShell open={true} onOpenChange={() => {}} title="Width" width={width}>
          <p>Content</p>
        </ModalShell>
      )
      expect(screen.getByRole('dialog').style.maxWidth).toBe(cap)
    })
  }

  test('with no width, the popup is the default 48rem, an alertdialog too', () => {
    render(
      <ModalShell open={true} onOpenChange={() => {}} title="Confirm?" role="alertdialog">
        <p>Content</p>
      </ModalShell>
    )
    expect(screen.getByRole('alertdialog').style.maxWidth).toBe('48rem')
  })

  test('the popup takes no width class', () => {
    render(
      <ModalShell open={true} onOpenChange={() => {}} title="Width">
        <p>Content</p>
      </ModalShell>
    )
    expect(screen.getByRole('dialog').className).toBe('')
  })

  test('the danger band declares an ink ground for its ×; the pilot band does not (K1)', () => {
    const { unmount } = render(
      <ModalShell open={true} onOpenChange={() => {}} title="Delete" tone="danger">
        <p>Content</p>
      </ModalShell>
    )
    const danger = screen.getByRole('button', { name: 'Close' })
    expect(danger.closest('[data-ground]')?.getAttribute('data-ground')).toBe('ink')
    unmount()
    render(
      <ModalShell open={true} onOpenChange={() => {}} title="Edit">
        <p>Content</p>
      </ModalShell>
    )
    expect(screen.getByRole('button', { name: 'Close' }).closest('[data-ground]')).toBeNull()
  })
})
