import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { DisplayCard } from '../DisplayCard'
import { resolveDisplayMode } from '../displayMode'

afterEach(cleanup)

describe('resolveDisplayMode', () => {
  test('maps modes onto the existing booleans', () => {
    expect(resolveDisplayMode('full', undefined, undefined)).toEqual({
      compact: false,
      listing: false,
    })
    expect(resolveDisplayMode('compact', undefined, undefined)).toEqual({
      compact: true,
      listing: false,
    })
    expect(resolveDisplayMode('head', undefined, undefined)).toEqual({
      compact: true,
      listing: true,
    })
  })

  test('explicit booleans take precedence over mode', () => {
    expect(resolveDisplayMode('head', false, false)).toEqual({
      compact: false,
      listing: false,
    })
    expect(resolveDisplayMode('full', true, undefined)).toEqual({
      compact: true,
      listing: false,
    })
  })

  test('defaults to full when nothing is provided', () => {
    expect(resolveDisplayMode(undefined, undefined, undefined)).toEqual({
      compact: false,
      listing: false,
    })
  })
})

describe('DisplayCard mode sugar', () => {
  test("mode='head' hides body and footer like listing", () => {
    render(
      <DisplayCard
        headerContent={<span>Header</span>}
        footerContent={<span>Foot</span>}
        mode="head"
      >
        <span>Body</span>
      </DisplayCard>
    )
    expect(screen.getByText('Header')).toBeTruthy()
    expect(screen.queryByText('Body')).toBeNull()
    expect(screen.queryByText('Foot')).toBeNull()
  })

  test("mode='full' renders body and footer", () => {
    render(
      <DisplayCard
        headerContent={<span>Header</span>}
        footerContent={<span>Foot</span>}
        mode="full"
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

describe('DisplayCard footActions / footMeta', () => {
  test('fold into the footer band alongside footerContent', () => {
    render(
      <DisplayCard
        headerContent={<span>H</span>}
        footerContent={<span>Source</span>}
        footActions={<button type="button">Repair</button>}
        footMeta={[{ label: 'AP Cost', value: 1 }]}
      >
        <span>Body</span>
      </DisplayCard>
    )
    expect(screen.getByText('Source')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Repair' })).toBeTruthy()
    expect(screen.getByText('AP Cost')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
  })

  test('force the foot band even without footerContent', () => {
    render(
      <DisplayCard headerContent={<span>H</span>} footActions={<button type="button">Use</button>}>
        <span>Body</span>
      </DisplayCard>
    )
    expect(screen.getByRole('button', { name: 'Use' })).toBeTruthy()
  })
})
