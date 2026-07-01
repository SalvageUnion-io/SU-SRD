import { describe, test, expect, afterEach } from 'bun:test'
import type { ReactElement } from 'react'
import { render, screen, cleanup } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from '../index'
import { EntityExternalLinkProvider } from '../entityHrefContext'
import type { EntityExternalLinkBuilder } from '../entityHrefContext'

/**
 * The app-supplied external cross-link (EntityExternalLinkProvider — e.g.
 * ITUN's "View in SRD →") renders in the foot band of FULL entity cards only.
 * Compact and listing cards stay uncluttered; without a provider nothing
 * renders (suref-web's case).
 */
const chassis = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')

const externalLink: EntityExternalLinkBuilder = (entity) => (
  <a href={`https://example.test/${'id' in entity ? entity.id : ''}`}>View in SRD →</a>
)

function renderWithProvider(ui: ReactElement) {
  return render(<EntityExternalLinkProvider value={externalLink}>{ui}</EntityExternalLinkProvider>)
}

afterEach(() => cleanup())

describe('external cross-link footer', () => {
  test('full display renders the app-supplied link in the foot band', () => {
    renderWithProvider(<ReferenceEntityDisplay data={chassis as unknown as SURefEntity} />)
    expect(screen.getByText('View in SRD →')).toBeTruthy()
  })

  test('compact display omits the link', () => {
    renderWithProvider(<ReferenceEntityDisplay data={chassis as unknown as SURefEntity} compact />)
    expect(screen.queryByText('View in SRD →')).toBeNull()
  })

  test('listing display omits the link', () => {
    renderWithProvider(
      <ReferenceEntityDisplay data={chassis as unknown as SURefEntity} compact listing />
    )
    expect(screen.queryByText('View in SRD →')).toBeNull()
  })

  test('renders nothing without a provider', () => {
    render(<ReferenceEntityDisplay data={chassis as unknown as SURefEntity} />)
    expect(screen.queryByText('View in SRD →')).toBeNull()
  })
})
