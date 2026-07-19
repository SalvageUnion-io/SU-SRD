/**
 * RuleBrief render tests (wizard-refresh Phase 2): the "THE RULE" poster
 * callout heading every wizard step — black stamp, rule text, and the accent
 * footer citation, all composed through SheetSectionCard.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { RuleBrief } from 'component-lib'

afterEach(cleanup)

describe('RuleBrief', () => {
  test('renders the THE RULE stamp, the rule text, and the citation footer', () => {
    render(
      <RuleBrief rule="Choose two pieces of Tech 1 Pilot Equipment." cite="Core Book · pp.18–19" />
    )
    expect(screen.getByText('The Rule')).toBeTruthy()
    expect(screen.getByText('Choose two pieces of Tech 1 Pilot Equipment.')).toBeTruthy()
    expect(screen.getByText('Core Book · pp.18–19')).toBeTruthy()
  })

  test('is a labelled region and omits the footer when no citation is given', () => {
    const { container } = render(<RuleBrief rule="Check the build, then create." />)
    expect(container.querySelector('section[aria-label="The rule"]')).toBeTruthy()
    expect(screen.getByText('Check the build, then create.')).toBeTruthy()
    expect(screen.queryByText(/Core Book/i)).toBeNull()
  })
})
