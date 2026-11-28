import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { Grid } from '../Grid'

describe('Grid', () => {
  test('sets its narrowest item as --su-grid-min, its gap a space step', () => {
    const { container } = render(
      <Grid min="26rem" gap={32}>
        <div />
      </Grid>
    )
    const grid = container.firstElementChild as HTMLElement
    expect(grid.className).toBe('su-grid')
    expect(grid.dataset.gap).toBe('32')
    expect(grid.style.getPropertyValue('--su-grid-min')).toBe('26rem')
  })

  test('caps a row at max items', () => {
    const { container } = render(
      <Grid min="12rem" max={3} gap={12}>
        <div />
      </Grid>
    )
    const grid = container.firstElementChild as HTMLElement
    expect(grid.style.getPropertyValue('--su-grid-max')).toBe('3')
  })

  test('keeps the caller style beside the measure', () => {
    const { container } = render(
      <Grid min="18rem" gap={16} style={{ alignItems: 'start' }}>
        <div />
      </Grid>
    )
    const grid = container.firstElementChild as HTMLElement
    expect(grid.style.alignItems).toBe('start')
    expect(grid.style.getPropertyValue('--su-grid-min')).toBe('18rem')
  })
})
