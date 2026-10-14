/**
 * CrawlerReviewStep — the recap is label-first (ruleset §3.7): the type and
 * the tech level are Tokens, Structure is `SP | 20/20`, TL `TL | 1`, and each
 * Scrap tier `T1 | 3`, never value-first prose ("20 SP (starts at full)").
 */

import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EMPTY_CRAWLER_FORM_STATE } from '../../../lib/wizard/crawlerFormState'
import { CrawlerReviewStep } from '../CrawlerReviewStep'

const techLevel = SalvageUnionReference.CrawlerTechLevels.all().find((tl) => tl.techLevel === 1)
const exploratory = SalvageUnionReference.Crawlers.getByName('Exploratory')

describe('CrawlerReviewStep', () => {
  test('the recap reads as chips and Tokens, label first', () => {
    if (!techLevel || !exploratory) throw new Error('fixture missing')
    const { container } = render(
      <CrawlerReviewStep
        form={{
          ...EMPTY_CRAWLER_FORM_STATE,
          name: 'Tenacity',
          type: 'exploratory',
          scrapPool: { ...EMPTY_CRAWLER_FORM_STATE.scrapPool, tl1: 3 },
        }}
        techLevel={techLevel}
        selectedType={exploratory}
        systems={[]}
        bayCount={10}
        submitError={null}
      />
    )
    // What the eye reads: each name's kind is for screen readers only.
    const seen = container.cloneNode(true) as HTMLElement
    for (const hidden of seen.querySelectorAll('.su-sr-only')) hidden.remove()
    const text = (seen.textContent ?? '').replace(/\s+/g, '')
    expect(text).toContain('SP20/20')
    expect(text).toContain('TL1')
    expect(text).toContain('T13')
    expect(seen.textContent).not.toMatch(/starts at full|Tech Level|×/)
    // The type is a Token that opens it.
    const tokens = container.querySelectorAll('.su-entity-token')
    expect(Array.from(tokens).some((t) => t.textContent?.includes('Exploratory'))).toBe(true)
    expect(screen.getAllByText('Exploratory').length).toBeGreaterThan(0)
  })
})
