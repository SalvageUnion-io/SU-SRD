/**
 * The stats step's chassis ability is the chassis's, nested in it: a
 * contentful Mini (N3, E19), its head then its full text, `[(CHASSIS)]`
 * naming the chassis; never a card or a Compact.
 */
import { describe, expect, it } from 'bun:test'
import { render } from '@testing-library/react'
import { MechStatsStep } from '../MechStatsStep'

describe('MechStatsStep chassis ability', () => {
  it('is a contentful Mini naming its chassis', () => {
    const { container } = render(<MechStatsStep chassisName="mule" />)
    const token = container.querySelector('.su-entity-mini[data-contentful]')
    expect(token?.querySelector('.su-entity-mini__head')?.textContent).toContain(
      'Integrated Cargo Bay'
    )
    const body = token?.querySelector('.su-entity-mini__body')?.textContent ?? ''
    expect(body).toContain('The Mule')
    expect(body).not.toContain('[(CHASSIS)]')
    expect(container.querySelector('.su-entity-compact')).toBeNull()
  })
})
