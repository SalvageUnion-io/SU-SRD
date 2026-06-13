import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityDisplay } from '../index'

/**
 * Phase-1 EntityCard extension tests (beta plan 1.2): mode sugar, status
 * badge (supersets damaged), expand slot, auto type-label tag,
 * footActions/footMeta — all opt-in, driven by real reference entities.
 */

const system = SalvageUnionReference.Systems.all()[0]
const equipment = SalvageUnionReference.Equipment.find((e) => e.name === 'Rifle')

afterEach(cleanup)

describe('fixtures', () => {
  test('resolve', () => {
    expect(system).toBeDefined()
    expect(equipment).toBeDefined()
  })
})

describe('mode sugar', () => {
  test("mode='head' renders header-only (no body content)", () => {
    const { container } = render(<ReferenceEntityDisplay data={system} mode="head" />)
    expect(screen.getByText(system!.name)).toBeTruthy()
    // listing mode renders no white body box
    expect(container.querySelector('.bg-su-white.mx-3')).toBeNull()
  })

  test('explicit booleans still win over mode', () => {
    render(<ReferenceEntityDisplay data={system} mode="head" listing={false} />)
    // body renders because listing=false overrides head
    expect(screen.getByText(system!.name)).toBeTruthy()
  })
})

describe('status badge', () => {
  test('opt-in badge renders and cycles', () => {
    const onStatusClick = mock(() => {})
    render(
      <ReferenceEntityDisplay data={equipment} status="damaged" onStatusClick={onStatusClick} />
    )
    const badge = screen.getByText('Damaged')
    expect(badge).toBeTruthy()
    fireEvent.click(badge)
    expect(onStatusClick).toHaveBeenCalled()
  })

  test("status='damaged' supersets the damaged prop (grey header)", () => {
    render(<ReferenceEntityDisplay data={equipment} status="damaged" />)
    const header = screen.getByTestId('frame-header-container')
    expect(header.className).toContain('bg-su-grey')
  })

  test('no badge and no grey header by default', () => {
    render(<ReferenceEntityDisplay data={equipment} />)
    expect(screen.queryByText('Intact')).toBeNull()
    expect(screen.getByTestId('frame-header-container').className).not.toContain('bg-su-grey')
  })
})

describe('auto type-label tag', () => {
  // The source footer also prints the schema display name, so it is hidden
  // here to isolate the header tag.
  test('showTypeLabel appends the schema display name as a trailing tag', () => {
    render(<ReferenceEntityDisplay data={equipment} showTypeLabel hide={{ footer: true }} />)
    expect(screen.getByText('Equipment')).toBeTruthy()
  })

  test('typeLabel overrides the derived label', () => {
    render(<ReferenceEntityDisplay data={equipment} typeLabel="Pilot Gear" />)
    expect(screen.getByText('Pilot Gear')).toBeTruthy()
  })

  test('absent by default', () => {
    render(<ReferenceEntityDisplay data={system} hide={{ footer: true }} />)
    expect(screen.queryByText('System')).toBeNull()
  })
})

describe('expand slot', () => {
  test('renders arbitrary content between body and footer', () => {
    render(
      <ReferenceEntityDisplay data={equipment} expand={<div data-testid="expand-slot">Tree</div>} />
    )
    expect(screen.getByTestId('expand-slot')).toBeTruthy()
  })

  test('hidden in listing/head mode', () => {
    render(
      <ReferenceEntityDisplay
        data={equipment}
        mode="head"
        expand={<div data-testid="expand-slot">Tree</div>}
      />
    )
    expect(screen.queryByTestId('expand-slot')).toBeNull()
  })
})

describe('footActions / footMeta', () => {
  test('fold into the entity foot band', () => {
    render(
      <ReferenceEntityDisplay
        data={equipment}
        footActions={<button>Spend AP</button>}
        footMeta={[{ label: 'AP Cost', value: 1 }]}
      />
    )
    expect(screen.getByRole('button', { name: 'Spend AP' })).toBeTruthy()
    expect(screen.getByText('AP Cost')).toBeTruthy()
  })

  test('render the band even when the source footer is hidden', () => {
    render(
      <ReferenceEntityDisplay
        data={equipment}
        hide={{ footer: true }}
        footActions={<button>Use</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'Use' })).toBeTruthy()
    // source chrome stays suppressed
    expect(screen.queryByText(/Page/)).toBeNull()
  })
})
