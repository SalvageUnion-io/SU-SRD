/**
 * CrawlerBuilder responsive layout tests — Phase 4.
 *
 * Asserts that the desktop 2-pane (lg:flex-row) layout is present in the
 * CrawlerBuilder form wrapper, matching the MechBuilder pattern.
 *
 * Conventions:
 *  - toBeTruthy() not toBeInTheDocument()
 *  - No mock.module()
 *  - className string assertions for layout classes (happy-dom has no layout engine)
 */

import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { CrawlerBuilder } from '../CrawlerBuilder'

describe('CrawlerBuilder — responsive 2-pane layout', () => {
  test('form contains a lg:flex-row wrapper for desktop 2-pane layout', () => {
    const { container } = render(
      <CrawlerBuilder onCreated={() => undefined} onCancel={() => undefined} />
    )
    // The 2-pane wrapper should have lg:flex-row in its className
    const flexRow = container.querySelector('[class*="lg:flex-row"]')
    expect(flexRow).toBeTruthy()
  })

  test('form contains a capacity sidebar wrapper (lg:w-64)', () => {
    const { container } = render(
      <CrawlerBuilder onCreated={() => undefined} onCancel={() => undefined} />
    )
    // The right sidebar should have lg:w-64
    const sidebar = container.querySelector('[class*="lg:w-64"]')
    expect(sidebar).toBeTruthy()
  })

  test('capacity summary is rendered in the sidebar region', () => {
    const { container } = render(
      <CrawlerBuilder onCreated={() => undefined} onCancel={() => undefined} />
    )
    // The sidebar should contain an element labeled "Capacity"
    const capacityEl = container.querySelector('[aria-label="Capacity summary"]')
    expect(capacityEl).toBeTruthy()
  })
})
