/**
 * CrawlerBuilder responsive layout tests.
 *
 * The builder sits on the shared WizShell skeleton (design §3.2): a 196px
 * stepper rail beside the panes on desktop (lg:flex-row), stacked full-width
 * with a horizontal stepper on mobile. Asserts the responsive scaffolding is
 * present on initial render.
 *
 * Conventions:
 *  - toBeTruthy() not toBeInTheDocument()
 *  - No mock.module()
 *  - className string assertions for layout classes (happy-dom has no layout engine)
 */

import { act, render } from '@testing-library/react'
import { beforeAll, describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { CrawlerBuilder } from '../CrawlerBuilder'

beforeAll(async () => {
  // The builder preloads these on mount; warming the cache here lets the
  // act() flush below absorb the resulting state update.
  await SalvageUnionReference.preload(['crawler-tech-levels', 'systems', 'crawler-bays'])
})

async function renderBuilder() {
  const result = render(<CrawlerBuilder onComplete={() => {}} onCancel={() => {}} />)
  // Flush the mount-effect preload chain so its setState lands inside act.
  await act(async () => {})
  return result
}

describe('CrawlerBuilder — responsive wizard layout', () => {
  test('renders the WizShell row layout (stacked on mobile, rail beside panes at lg)', async () => {
    const { container } = await renderBuilder()
    const shell = container.querySelector('[class*="lg:flex-row"]')
    expect(shell).toBeTruthy()
  })

  test('renders a stepper navigation rail', async () => {
    const { container } = await renderBuilder()
    const stepper = container.querySelector('nav[aria-label="Steps"]')
    expect(stepper).toBeTruthy()
  })
})
