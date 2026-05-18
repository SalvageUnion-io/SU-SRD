import { describe, it, expect } from 'bun:test'
import { render } from '@testing-library/react'
import { ViewInSRDLink } from '../ViewInSRDLink'

describe('ViewInSRDLink', () => {
  it('renders an anchor element with correct href', () => {
    const { container } = render(<ViewInSRDLink schemaName="chassis" slug="iron-mongrel" />)
    const link = container.querySelector('a')
    expect(link).toBeTruthy()
    expect(link?.href).toBe('https://salvageunion.io/schema/chassis/item/iron-mongrel')
  })

  it('opens in a new tab', () => {
    const { container } = render(<ViewInSRDLink schemaName="equipment" slug="armor-plating" />)
    const link = container.querySelector('a')
    expect(link?.target).toBe('_blank')
  })

  it('has correct security attributes', () => {
    const { container } = render(<ViewInSRDLink schemaName="abilities" slug="rapid-fire" />)
    const link = container.querySelector('a')
    expect(link?.rel).toBe('noopener noreferrer')
  })

  it('displays link text', () => {
    const { getByText } = render(<ViewInSRDLink schemaName="classes" slug="scrapyard-scrounger" />)
    expect(getByText('View in SRD →')).toBeTruthy()
  })

  it('accepts and applies custom className', () => {
    const { container } = render(
      <ViewInSRDLink schemaName="mech-systems" slug="comms-array" className="custom-class" />
    )
    const link = container.querySelector('a')
    expect(link?.className).toContain('custom-class')
  })
})
