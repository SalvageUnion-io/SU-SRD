import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { Card } from '../Card'
import { displayBooleans, resolveCardDisplay } from '../displayMode'

describe('resolveCardDisplay', () => {
  test('size and extent are orthogonal — a small card can still be full', () => {
    expect(resolveCardDisplay({ size: 'small' })).toEqual({ size: 'small', extent: 'full' })
    expect(resolveCardDisplay({ size: 'small', extent: 'head' })).toEqual({
      size: 'small',
      extent: 'head',
    })
  })

  test('an unspecified card is the dominant solo rendering', () => {
    expect(resolveCardDisplay({})).toEqual({ size: 'large', extent: 'full' })
  })

  test('each axis defaults independently of the other', () => {
    expect(resolveCardDisplay({ size: 'medium' })).toEqual({ size: 'medium', extent: 'full' })
    expect(resolveCardDisplay({ extent: 'head' })).toEqual({ size: 'large', extent: 'head' })
  })

  test('displayBooleans projects back for layout', () => {
    expect(displayBooleans({ size: 'large', extent: 'full' })).toEqual({
      compact: false,
      listing: false,
    })
    expect(displayBooleans({ size: 'small', extent: 'head' })).toEqual({
      compact: true,
      listing: true,
    })
  })
})

describe('Card size/extent sugar', () => {
  test("extent='head' hides body and footer", () => {
    render(
      <Card headerContent={<span>Header</span>} footerContent={<span>Foot</span>} extent="head">
        <span>Body</span>
      </Card>
    )
    expect(screen.getByText('Header')).toBeTruthy()
    expect(screen.queryByText('Body')).toBeNull()
    expect(screen.queryByText('Foot')).toBeNull()
  })

  test("extent='full' renders body and footer", () => {
    render(
      <Card headerContent={<span>Header</span>} footerContent={<span>Foot</span>} extent="full">
        <span>Body</span>
      </Card>
    )
    expect(screen.getByText('Body')).toBeTruthy()
    expect(screen.getByText('Foot')).toBeTruthy()
  })
})
