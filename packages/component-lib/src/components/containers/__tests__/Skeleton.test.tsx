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
})
