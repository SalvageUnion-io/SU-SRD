/**
 * The stats step's chassis ability is the chassis's, nested in it: a
 * contentful Token (N3, E19), its head then its full text, `[(CHASSIS)]`
 * naming the chassis; never a card or a Row.
 */
import { describe, expect, it } from 'bun:test'
import { render } from '@testing-library/react'
import { MechStatsStep } from '../MechStatsStep'

describe('MechStatsStep chassis ability', () => {
  it('is a contentful Token naming its chassis', () => {
    const { container } = render(<MechStatsStep chassisName="mule" />)
    const token = container.querySelector('.su-entity-token[data-contentful]')
    expect(token?.querySelector('.su-entity-token__head')?.textContent).toContain(
      'Integrated Cargo Bay'
    )
    const body = token?.querySelector('.su-entity-token__body')?.textContent ?? ''
    expect(body).toContain('The Mule')
    expect(body).not.toContain('[(CHASSIS)]')
    expect(container.querySelector('.su-entity-row')).toBeNull()
  })
})
