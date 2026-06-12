import { describe, test, expect, afterEach, spyOn } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from '../index'

/**
 * Sources carry a `purchaseLink` to the publisher's store. The display surfaces
 * it as a "Buy" header control on both the full and compact cards. Clicking it
 * opens the store and calls preventDefault, so it stays safe inside the schema
 * list view's wrapping navigation <a> (opens the store without navigating).
 */
const source = SalvageUnionReference.Sources.find((e) => e.name === 'Salvage Union Workshop Manual')
const purchaseLink =
  source && 'purchaseLink' in source && typeof source.purchaseLink === 'string'
    ? source.purchaseLink
    : undefined

afterEach(() => cleanup())

describe('source Buy control', () => {
  test('fixture resolves with a purchaseLink', () => {
    expect(source).toBeDefined()
    expect(purchaseLink).toContain('leyline.press')
  })

  test('full card renders a Buy control that opens the purchase link in a new tab', () => {
    const openSpy = spyOn(window, 'open').mockImplementation(() => null)
    try {
      render(<ReferenceEntityDisplay data={source} />)
      const buy = screen.getByRole('button', { name: /Buy Salvage Union Workshop Manual/i })
      expect(buy).toBeTruthy()
      fireEvent.click(buy)
      expect(openSpy).toHaveBeenCalledTimes(1)
      expect(openSpy).toHaveBeenCalledWith(purchaseLink, '_blank', 'noopener,noreferrer')
    } finally {
      openSpy.mockRestore()
    }
  })

  test('compact card also renders the Buy control', () => {
    const openSpy = spyOn(window, 'open').mockImplementation(() => null)
    try {
      render(<ReferenceEntityDisplay data={source} compact />)
      const buy = screen.getByRole('button', { name: /Buy Salvage Union Workshop Manual/i })
      fireEvent.click(buy)
      expect(openSpy).toHaveBeenCalledWith(purchaseLink, '_blank', 'noopener,noreferrer')
    } finally {
      openSpy.mockRestore()
    }
  })

  test('clicking the Buy control prevents the default action (safe inside a wrapping <a>)', () => {
    const openSpy = spyOn(window, 'open').mockImplementation(() => null)
    try {
      render(<ReferenceEntityDisplay data={source} compact />)
      const buy = screen.getByRole('button', { name: /Buy Salvage Union Workshop Manual/i })
      // fireEvent.click returns false when a handler called preventDefault.
      const notCancelled = fireEvent.click(buy)
      expect(notCancelled).toBe(false)
    } finally {
      openSpy.mockRestore()
    }
  })
})
