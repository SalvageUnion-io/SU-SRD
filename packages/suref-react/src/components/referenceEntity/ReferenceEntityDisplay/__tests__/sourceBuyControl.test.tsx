import { describe, test, expect, afterEach, spyOn } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from '../index'

/**
 * Sources carry a `purchaseLink` to the publisher's store. The display surfaces
 * it as a "Buy" header control — but only on the full card. Compact source cards
 * are wrapped in a navigation <a> by the list view, so a nested button there
 * would be invalid markup and would double-activate on click.
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

  test('compact card omits the Buy control', () => {
    render(<ReferenceEntityDisplay data={source} compact />)
    expect(screen.queryByRole('button', { name: /Buy/i })).toBeNull()
  })
})
