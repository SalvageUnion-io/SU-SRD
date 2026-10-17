import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { Skeleton } from '../Skeleton'

describe('Skeleton', () => {
  test('exposes a loading status', () => {
    render(<Skeleton />)
    expect(screen.getByRole('status', { name: 'Loading' })).toBeTruthy()
  })

  test('mirrors the compact card density: the medium card’s band height', () => {
    const { container } = render(<Skeleton />)
    const band = container.querySelector<HTMLElement>('[role="status"] > div')
    expect(band?.style.minHeight).toBe('60px')
  })

  test('rows: a list of `count` Row ghosts under one status', () => {
    render(<Skeleton shape="rows" count={4} label="Loading the crew" />)
    const status = screen.getByRole('status', { name: 'Loading the crew' })
    expect(status.querySelectorAll('li')).toHaveLength(4)
  })

  test('row: one Row ghost', () => {
    render(<Skeleton shape="row" />)
    expect(
      screen.getByRole('status', { name: 'Loading' }).querySelectorAll('.su-ghost')
    ).toHaveLength(2)
  })

  test('tile: the art at 3:4', () => {
    render(<Skeleton shape="tile" />)
    const art = screen.getByRole('status').querySelector<HTMLElement>('.su-ghost')
    expect(art?.style.aspectRatio).toBe('3 / 4')
  })
})
