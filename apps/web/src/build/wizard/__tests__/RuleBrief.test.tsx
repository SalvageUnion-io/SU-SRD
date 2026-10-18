/**
 * RuleBrief render tests: the untitled rule box opening every wizard step —
 * rule text and the citation under it, composed through Box.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { RuleBrief } from '../RuleBrief'

describe('RuleBrief', () => {
  test('renders the rule text and the citation footer, with no title of its own', () => {
    render(
      <RuleBrief
        rule="Choose two pieces of Tech 1 Pilot Equipment."
        cite={{ source: 'Salvage Union Workshop Manual', page: [18, 19] }}
      />
    )
    expect(screen.queryByText('The Rule')).toBeNull()
    expect(screen.getByText('Choose two pieces of Tech 1 Pilot Equipment.')).toBeTruthy()
    expect(screen.getByText('Workshop Manual · pp.18–19')).toBeTruthy()
  })

  test('is a labelled region and omits the footer when no citation is given', () => {
    const { container } = render(<RuleBrief rule="Check the build, then create." />)
    expect(container.querySelector('section[aria-label="The rule"]')).toBeTruthy()
    expect(screen.getByText('Check the build, then create.')).toBeTruthy()
    expect(screen.queryByText(/Workshop Manual/i)).toBeNull()
  })
})
