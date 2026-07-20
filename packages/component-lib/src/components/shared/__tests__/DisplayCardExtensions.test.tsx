import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DisplayCard } from '../DisplayCard'
import { displayBooleans, resolveCardDisplay } from '../displayMode'

afterEach(cleanup)

describe('resolveCardDisplay', () => {
  test('size and extent are orthogonal — a small card can still be full', () => {
    expect(resolveCardDisplay({ size: 'small' })).toEqual({ size: 'small', extent: 'full' })
    expect(resolveCardDisplay({ size: 'small', extent: 'head' })).toEqual({
      size: 'small',
      extent: 'head',
    })
  })

  test('the legacy booleans project onto the axes', () => {
    expect(resolveCardDisplay({})).toEqual({ size: 'large', extent: 'full' })
    expect(resolveCardDisplay({ compact: true })).toEqual({ size: 'medium', extent: 'full' })
    expect(resolveCardDisplay({ listing: true })).toEqual({ size: 'medium', extent: 'head' })
  })

  test('an explicit size wins over the booleans', () => {
    expect(resolveCardDisplay({ size: 'large', compact: true })).toEqual({
      size: 'large',
      extent: 'full',
    })
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

describe('DisplayCard size/extent sugar', () => {
  test("extent='head' hides body and footer", () => {
    render(
      <DisplayCard
        headerContent={<span>Header</span>}
        footerContent={<span>Foot</span>}
        extent="head"
      >
        <span>Body</span>
      </DisplayCard>
    )
    expect(screen.getByText('Header')).toBeTruthy()
    expect(screen.queryByText('Body')).toBeNull()
    expect(screen.queryByText('Foot')).toBeNull()
  })

  test("extent='full' renders body and footer", () => {
    render(
      <DisplayCard
        headerContent={<span>Header</span>}
        footerContent={<span>Foot</span>}
        extent="full"
      >
        <span>Body</span>
      </DisplayCard>
    )
    expect(screen.getByText('Body')).toBeTruthy()
    expect(screen.getByText('Foot')).toBeTruthy()
  })
})

describe('DisplayCard status badge', () => {
  test('renders the opt-in Intact/Damaged/Destroyed badge', () => {
    render(
      <DisplayCard headerContent={<span>H</span>} status="destroyed">
        <span>Body</span>
      </DisplayCard>
    )
    expect(screen.getByText('Destroyed')).toBeTruthy()
  })

  test('no badge by default', () => {
    render(
      <DisplayCard headerContent={<span>H</span>}>
        <span>Body</span>
      </DisplayCard>
    )
    expect(screen.queryByText('Intact')).toBeNull()
  })

  test('onStatusClick makes the badge a cycle button', () => {
    const onStatusClick = mock(() => {})
    render(
      <DisplayCard headerContent={<span>H</span>} status="intact" onStatusClick={onStatusClick} />
    )
    fireEvent.click(screen.getByText('Intact'))
    expect(onStatusClick).toHaveBeenCalled()
  })
})

describe('DisplayCard expand slot', () => {
  test('renders after the body, hidden in listing mode', () => {
    render(
      <DisplayCard headerContent={<span>H</span>} expand={<span>Expanded</span>}>
        <span>Body</span>
      </DisplayCard>
    )
    expect(screen.getByText('Expanded')).toBeTruthy()
    cleanup()
    render(
      <DisplayCard headerContent={<span>H</span>} expand={<span>Expanded</span>} listing>
        <span>Body</span>
      </DisplayCard>
    )
    expect(screen.queryByText('Expanded')).toBeNull()
  })
})

describe('DisplayCard footMeta / footerContent', () => {
  test('fold into the footer band alongside footerContent', () => {
    render(
      <DisplayCard
        headerContent={<span>H</span>}
        footerContent={<span>Source</span>}
        footMeta={[{ label: 'AP Cost', value: 1 }]}
      >
        <span>Body</span>
      </DisplayCard>
    )
    expect(screen.getByText('Source')).toBeTruthy()
    expect(screen.getByText('AP Cost')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
  })

  test('footMeta alone renders the foot band', () => {
    render(
      <DisplayCard headerContent={<span>H</span>} footMeta={[{ label: 'Slots', value: 2 }]}>
        <span>Body</span>
      </DisplayCard>
    )
    expect(screen.getByText('Slots')).toBeTruthy()
  })
})
