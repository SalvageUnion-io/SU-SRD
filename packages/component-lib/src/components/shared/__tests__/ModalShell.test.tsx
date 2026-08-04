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

  test('title is included in an sr-only element for accessibility', () => {
    render(
      <ModalShell open={true} onOpenChange={() => {}} title="Accessible Title">
        <p>Content</p>
      </ModalShell>
    )
    // Dialog.Title renders with sr-only — it's in document.body (portaled)
    const srOnlyEls = document.body.querySelectorAll('.sr-only')
    const titleEl = Array.from(srOnlyEls).find((el) => el.textContent === 'Accessible Title')
    expect(titleEl).toBeTruthy()
  })
})
