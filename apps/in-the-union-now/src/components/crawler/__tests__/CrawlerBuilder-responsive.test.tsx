/**
 * CrawlerBuilder responsive layout tests.
 *
 * The builder is a stepper wizard (mirroring MechBuilder/PilotWizard): a
 * left stepper rail beside a content column on desktop, stacked on mobile.
 * Asserts that responsive layout scaffolding is present on initial render.
 *
 * Conventions:
 *  - toBeTruthy() not toBeInTheDocument()
 *  - No mock.module()
 *  - className string assertions for layout classes (happy-dom has no layout engine)
 */

import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { CrawlerBuilder } from '../CrawlerBuilder'

describe('CrawlerBuilder — responsive wizard layout', () => {
  test('renders a responsive stepper + content grid on desktop', () => {
    const { container } = render(
      <CrawlerBuilder onCreated={() => undefined} onCancel={() => undefined} />
    )
    // The wizard shell uses a 2-column grid (stepper rail + content) at lg.
    const grid = container.querySelector('[class*="lg:grid-cols-"]')
    expect(grid).toBeTruthy()
  })

  test('renders a stepper navigation rail', () => {
    const { container } = render(
      <CrawlerBuilder onCreated={() => undefined} onCancel={() => undefined} />
    )
    const stepper = container.querySelector('nav[aria-label="Wizard steps"]')
    expect(stepper).toBeTruthy()
  })
})
