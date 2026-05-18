/**
 * Tests for PilotStandIn and CrawlerPilotsStandIn placeholder components.
 *
 * AC-4: dumb display components with correct placeholder text and no
 * entityStore access.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'

import { PilotStandIn } from '../PilotStandIn'
import { CrawlerPilotsStandIn } from '../CrawlerPilotsStandIn'

describe('PilotStandIn', () => {
  test('renders "No Pilot Assigned" text', () => {
    render(<PilotStandIn />)
    expect(screen.getByText('No Pilot Assigned')).toBeTruthy()
  })

  test('has accessible aria-label', () => {
    render(<PilotStandIn />)
    expect(screen.getByLabelText('No pilot assigned')).toBeTruthy()
  })

  test('accepts and applies a className prop', () => {
    render(<PilotStandIn className="my-custom-class" />)
    const el = screen.getByLabelText('No pilot assigned')
    expect(el.className).toContain('my-custom-class')
  })
})

describe('CrawlerPilotsStandIn', () => {
  test('renders "No Pilots Assigned" text', () => {
    render(<CrawlerPilotsStandIn />)
    expect(screen.getByText('No Pilots Assigned')).toBeTruthy()
  })

  test('has accessible aria-label', () => {
    render(<CrawlerPilotsStandIn />)
    expect(screen.getByLabelText('No pilots assigned')).toBeTruthy()
  })

  test('accepts and applies a className prop', () => {
    render(<CrawlerPilotsStandIn className="another-class" />)
    const el = screen.getByLabelText('No pilots assigned')
    expect(el.className).toContain('another-class')
  })
})
