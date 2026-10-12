import { describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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

describe('Card status badge', () => {
  test('renders the opt-in Intact/Damaged/Destroyed badge', () => {
    render(
      <Card headerContent={<span>H</span>} status="destroyed">
        <span>Body</span>
      </Card>
    )
    expect(screen.getByText('Destroyed')).toBeTruthy()
  })

  test('no badge by default', () => {
    render(
      <Card headerContent={<span>H</span>}>
        <span>Body</span>
      </Card>
    )
    expect(screen.queryByText('Intact')).toBeNull()
  })

  test('onStatusClick makes the badge a cycle button', () => {
    const onStatusClick = mock(() => {})
    render(<Card headerContent={<span>H</span>} status="intact" onStatusClick={onStatusClick} />)
    fireEvent.click(screen.getByText('Intact'))
    expect(onStatusClick).toHaveBeenCalled()
  })
})

describe('Card expand slot', () => {
  test('renders after the body, hidden in listing mode', () => {
    render(
      <Card headerContent={<span>H</span>} expand={<span>Expanded</span>}>
        <span>Body</span>
      </Card>
    )
    expect(screen.getByText('Expanded')).toBeTruthy()
    cleanup()
    render(
      <Card headerContent={<span>H</span>} expand={<span>Expanded</span>} extent="head">
        <span>Body</span>
      </Card>
    )
    expect(screen.queryByText('Expanded')).toBeNull()
  })
})

describe('Card footMeta / footerContent', () => {
  test('fold into the footer band alongside footerContent', () => {
    render(
      <Card
        headerContent={<span>H</span>}
        footerContent={<span>Source</span>}
        footMeta={[{ label: 'AP Cost', value: 1 }]}
      >
        <span>Body</span>
      </Card>
    )
    expect(screen.getByText('Source')).toBeTruthy()
    expect(screen.getByText('AP Cost')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
  })

  test('footMeta alone renders the foot band', () => {
    render(
      <Card headerContent={<span>H</span>} footMeta={[{ label: 'Slots', value: 2 }]}>
        <span>Body</span>
      </Card>
    )
    expect(screen.getByText('Slots')).toBeTruthy()
  })
})
