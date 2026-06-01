import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { ReferenceEntityFooter } from '../ReferenceEntityFooter'

const baseProps = {
  footerDisplayName: 'Chassis',
  booklet: undefined,
  page: undefined,
  headerBg: 'bg-su-green',
  headerBgColor: undefined,
}

describe('ReferenceEntityFooter', () => {
  afterEach(cleanup)

  test('strips the "Salvage Union" prefix from the source label', () => {
    render(<ReferenceEntityFooter {...baseProps} source="Salvage Union Workshop Manual" />)
    expect(screen.getByText('Workshop Manual')).toBeTruthy()
    expect(screen.queryByText('Salvage Union Workshop Manual')).toBeNull()
  })

  test('leaves a non-prefixed source intact', () => {
    render(<ReferenceEntityFooter {...baseProps} source="Mech Monday" />)
    expect(screen.getByText('Mech Monday')).toBeTruthy()
  })

  test('appends the booklet in parentheses after the shortened source', () => {
    render(
      <ReferenceEntityFooter {...baseProps} source="Salvage Union Core Rulebook" booklet="Pilots" />
    )
    expect(screen.getByText('Core Rulebook (Pilots)')).toBeTruthy()
  })
})
