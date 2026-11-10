/**
 * RuleBrief render tests: the untitled rule box opening every wizard step —
 * rule text and the citation under it, composed through Box.
 */

import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
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

  test('fold: a long rule folds to two lines on a phone, and its toggle opens it', () => {
    const long = 'Choose a class, then choose your first ability from its trees. '.repeat(3)
    render(<RuleBrief rule={long} fold />)
    const rule = screen.getByText(long.trim())
    expect(rule.classList.contains('su-wiz-rule--folded')).toBe(true)
    const toggle = screen.getByRole('button', { name: 'Read the rule' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(toggle)
    expect(rule.classList.contains('su-wiz-rule--folded')).toBe(false)
    expect(screen.getByRole('button', { name: 'Fold the rule' })).toBeTruthy()
  })

  test('fold: a short rule has nothing to fold', () => {
    render(<RuleBrief rule="Check the build, then create." fold />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
