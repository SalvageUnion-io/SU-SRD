import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from '../index'

/**
 * Source entities render the standard entity footer (display-name + source tag),
 * but — being self-referencing books — omit the placeholder page number.
 */
const source = SalvageUnionReference.Sources.find((e) => e.name === 'Salvage Union Workshop Manual')

afterEach(() => cleanup())

describe('source footer', () => {
  test('renders the footer with the "Source" display-name tag', () => {
    render(<ReferenceEntityDisplay data={source} />)
    expect(screen.getByText('Source')).toBeTruthy()
  })

  test('renders the source book tag (short, without the "Salvage Union" prefix)', () => {
    render(<ReferenceEntityDisplay data={source} />)
    expect(screen.getByText('Workshop Manual')).toBeTruthy()
  })

  test('omits the page number', () => {
    render(<ReferenceEntityDisplay data={source} />)
    expect(screen.queryByText(/^Page\b/i)).toBeNull()
  })
})
